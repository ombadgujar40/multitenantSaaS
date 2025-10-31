import express from "express"
import { register, getEmps, updateEmp, deleteEmp } from "../routes/empAuth.js"
import { verifyToken } from "../middleware/verifytoken.js"
const router = express.Router()

router.post("/register", register)
router.get("/getAllEmps", getEmps)
router.put("/update/:id", updateEmp)
router.delete("/delete/:id", deleteEmp)

export default router


