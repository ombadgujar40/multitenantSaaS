import { prisma } from "../config/prismaconfig.js";


export const getAllPlans = async (req, res) => {
    try {
        const resp = await prisma.choosedPlan.findMany({
            select: { org: true, Domain: true, Plan: true, Status: true, createdAt: true 
            }
        })

        res.status(200).send(resp)
    } catch (error) {
        console.log(error)
    }
}