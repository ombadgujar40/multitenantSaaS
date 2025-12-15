import bcrypt from "bcryptjs";
import { prisma } from "../config/prismaconfig.js";
import { v4 as uuidv4 } from "uuid";

/* -------------------
   Helpers (same style as authLog)
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
   Customer controllers
   ----------------------- */

export const register = async (req, res) => {
  try {
    const { orgName, name, email, password } = req.body;

    // Resolve actor info from req.user (trusted) or fallback to body/query
    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    const org = await prisma.organization.findUnique({ where: { name: orgName } });
    if (!org) {
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
        action: "CUSTOMER_REGISTER",
        target: null,
        metadata,
      });

      return res.status(404).json({ message: "Organization does not exist" });
    }

    const orgId = org.id;

    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "CUSTOMER_ALREADY_EXISTS",
        actorRole: actor?.role || null,
        tenantId: orgId,
        resourceType: "CUSTOMER",
      });

      await createAudit({
        req,
        actorId: parseActorId(actor?.id),
        actorEmail: actor?.email || null,
        action: "CUSTOMER_REGISTER",
        target: null,
        metadata,
      });

      return res.status(400).json({ message: "User already exist" });
    }

    const hashedPass = await bcrypt.hash(password, 10);

    const created = await prisma.customer.create({
      data: {
        orgId,
        name,
        email,
        password: hashedPass,
      },
    });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: orgId,
      resourceType: "CUSTOMER",
      resourceId: created.id,
      extra: { createdCustomerEmail: created.email },
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "CUSTOMER_REGISTER",
      target: { customerId: created.id },
      metadata,
    });

    return res.status(201).json({ message: "customer created successfully", createUser: created });
  } catch (error) {
    console.error("register customer error:", error);

    await createErrorLog({
      eventType: "customer_register_exception",
      severity: "CRITICAL",
      message: error?.message || "Unknown error in customer register",
      tenantId: null,
      userId: req.user?.id || parseActorId(req.body?.actorId) || null,
      payload: { stack: error?.stack || null, body: req.body, route: "POST /customer/register" },
    });

    return res.status(500).json({ message: "Server error" });
  }
};

export const getCust = async (req, res) => {
  try {
    const { orgId, role } = req.query;

    // actor from token or fallback to query/body
    const actor = req.user || { id: req.body?.actorId || null, role: req.query?.role || req.body?.actorRole || null, email: req.body?.actorEmail || null };

    if (role !== "admin") {
      const metadata = buildMetadata(req, {
        outcome: "DENIED",
        outcomeReason: "UNAUTHORIZED_ACCESS",
        actorRole: actor?.role || null,
        tenantId: orgId ? Number(orgId) : null,
        resourceType: "CUSTOMER",
      });

      await createAudit({
        req,
        actorId: parseActorId(actor?.id),
        actorEmail: actor?.email || null,
        action: "CUSTOMER_LIST",
        target: null,
        metadata,
      });

      return res.status(403).send("Unauthorized Access");
    }

    const resp = await prisma.customer.findMany({
      where: { orgId: Number(orgId) },
      select: { id: true, name: true, email: true, projects: true, createdAt: true, orgId: true, org: true },
    });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: orgId ? Number(orgId) : null,
      resourceType: "CUSTOMER",
      extra: { resultCount: resp.length },
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "CUSTOMER_LIST",
      target: null,
      metadata,
    });

    return res.status(200).send(resp);
  } catch (error) {
    console.error("getCust Error:", error);

    await createErrorLog({
      eventType: "get_customers_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in getCust",
      tenantId: req.query?.orgId ? Number(req.query.orgId) : null,
      userId: req.user?.id || parseActorId(req.body?.actorId),
      payload: { stack: error?.stack || null, query: req.query, body: req.body },
    });

    return res.status(500).json({ msg: error });
  }
};

export const updateCust = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    // read before snapshot
    const before = await prisma.customer.findUnique({ where: { id: Number(id) } });

    const updated = await prisma.customer.update({
      where: { id: Number(id) },
      data: { name, email },
    });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: updated.orgId || null,
      resourceType: "CUSTOMER",
      resourceId: updated.id,
      extra: {
        before: before ? { id: before.id, email: before.email, name: before.name } : null,
        after: { id: updated.id, email: updated.email, name: updated.name },
      },
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "CUSTOMER_UPDATE",
      target: { customerId: updated.id },
      metadata,
    });

    return res.json(updated);
  } catch (error) {
    console.error("updateCust Error:", error);

    await createErrorLog({
      eventType: "update_customer_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in updateCust",
      tenantId: null,
      userId: req.user?.id || parseActorId(req.body?.actorId),
      payload: { stack: error?.stack || null, params: req.params, body: req.body },
    });

    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteCust = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    // read before delete to capture org context
    const before = await prisma.customer.findUnique({ where: { id: Number(id) } });

    await prisma.customer.delete({ where: { id: Number(id) } });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: before?.orgId || null,
      resourceType: "CUSTOMER",
      resourceId: Number(id),
      extra: { deletedCustomerSnapshot: before ? { id: before.id, email: before.email, name: before.name } : null },
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "CUSTOMER_DELETE",
      target: { customerId: Number(id) },
      metadata,
    });

    return res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("deleteCust Error:", error);

    await createErrorLog({
      eventType: "delete_customer_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in deleteCust",
      tenantId: null,
      userId: req.user?.id || parseActorId(req.body?.actorId),
      payload: { stack: error?.stack || null, params: req.params, body: req.body },
    });

    return res.status(500).json({ message: "Server error" });
  }
};
