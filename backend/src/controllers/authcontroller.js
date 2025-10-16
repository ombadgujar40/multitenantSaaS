import express from "express"
import { login, register } from "../routes/auth.js"
const router = express.Router()

router.get("/", (req, res) => {
    res.send("Hellllllooo")
})
router.post("/login", login)
router.post("/register", register)


export default router


