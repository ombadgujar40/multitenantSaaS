import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js";
import { v4 as uuidv4 } from "uuid";

/* -------------------
   Helpers (shared)
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
   Super Admin controllers
   ----------------------- */

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.platformAdmin.findUnique({ where: { email } });
    if (!user) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "USER_NOT_FOUND",
        actorRole: null,
        tenantId: null,
        resourceType: "AUTH",
      });
      await createAudit({ req, actorId: null, actorEmail: email || null, action: "SUPERADMIN_LOGIN", target: null, metadata });
      return res.status(400).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "INVALID_PASSWORD",
        actorRole: user.role || null,
        tenantId: null,
        resourceType: "AUTH",
      });
      await createAudit({ req, actorId: null, actorEmail: email || null, action: "SUPERADMIN_LOGIN", target: null, metadata });
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, organisation: null },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: user.role || null,
      tenantId: null,
      resourceType: "AUTH",
      resourceId: user.id,
    });

    await createAudit({ req, actorId: user.id, actorEmail: user.email || null, action: "SUPERADMIN_LOGIN", target: null, metadata });

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("SuperAdmin login error:", error);
    await createErrorLog({
      eventType: "superadmin_login_exception",
      severity: "CRITICAL",
      message: error?.message || "Unknown error in superadmin login",
      tenantId: null,
      userId: null,
      payload: { stack: error?.stack || null, body: req.body, route: "POST /superadmin/login" },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

export const getUser = async (req, res) => {
  try {
    const data = req.user;
    if (!data) {
      const metadata = buildMetadata(req, { outcome: "DENIED", outcomeReason: "NO_AUTH", actorRole: null, resourceType: "USER" });
      await createAudit({ req, actorId: null, actorEmail: null, action: "SUPERADMIN_GET_ME", target: null, metadata });
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (data.role === "superAdmin") {
      const admin = await prisma.platformAdmin.findUnique({ where: { id: data.id }, select: { name: true, email: true, role: true, id: true } });

      const metadata = buildMetadata(req, {
        outcome: "SUCCESS",
        actorRole: data.role,
        tenantId: null,
        resourceType: "USER",
        resourceId: data.id,
      });

      await createAudit({ req, actorId: data.id, actorEmail: admin?.email || null, action: "SUPERADMIN_GET_ME", target: null, metadata });

      return res.status(200).json({ data: admin, role: admin.role });
    } else {
      const metadata = buildMetadata(req, {
        outcome: "DENIED",
        outcomeReason: "NOT_SUPERADMIN",
        actorRole: data.role || null,
        tenantId: null,
        resourceType: "USER",
      });
      await createAudit({ req, actorId: data.id || null, actorEmail: data?.email || null, action: "SUPERADMIN_GET_ME", target: null, metadata });
      return res.status(502).send("Admin don't exists");
    }
  } catch (error) {
    console.error("getUser superadmin error:", error);
    await createErrorLog({
      eventType: "superadmin_getuser_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in superadmin getUser",
      tenantId: null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, route: "GET /superadmin/me" },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    const existing = await prisma.platformAdmin.findUnique({ where: { email } });
    if (existing) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "SUPERADMIN_EXISTS",
        actorRole: actor?.role || null,
        tenantId: null,
        resourceType: "SUPERADMIN",
      });
      await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "SUPERADMIN_REGISTER", target: null, metadata });
      return res.status(400).json({ message: "Employee already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = await prisma.platformAdmin.create({
      data: { email, password: hashedPassword, name },
    });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: null,
      resourceType: "SUPERADMIN",
      resourceId: employee.id,
      extra: { createdEmail: email },
    });

    await createAudit({ req, actorId: parseActorId(actor?.id), actorEmail: actor?.email || null, action: "SUPERADMIN_REGISTER", target: { superAdminId: employee.id }, metadata });

    return res.status(201).json({ message: "Super Admin created successfully", employee });
  } catch (error) {
    console.error("SuperAdmin register error:", error);
    await createErrorLog({
      eventType: "superadmin_register_exception",
      severity: "CRITICAL",
      message: error?.message || "Unknown error in superadmin register",
      tenantId: null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, body: req.body, route: "POST /superadmin/register" },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

export const metricsData = async (req, res) => {
  try {
    const data = req.user;
    if (!data || data.role !== "superAdmin") {
      const metadata = buildMetadata(req, { outcome: "DENIED", outcomeReason: "NOT_SUPERADMIN", actorRole: data?.role || null, resourceType: "METRICS" });
      await createAudit({ req, actorId: data?.id || null, actorEmail: data?.email || null, action: "SUPERADMIN_METRICS", target: null, metadata });
      return res.status(403).send("Unauthorized");
    }

    const organization = await prisma.organization.findMany({ select: { id: true, name: true } });
    const employee = await prisma.employee.findMany({ select: { id: true, name: true, orgId: true, org: true } });
    const orgAdmin = await prisma.employee.findMany({ where: { role: "admin" }, select: { id: true, name: true, orgId: true, org: true } });
    const customer = await prisma.customer.findMany({ select: { id: true, name: true, orgId: true, org: true } });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: data.role,
      tenantId: null,
      resourceType: "METRICS",
      extra: { orgCount: organization.length, empCount: employee.length, adminCount: orgAdmin.length, custCount: customer.length },
    });

    await createAudit({ req, actorId: data.id, actorEmail: data?.email || null, action: "SUPERADMIN_METRICS", target: null, metadata });

    return res.status(200).json({ msg: "success", data: { organization, employee, orgAdmin, customer } });
  } catch (error) {
    console.error("metricsData error:", error);
    await createErrorLog({
      eventType: "superadmin_metrics_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in metricsData",
      tenantId: null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, route: "GET /superadmin/metrics" },
    });
    return res.status(500).json({ message: "Server error" });
  }
};
