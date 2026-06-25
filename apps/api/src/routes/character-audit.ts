import { Router } from "express";
import { z } from "zod";
import { requirePrimaryAdmin } from "../middleware/auth.js";
import { prisma } from "../prisma.js";

export const adminCharacterAuditRouter = Router();

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(80),
  cursor: z.coerce.number().int().positive().optional()
});

adminCharacterAuditRouter.get("/admin/characters/:characterId/audit-log", requirePrimaryAdmin, async (req, res) => {
  const characterId = Number(req.params.characterId);
  const query = auditQuerySchema.safeParse(req.query);

  if (!Number.isInteger(characterId) || characterId <= 0) {
    res.status(400).json({ error: "Invalid character id" });
    return;
  }

  if (!query.success) {
    res.status(400).json({ error: "Invalid audit query", details: query.error.flatten() });
    return;
  }

  const rows = await prisma.characterAuditLog.findMany({
    where: {
      characterId,
      ...(query.data.cursor ? { id: { lt: query.data.cursor } } : {})
    },
    include: {
      actorUser: { select: { id: true, username: true, firstName: true, lastName: true } },
      character: { select: { id: true, nickname: true, userId: true } },
      relatedItemInstance: { select: { id: true, template: { select: { id: true, slug: true, name: true } } } },
      relatedBattle: { select: { id: true, type: true, status: true, winnerCharacterId: true, createdAt: true, finishedAt: true } }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.data.limit
  });

  res.json({
    items: rows.map((row) => ({
      id: row.id,
      character: row.character,
      eventType: row.eventType,
      summary: row.summary,
      actorUser: row.actorUser,
      beforeState: row.beforeState,
      afterState: row.afterState,
      metadata: row.metadata,
      relatedItem: row.relatedItemInstance ? {
        id: row.relatedItemInstance.id,
        template: row.relatedItemInstance.template
      } : null,
      relatedBattle: row.relatedBattle,
      createdAt: row.createdAt.toISOString()
    })),
    nextCursor: rows.length === query.data.limit ? rows[rows.length - 1]?.id ?? null : null
  });
});
