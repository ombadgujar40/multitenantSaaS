import { prisma } from "../config/prismaconfig.js";
import { v4 as uuidv4 } from "uuid";

/* -------------------
   Helpers (shared style)
   ------------------- */

function parseActorId(actorId) {
  if (actorId === undefined || actorId === null) return null;
  const n = Number(actorId);
  return Number.isInteger(n) ? n : null;
}

function getClientIp(req) {
  const xff = req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"]);
  if (xff) return String(xff).split(",")[0].trim();
  return req.ip || (req.connection && (req.connection.remoteAddress || null)) || null;
}

function buildMetadata(req, opts = {}) {
  return {
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    outcome: opts.outcome || null, // SUCCESS | FAILURE | DENIED
    outcomeReason: opts.outcomeReason || null,
    ip: getClientIp(req),
    userAgent: (req && req.headers && req.headers["user-agent"]) || null,
    requestId: (req && (req.id || (req.headers && req.headers["x-request-id"]))) || uuidv4(),
    actorRole: opts.actorRole || null,
    tenantId: opts.tenantId || null,
    resourceType: opts.resourceType || null,
    resourceId: opts.resourceId || null,
    extra: opts.extra || null,
  };
}

async function createErrorLog({ eventType, severity = "HIGH", message, tenantId = null, userId = null, payload = null }) {
  try {
    const created = await prisma.errorLog.create({
      data: {
        eventType,
        severity,
        message,
        tenantId: tenantId ? Number(tenantId) : null,
        userId: userId ? Number(userId) : null,
        payload,
      },
    });
    return created;
  } catch (err) {
    console.error("createErrorLog failed:", err);
    return null;
  }
}

async function createAudit({ req, actorId = null, actorEmail = null, action, target = null, metadata = {} }) {
  try {
    const actorInt = parseActorId(actorId);
    const audit = await prisma.auditLog.create({
      data: {
        actorId: actorInt,
        actorEmail: actorEmail || null,
        action,
        target: target || null,
        metadata,
      },
    });
    return audit;
  } catch (err) {
    console.error("createAudit failed:", err);
    // Attempt to write an error log about the audit failure
    try {
      await createErrorLog({
        eventType: "audit_log_error",
        severity: "HIGH",
        message: `Failed to write audit log for action=${action}`,
        tenantId: metadata?.tenantId || null,
        userId: parseActorId(actorId),
        payload: { error: err?.message || String(err), attemptedAudit: { actorId, actorEmail, action, target, metadata } },
      });
    } catch (e) {
      console.error("Failed to write error log after audit failure:", e);
    }
    return null;
  }
}

/* -----------------------
   Task controllers
   ----------------------- */


export const register = async (req, res) => {
  try {
    const {
      projectId,
      assignedToId,
      title,
      description,
      status,
      dueDate,
    } = req.body;

    // 1. Use the authenticated user's identity.
    const actor = req.user;

    if (!actor) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (actor.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can create tasks",
      });
    }

    const projectIdNum = Number(projectId);

    if (!Number.isInteger(projectIdNum) || projectIdNum <= 0) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    if (!title?.trim()) {
      return res.status(400).json({ message: "Task title is required" });
    }

    // 2. Find the project BEFORE accessing project.orgId.
    const project = await prisma.project.findUnique({
      where: { id: projectIdNum },
    });

    if (!project) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "PROJECT_NOT_FOUND",
        actorRole: actor.role,
        tenantId: actor.organisation || null,
        resourceType: "TASK",
      });

      await createAudit({
        req,
        actorId: parseActorId(actor.id),
        actorEmail: actor.email || null,
        action: "TASK_CREATE",
        target: { projectId: projectIdNum },
        metadata,
      });

      return res.status(404).json({
        message: "Project does not exist",
      });
    }

    // 3. Check that this customer owns the project.
    if (!project.customerId) {
      return res.status(400).json({
        message: "This project has no associated customer",
      });
    }

    if (Number(project.customerId) !== Number(actor.id)) {
      return res.status(403).json({
        message: "You cannot create tasks for another customer's project",
      });
    }

    // 4. Validate the selected employee.
    let employeeId = null;

    if (
      assignedToId !== undefined &&
      assignedToId !== null &&
      assignedToId !== ""
    ) {
      employeeId = Number(assignedToId);

      if (!Number.isInteger(employeeId) || employeeId <= 0) {
        return res.status(400).json({
          message: "Invalid employee ID",
        });
      }

      const employee = await prisma.employee.findFirst({
        where: {
          id: employeeId,
          orgId: project.orgId,
          role: "employee",
        },
        select: { id: true },
      });

      if (!employee) {
        return res.status(400).json({
          message: "Employee does not belong to this project organization",
        });
      }
    }

    // 5. Create the task and add the employee to the existing
    //    project chatroom in one database transaction.
    const createTask = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId: projectIdNum,
          assignedToId: employeeId,
          title: title.trim(),
          description: description || null,
          status: status || "pending",
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });

      // If no employee was selected, the customer owns the task.
      if (employeeId !== null) {
        const chatGroup = await tx.chatGroup.findUnique({
          where: { projectId: projectIdNum },
        });

        if (!chatGroup) {
          throw new Error("PROJECT_CHAT_GROUP_NOT_FOUND");
        }

        // Do not create duplicate memberships.
        const existingMembership = await tx.groupMember.findFirst({
          where: {
            groupId: chatGroup.id,
            employeeId,
          },
          select: { id: true },
        });

        if (!existingMembership) {
          await tx.groupMember.create({
            data: {
              groupId: chatGroup.id,
              employeeId,
              role: "member",
            },
          });
        }
      }

      return task;
    });

    // 6. Keep the existing audit logging.
    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor.role,
      tenantId: project.orgId,
      resourceType: "TASK",
      resourceId: createTask.id,
      extra: {
        createdTaskTitle: createTask.title,
        assignedToId: createTask.assignedToId,
      },
    });

    await createAudit({
      req,
      actorId: parseActorId(actor.id),
      actorEmail: actor.email || null,
      action: "TASK_CREATE",
      target: {
        projectId: projectIdNum,
        taskId: createTask.id,
      },
      metadata,
    });

    return res.status(201).json({
      message: "Task created successfully",
      createTask,
    });
  } catch (error) {
    console.error("task register error:", error);

    await createErrorLog({
      eventType: "task_register_exception",
      severity: "CRITICAL",
      message: error?.message || "Unknown error in task register",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: {
        stack: error?.stack || null,
        body: req.body,
        route: "POST /tasks/register",
      },
    });

    if (error.message === "PROJECT_CHAT_GROUP_NOT_FOUND") {
      return res.status(409).json({
        message:
          "This project has no chatroom. Create or repair its chatroom before assigning employees.",
      });
    }

    return res.status(500).json({ message: "Server error" });
  }
};


export const getTasks = async (req, res) => {
  try {
    const { role } = req.query;
    const { organisation, id } = req.user || { organisation: req.query?.organisation || null, id: req.query?.id || null };
    const actor = req.user || { id: req.body?.actorId || null, role: req.query?.role || req.body?.actorRole || null, email: req.body?.actorEmail || null };

    if (role === "admin") {
      const resp = await prisma.task.findMany({
        where: { project: { orgId: Number(organisation) } },
        select: { id: true, title: true, description: true, status: true, createdAt: true, assignedToId: true, assignedTo: true, dueDate: true, projectId: true, project: true },
      });

      const metadata = buildMetadata(req, {
        outcome: "SUCCESS",
        actorRole: actor?.role || null,
        tenantId: organisation ? Number(organisation) : null,
        resourceType: "TASK",
        extra: { resultCount: resp.length },
      });

      await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "TASK_LIST", target: null, metadata });
      return res.status(200).send(resp);
    } else if (role === "employee") {
      const resp = await prisma.task.findMany({
        where: { assignedTo: { id: Number(id) } },
        select: { id: true, project: true, projectId: true, assignedTo: true, assignedToId: true, title: true, description: true, status: true, dueDate: true, createdAt: true },
      });

      const metadata = buildMetadata(req, {
        outcome: "SUCCESS",
        actorRole: actor?.role || null,
        tenantId: organisation ? Number(organisation) : null,
        resourceType: "TASK",
        extra: { resultCount: resp.length },
      });

      await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "TASK_LIST", target: null, metadata });
      return res.status(200).send(resp);
    } else if (role === "customer") {
      // customer role behaviour - currently returns tasks of customer if needed
      // here we return tasks where the project's org matches and customer's id matches assignedTo or project.customerId — adjust as per app logic
      const resp = await prisma.task.findMany({
        where: { project: { orgId: Number(organisation) } },
        select: { id: true, title: true, description: true, status: true, project: true, assignedTo: true, dueDate: true },
      });

      const metadata = buildMetadata(req, {
        outcome: "SUCCESS",
        actorRole: actor?.role || "customer",
        tenantId: organisation ? Number(organisation) : null,
        resourceType: "TASK",
        extra: { resultCount: resp.length },
      });

      await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "TASK_LIST", target: null, metadata });
      return res.status(200).send(resp);
    } else {
      const metadata = buildMetadata(req, {
        outcome: "DENIED",
        outcomeReason: "NO_ROLE",
        actorRole: actor?.role || null,
        tenantId: organisation ? Number(organisation) : null,
        resourceType: "TASK",
      });

      await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "TASK_LIST", target: null, metadata });
      return res.status(403).send("no role");
    }
  } catch (error) {
    console.error("getTasks Error:", error);
    await createErrorLog({
      eventType: "get_tasks_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in getTasks",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, query: req.query, body: req.body },
    });
    return res.status(500).json({ msg: error });
  }
};

export const getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { role, id } = req.user || { role: req.query?.role || null, id: req.query?.id || null };
    const actor = req.user || { id: req.body?.actorId || null, role: role || null, email: req.body?.actorEmail || null };

    if (role === "admin") {
      const resp = await prisma.task.findMany({
        where: { projectId: Number(projectId) },
        select: { id: true, title: true, description: true, status: true, project: true, assignedTo: true, dueDate: true },
      });

      const metadata = buildMetadata(req, {
        outcome: "SUCCESS",
        actorRole: actor?.role || null,
        tenantId: req.user?.organisation || null,
        resourceType: "TASK",
        extra: { resultCount: resp.length },
      });

      await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "TASK_PROJECT_LIST", target: { projectId: Number(projectId) }, metadata });
      return res.status(200).send(resp);
    } else if (role === "employee") {
      const resp = await prisma.task.findMany({
        where: { assignedTo: { id: Number(id) } },
        select: { id: true, project: true, projectId: true, assignedTo: true, assignedToId: true, title: true, description: true, status: true, dueDate: true, createdAt: true },
      });

      const metadata = buildMetadata(req, {
        outcome: "SUCCESS",
        actorRole: actor?.role || null,
        tenantId: req.user?.organisation || null,
        resourceType: "TASK",
        extra: { resultCount: resp.length },
      });

      await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "TASK_PROJECT_LIST", target: { projectId: Number(projectId) }, metadata });
      return res.status(200).send(resp);
    } else if (role === "customer") {
      const resp = await prisma.task.findMany({
        where: { projectId: Number(projectId) },
        select: { id: true, title: true, description: true, status: true, project: true, assignedTo: true, dueDate: true },
      });

      const metadata = buildMetadata(req, {
        outcome: "SUCCESS",
        actorRole: actor?.role || "customer",
        tenantId: req.user?.organisation || null,
        resourceType: "TASK",
        extra: { resultCount: resp.length },
      });

      await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "TASK_PROJECT_LIST", target: { projectId: Number(projectId) }, metadata });
      return res.status(200).send(resp);
    } else {
      const metadata = buildMetadata(req, {
        outcome: "DENIED",
        outcomeReason: "NO_ROLE",
        actorRole: actor?.role || null,
        tenantId: req.user?.organisation || null,
        resourceType: "TASK",
      });

      await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "TASK_PROJECT_LIST", target: { projectId: Number(projectId) }, metadata });
      return res.status(403).send("no role");
    }
  } catch (error) {
    console.error("getProjectTasks Error:", error);
    await createErrorLog({
      eventType: "get_project_tasks_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in getProjectTasks",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, params: req.params },
    });
    return res.status(500).json({ msg: error });
  }
};

export const updateTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    // Read before snapshot
    const before = await prisma.task.findUnique({ where: { id: Number(id) } });

    const updated = await prisma.task.update({
      where: { id: Number(id) },
      data: { status },
    });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: before?.project?.orgId || null,
      resourceType: "TASK",
      resourceId: updated.id,
      extra: { before: before ? { id: before.id, status: before.status, assignedToId: before.assignedToId } : null, after: { id: updated.id, status: updated.status } },
    });

    await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "TASK_UPDATE", target: { taskId: updated.id }, metadata });

    return res.json(updated);
  } catch (error) {
    console.error("updateTasks Error:", error);
    await createErrorLog({
      eventType: "update_task_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in updateTasks",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, params: req.params, body: req.body },
    });
    return res.status(500).json({ message: "Server error" });
  }
};


export const deleteTasks = async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    const actor = req.user;

    if (!actor || actor.role !== "customer") {
      return res.status(403).json({
        message: "Only customers can delete tasks",
      });
    }

    if (!Number.isInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const customerId = Number(actor.id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(401).json({
        message: "Invalid customer identity",
      });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            customerId: true,
            orgId: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (task.project.customerId !== customerId) {
      return res.status(403).json({
        message: "You cannot delete tasks from another customer's project",
      });
    }

    await prisma.task.delete({
      where: { id: taskId },
    });

    await createAudit({
      req,
      actorId: parseActorId(actor.id),
      actorEmail: actor.email || null,
      action: "TASK_DELETE",
      target: {
        taskId,
        projectId: task.projectId,
      },
      metadata: buildMetadata(req, {
        outcome: "SUCCESS",
        actorRole: actor.role,
        tenantId: task.project.orgId,
        resourceType: "TASK",
        resourceId: taskId,
      }),
    });

    return res.status(200).json({
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("deleteTasks Error:", error);

    await createErrorLog({
      eventType: "delete_task_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in deleteTasks",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: {
        stack: error?.stack || null,
        params: req.params,
      },
    });

    return res.status(500).json({
      message: "Failed to delete task",
    });
  }
};

