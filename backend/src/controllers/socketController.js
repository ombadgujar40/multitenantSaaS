// socketController.js
// central socket handlers and helpers
import jwt from "jsonwebtoken"; // used for verifying socket JWTs

// exported initializer
export function initSocketController({ io, prisma, app }) {

  async function resolveSenderName(prisma, senderType, senderId) {
    if (!senderId) return "Unknown";
    try {
      if (senderType === "employee" || senderType === "admin") {
        const emp = await prisma.employee.findUnique({ where: { id: Number(senderId) } });
        return emp ? emp.name : `Employee:${senderId}`;
      } else if (senderType === "customer") {
        const cust = await prisma.customer.findUnique({ where: { id: Number(senderId) } });
        return cust ? cust.name : `Customer:${senderId}`;
      } else if (senderType === "system") {
        return "System";
      }
      return `${senderType}:${senderId}`;
    } catch (err) {
      console.error("resolveSenderName error", err);
      return `${senderType}:${senderId}`;
    }
  }
  // simple in-memory presence map (for single-node); use Redis for multi-node
  const onlineUsers = new Map();

  // socket auth middleware — uses the same JWT verification approach as your HTTP middleware
  io.use(async (socket, next) => {
    try {
      let { token } = socket.handshake.auth || {};

      if (!token) return next(new Error("No auth token"));

      // Accept either raw token or "Bearer <token>"
      if (typeof token === "string" && token.startsWith("Bearer ")) {
        token = token.split(" ")[1];
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // decoded should contain the same claims you put on req.user in HTTP middleware
        // e.g. { id, role, orgId, iat, exp, ... }
        socket.user = decoded;
        return next();
      } catch (err) {
        console.error("Socket JWT verification error:", err.message);
        return next(new Error("Invalid or expired token"));
      }
    } catch (err) {
      console.error("Socket auth error:", err);
      return next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log("Socket connected:", socket.id, user);

    if (user) {
      const key = `${user.role || user.type || "unknown"}:${user.id}`;
      const arr = onlineUsers.get(key) || [];
      arr.push(socket.id);
      onlineUsers.set(key, arr);
    }

    // Join a chat group after verifying membership
    socket.on("join_group", async ({ groupId }) => {
  try {
    if (!socket.user) return socket.emit("error", "Not authenticated");
    const { id: userId } = socket.user;
    const userRole = socket.user.role; // admin | employee | customer (whatever your token includes)
    const userType = socket.user.type || (userRole === "customer" ? "customer" : (userRole === "admin" ? "admin" : "employee"));

    // verify membership
    const isMember = await prisma.groupMember.findFirst({
      where: {
        groupId: Number(groupId),
        OR: [
          userType === "employee" ? { employeeId: Number(userId) } : undefined,
          userType === "customer" ? { customerId: Number(userId) } : undefined,
          userType === "admin" ? { employeeId: Number(userId) } : undefined,
        ].filter(Boolean),
      },
    });

    if (!isMember) {
      return socket.emit("error", "You are not a member of this group");
    }

    const room = `group_${groupId}`;
    socket.join(room);
    socket.emit("joined_group", { groupId });

    // fetch last messages and augment with senderName
    const lastMessages = await prisma.message.findMany({
      where: { groupId: Number(groupId) },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    // Build a map of senderType -> set of ids to batch-resolve names
    const idsByType = {};
    for (const m of lastMessages) {
      if (!m.senderType || !m.senderId) continue;
      idsByType[m.senderType] = idsByType[m.senderType] || new Set();
      idsByType[m.senderType].add(Number(m.senderId));
    }

    // batch fetch names for employees/admins and customers
    const senderNameMap = {}; // key `${senderType}:${id}` -> name

    if (idsByType.employee || idsByType.admin) {
      // employees and admins live in Employee table
      const employeeIds = new Set([...(idsByType.employee || []), ...(idsByType.admin || [])]);
      if (employeeIds.size > 0) {
        const rows = await prisma.employee.findMany({
          where: { id: { in: Array.from(employeeIds) } },
          select: { id: true, name: true },
        });
        rows.forEach((r) => {
          senderNameMap[`employee:${r.id}`] = r.name;
          senderNameMap[`admin:${r.id}`] = r.name;
        });
      }
    }

    if (idsByType.customer) {
      const rows = await prisma.customer.findMany({
        where: { id: { in: Array.from(idsByType.customer) } },
        select: { id: true, name: true },
      });
      rows.forEach((r) => {
        senderNameMap[`customer:${r.id}`] = r.name;
      });
    }

    // augment messages
    const augmented = lastMessages.map((m) => {
      const key = `${m.senderType}:${m.senderId}`;
      const senderName = socket.user?.name || senderNameMap[key] || (m.senderType === "system" ? "System" : key);
      return {
        ...m,
        senderName,
      };
    });

    socket.emit("group_messages", augmented);
  } catch (err) {
    console.error("join_group error", err);
    socket.emit("error", "Failed to join group");
  }
});


    socket.on("leave_group", ({ groupId }) => {
      socket.leave(`group_${groupId}`);
      socket.emit("left_group", { groupId });
    });

    socket.on("send_message", async ({ groupId, text, meta }) => {
  try {
    if (!socket.user) return socket.emit("error", "Not authenticated");
    if (!text || !text.trim()) return;

    const { id: userId } = socket.user;
    const userRole = socket.user.role;
    const userType = socket.user.type || (userRole === "customer" ? "customer" : (userRole === "admin" ? "admin" : "employee"));

    // verify membership
    const isMember = await prisma.groupMember.findFirst({
      where: {
        groupId: Number(groupId),
        OR: [
          userType === "employee" ? { employeeId: Number(userId) } : undefined,
          userType === "customer" ? { customerId: Number(userId) } : undefined,
          userType === "admin" ? { employeeId: Number(userId) } : undefined,
        ].filter(Boolean),
      },
    });
    if (!isMember) return socket.emit("error", "Not a group member");

    // Persist message
    const msg = await prisma.message.create({
      data: {
        groupId: Number(groupId),
        senderId: Number(userId),
        senderType: userType,
        text,
        meta: meta || null,
      },
    });

    // update group's lastMessageAt
    await prisma.chatGroup.update({
      where: { id: Number(groupId) },
      data: { lastMessageAt: msg.createdAt },
    });

    // resolve senderName: prefer JWT's name, else lookup
    let senderName = socket.user?.name || null;
    if (!senderName) {
      senderName = await resolveSenderName(prisma, userType, userId);
    }

    const payload = {
      id: msg.id,
      groupId: msg.groupId,
      senderId: msg.senderId,
      senderType: msg.senderType,
      senderName,            // <-- added
      text: msg.text,
      meta: msg.meta,
      createdAt: msg.createdAt,
    };

    // broadcast to the group room
    io.to(`group_${groupId}`).emit("new_message", payload);
  } catch (err) {
    console.error("send_message error", err);
    socket.emit("error", "Failed to send message");
  }
});


    socket.on("disconnect", () => {
      console.log("Socket disconnected", socket.id);
      if (socket.user) {
        const key = `${socket.user.role || socket.user.type || "unknown"}:${socket.user.id}`;
        const arr = (onlineUsers.get(key) || []).filter((s) => s !== socket.id);
        if (arr.length === 0) onlineUsers.delete(key);
        else onlineUsers.set(key, arr);
      }
    });
  });

  // --- helpers exposed via app (or exports) ---
  // attach helper to app so controllers can call req.app.get('emitGroupCreated')
  function emitGroupCreated(group) {
    io.emit("group_created", {
      id: group.id,
      projectId: group.projectId,
      name: group.name,
      orgId: group.orgId,
      createdAt: group.createdAt,
    });
  }

  // also expose a function to send push to a specific user (employee/customer)
  function emitToUser(userType, userId, event, payload) {
    const key = `${userType}:${userId}`;
    const sockets = onlineUsers.get(key) || [];
    for (const sockId of sockets) {
      const s = io.sockets.sockets.get(sockId);
      if (s) s.emit(event, payload);
    }
  }

  // allow other parts of the app to access helpers
  app.set("emitGroupCreated", emitGroupCreated);
  app.set("emitToUser", emitToUser);
}
