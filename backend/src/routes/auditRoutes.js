import { prisma } from "../config/prismaconfig.js";

export const getAllAudits = async (req, res) => {
    try {
        const resp = await prisma.auditLog.findMany({
            select: { actorId: true, actorEmail: true, action: true, target: true, metadata: true, createdAt: true }
        })

        res.status(200).send(resp)
    } catch (error) {
        console.log(error)
    }
}

export const getRecentAudits = async (req, res) => {
    try {
        const audits = await prisma.auditLog.findMany({
            orderBy: { createdAt: "desc" },  // NEWEST FIRST
            take: 5,                        // only 50 most recent
        });

        res.status(200).send(audits)
    } catch (error) {
        console.log(error)
    }
}

export const addAudit = async (req, res) => {
    try {
        const { actorId, actorEmail, action, target, metadata } = req.body
        const resp = await prisma.auditLog.create({
            data: {
                actorId,
                actorEmail,
                action,
                target,
                metadata
            }
        })

        res.status(200).send(resp)

    } catch (error) {
        console.log(error)
    }
}



