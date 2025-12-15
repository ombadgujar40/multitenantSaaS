import express from "express";
import { login, getUser, register, metricsData } from "../routes/superAdminLog.js";
import { verifyToken } from "../middleware/verifytoken.js";
import { requirePlatformAdmin } from "../middleware/requirePlatformAdmin.js";

const router = express.Router();
router.get("/health", (req, res) => {
  res.status(200).json({ok: true});
});
router.post("/login", login);
router.get("/me", verifyToken, requirePlatformAdmin, getUser);
router.get("/metrics", verifyToken, requirePlatformAdmin, metricsData);
router.post("/register", register);

export default router;
