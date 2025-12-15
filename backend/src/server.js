import "dotenv/config"
import express from "express"
import cors from "cors"
import { createServer } from "http";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { pruneAuditLogsIfNeeded } from "./utils/auditRetention.js";


import login from "./controllers/authLogin.js"
import orgauthroutes from "./controllers/organizationAuth.js"
import empauthroutes from "./controllers/employeeAuth.js"
import customerroutes from "./controllers/customerAuth.js"
import allroute from "./controllers/generalAuth.js"
import projectRoute from "./controllers/projectsControler.js"
import taskRoute from "./controllers/taskControler.js"
import chatRoutes from "./controllers/chatController.js";
import superAdminRoute from "./controllers/superAdminController.js"
import planRoute from "./controllers/planController.js"
import auditRoutes from "./controllers/auditController.js"
import errorRoute from "./controllers/errorController.js"





// import socket controller initializer
import { initSocketController } from "./controllers/socketController.js";

const prisma = new PrismaClient();
const app = express()
app.use(cors())
app.use(express.json())

app.use(allroute)
app.use(login)
app.use("/errors", errorRoute)
app.use("/audits", auditRoutes)
app.use("/plans", planRoute)
app.use("/project", projectRoute)
app.use("/task", taskRoute)
app.use("/superadmin", superAdminRoute)
app.use("/organization", orgauthroutes)
app.use("/employee", empauthroutes)
app.use("/chat", chatRoutes);
app.use("/customer", customerroutes)

// create http server + socket.io on top of it
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// attach io & prisma to app for controllers to access
app.set("io", io);
app.set("prisma", prisma);

// initialize socket handlers (separated file)
initSocketController({ io, prisma, app });

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  // Optional: run once on startup
  pruneAuditLogsIfNeeded();

  // Schedule periodic pruning (every 30 minutes)
  setInterval(() => {
    pruneAuditLogsIfNeeded();
  }, 30 * 60 * 1000);
});