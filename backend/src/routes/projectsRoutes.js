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
    const { name, description, dueDate } = req.body;
    const { id: userId, organisation } = req.user || { id: req.body?.actorId || null, organisation: req.body?.organisation || null };

    const org = await prisma.organization.findUnique({ where: { id: organisation } });
    if (!org) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "ORG_NOT_FOUND",
        actorRole: req.user?.role || null,
        tenantId: null,
        resourceType: "PROJECT",
      });

      await createAudit({
        req,
        actorId: parseActorId(userId),
        actorEmail: req.user?.email || null,
        action: "PROJECT_REGISTER",
        target: null,
        metadata,
      });

      return res.status(404).json({ message: "Organization does not exists" });
    }

    const createProject = await prisma.project.create({
      data: {
        orgId: organisation,
        customerId: userId,
        name,
        description,
        dueDate: new Date(dueDate).toISOString(),
      },
    });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: req.user?.role || null,
      tenantId: organisation,
      resourceType: "PROJECT",
      resourceId: createProject.id,
      extra: { createdProjectName: createProject.name },
    });

    await createAudit({
      req,
      actorId: parseActorId(userId),
      actorEmail: req.user?.email || null,
      action: "PROJECT_REGISTER",
      target: { projectId: createProject.id },
      metadata,
    });

    return res.status(201).json({ message: "project created successfully", createProject });
  } catch (error) {
    console.error("project register error:", error);
    await createErrorLog({
      eventType: "project_register_exception",
      severity: "CRITICAL",
      message: error?.message || "Unknown error in project register",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, body: req.body, route: "POST /projects/register" },
    });
    return res.status(500).json({ message: "Server error" });
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

      case "customer": {
        const custResp = await prisma.project.findMany({
          where: { orgId: organisation, customerId: id },
          select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true, deliverableLink: true, dueDate: true },
        });

        const metadata = buildMetadata(req, {
          outcome: "SUCCESS",
          actorRole: role,
          tenantId: organisation || null,
          resourceType: "PROJECT",
          extra: { resultCount: custResp.length },
        });

        await createAudit({ req, actorId: id, actorEmail: req.user?.email || null, action: "PROJECT_LIST", target: null, metadata });
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

export const updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { id, organisation } = req.user || { id: req.body?.actorId || null, organisation: req.body?.organisation || null };
    const { name, description, status, link, dueDate } = req.body;

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

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: req.user?.role || null,
      tenantId: updated.orgId || null,
      resourceType: "PROJECT",
      resourceId: updated.id,
      extra: { before: before ? { id: before.id, name: before.name, status: before.status } : null, after: { id: updated.id, name: updated.name, status: updated.status } },
    });

    await createAudit({ req, actorId: parseActorId(id), actorEmail: req.user?.email || null, action: "PROJECT_UPDATE", target: { projectId: updated.id }, metadata });

    return res.json(updated);
  } catch (error) {
    console.error("updateProject Error:", error);
    await createErrorLog({
      eventType: "update_project_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in updateProject",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, params: req.params, body: req.body },
    });
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
