import { BattleReviewStatus, CharacterStatName } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { characterStatsSaveRequestSchema } from "@telegram-mini-chat/shared";
import { BattleService } from "../combat/battle.service.js";
import { battleTypeSchema, combatActionSchema } from "../combat/combat.types.js";
import { saveStatAllocations, spendStatPoint } from "../combat/stats.service.js";
import { requireAdmin } from "../middleware/auth.js";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../types.js";

const createBattleSchema = z.object({
  opponentCharacterId: z.coerce.number().int().positive(),
  type: battleTypeSchema.default("NORMAL"),
  eventMultiplier: z.coerce.number().min(0).max(5).optional()
});

const resolveFlagSchema = z.object({
  status: z.enum(["REVIEWED", "DISMISSED", "CONFIRMED_ABUSE"]),
  reviewNote: z.string().trim().max(2000).optional()
});

const statNameSchema = z.enum(["STRENGTH", "AGILITY", "VITALITY", "INTUITION", "INTELLIGENCE", "WISDOM"]);
const battleService = new BattleService(prisma);

export const battlesRouter = Router();
export const adminBattleReviewRouter = Router();
export const charactersRouter = Router();

battlesRouter.post("/battles", async (req, res) => {
  const body = createBattleSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid battle request", details: body.error.flatten() });
  try {
    const characterId = await requireCurrentCharacterId(req as unknown as AuthenticatedRequest);
    const battle = await battleService.createBattle({ initiatorCharacterId: characterId, ...body.data });
    res.status(201).json(battle);
  } catch (error) {
    sendCombatError(res, error);
  }
});

battlesRouter.get("/battles/:id", async (req, res) => {
  const battleId = readPositiveId(req.params.id);
  if (!battleId) return res.status(400).json({ error: "Invalid battle id" });
  try {
    const characterId = await requireCurrentCharacterId(req as unknown as AuthenticatedRequest);
    res.json(await battleService.getBattle(battleId, characterId));
  } catch (error) {
    sendCombatError(res, error);
  }
});

battlesRouter.post("/battles/:id/actions", async (req, res) => {
  const battleId = readPositiveId(req.params.id);
  const action = combatActionSchema.safeParse(req.body);
  if (!battleId || !action.success) return res.status(400).json({ error: "Invalid battle action", details: action.success ? undefined : action.error.flatten() });
  try {
    const characterId = await requireCurrentCharacterId(req as unknown as AuthenticatedRequest);
    res.json(await battleService.submitAction(battleId, characterId, action.data));
  } catch (error) {
    sendCombatError(res, error);
  }
});

battlesRouter.post("/battles/:id/report", async (req, res) => {
  const battleId = readPositiveId(req.params.id);
  if (!battleId) return res.status(400).json({ error: "Invalid battle id" });
  try {
    const characterId = await requireCurrentCharacterId(req as unknown as AuthenticatedRequest);
    res.status(201).json(await battleService.reportBattle(battleId, characterId));
  } catch (error) {
    sendCombatError(res, error);
  }
});

charactersRouter.get("/characters/me/progression", async (req, res) => {
  try {
    const characterId = await requireCurrentCharacterId(req as unknown as AuthenticatedRequest);
    const [progression, stats, masteries] = await Promise.all([
      prisma.characterProgression.upsert({ where: { characterId }, create: { characterId }, update: {} }),
      prisma.characterStats.upsert({ where: { characterId }, create: { characterId }, update: {} }),
      prisma.weaponMastery.findMany({ where: { characterId } })
    ]);
    res.json({ progression: { ...progression, totalExp: progression.totalExp.toString() }, stats, weaponMasteries: masteries });
  } catch (error) {
    sendCombatError(res, error);
  }
});

charactersRouter.post("/characters/me/stats/:statName", async (req, res) => {
  const statName = statNameSchema.safeParse(String(req.params.statName).toUpperCase());
  if (!statName.success) return res.status(400).json({ error: "Invalid stat name" });
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const characterId = await requireCurrentCharacterId(authReq);
    res.json(await spendStatPoint(prisma, characterId, statName.data as CharacterStatName, authReq.authUser.id));
  } catch (error) {
    sendCombatError(res, error);
  }
});

charactersRouter.put("/characters/me/stats", async (req, res) => {
  const body = characterStatsSaveRequestSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid stat allocation", details: body.error.flatten() });
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const characterId = await requireCurrentCharacterId(authReq);
    const result = await saveStatAllocations(prisma, characterId, body.data.allocations, authReq.authUser.id);
    res.json({ stats: result.stats, progression: { ...result.progression, totalExp: result.progression.totalExp.toString() } });
  } catch (error) {
    sendCombatError(res, error);
  }
});

adminBattleReviewRouter.get("/admin/battle-review-flags", requireAdmin, async (req, res) => {
  const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;
  const status = rawStatus ? z.nativeEnum(BattleReviewStatus).safeParse(rawStatus) : undefined;
  if (status && !status.success) return res.status(400).json({ error: "Invalid review status" });
  res.json(await battleService.listReviewFlags(status?.data));
});

adminBattleReviewRouter.post("/admin/battle-review-flags/:id/resolve", requireAdmin, async (req, res) => {
  const flagId = readPositiveId(String(req.params.id));
  const body = resolveFlagSchema.safeParse(req.body);
  if (!flagId || !body.success) return res.status(400).json({ error: "Invalid review resolution", details: body.success ? undefined : body.error.flatten() });
  try {
    const { authUser } = req as AuthenticatedRequest;
    res.json(await battleService.resolveReviewFlag(flagId, authUser.id, body.data.status, body.data.reviewNote));
  } catch (error) {
    sendCombatError(res, error);
  }
});

async function requireCurrentCharacterId(req: AuthenticatedRequest) {
  const profile = await prisma.playerProfile.findUnique({ where: { userId: req.authUser.id }, select: { id: true } });
  if (!profile) throw new Error("Player profile must be registered before using combat");
  return profile.id;
}

function readPositiveId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function sendCombatError(res: { status(code: number): { json(value: unknown): unknown } }, error: unknown) {
  const message = error instanceof Error ? error.message : "Combat request failed";
  const status = /not found/i.test(message) ? 404 : /not a participant|profile must|No available|Cannot battle|does not allow|Invalid|unavailable|already submitted/i.test(message) ? 400 : 500;
  res.status(status).json({ error: message });
}
