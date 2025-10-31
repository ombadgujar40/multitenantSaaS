import express from "express"
import { register, getAll, getOne } from "../routes/orgAuth.js"
const router = express.Router()

router.get("/", (req, res) => {
    res.send("Organization routes")
})

router.post("/register", register)
router.get("/all", getAll)
router.get("/one/:id", getOne)


export default router


