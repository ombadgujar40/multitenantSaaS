import express from "express"
import { register, deleteCust, updateCust, getCust } from "../routes/custAuth.js"

const router = express.Router()

router.get("/", (req, res) => {
    res.send("Customer routes")
})

router.post("/register", register)
router.get("/getAllCusts", getCust)
router.put("/update/:id", updateCust)
router.delete("/delete/:id", deleteCust)

export default router