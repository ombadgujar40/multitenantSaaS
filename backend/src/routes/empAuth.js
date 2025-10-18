import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js";

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.employee.findUnique({ where: { email } });
        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { id: user.id, role: user.role },
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
    const { orgId, name, email, password, role } = req.body;

    // Check if org exists
    const organization = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!organization) return res.status(400).json({ message: "Organization not found" });

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
      },
    });

    res.status(201).json({ message: "Employee created successfully", employee });
  } catch (error) {
    console.error("Register Employee Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


