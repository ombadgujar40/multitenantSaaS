import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js";
import { verifyToken } from "../middleware/verifytoken.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.employee.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.id, role: user.role, orgId: user.orgId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
}

export const register = async (req, res) => {
  try {
    const { orgName, name, email, password, role, designation } = req.body;

    // Check if org exists
    const org = await prisma.organization.findUnique({ where: { name: orgName } })
    if (!org) return res.status(404).json({ message: "Organizaion does not exists" })
    const orgId = org.id

    // Check if email already exists
    const existingEmployee = await prisma.employee.findUnique({ where: { email } });
    if (existingEmployee) return res.status(400).json({ message: "Employee already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create employee
    const employee = await prisma.employee.create({
      data: {
        orgId,
        name,
        email,
        password: hashedPassword,
        role: role || "employee",
        jobPosition: designation
      },
    });

    res.status(201).json({ message: "Employee created successfully", employee });
  } catch (error) {
    console.error("Register Employee Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getEmps = async (req, res) => {
  const { orgId, role } = req.query
  try {
    if (role != "admin") {
      res.status(300).send("Unathourized Acess")
    }
    const resp = await prisma.employee.findMany({ where: { role: "employee", orgId: Number(orgId) }, select: { id: true, name: true, email: true, role: true, jobPosition: true, createdAt: true, orgId: true } })
    res.status(200).send(resp)
  } catch (error) {
    console.log(error)
    res.json({ msg: error })
  }
}

export const updateEmp = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, jobPosition } = req.body;
  const updated = await prisma.employee.update({
    where: { id: Number(id) },
    data: { name, email, role, jobPosition },
  });
  res.json(updated);
}

export const deleteEmp = async (req, res) => {
  const { id } = req.params;
  await prisma.employee.delete({ where: { id: Number(id) } });
  res.json({ message: "Deleted successfully" });
}


