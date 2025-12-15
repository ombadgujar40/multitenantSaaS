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
    outcomeReason: opts.outcomeReason || null, // e.g., ORG_ALREADY_EXISTS
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
   Organization controllers
   ----------------------- */

export const register = async (req, res) => {
  try {
    const { name, Domain } = req.body;
    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    // Check existing
    const existingOrg = await prisma.organization.findUnique({ where: { name } });
    if (existingOrg) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "ORG_ALREADY_EXISTS",
        actorRole: actor?.role || null,
        tenantId: null,
        resourceType: "ORGANIZATION",
      });

      await createAudit({
        req,
        actorId: parseActorId(actor?.id),
        actorEmail: actor?.email || null,
        action: "ORG_REGISTER",
        target: null,
        metadata,
      });

      return res.status(400).json({ message: "Organization already exists" });
    }

    // Create org
    const organization = await prisma.organization.create({ data: { name, Domain } });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: organization.id,
      resourceType: "ORGANIZATION",
      resourceId: organization.id,
      extra: { domain: Domain },
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "ORG_REGISTER",
      target: { orgId: organization.id },
      metadata,
    });

    return res.status(201).json({
      message: "Organization registered successfully",
      organization,
    });
  } catch (error) {
    console.error("Register Error:", error);
    await createErrorLog({
      eventType: "organization_register_exception",
      severity: "CRITICAL",
      message: error?.message || "Unknown error in organization register",
      tenantId: null,
      userId: req.user?.id || parseActorId(req.body?.actorId) || null,
      payload: { stack: error?.stack || null, body: req.body, route: "POST /organization/register" },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAll = async (req, res) => {
  try {
    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    const resp = await prisma.organization.findMany({ select: { id: true, name: true } });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: null,
      resourceType: "ORGANIZATION",
      extra: { resultCount: resp.length },
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "ORG_LIST",
      target: null,
      metadata,
    });

    return res.status(200).json(resp);
  } catch (error) {
    console.error("getAll Org Error:", error);
    await createErrorLog({
      eventType: "get_organizations_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in getAll organizations",
      tenantId: null,
      userId: req.user?.id || parseActorId(req.body?.actorId) || null,
      payload: { stack: error?.stack || null, route: "GET /organization/all" },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

export const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    const resp = await prisma.organization.findUnique({ where: { id: Number(id) } });

    if (!resp) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "ORG_NOT_FOUND",
        actorRole: actor?.role || null,
        tenantId: null,
        resourceType: "ORGANIZATION",
      });

      await createAudit({
        req,
        actorId: parseActorId(actor?.id),
        actorEmail: actor?.email || null,
        action: "ORG_GET",
        target: { orgId: Number(id) },
        metadata,
      });

      return res.status(404).json({ message: "Organization not found" });
    }

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: resp.id,
      resourceType: "ORGANIZATION",
      resourceId: resp.id,
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "ORG_GET",
      target: { orgId: resp.id },
      metadata,
    });

    return res.status(200).json(resp);
  } catch (error) {
    console.error("getOne Org Error:", error);
    await createErrorLog({
      eventType: "get_one_organization_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in getOne",
      tenantId: null,
      userId: req.user?.id || parseActorId(req.body?.actorId) || null,
      payload: { stack: error?.stack || null, params: req.params, route: "GET /organization/one/:id" },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

export const updateOrg = async (req, res) => {
  try {
    const { id } = req.params; // org id
    const { Status } = req.body;

    // Resolve actor info (trusted server-side if present)
    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    const isExist = await prisma.organization.findUnique({ where: { id: Number(id) } });
    if (!isExist) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "ORG_NOT_FOUND",
        actorRole: actor?.role || null,
        tenantId: null,
        resourceType: "ORGANIZATION",
      });

      await createAudit({
        req,
        actorId: parseActorId(actor?.id),
        actorEmail: actor?.email || null,
        action: "ORG_UPDATE",
        target: { orgId: Number(id) },
        metadata,
      });

      return res.status(400).send("Organization does not exist");
    }

    // find the plan row for the org (choose latest if multiples)
    const plan = await prisma.choosedPlan.findFirst({
      where: { orgId: Number(id) },
      orderBy: { createdAt: "desc" } // safest if multiple records exist - pick latest
    });

    if (!plan) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "PLAN_NOT_FOUND",
        actorRole: actor?.role || null,
        tenantId: Number(id),
        resourceType: "CHOOSedPLAN",
      });

      await createAudit({
        req,
        actorId: parseActorId(actor?.id),
        actorEmail: actor?.email || null,
        action: "ORG_UPDATE_PLAN",
        target: { orgId: Number(id) },
        metadata,
      });

      return res.status(404).send("Plan not found for this org");
    }

    // perform update
    const update = await prisma.choosedPlan.update({
      where: { id: plan.id },
      data: { Status }
    });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: Number(id),
      resourceType: "CHOOSedPLAN",
      resourceId: update.id,
      extra: { previousStatus: plan.Status, newStatus: Status }
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "ORG_UPDATE_PLAN",
      target: { orgId: Number(id), planId: update.id },
      metadata,
    });

    return res.status(200).send(update);
  } catch (error) {
    console.error("updateOrg Error:", error);

    // write error log
    await createErrorLog({
      eventType: "update_org_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in updateOrg",
      tenantId: req.params?.id ? Number(req.params.id) : null,
      userId: req.user?.id || parseActorId(req.body?.actorId) || null,
      payload: { stack: error?.stack || null, params: req.params, body: req.body, route: "PUT /organization/update/:id" },
    });

    return res.status(500).send("Server error");
  }
};