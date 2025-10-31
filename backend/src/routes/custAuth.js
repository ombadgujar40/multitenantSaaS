import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prismaconfig.js"

export const register = async (req, res) => {
    try {
        const {orgName, name, email, password } = req.body

        const org = await prisma.organization.findUnique( { where: { name: orgName } } )
        if(!org) return res.status(404).json({message: "Organizaion does not exists"})
        const orgId = org.id
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


