import express from "express"
import { getUser } from "../routes/authlog.js"
import { verifyToken } from "../middleware/verifytoken.js"
const router = express.Router()

router.get("/me", verifyToken, getUser)
export default router