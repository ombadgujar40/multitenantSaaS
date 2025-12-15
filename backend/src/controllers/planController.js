import express from "express"
import { getAllPlans } from "../routes/planRoutes.js"
import { verifyToken } from "../middleware/verifytoken.js"
import { requirePlatformAdmin } from "../middleware/requirePlatformAdmin.js"
const router = express.Router()


router.get("/health", (req, res) => {
  res.status(200).json({ok: true});
});
router.get("/allplans", verifyToken, requirePlatformAdmin, getAllPlans)
export default router