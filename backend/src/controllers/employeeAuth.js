import express from "express"
import { login, register } from "../routes/empAuth.js"
const router = express.Router()

router.get("/", (req, res) => {
    res.send("Employee routes")
})
router.post("/login", login)
router.post("/register", register)


export default router


