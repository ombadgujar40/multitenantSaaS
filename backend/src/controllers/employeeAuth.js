import express from "express";
import { register, getEmps, updateEmp, deleteEmp, login } from "../routes/empAuth.js";
import { verifyToken } from "../middleware/verifytoken.js";

const router = express.Router();
router.get("/health", (req, res) => {
  res.status(200).json({ok: true});
});

router.post("/register", register);
router.get("/getAllEmps", getEmps);
router.put("/update/:id", verifyToken, updateEmp);
router.delete("/delete/:id", deleteEmp);

// optional: if you expose login here (keeps frontend unchanged)
// router.post("/login", login);

export default router;
