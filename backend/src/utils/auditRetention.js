import { prisma } from "../config/prismaconfig.js";

const MAX_AUDIT_LOGS = 3000;
const DELETE_BATCH_SIZE = 2000;

export async function pruneAuditLogsIfNeeded() {
  try {
    const total = await prisma.auditLog.count();

    if (total <= MAX_AUDIT_LOGS) return;

    const excess = total - MAX_AUDIT_LOGS;
    const toDelete = Math.max(DELETE_BATCH_SIZE, excess);

    // Find oldest records
    const oldLogs = await prisma.auditLog.findMany({
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: toDelete,
    });

    if (oldLogs.length === 0) return;

    await prisma.auditLog.deleteMany({
      where: {
        id: { in: oldLogs.map(l => l.id) },
      },
    });

    console.log(`[AUDIT] Pruned ${oldLogs.length} old audit logs`);
  } catch (error) {
    // IMPORTANT: never crash app due to pruning
    console.error("[AUDIT PRUNE ERROR]", error);
  }
}
