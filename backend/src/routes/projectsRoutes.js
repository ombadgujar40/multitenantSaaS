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

export const handleAcceptProject = async (req, res) => {
  const projectId = Number(req.params.id);
  const prisma = req.app.get("prisma");
  const emitGroupCreated = req.app.get("emitGroupCreated");

  try {
    // transaction to update project, create group, add members, add system message
    const result = await prisma.$transaction(async (tx) => {
      // Load project with customer and org info
      const project = await tx.project.findUnique({
        where: { id: projectId },
        include: { customer: true, org: true },
      });

      if (!project) {
        throw new Error("Project not found");
      }

      // update project status -> active
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data: { status: "active" },
      });

      // create chat group (one group per project)
      const group = await tx.chatGroup.create({
        data: {
          projectId: projectId,
          name: project.name,
          orgId: project.orgId,
        },
      });

      // add customer as member (if exists)
      if (project.customer) {
        await tx.groupMember.create({
          data: {
            groupId: group.id,
            customerId: project.customer.id,
            role: "member",
          },
        });
      }

      // add all org admins as members
      const admins = await tx.employee.findMany({
        where: { orgId: project.orgId, role: "admin" },
      });

      for (const admin of admins) {
        await tx.groupMember.create({
          data: {
            groupId: group.id,
            employeeId: admin.id,
            role: "admin",
          },
        });
      }

      // optional: create system message
      const sysMsg = await tx.message.create({
        data: {
          groupId: group.id,
          senderId: 0,
          senderType: "system",
          text: `Group "${group.name}" created for project.`,
        },
      });

      return { updatedProject, group, sysMsg };
    });

    // emit websocket event to notify clients (if helper available)
    if (emitGroupCreated) {
      emitGroupCreated(result.group);
    }

    return res.json({ ok: true, project: result.updatedProject, group: result.group });
  } catch (error) {
    console.error("activate project error:", error);
    return res.status(500).json({ ok: false, message: error.message || "Server error" });
  }
}