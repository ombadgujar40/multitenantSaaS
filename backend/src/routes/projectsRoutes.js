import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js"

export const register = async (req, res) => {
  try {
    const { name, description, dueDate } = req.body
    const { id, organisation } = req.user

    const org = await prisma.organization.findUnique({ where: { id: organisation } })
    if (!org) return res.status(404).json({ message: "Organizaion does not exists" })

    const createProject = await prisma.project.create({
      data: {
        orgId: organisation,
        customerId: id,
        name,
        description,
        dueDate: new Date(dueDate).toISOString()
      }
    })

    res.status(201).json({ message: "project created successfully", createProject })
  } catch (error) {
    console.log(error)
  }
}


export const getProjects = async (req, res) => {
  const { role, custId } = req.query
  const { organisation, id } = req.user

  try {
    switch (role) {
      case "admin":
        const adminResp = await prisma.project.findMany({ where: { orgId: organisation }, select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true, deliverableLink: true, tasks: true, customer: true, dueDate: true } })
        res.status(200).send(adminResp)
        break;
      case "customer":
        const custResp = await prisma.project.findMany({ where: { orgId: organisation, customerId: id }, select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true, deliverableLink: true, dueDate: true } })
        res.status(200).send(custResp)
        break;
      default:
        res.status(300).send("Unathourized Acess")
        break;
    }
  } catch (error) {
    console.log(error)
  }
}

export const getProjectsStats = async (req, res) => {
  const { role, status, custId } = req.query
  const { organisation } = req.user

  try {
    switch (role) {
      case "admin":
        const adminResp = await prisma.project.findMany({ where: { orgId: organisation, status: status }, select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true } })
        res.status(200).send(adminResp)
        break;
      case "customer":
        const custResp = await prisma.project.findMany({ where: { orgId: organisation, customerId: custId }, select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true, customerId } })
        res.status(200).send(custResp)
      default:

    }
  } catch (error) {
    res.json({ msg: error })
  }
}

export const updateProject = async (req, res) => {
  const { projectId } = req.params;
  const { id, organisation } = req.user
  const { name, description, status, link, dueDate } = req.body;
  const updated = await prisma.project.update({
    where: { id: Number(projectId) },
    data: { name, description, status, deliverableLink: link, dueDate: new Date(dueDate).toISOString() },
  });
  res.json(updated);
}

export const deleteProject = async (req, res) => {
  const { id } = req.params;
  await prisma.project.delete({ where: { id: Number(id) } });
  res.json({ message: "Deleted successfully" });
}


export const getProjectDetail = async (req, res) => {
  const { projId } = req.params;
  try {
    const resp = await prisma.project.findUnique({ where: { id: Number(projId) },select: {tasks: true, createdAt: true, description: true, status: true, name: true, id: true, org: true} })
    res.status(200).send(resp)
  } catch (error) {
    console.log(error)
  }
}