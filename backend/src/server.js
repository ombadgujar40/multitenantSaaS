import "dotenv/config"
import express from "express"
import cors from "cors"
import { createServer } from "http";
import { Server } from "socket.io";
// import { PrismaClient } from "@prisma/client";
import { prisma } from "./config/prismaconfig.js";
import client from "prom-client";
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

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
});

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});



// import socket controller initializer
import { initSocketController } from "./controllers/socketController.js";

// const prisma = new PrismaClient();
const app = express()

app.use((req, res, next) => {
  const start = process.hrtime();

  res.on("finish", () => {
    const duration = process.hrtime(start);
    const durationSeconds = duration[0] + duration[1] / 1e9;

    const route = req.route?.path || req.path;

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode,
      },
      durationSeconds
    );
  });

  next();
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);

  const metrics = await register.metrics();

  res.end(metrics);
});
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