import express from "express"
import { login, register, getEmp } from "../routes/empAuth.js"
import { verifyToken } from "../middleware/verifytoken.js"
const router = express.Router()

router.get("/me", verifyToken, getEmp)
router.post("/login", login)
router.post("/register", register)


export default router


