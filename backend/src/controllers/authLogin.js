import express from "express"
import { login } from "../routes/authlog.js"

const router = express.Router()

router.post("/login", login)

export default router