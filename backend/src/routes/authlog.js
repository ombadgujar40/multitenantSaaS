import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Helpers
 */
function parseActorId(actorId) {
  if (actorId === undefined || actorId === null) return null;
  const n = Number(actorId);
  return Number.isInteger(n) ? n : null;
}

function getClientIp(req) {
  // x-forwarded-for may contain a list
  const xff = req.headers && (req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"]);
  if (xff) return String(xff).split(",")[0].trim();
  return req.ip || (req.connection && (req.connection.remoteAddress || null)) || null;
}

function buildMetadata(req, opts = {}) {
  return {
    eventId: uuidv4(),
    timestamp: new Date().toISOString(),
    outcome: opts.outcome || null, // SUCCESS | FAILURE | DENIED
    outcomeReason: opts.outcomeReason || null, // e.g., INVALID_PASSWORD
    ip: getClientIp(req),
    userAgent: (req && req.headers && req.headers["user-agent"]) || null,
    requestId: (req && (req.id || req.headers && req.headers["x-request-id"])) || uuidv4(),
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
    // best-effort only; avoid crashing
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
    // log the audit failure into ErrorLog for traceability
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
   Controller functions
   ----------------------- */

export const login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Determine model & lookup function based on role
    let user = null;
    if (role === "customer") {
      user = await prisma.customer.findUnique({ where: { email } });
    } else if (role === "employee" || role === "admin") {
      user = await prisma.employee.findUnique({ where: { email } });
    } else {
      // Invalid role supplied — audit and return
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "INVALID_ROLE_PROVIDED",
        actorRole: null,
        tenantId: null,
        resourceType: "AUTH",
      });

      await createAudit({
        req,
        actorId: null,
        actorEmail: email || null,
        action: "USER_LOGIN",
        target: null,
        metadata,
      });

      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user) {
      // user not found
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "USER_NOT_FOUND",
        actorRole: null,
        tenantId: null,
        resourceType: "AUTH",
      });

      await createAudit({
        req,
        actorId: null,
        actorEmail: email || null,
        action: "USER_LOGIN",
        target: null,
        metadata,
      });

      return res.status(400).json({ message: "User not found" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "INVALID_PASSWORD",
        actorRole: role || null,
        tenantId: user.orgId || null,
        resourceType: "AUTH",
      });

      await createAudit({
        req,
        actorId: null,
        actorEmail: email || null,
        action: "USER_LOGIN",
        target: null,
        metadata,
      });

      return res.status(400).json({ message: "Invalid credentials" });
    }

    // If role == admin but user exists in employee table, allow but set role to "admin" in token
    const tokenPayload = { id: user.id, role: role === "admin" ? "admin" : role, organisation: user.orgId };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "7d" });

    // Successful login audit
    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      outcomeReason: null,
      actorRole: role === "admin" ? "admin" : role,
      tenantId: user.orgId || null,
      resourceType: "AUTH",
      resourceId: user.id,
    });

    await createAudit({
      req,
      actorId: user.id,
      actorEmail: email || null,
      action: "USER_LOGIN",
      target: null,
      metadata,
    });

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login Error:", error);
    // error log
    await createErrorLog({
      eventType: "login_handler_exception",
      severity: "CRITICAL",
      message: error?.message || "Unknown error in login",
      tenantId: null,
      userId: null,
      payload: { stack: error?.stack || null, body: req.body, route: "POST /auth/login" },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

export const getUser = async (req, res) => {
  try {
    const data = req.user;

    if (!data) {
      // no authenticated user present
      const metadata = buildMetadata(req, {
        outcome: "DENIED",
        outcomeReason: "NO_AUTH",
        actorRole: null,
        tenantId: null,
        resourceType: "AUTH",
      });

      await createAudit({
        req,
        actorId: null,
        actorEmail: null,
        action: "GET_USER",
        target: null,
        metadata,
      });

      return res.status(401).json({ message: "Unauthorized" });
    }

    if (data.role === "superAdmin") {
      const admin = await prisma.platformAdmin.findUnique({
        where: { id: data.id },
        select: { name: true, email: true, role: true, id: true },
      });

      const metadata = buildMetadata(req, {
        outcome: "SUCCESS",
        actorRole: data.role,
        tenantId: null,
        resourceType: "USER",
        resourceId: data.id,
      });
      await createAudit({ req, actorId: data.id, actorEmail: admin?.email || null, action: "GET_USER", target: null, metadata });

      return res.status(200).json({ data: admin, role: admin?.role });
    } else {
      // normal org flows
      const organisationName = await prisma.organization.findUnique({ where: { id: data.organisation } });
      if (!organisationName) {
        const metadata = buildMetadata(req, {
          outcome: "FAILURE",
          outcomeReason: "ORG_NOT_FOUND",
          actorRole: data.role,
          tenantId: data.organisation || null,
          resourceType: "ORGANIZATION",
        });
        await createAudit({ req, actorId: data.id, actorEmail: data?.email || null, action: "GET_USER", target: null, metadata });
        return res.status(502).send("Organisation don't exists");
      }

      switch (data.role) {
        case "employee": {
          const emp = await prisma.employee.findUnique({
            where: { id: data.id },
            select: { name: true, email: true, role: true, id: true, orgId: true },
          });

          const metadata = buildMetadata(req, {
            outcome: "SUCCESS",
            actorRole: data.role,
            tenantId: emp?.orgId || null,
            resourceType: "USER",
            resourceId: data.id,
          });
          await createAudit({ req, actorId: data.id, actorEmail: emp?.email || null, action: "GET_USER", target: null, metadata });

          return res.status(200).json({ data: emp, role: emp?.role });
        }

        case "customer": {
          const cust = await prisma.customer.findUnique({
            where: { id: data.id },
            select: { name: true, email: true, id: true },
          });

          const metadata = buildMetadata(req, {
            outcome: "SUCCESS",
            actorRole: data.role,
            tenantId: data.organisation || null,
            resourceType: "USER",
            resourceId: data.id,
          });
          await createAudit({ req, actorId: data.id, actorEmail: cust?.email || null, action: "GET_USER", target: null, metadata });

          return res.status(200).json({ data: cust, role: "customer" });
        }

        case "admin": {
          const admin = await prisma.employee.findUnique({
            where: { id: data.id },
            select: { name: true, email: true, role: true, id: true, orgId: true },
          });

          const metadata = buildMetadata(req, {
            outcome: "SUCCESS",
            actorRole: data.role,
            tenantId: admin?.orgId || null,
            resourceType: "USER",
            resourceId: data.id,
          });
          await createAudit({ req, actorId: data.id, actorEmail: admin?.email || null, action: "GET_USER", target: null, metadata });

          return res.status(200).json({ data: admin, role: admin?.role });
        }

        default:
          // unknown role
          const metadata = buildMetadata(req, {
            outcome: "FAILURE",
            outcomeReason: "UNKNOWN_ROLE",
            actorRole: data.role || null,
            tenantId: data.organisation || null,
            resourceType: "USER",
          });
          await createAudit({ req, actorId: data.id, actorEmail: data?.email || null, action: "GET_USER", target: null, metadata });
          return res.status(400).json({ message: "Unknown role" });
      }
    }
  } catch (error) {
    console.error("getUser Error:", error);
    await createErrorLog({
      eventType: "getUser_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in getUser",
      tenantId: req.user?.organisation || null,
      userId: req.user?.id || null,
      payload: { stack: error?.stack || null, route: "GET /auth/user", body: req.body },
    });
    return res.status(500).json({ message: "Server error" });
  }
};
