import { prisma } from "../config/prismaconfig.js";

export const getErrors = async(req, res) => {
    try {
        const resp = await prisma.errorLog.findMany({
            select: { eventType: true, severity: true, message: true, tenantId: true, userId: true, payload: true, createdAt: true }
            })
    
        res.status(200).send(resp)
    } catch (error) {
        console.log(error)
    }
}

export const getRecentErrors = async (req, res) => {
    try {
        const error = await prisma.errorLog.findMany({
            orderBy: { createdAt: "desc" },  // NEWEST FIRST
            take: 5,                        // only 50 most recent
        });

        res.status(200).send(error)
    } catch (error) {
        console.log(error)
    }
}