import { CharacterAuditEventType, type Prisma } from "@prisma/client";

type AuditExecutor = Prisma.TransactionClient;

type CharacterAuditInput = {
  characterId: number;
  eventType: CharacterAuditEventType;
  summary: string;
  actorUserId?: number | null;
  beforeState?: Prisma.InputJsonValue | null;
  afterState?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue;
  relatedItemInstanceId?: number | null;
  relatedBattleId?: number | null;
};

export async function recordCharacterAudit(tx: AuditExecutor, input: CharacterAuditInput) {
  return tx.characterAuditLog.create({
    data: {
      characterId: input.characterId,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      summary: input.summary,
      beforeState: input.beforeState ?? undefined,
      afterState: input.afterState ?? undefined,
      metadata: input.metadata ?? {},
      relatedItemInstanceId: input.relatedItemInstanceId ?? null,
      relatedBattleId: input.relatedBattleId ?? null
    }
  });
}
