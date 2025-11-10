import express from "express"
import { register, deleteTasks, updateTasks, getTasks, getProjectTasks } from "../routes/taskRoutes.js"
import { verifyToken } from "../middleware/verifytoken.js"

const router = express.Router()

router.get("/", (req, res) => {
    res.send("Customer routes")
})

router.post("/register", register)
router.get("/getAllTasks", verifyToken, getTasks)
router.get("/getProjectTasks/:projectId", verifyToken, getProjectTasks)
// router.put("/update/:id", updateTasks)
router.patch("/update/:id", verifyToken, updateTasks)
router.delete("/delete/:id", deleteTasks)

export default router