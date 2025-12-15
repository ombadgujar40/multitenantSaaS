import express from "express";
import { login, getUser } from "../routes/authlog.js";
import { verifyToken } from "../middleware/verifytoken.js"; // keep if you use it

const router = express.Router();

router.post("/login", login);

// getUser requires auth
// router.get("/user", verifyToken, getUser);

export default router;
