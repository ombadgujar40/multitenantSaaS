// controllers/chatController.js
import express from "express";

/**
 * Chat controller functions.
 * Assumptions:
 * - Prisma client is available via req.app.get('prisma')
 * - Socket.IO instance available via req.app.get('io')
 * - Optional helper emitToUser / emitGroupCreated attached to app
 * - req.user is populated by your verifyToken middleware (contains id, role, orgId, maybe type)
 */

export const getUserGroups = async (req, res) => {
  const prisma = req.app.get("prisma");
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  try {
    // determine if request user is employee or customer
    // prefer explicit claim 'type' else infer from role
    const userType = user.type || (user.role === "customer" ? "customer" : "employee");

    // find groups where the user is a member (via GroupMember)
    let memberships;
    if (userType === "employee") {
      memberships = await prisma.groupMember.findMany({
        where: { employeeId: Number(user.id) },
        include: {
          group: {
            include: {
              // include a lightweight count of members
              members: { select: { id: true } },
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      });
    } else {
      memberships = await prisma.groupMember.findMany({
        where: { customerId: Number(user.id) },
        include: {
          group: {
            include: {
              members: { select: { id: true } },
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { joinedAt: "desc" },
      });
    }

    const groups = memberships.map((m) => {
      const g = m.group;
      return {
        id: g.id,
        name: g.name,
        projectId: g.projectId,
        orgId: g.orgId,
        memberCount: (g.members || []).length,
        lastMessageAt: g.lastMessageAt,
        project: g.project || null,
      };
    });

    return res.json(groups);
  } catch (err) {
    console.error("getUserGroups error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET messages for a group (cursor pagination)
 * Query params:
 *  - limit (number)
 *  - before (ISO date or message id) // optional cursor
 */
export const getGroupMessages = async (req, res) => {
  const prisma = req.app.get("prisma");
  const user = req.user;
  const groupId = Number(req.params.groupId);
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const before = req.query.before || null; // can be createdAt ISO string or message id (we'll try createdAt)

  if (!user) return res.status(401).json({ message: "Unauthorized" });

  try {
    // verify membership
    const userType = user.type || (user.role === "customer" ? "customer" : "employee");
    const isMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        OR: [
          userType === "employee" ? { employeeId: Number(user.id) } : undefined,
          userType === "customer" ? { customerId: Number(user.id) } : undefined,
        ].filter(Boolean),
      },
    });
    if (!isMember) return res.status(403).json({ message: "Forbidden - not a group member" });

    // query messages
    const where = { groupId };
    if (before) {
      // try to parse as date first
      const maybeDate = new Date(before);
      if (!Number.isNaN(maybeDate.getTime())) {
        where.createdAt = { lt: maybeDate };
      } else if (!Number.isNaN(Number(before))) {
        // treat as id
        where.id = { lt: Number(before) };
      }
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // return messages in ascending order (oldest first)
    return res.json(messages.reverse());
  } catch (err) {
    console.error("getGroupMessages error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST a message to a group via REST (will persist and broadcast via socket)
 * body: { text: string, meta?: object }
 */
export const postMessageToGroup = async (req, res) => {
  const prisma = req.app.get("prisma");
  const io = req.app.get("io");
  const user = req.user;
  const groupId = Number(req.params.groupId);
  const { text, meta } = req.body;

  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (!text || !text.trim()) return res.status(400).json({ message: "Message text required" });

  try {
    const userType = user.type || (user.role === "customer" ? "customer" : "employee");

    // verify membership
    const isMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        OR: [
          userType === "employee" ? { employeeId: Number(user.id) } : undefined,
          userType === "customer" ? { customerId: Number(user.id) } : undefined,
        ].filter(Boolean),
      },
    });
    if (!isMember) return res.status(403).json({ message: "Forbidden - not a group member" });

    // create message
    const msg = await prisma.message.create({
      data: {
        groupId,
        senderId: Number(user.id),
        senderType: userType,
        text,
        meta: meta || null,
      },
    });

    // update group's lastMessageAt
    await prisma.chatGroup.update({
      where: { id: groupId },
      data: { lastMessageAt: msg.createdAt },
    });

    const payload = {
      id: msg.id,
      groupId: msg.groupId,
      senderId: msg.senderId,
      senderType: msg.senderType,
      text: msg.text,
      meta: msg.meta,
      createdAt: msg.createdAt,
    };

    // broadcast via socket (if io is attached)
    if (io) {
      io.to(`group_${groupId}`).emit("new_message", payload);
    } else {
      // fallback helper (emitToUser) if you prefer
      const emitToUser = req.app.get("emitToUser");
      if (emitToUser) {
        // notify each member online individually (less efficient than room broadcast)
        const members = await prisma.groupMember.findMany({ where: { groupId } });
        for (const m of members) {
          if (m.employeeId) emitToUser("employee", m.employeeId, "new_message", payload);
          if (m.customerId) emitToUser("customer", m.customerId, "new_message", payload);
        }
      }
    }

    return res.status(201).json(msg);
  } catch (err) {
    console.error("postMessageToGroup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Create a chat group (typically admin flow; name, projectId, orgId required)
 * body: { projectId, name, orgId, members?: [{ employeeId?, customerId?, role? }] }
 */
export const createGroup = async (req, res) => {
  const prisma = req.app.get("prisma");
  const emitGroupCreated = req.app.get("emitGroupCreated");
  const user = req.user;

  // only allow admin users for now
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  if (user.role !== "admin") return res.status(403).json({ message: "Forbidden" });

  const { projectId, name, orgId, members = [] } = req.body;
  if (!projectId || !name || !orgId) return res.status(400).json({ message: "Missing fields" });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.chatGroup.create({
        data: {
          projectId: Number(projectId),
          name,
          orgId: Number(orgId),
        },
      });

      // create members if provided
      for (const m of members) {
        await tx.groupMember.create({
          data: {
            groupId: group.id,
            employeeId: m.employeeId ? Number(m.employeeId) : null,
            customerId: m.customerId ? Number(m.customerId) : null,
            role: m.role || "member",
          },
        });
      }

      // create system message
      await tx.message.create({
        data: {
          groupId: group.id,
          senderId: 0,
          senderType: "system",
          text: `Group "${group.name}" created.`,
        },
      });

      return group;
    });

    // broadcast group_created
    if (emitGroupCreated) emitGroupCreated(result);

    return res.status(201).json(result);
  } catch (err) {
    console.error("createGroup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Add a member to group (used when assigning a task)
 * body: { employeeId?, customerId?, role? }
 */
export const addMemberToGroup = async (req, res) => {
  const prisma = req.app.get("prisma");
  const emitToUser = req.app.get("emitToUser");
  const user = req.user;
  const groupId = Number(req.params.groupId);
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  const { employeeId, customerId, role = "member" } = req.body;
  if (!employeeId && !customerId) return res.status(400).json({ message: "employeeId or customerId required" });

  try {
    // optionally check request user has rights to add (admin or group admin)
    // For now allow org admin only (you can add group admin checks here)
    if (user.role !== "admin") {
      // you could also check group member role === 'admin' to allow group-level admins
      return res.status(403).json({ message: "Forbidden" });
    }

    const member = await prisma.groupMember.create({
      data: {
        groupId,
        employeeId: employeeId ? Number(employeeId) : null,
        customerId: customerId ? Number(customerId) : null,
        role,
      },
    });

    // optional system message
    await prisma.message.create({
      data: {
        groupId,
        senderId: 0,
        senderType: "system",
        text: employeeId ? `Employee ${employeeId} added to group` : `Customer ${customerId} added to group`,
      },
    });

    // notify the user if online
    if (emitToUser) {
      if (employeeId) emitToUser("employee", Number(employeeId), "added_to_group", { groupId });
      if (customerId) emitToUser("customer", Number(customerId), "added_to_group", { groupId });
    }

    return res.status(201).json(member);
  } catch (err) {
    console.error("addMemberToGroup error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
