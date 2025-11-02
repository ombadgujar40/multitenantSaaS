import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js"

export const register = async (req, res) => {
  try {
    const { orgName, name, email, password } = req.body

    const org = await prisma.organization.findUnique({ where: { name: orgName } })
    if (!org) return res.status(404).json({ message: "Organizaion does not exists" })
    const orgId = org.id
    const user = await prisma.customer.findUnique({ where: { email } })
    if (user) return res.status(400).json({ message: "User already exist" })

    const hashespass = await bcrypt.hash(password, 10)

    const createUser = await prisma.customer.create({
      data: {
        orgId,
        name,
        email,
        password: hashespass,
      }
    })

    res.status(201).json({ message: "customer created successfully", createUser })
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
        const adminResp = await prisma.project.findMany({ where: { orgId: organisation }, select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true } })
        res.status(200).send(adminResp)
        break;
      case "customer":
        const custResp = await prisma.project.findMany({ where: { orgId: organisation, customerId: id }, select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true } })
        res.status(200).send(custResp)
      default:
        res.status(300).send("Unathourized Acess")
        break;
    }
  } catch(error) {
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
        const custResp = await prisma.project.findMany({ where: { orgId: organisation, status: status, customerId: custId }, select: { id: true, name: true, description: true, status: true, createdAt: true, orgId: true, org: true } })
        res.status(200).send(custResp)
      default:
        res.status(300).send("Unathourized Acess")
        break;
    }
  } catch (error) {
    console.log(error)
    res.json({ msg: error })
  }
}

export const updateProject = async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  const updated = await prisma.customer.update({
    where: { id: Number(id) },
    data: { name, email },
  });
  res.json(updated);
}

export const deleteProject = async (req, res) => {
  const { id } = req.params;
  await prisma.customer.delete({ where: { id: Number(id) } });
  res.json({ message: "Deleted successfully" });
}


