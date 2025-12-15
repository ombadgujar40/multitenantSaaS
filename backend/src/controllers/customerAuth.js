import express from "express";
import { register, deleteCust, updateCust, getCust } from "../routes/custAuth.js";
import { verifyToken } from "../middleware/verifytoken.js"; // use if you have it

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({ok: true});
});

// public register (frontend unchanged)
router.post("/register", register);

// List customers — your existing route accepted orgId & role in query.
// If you have verifyToken middleware, you can protect this route; leaving as-is to avoid frontend changes.
router.get("/getAllCusts", getCust);

// update and delete — these may be protected in frontend flows; keep as-is to avoid frontend changes.
// If you use verifyToken, add it here (router.put("/update/:id", verifyToken, updateCust))
router.put("/update/:id", updateCust);
router.delete("/delete/:id", deleteCust);

export default router;
