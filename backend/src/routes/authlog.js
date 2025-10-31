import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js"


export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body

        if (role == 'customer') {
            const user = await prisma.customer.findUnique({ where: { email } })
            if (!user) return res.status(400).json({ message: "User not found" });

            const isMatch = await bcrypt.compare(password, user.password)
            if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

            const token = jwt.sign(
                { id: user.id, role: role, organisation: user.orgId },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            )

            res.status(200).json({ message: "Login successful", token });

        } else if (role == 'employee') {
            const user = await prisma.employee.findUnique({ where: { email } })
            if (!user) return res.status(400).json({ message: "User not found" });

            const isMatch = await bcrypt.compare(password, user.password)
            if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

            const token = jwt.sign(
                { id: user.id, role: role, organisation: user.orgId },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            )

            res.status(200).json({ message: "Login successful", token });

        } else {
            const user = await prisma.employee.findUnique({ where: { email } })
            if (!user) return res.status(400).json({ message: "User not found" });

            const isMatch = await bcrypt.compare(password, user.password)
            if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

            const token = jwt.sign(
                { id: user.id, role: "admin", organisation: user.orgId },
                process.env.JWT_SECRET,
                { expiresIn: "7d" }
            )

            res.status(200).json({ message: "Login successful", token });
        }

    } catch (error) {
        console.log(error)
    }
}

export const getUser = async (req, res) => {
    const data = req.user
    // res.send(data.organisation)
    try {
        const organisationName = await prisma.organization.findUnique({ where: { id: data.organisation } })
        // console.log(organisationName)
        if (organisationName) {

            switch (data.role) {
                case "employee":
                    const emp = await prisma.employee.findUnique({ where: { id: data.id }, select: { name: true, email: true, role: true, id: true, orgId: true } })
                    res.status(200).json({ data: emp, role: emp.role })
                    break;

                case "customer":
                    const cust = await prisma.customer.findUnique({ where: { id: data.id }, select: { name: true, email: true } })
                    res.status(200).json({ data: cust, role: "customer" })
                    break;

                case "admin":
                    const admin = await prisma.employee.findUnique({ where: { id: data.id }, select: { name: true, email: true, role:true, id: true, orgId: true } })
                    res.status(200).json({ data: admin, role: admin.role })
                    break;
                default: 
                    return
            }
        } else {
            res.status(502).send("Organisation don't exists")
        }
    } catch (error) {
        console.log(error)
    }
}
