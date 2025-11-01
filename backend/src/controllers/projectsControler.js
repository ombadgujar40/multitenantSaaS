import express from "express"
import { register, deleteProject, updateProject, getProjects, getProjectsStats } from "../routes/projectsRoutes.js"
import { verifyToken } from "../middleware/verifytoken.js"

const router = express.Router()

router.get("/", (req, res) => {
    res.send("Customer routes")
})

router.post("/register", register)
router.get("/getAllProjects", verifyToken, getProjects)
router.get("/getProjectsStats", verifyToken, getProjectsStats)
router.put("/update/:id", updateProject)
router.delete("/delete/:id", deleteProject)

export default router