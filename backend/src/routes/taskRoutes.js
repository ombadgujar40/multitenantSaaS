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
    const { projectId, assignedToId, title, description, status, dueDate } = req.body;
    // Prefer trusted req.user, fallback to body
    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    const project = await prisma.project.findUnique({ where: { id: Number(projectId) } });
    if (!project) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "PROJECT_NOT_FOUND",
        actorRole: actor?.role || null,
        tenantId: null,
        resourceType: "TASK",
      });

      await createAudit({
        req,
        actorId: parseActorId(actor?.id),
        actorEmail: actor?.email || null,
        action: "TASK_CREATE",
        target: { projectId: Number(projectId) },
        metadata,
      });

      return res.status(400).json({ message: "Project does not exist" });
    }

    const createTask = await prisma.task.create({
      data: {
        projectId: Number(projectId),
        assignedToId: assignedToId ? Number(assignedToId) : null,
        title,
        description,
        status,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      },
    });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: project.orgId || null,
      resourceType: "TASK",
      resourceId: createTask.id,
      extra: { createdTaskTitle: createTask.title, assignedToId: createTask.assignedToId },
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "TASK_CREATE",
      target: { projectId: Number(projectId), taskId: createTask.id },
      metadata,
    });

    return res.status(201).json({ message: "task created successfully", createTask });
  } catch (error) {
    console.error("task register error:", error);
    await createErrorLog({
      eventType: "task_register_exception",
      severity: "CRITICAL",
      message: error?.message || "Unknown error in task register",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, body: req.body, route: "POST /tasks/register" },
    });
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
    const { id } = req.params;
    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    // read before delete to capture project/org context
    const before = await prisma.task.findUnique({ where: { id: Number(id) } });

    if (!before) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "TASK_NOT_FOUND",
        actorRole: actor?.role || null,
        tenantId: null,
        resourceType: "TASK",
      });

      await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "TASK_DELETE", target: { taskId: Number(id) }, metadata });
      return res.status(404).json({ message: "Task not found" });
    }

    await prisma.task.delete({ where: { id: Number(id) } });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: before?.project?.orgId || null,
      resourceType: "TASK",
      resourceId: Number(id),
      extra: { deletedTaskSnapshot: { id: before.id, title: before.title, status: before.status, assignedToId: before.assignedToId } },
    });

    await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "TASK_DELETE", target: { taskId: Number(id) }, metadata });

    return res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("deleteTasks Error:", error);
    await createErrorLog({
      eventType: "delete_task_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in deleteTasks",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, params: req.params, body: req.body },
    });
    return res.status(500).json({ message: "Server error" });
  }
};
