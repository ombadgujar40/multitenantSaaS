import express from "express"
import { register } from "../routes/orgAuth.js"
const router = express.Router()

router.get("/", (req, res) => {
    res.send("Organization routes")
})

router.post("/register", register)


export default router


