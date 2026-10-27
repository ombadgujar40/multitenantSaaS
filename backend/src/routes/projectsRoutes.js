import { prisma } from "../config/prismaconfig.js";
import { v4 as uuidv4 } from "uuid";
import { redisClient } from "../config/reddis.js";
import {
  customerStatsCacheHits,
  customerStatsCacheMisses,
  customerStatsRedisErrors,
  customerStatsDbQueries,
} from "../config/metrics.js";

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
    outcomeReason: opts.outcomeReason || null, // e.g., ORG_NOT_FOUND
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
   Project controllers
   ----------------------- */



export const register = async (req, res) => {
  try {
    // 1. Authenticate the customer.
    const { id: userId, role, organisation } = req.user || {};

    if (role !== "customer") {
      return res.status(403).json({
        message: "Only customers can create projects",
      });
    }

    const customerId = Number(userId);
    const orgId = Number(organisation);

    if (
      !Number.isInteger(customerId) ||
      customerId <= 0 ||
      !Number.isInteger(orgId) ||
      orgId <= 0
    ) {
      return res.status(401).json({
        message: "Invalid authenticated user or organization",
      });
    }

    const { name, description, dueDate } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Project name is required",
      });
    }

    let parsedDueDate = null;

    if (dueDate) {
      parsedDueDate = new Date(dueDate);

      if (Number.isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({
          message: "Invalid due date",
        });
      }
    }

    // 2. Verify the organization.
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return res.status(404).json({
        message: "Organization does not exist",
      });
    }

    // 3. Atomically create the project and its chatroom.
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: {
          id: customerId,
          orgId,
        },
        select: { id: true },
      });

      if (!customer) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      // Create project.
      const project = await tx.project.create({
        data: {
          orgId,
          customerId,
          name: name.trim(),
          description: description || null,
          dueDate: parsedDueDate,
        },
      });

      // Create one chatroom for this project.
      const chatGroup = await tx.chatGroup.create({
        data: {
          projectId: project.id,
          orgId,
          name: `${project.name} Chat`,
        },
      });

      // Add the customer as the project chat manager.
      await tx.groupMember.create({
        data: {
          groupId: chatGroup.id,
          customerId,
          role: "manager",
        },
      });

      // Add an initial system message.
      await tx.message.create({
        data: {
          groupId: chatGroup.id,
          senderId: customerId,
          senderType: "system",
          text: `Project chatroom created for "${project.name}".`,
        },
      });

      return { project, chatGroup };
    });

    // 4. Record the successful operation in your audit log.
    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: role,
      tenantId: orgId,
      resourceType: "PROJECT",
      resourceId: result.project.id,
      extra: {
        createdProjectName: result.project.name,
        chatGroupId: result.chatGroup.id,
      },
    });

    await createAudit({
      req,
      actorId: parseActorId(customerId),
      actorEmail: req.user?.email || null,
      action: "PROJECT_REGISTER",
      target: {
        projectId: result.project.id,
        chatGroupId: result.chatGroup.id,
      },
      metadata,
    });

    return res.status(201).json({
      message: "Project and project chatroom created successfully",
      createProject: result.project,
      chatGroup: result.chatGroup,
    });
  } catch (error) {
    if (error.message === "CUSTOMER_NOT_FOUND") {
      return res.status(403).json({
        message: "Customer does not belong to this organization",
      });
    }

    console.error("project register error:", error);

    await createErrorLog({
      eventType: "project_register_exception",
      severity: "CRITICAL",
      message: error?.message || "Unknown error in project register",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: {
        stack: error?.stack || null,
        body: req.body,
        route: "POST /projects/register",
      },
    });

    return res.status(500).json({
      message: "Server error",
    });
  }
};



export const getProjects = async (req, res) => {
  try {
    const { role, custId } = req.query;
    const { organisation, id } = req.user || { organisation: req.query?.organisation || null, id: req.query?.id || null };

    if (!role) {
      const metadata = buildMetadata(req, {
        outcome: "DENIED",
        outcomeReason: "MISSING_ROLE",
        actorRole: null,
        tenantId: organisation || null,
        resourceType: "PROJECT",
      });
      await createAudit({ req, actorId: null, actorEmail: null, action: "PROJECT_LIST", target: null, metadata });
      return res.status(400).json({ message: "Role required" });
    }

    switch (role) {
      case "admin": {
        const adminResp = await prisma.project.findMany({
          where: { orgId: organisation },
          select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true, deliverableLink: true, tasks: true, customer: true, dueDate: true },
        });

        const metadata = buildMetadata(req, {
          outcome: "SUCCESS",
          actorRole: role,
          tenantId: organisation || null,
          resourceType: "PROJECT",
          extra: { resultCount: adminResp.length },
        });

        await createAudit({ req, actorId: req.user?.id || null, actorEmail: req.user?.email || null, action: "PROJECT_LIST", target: null, metadata });
        return res.status(200).send(adminResp);
      }

      // case "customer": {
      // await new Promise(resolve => setTimeout(resolve, 5000));

      // const custResp = await prisma.project.findMany({
      //   where: { orgId: organisation, customerId: id },
      //   select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true, deliverableLink: true, dueDate: true },
      // });


      // const metadata = buildMetadata(req, {
      //   outcome: "SUCCESS",
      //   actorRole: role,
      //   tenantId: organisation || null,
      //   resourceType: "PROJECT",
      //   extra: { resultCount: custResp.length },
      // });

      // await createAudit({ req, actorId: id, actorEmail: req.user?.email || null, action: "PROJECT_LIST", target: null, metadata });

      // return res.status(200).send(custResp);        


      case "customer": {

        const custResp = await prisma.project.findMany({
          where: { orgId: organisation, customerId: id },
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            createdAt: true,
            orgId: true,
            org: true,
            deliverableLink: true,
            dueDate: true,
          },
        });


        const metadata = buildMetadata(req, {
          outcome: "SUCCESS",
          actorRole: role,
          tenantId: organisation || null,
          resourceType: "PROJECT",
          extra: { resultCount: custResp.length },
        });

        await createAudit({
          req,
          actorId: id,
          actorEmail: req.user?.email || null,
          action: "PROJECT_LIST",
          target: null,
          metadata,
        });

        return res.status(200).send(custResp);
      }

      // }

      default: {
        const metadata = buildMetadata(req, {
          outcome: "DENIED",
          outcomeReason: "UNAUTHORIZED_ACCESS",
          actorRole: role || null,
          tenantId: organisation || null,
          resourceType: "PROJECT",
        });
        await createAudit({ req, actorId: req.user?.id || null, actorEmail: req.user?.email || null, action: "PROJECT_LIST", target: null, metadata });
        return res.status(403).send("Unathourized Acess");
      }
    }
  } catch (error) {
    console.error("getProjects Error:", error);
    await createErrorLog({
      eventType: "get_projects_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in getProjects",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, query: req.query, body: req.body },
    });
    return res.status(500).json({ msg: error });
  }
};

export const getProjectsStats = async (req, res) => {
  try {
    const { role, status, custId } = req.query;
    const { organisation } = req.user || { organisation: req.query?.organisation || null };

    switch (role) {
      case "admin": {
        const adminResp = await prisma.project.findMany({
          where: { orgId: organisation, status: status },
          select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true },
        });

        const metadata = buildMetadata(req, {
          outcome: "SUCCESS",
          actorRole: role,
          tenantId: organisation || null,
          resourceType: "PROJECT",
          extra: { resultCount: adminResp.length },
        });

        await createAudit({ req, actorId: req.user?.id || null, actorEmail: req.user?.email || null, action: "PROJECT_STATS", target: null, metadata });
        return res.status(200).send(adminResp);
      }

      case "customer": {
        const custResp = await prisma.project.findMany({
          where: { orgId: organisation, customerId: custId },
          select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true, customerId: true },
        });

        const metadata = buildMetadata(req, {
          outcome: "SUCCESS",
          actorRole: role,
          tenantId: organisation || null,
          resourceType: "PROJECT",
          extra: { resultCount: custResp.length },
        });

        await createAudit({ req, actorId: req.user?.id || null, actorEmail: req.user?.email || null, action: "PROJECT_STATS", target: null, metadata });
        return res.status(200).send(custResp);
      }

      default: {
        const metadata = buildMetadata(req, {
          outcome: "DENIED",
          outcomeReason: "UNAUTHORIZED_ACCESS",
          actorRole: role || null,
          tenantId: organisation || null,
          resourceType: "PROJECT",
        });
        await createAudit({ req, actorId: req.user?.id || null, actorEmail: req.user?.email || null, action: "PROJECT_STATS", target: null, metadata });
        return res.status(403).send("Unathourized Acess");
      }
    }
  } catch (error) {
    console.error("getProjectsStats Error:", error);
    await createErrorLog({
      eventType: "get_projects_stats_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in getProjectsStats",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, query: req.query, body: req.body },
    });
    return res.status(500).json({ msg: error });
  }
};



export const getCustomerStats = async (req, res) => {
  const { id, organisation, role } = req.user || {};

  if (role !== "customer") {
    return res.status(403).json({
      message: "Customer access required",
    });
  }

  if (
    !Number.isInteger(id) ||
    !Number.isInteger(organisation)
  ) {
    return res.status(401).json({
      message: "Invalid customer identity",
    });
  }

  const cacheKey = `customerStats:org:${organisation}:customer:${id}`;

  try {
    // 1. Try Redis first.
    if (redisClient.isReady) {
      try {
        const cached = await redisClient.get(cacheKey);

        if (cached !== null) {
          res.set("X-Cache", "HIT");
          return res.status(200).json(JSON.parse(cached));
        }
      } catch (error) {
        console.error("Redis cache read failed:", error.message);
      }
    }

    // 2. Cache miss: query PostgreSQL.
    const baseWhere = {
      orgId: organisation,
      customerId: id,
    };

    const [active, completed, pending] = await Promise.all([
      prisma.project.count({
        where: { ...baseWhere, status: "active" },
      }),
      prisma.project.count({
        where: { ...baseWhere, status: "completed" },
      }),
      prisma.project.count({
        where: { ...baseWhere, status: "pending" },
      }),
    ]);

    const stats = { active, completed, pending };

    // 3. Cache for 30 seconds when Redis is available.
    if (redisClient.isReady) {
      try {
        await redisClient.set(cacheKey, JSON.stringify(stats), {
          EX: 30,
        });
      } catch (error) {
        console.error("Redis cache write failed:", error.message);
      }
    }

    res.set("X-Cache", "MISS");
    return res.status(200).json(stats);
  } catch (error) {
    console.error("getCustomerStats error:", error);
    return res.status(500).json({
      message: "Failed to retrieve customer project statistics",
    });
  }
};



export const updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, status, link, dueDate } = req.body;
    const { id } = req.user || {};

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (link !== undefined) updateData.deliverableLink = link;

    if (dueDate) {
      const d = new Date(dueDate);
      if (!isNaN(d)) updateData.dueDate = d.toISOString();
    }

    const updated = await prisma.project.update({
      where: { id: Number(projectId) },
      data: updateData,
    });

    await createAudit({
      req,
      actorId: id || null,
      actorEmail: req.user?.email || null,
      action: "PROJECT_UPDATE",
      target: { projectId: updated.id },
      metadata: buildMetadata(req, {
        outcome: "SUCCESS",
        resourceType: "PROJECT",
        resourceId: updated.id,
        tenantId: updated.orgId,
      }),
    });

    return res.json(updated);
  } catch (error) {
    console.error("updateProject Error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    // read before delete to capture org context
    const before = await prisma.project.findUnique({ where: { id: Number(id) } });

    await prisma.project.delete({ where: { id: Number(id) } });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: before?.orgId || null,
      resourceType: "PROJECT",
      resourceId: Number(id),
      extra: { deletedProjectSnapshot: before ? { id: before.id, name: before.name, status: before.status } : null },
    });

    await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "PROJECT_DELETE", target: { projectId: Number(id) }, metadata });

    return res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("deleteProject Error:", error);
    await createErrorLog({
      eventType: "delete_project_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in deleteProject",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, params: req.params, body: req.body },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

export const getProjectDetail = async (req, res) => {
  try {
    const { projId } = req.params;

    const resp = await prisma.project.findUnique({
      where: { id: Number(projId) },
      select: { tasks: true, createdAt: true, description: true, status: true, name: true, id: true, org: true },
    });

    if (!resp) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "PROJECT_NOT_FOUND",
        actorRole: req.user?.role || null,
        tenantId: null,
        resourceType: "PROJECT",
      });

      await createAudit({ req, actorId: req.user?.id || null, actorEmail: req.user?.email || null, action: "PROJECT_GET", target: { projectId: Number(projId) }, metadata });

      return res.status(404).json({ message: "Project not found" });
    }

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: req.user?.role || null,
      tenantId: resp.orgId || null,
      resourceType: "PROJECT",
      resourceId: resp.id,
    });

    await createAudit({ req, actorId: req.user?.id || null, actorEmail: req.user?.email || null, action: "PROJECT_GET", target: { projectId: resp.id }, metadata });

    return res.status(200).send(resp);
  } catch (error) {
    console.error("getProjectDetail Error:", error);
    await createErrorLog({
      eventType: "get_project_detail_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in getProjectDetail",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, params: req.params },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

export const handleAcceptProject = async (req, res) => {
  const rawId = req.params?.projectId;
  const projectId = Number(rawId);
  if (!rawId || Number.isNaN(projectId)) {
    console.error("INVALID PROJECT ID", {
      params: req.params,
      url: req.originalUrl,
    });

    return res.status(400).json({
      ok: false,
      message: "Invalid or missing projectId",
      params: req.params,
    });
  }
  try {
    // transaction to update project, create group, add members, add system message
    const result = await prisma.$transaction(async (tx) => {
      // Load project with customer and org info
      const project = await tx.project.findUnique({
        where: { id: projectId },
        include: { customer: true, org: true },
      });

      if (!project) {
        const metadata = buildMetadata(req, {
          outcome: "FAILURE",
          outcomeReason: "PROJECT_NOT_FOUND",
          actorRole: req.user?.role || null,
          tenantId: null,
          resourceType: "PROJECT",
        });
        await createAudit({ req, actorId: req.user?.id || null, actorEmail: req.user?.email || null, action: "PROJECT_ACTIVATE", target: { projectId }, metadata });
        throw new Error("Project not found");
      }

      // update project status -> active
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: { status: "active" },
      });

      // create chat group (one group per project)
      const group = await tx.chatGroup.create({
        data: {
          projectId: projectId,
          name: project.name,
          orgId: project.orgId,
        },
      });

      // add customer as member (if exists)
      if (project.customer) {
        await tx.groupMember.create({
          data: {
            groupId: group.id,
            customerId: project.customer.id,
            role: "member",
          },
        });
      }

      // add all org admins as members
      const admins = await tx.employee.findMany({
        where: { orgId: project.orgId, role: "admin" },
      });

      for (const admin of admins) {
        await tx.groupMember.create({
          data: {
            groupId: group.id,
            employeeId: admin.id,
            role: "admin",
          },
        });
      }

      // optional: create system message
      const sysMsg = await tx.message.create({
        data: {
          groupId: group.id,
          senderId: 0,
          senderType: "system",
          text: `Group "${group.name}" created for project.`,
        },
      });

      return { updatedProject, group, sysMsg };
    });

    // emit websocket event to notify clients (if helper available)
    if (req.app && req.app.get("emitGroupCreated")) {
      const emitGroupCreated = req.app.get("emitGroupCreated");
      emitGroupCreated(result.group);
    }

    // audit success
    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: req.user?.role || null,
      tenantId: result.updatedProject?.orgId || null,
      resourceType: "PROJECT",
      resourceId: result.updatedProject?.id,
      extra: { groupId: result.group?.id },
    });

    await createAudit({ req, actorId: req.user?.id || null, actorEmail: req.user?.email || null, action: "PROJECT_ACTIVATE", target: { projectId }, metadata });

    return res.json({ ok: true, project: result.updatedProject, group: result.group });
  } catch (error) {
    console.error("activate project error:", error);

    await createErrorLog({
      eventType: "activate_project_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in activate project",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, params: req.params },
    });

    return res.status(500).json({ ok: false, message: error.message || "Server error" });
  }
};
