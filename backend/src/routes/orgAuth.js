import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js";

export const register = async (req, res) => {
    try {
        const { name } = req.body;

        // ✅ Check if organization already exists by name
        const existingOrg = await prisma.organization.findUnique({
            where: { name },
        });

        if (existingOrg)
            return res.status(400).json({ message: "Organization already exists" });

        // ✅ Create new organization
        const organization = await prisma.organization.create({
            data: { name },
        });

        res.status(201).json({
            message: "Organization registered successfully",
            organization,
        });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ message: "Server error" });
    }
}


