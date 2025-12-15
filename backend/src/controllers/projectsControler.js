import express from "express";
import { register, deleteProject, handleAcceptProject, updateProject, getProjects, getProjectsStats, getProjectDetail } from "../routes/projectsRoutes.js";
import { verifyToken } from "../middleware/verifytoken.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({ok: true});
});

router.post("/register", verifyToken, register);
router.get("/getAllProjects", verifyToken, getProjects);
router.get("/getProjectsStats", verifyToken, getProjectsStats);
router.get("/getProjectDetail/:projId", getProjectDetail);
router.put("/update/:projectId", verifyToken, updateProject);
router.put("/activate/:id", verifyToken, handleAcceptProject);
router.delete("/delete/:id", deleteProject);

export default router;
