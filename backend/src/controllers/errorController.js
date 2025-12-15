import express from "express"
import { getErrors, getRecentErrors } from "../routes/errorRoute.js"
import { verifyToken } from "../middleware/verifytoken.js"
import { requirePlatformAdmin } from "../middleware/requirePlatformAdmin.js"
const router = express.Router()

router.get("/health", (req, res) => {
  res.status(200).json({ok: true});
});

router.get("/allerrors", verifyToken, requirePlatformAdmin, getErrors)
router.get("/getrecenterrors", verifyToken, requirePlatformAdmin, getRecentErrors)
export default router