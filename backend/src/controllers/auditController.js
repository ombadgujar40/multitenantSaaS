import express from "express"
import { getAllAudits, addAudit, getRecentAudits } from "../routes/auditRoutes.js"
import { verifyToken } from "../middleware/verifytoken.js"
import { requirePlatformAdmin } from "../middleware/requirePlatformAdmin.js"
const router = express.Router()

router.get("/health", (req, res) => {
  res.status(200).json({ok: true});
});

router.get("/allaudits", verifyToken, requirePlatformAdmin, getAllAudits)
router.post("/addaudit", verifyToken, addAudit)
router.get("/recentaudits", verifyToken, requirePlatformAdmin, getRecentAudits)
export default router