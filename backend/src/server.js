import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { prisma } from "./config/prismaconfig.js";
import { pruneAuditLogsIfNeeded } from "./utils/auditRetention.js";

import login from "./controllers/authLogin.js";
import orgauthroutes from "./controllers/organizationAuth.js";
import empauthroutes from "./controllers/employeeAuth.js";
import customerroutes from "./controllers/customerAuth.js";
import allroute from "./controllers/generalAuth.js";
import projectRoute from "./controllers/projectsControler.js";
import taskRoute from "./controllers/taskControler.js";
import chatRoutes from "./controllers/chatController.js";
import superAdminRoute from "./controllers/superAdminController.js";
import planRoute from "./controllers/planController.js";
import auditRoutes from "./controllers/auditController.js";
import errorRoute from "./controllers/errorController.js";

import { initSocketController } from "./controllers/socketController.js";

const app = express();

app.use(cors());
app.use(express.json());

// Application routes
app.use(allroute);
app.use(login);
app.use("/errors", errorRoute);
app.use("/audits", auditRoutes);
app.use("/plans", planRoute);
app.use("/project", projectRoute);
app.use("/task", taskRoute);
app.use("/superadmin", superAdminRoute);
app.use("/organization", orgauthroutes);
app.use("/employee", empauthroutes);
app.use("/chat", chatRoutes);
app.use("/customer", customerroutes);

// HTTP server and Socket.IO
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Share dependencies with controllers
app.set("io", io);
app.set("prisma", prisma);

// Initialize socket handlers
initSocketController({ io, prisma, app });

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;

let auditRetentionTimer;
let isShuttingDown = false;

async function startServer() {
  try {
    await prisma.$connect();
    console.log("Prisma connected");
  } catch (error) {
    console.error("Prisma connection failed:", error);
    process.exitCode = 1;
    return;
  }

  httpServer.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);

    // Run audit retention once on startup
    void pruneAuditLogsIfNeeded().catch((error) => {
      console.error("Initial audit retention failed:", error);
    });

    // Run audit retention every 30 minutes
    auditRetentionTimer = setInterval(() => {
      void pruneAuditLogsIfNeeded().catch((error) => {
        console.error("Scheduled audit retention failed:", error);
      });
    }, 30 * 60 * 1000);
  });
}

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log(`${signal} received. Starting graceful shutdown...`);

  if (auditRetentionTimer) {
    clearInterval(auditRetentionTimer);
  }

  // Closing Socket.IO also closes its underlying HTTP server.
  io.close(async () => {
    console.log("HTTP server and Socket.IO closed");

    try {
      await prisma.$disconnect();
      console.log("Prisma disconnected");
      console.log("Graceful shutdown complete");
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

void startServer();
```
