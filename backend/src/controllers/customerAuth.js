import express from "express"
import { register } from "../routes/custAuth.js"

const router = express.Router()

router.get("/", (req, res) => {
    res.send("Customer routes")
})

router.post("/register", register)

export default router