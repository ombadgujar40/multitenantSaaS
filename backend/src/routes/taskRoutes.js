import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js"

export const register = async (req, res) => {
  try {
    const { projectId, assignedToId, title, description, status, dueDate } = req.body

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) return res.status(400).json({ message: "Proejct does not exists" })

    const createTask = await prisma.task.create({
      data: {
        projectId,
        assignedToId,
        title,
        description,
        status,
        dueDate
      }
    })

    res.status(201).json({ message: "customer created successfully", createTask })
  } catch (error) {
    console.log(error)
  }
}


export const getTasks = async (req, res) => {
  const { role, id } = req.query
  const { organisation } = req.user

  try {
    if (role == "admin") {
      const resp = await prisma.task.findMany({ where: { orgId: organisation }, select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true } })
      res.status(200).send(resp)
    } else
      if (role == "employee") {
        const resp = await prisma.task.findMany({ where: { assignedTo: { id: Number(id) } }, select: { id: true, project: true, projectId: true, assignedTo: true, assignedToId: true, title: true, description: true, status: true, dueDate: true, createdAt: true } })
        res.status(200).send(resp)
      } else if (role = "customer") {
        res.status(201).send("customer role")
      } else {
        res.status(301).send("no role")
      }

  } catch (error) {
    console.log(error)
    res.json({ msg: error })
  }
}

export const getProjectTasks = async (req, res) => {
  const { projectId } = req.params
  const { role, id } = req.user

  try {
    if (role == "admin") {
      const resp = await prisma.task.findMany({ where: { projectId: Number(projectId) }, select: { id: true, title: true, description: true, status: true, project: true, assignedTo: true, dueDate: true } })
      res.status(200).send(resp)
    } else
      if (role == "employee") {
        const resp = await prisma.task.findMany({ where: { assignedTo: { id: Number(id) } }, select: { id: true, project: true, projectId: true, assignedTo: true, assignedToId: true, title: true, description: true, status: true, dueDate: true, createdAt: true } })
        res.status(200).send(resp)
      } else if (role == "customer") {
        const resp = await prisma.task.findMany({ where: { projectId: Number(projectId) }, select: { id: true, title: true, description: true, status: true, project: true, assignedTo: true, dueDate: true } })
        res.status(200).send(resp)
      } else {
        res.status(301).send("no role")
      }

  } catch (error) {
    console.log(error)
    res.json({ msg: error })
  }
}

export const updateTasks = async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  const updated = await prisma.customer.update({
    where: { id: Number(id) },
    data: { name, email },
  });
  res.json(updated);
}

export const deleteTasks = async (req, res) => {
  const { id } = req.params;
  await prisma.customer.delete({ where: { id: Number(id) } });
  res.json({ message: "Deleted successfully" });
}