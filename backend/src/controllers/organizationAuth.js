import express from "express";
import { register, getAll, getOne, updateOrg } from "../routes/orgAuth.js";
import { verifyToken } from "../middleware/verifytoken.js"; // optional: use if you have it
import { requirePlatformAdmin } from "../middleware/requirePlatformAdmin.js";

const router = express.Router();
router.get("/health", (req, res) => {
  res.status(200).json({ok: true});
});

// keep public API same so frontend needs no change
router.post("/register", register);
router.get("/all", getAll);
router.get("/one/:id", getOne);
router.put("/updateplan/:id", verifyToken, requirePlatformAdmin, updateOrg);
export default router;
