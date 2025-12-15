import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js";
import { v4 as uuidv4 } from "uuid";

/* -------------------
   Helpers
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
    outcomeReason: opts.outcomeReason || null, // e.g., INVALID_PASSWORD
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
    // record error log about audit write failure
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
   Employee controllers
   ----------------------- */

/**
 * login -- if you keep login here
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.employee.findUnique({ where: { email } });
    if (!user) {
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
        action: "EMPLOYEE_LOGIN",
        target: null,
        metadata,
      });

      return res.status(400).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      const metadata = buildMetadata(req, {
        outcome: "DENIED",
        outcomeReason: "USE_ADMIN_LOGIN",
        actorRole: user.role,
        tenantId: user.orgId || null,
        resourceType: "AUTH",
      });

      await createAudit({
        req,
        actorId: user.id,
        actorEmail: email || null,
        action: "EMPLOYEE_LOGIN",
        target: null,
        metadata,
      });

      return res.status(202).send("please use admin login");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "INVALID_PASSWORD",
        actorRole: user.role,
        tenantId: user.orgId || null,
        resourceType: "AUTH",
      });

      await createAudit({
        req,
        actorId: null,
        actorEmail: email || null,
        action: "EMPLOYEE_LOGIN",
        target: null,
        metadata,
      });

      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, orgId: user.orgId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      outcomeReason: null,
      actorRole: user.role,
      tenantId: user.orgId || null,
      resourceType: "AUTH",
      resourceId: user.id,
    });

    await createAudit({
      req,
      actorId: user.id,
      actorEmail: email || null,
      action: "EMPLOYEE_LOGIN",
      target: null,
      metadata,
    });

    return res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login Error:", error);
    await createErrorLog({
      eventType: "employee_login_exception",
      severity: "CRITICAL",
      message: error?.message || "Unknown error in employee login",
      tenantId: null,
      userId: null,
      payload: { stack: error?.stack || null, body: req.body, route: "POST /employee/login" },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * register employee
 */
export const register = async (req, res) => {
  try {
    const { orgName, name, email, password, role, designation } = req.body;

    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    // Check if org exists
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
        action: "EMPLOYEE_REGISTER",
        target: null,
        metadata,
      });

      return res.status(404).json({ message: "Organization does not exists" });
    }
    const orgId = org.id;

    // Check if email already exists
    const existingEmployee = await prisma.employee.findUnique({ where: { email } });
    if (existingEmployee) {
      const metadata = buildMetadata(req, {
        outcome: "FAILURE",
        outcomeReason: "EMPLOYEE_ALREADY_EXISTS",
        actorRole: actor?.role || null,
        tenantId: orgId,
        resourceType: "EMPLOYEE",
      });

      await createAudit({
        req,
        actorId: parseActorId(actor?.id),
        actorEmail: actor?.email || null,
        action: "EMPLOYEE_REGISTER",
        target: null,
        metadata,
      });

      return res.status(400).json({ message: "Employee already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create employee
    const employee = await prisma.employee.create({
      data: {
        orgId,
        name,
        email,
        password: hashedPassword,
        role: role || "employee",
        jobPosition: designation
      },
    });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      outcomeReason: null,
      actorRole: actor?.role || null,
      tenantId: orgId,
      resourceType: "EMPLOYEE",
      resourceId: employee.id,
      extra: { createdEmployeeEmail: email }
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "EMPLOYEE_REGISTER",
      target: { employeeId: employee.id },
      metadata,
    });

    return res.status(201).json({ message: "Employee created successfully", employee });
  } catch (error) {
    console.error("Register Employee Error:", error);
    await createErrorLog({
      eventType: "employee_register_exception",
      severity: "CRITICAL",
      message: error?.message || "Unknown error in register",
      tenantId: null,
      userId: req.user?.id || parseActorId(req.body?.actorId) || null,
      payload: { stack: error?.stack || null, body: req.body, route: "POST /employee/register" },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * get employees (list)
 */
export const getEmps = async (req, res) => {
  try {
    const { orgId, role } = req.query;

    const actor = req.user || { id: req.body?.actorId || null, role: req.query?.role || req.body?.actorRole || null, email: req.body?.actorEmail || null };

    if (role !== "admin") {
      const metadata = buildMetadata(req, {
        outcome: "DENIED",
        outcomeReason: "UNAUTHORIZED_ACCESS",
        actorRole: actor?.role || null,
        tenantId: orgId ? Number(orgId) : null,
        resourceType: "EMPLOYEE",
      });

      await createAudit({
        req,
        actorId: parseActorId(actor?.id),
        actorEmail: actor?.email || null,
        action: "EMPLOYEE_LIST",
        target: null,
        metadata,
      });

      return res.status(403).send("Unauthorized Access");
    }

    const resp = await prisma.employee.findMany({
      where: { role: "employee", orgId: Number(orgId) },
      select: { id: true, name: true, email: true, role: true, jobPosition: true, createdAt: true, orgId: true }
    });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: orgId ? Number(orgId) : null,
      resourceType: "EMPLOYEE",
      extra: { resultCount: resp.length }
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "EMPLOYEE_LIST",
      target: null,
      metadata,
    });

    return res.status(200).send(resp);
  } catch (error) {
    console.error("getEmps Error:", error);
    await createErrorLog({
      eventType: "get_employees_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in getEmps",
      tenantId: req.query?.orgId ? Number(req.query.orgId) : null,
      userId: req.user?.id || parseActorId(req.body?.actorId),
      payload: { stack: error?.stack || null, query: req.query, body: req.body },
    });
    return res.status(500).json({ msg: error });
  }
};

/**
 * update employee
 */
export const updateEmp = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, jobPosition } = req.body;

    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    // Read old record (for before snapshot)
    const before = await prisma.employee.findUnique({ where: { id: Number(id) } });

    const updated = await prisma.employee.update({
      where: { id: Number(id) },
      data: { name, email, role, jobPosition },
    });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: updated.orgId || null,
      resourceType: "EMPLOYEE",
      resourceId: updated.id,
      extra: { before: before ? { id: before.id, email: before.email, name: before.name, role: before.role, jobPosition: before.jobPosition } : null, after: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, jobPosition: updated.jobPosition } }
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "EMPLOYEE_UPDATE",
      target: { employeeId: updated.id },
      metadata,
    });

    return res.json(updated);
  } catch (error) {
    console.error("updateEmp Error:", error);
    await createErrorLog({
      eventType: "update_employee_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in updateEmp",
      tenantId: null,
      userId: req.user?.id || parseActorId(req.body?.actorId),
      payload: { stack: error?.stack || null, params: req.params, body: req.body },
    });
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * delete employee
 */
export const deleteEmp = async (req, res) => {
  try {
    const { id } = req.params;

    const actor = req.user || { id: req.body?.actorId || null, role: req.body?.actorRole || null, email: req.body?.actorEmail || null };

    // Read record before deletion to capture owner/tenant context
    const before = await prisma.employee.findUnique({ where: { id: Number(id) } });

    await prisma.employee.delete({ where: { id: Number(id) } });

    const metadata = buildMetadata(req, {
      outcome: "SUCCESS",
      actorRole: actor?.role || null,
      tenantId: before?.orgId || null,
      resourceType: "EMPLOYEE",
      resourceId: Number(id),
      extra: { deletedEmployeeSnapshot: before ? { id: before.id, email: before.email, name: before.name, role: before.role } : null }
    });

    await createAudit({
      req,
      actorId: parseActorId(actor?.id),
      actorEmail: actor?.email || null,
      action: "EMPLOYEE_DELETE",
      target: { employeeId: Number(id) },
      metadata,
    });

    return res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("deleteEmp Error:", error);
    await createErrorLog({
      eventType: "delete_employee_exception",
      severity: "HIGH",
      message: error?.message || "Unknown error in deleteEmp",
      tenantId: null,
      userId: req.user?.id || parseActorId(req.body?.actorId),
      payload: { stack: error?.stack || null, params: req.params, body: req.body },
    });
    return res.status(500).json({ message: "Server error" });
  }
};
