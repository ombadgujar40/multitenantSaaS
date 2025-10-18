import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js"

export const login = async (req, res) => {
    try {
        const { email, password } = req.body

        const user = await prisma.customer.findUnique({ where: { email } })
        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            {id: user.id, role: user.role},
            process.env.JWT_SECRET,
            {expiresIn: "7d"}
        )

        res.status(200).json({ message: "Login successful", token });

    } catch (error) {
        console.log(error)
    }
}



export const register = async (req, res) => {
    try {
        const {orgId, name, email, password } = req.body

        const org = await prisma.organization.findUnique( { where: { id: orgId } } )
        if(!org) return res.status(404).json({message: "Organizaion does not exists"})

        const user = await prisma.customer.findUnique({where:{email}})
        if (user) return res.status(400).json({ message: "User already exist"})

        const hashespass = await bcrypt.hash(password, 10)

        const createUser = await prisma.customer.create({
            data: {
                orgId,
                name,
                email,
                password: hashespass,
            }
        })

        res.status(201).json({ message: "customer created successfully", createUser})
    } catch (error) {
        console.log(error)
    }
}
