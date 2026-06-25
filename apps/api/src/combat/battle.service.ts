import { randomUUID } from "node:crypto";
import { BattleReviewStatus, BattleStatus, CharacterAuditEventType, type Prisma, type PrismaClient, type WeaponType } from "@prisma/client";
import { z } from "zod";
import { recordCharacterAudit } from "../characters/audit.service.js";
import { evaluateBattleSuspicion } from "./anti-abuse.service.js";
import { buildCombatant, resolveBattleRound, validateAndNormalizeAction } from "./combat.engine.js";
import { CombatBalanceConfig } from "./combat.config.js";
import { bodyZoneSchema, combatActionSchema, combatBuffSchema, itemModifierSchema, type BattleTypeCode, type CombatAction, type CombatBuff, type EquipmentItem, type RoundCombatant } from "./combat.types.js";
import { addExperience, calculateBattleExperience, ensureCharacterProgression } from "./experience.service.js";
import { addWeaponMasteryProgress, calculateMasteryProgress } from "./mastery.service.js";
import { calculateGearScore, deriveCombatStats, ensureCharacterStats } from "./stats.service.js";

type Transaction = Prisma.TransactionClient;
type ActionRow = { characterId: number; primaryAttackZone: "HEAD" | "CHEST" | "ABDOMEN" | "LEGS"; secondaryAttackZone: "HEAD" | "CHEST" | "ABDOMEN" | "LEGS" | null; defenseZones: Prisma.JsonValue; selectedTechnique: string | null; selectedConsumable: string | null; selectedSpell: string | null; energyCost: number | null };

export type CreateBattleInput = {
  initiatorCharacterId: number;
  opponentCharacterId: number;
  type: BattleTypeCode;
  eventMultiplier?: number;
};

export class BattleService {
  constructor(private readonly prisma: PrismaClient) {}

  async createBattle(input: CreateBattleInput) {
    if (input.initiatorCharacterId === input.opponentCharacterId) throw new Error("Cannot battle yourself");
    return this.prisma.$transaction(async (tx) => {
      const [attacker, defender] = await Promise.all([
        this.loadCombatant(tx, input.initiatorCharacterId),
        this.loadCombatant(tx, input.opponentCharacterId)
      ]);
      const battle = await tx.battle.create({
        data: {
          type: input.type,
          eventMultiplier: input.eventMultiplier ?? 1,
          randomSeed: randomUUID(),
          participants: {
            create: [
              { characterId: attacker.characterId, position: 1, currentHp: attacker.derived.maxHp, maxHpSnapshot: attacker.derived.maxHp, gearScore: calculateGearScore(attacker.equipment), combatBuffs: [] },
              { characterId: defender.characterId, position: 2, currentHp: defender.derived.maxHp, maxHpSnapshot: defender.derived.maxHp, gearScore: calculateGearScore(defender.equipment), combatBuffs: [] }
            ]
          }
        },
        include: { participants: true }
      });
      for (const participant of battle.participants) {
        await recordCharacterAudit(tx, {
          characterId: participant.characterId,
          eventType: CharacterAuditEventType.BATTLE_CREATED,
          summary: `Создан поединок #${battle.id}: тип ${battle.type}, позиция ${participant.position}.`,
          afterState: { battleId: battle.id, status: battle.status, maxHpSnapshot: participant.maxHpSnapshot, gearScore: participant.gearScore },
          metadata: { battleType: battle.type, opponentCharacterId: participant.characterId === input.initiatorCharacterId ? input.opponentCharacterId : input.initiatorCharacterId },
          relatedBattleId: battle.id
        });
      }
      return battle;
    });
  }

  async submitAction(battleId: number, characterId: number, rawAction: unknown) {
    const parsed = combatActionSchema.safeParse(rawAction);
    if (!parsed.success) throw new Error("Invalid combat action");
    return this.prisma.$transaction(async (tx) => {
      const battle = await tx.battle.findUnique({
        where: { id: battleId },
        include: { participants: { orderBy: { position: "asc" } }, rounds: { orderBy: { roundNumber: "desc" }, take: 1 } }
      });
      if (!battle) throw new Error("Battle not found");
      if (battle.status === BattleStatus.FINISHED || battle.status === BattleStatus.CANCELLED) throw new Error("Battle is no longer active");
      const participant = battle.participants.find((item) => item.characterId === characterId);
      if (!participant) throw new Error("Character is not a participant of this battle");
      const currentRound = (battle.rounds[0]?.roundNumber ?? 0) + 1;
      const alreadySubmitted = await tx.battleAction.findUnique({ where: { battleId_roundNumber_characterId: { battleId, roundNumber: currentRound, characterId } } });
      if (alreadySubmitted) throw new Error("Action already submitted for this round");

      const combatant = await this.loadCombatant(tx, characterId, participant.currentHp);
      const action = validateAndNormalizeAction(parsed.data, combatant.equipmentMode);
      await this.consumeSelectedConsumable(tx, characterId, action.selectedConsumable);
      await tx.battleAction.create({
        data: {
          battleId,
          roundNumber: currentRound,
          characterId,
          primaryAttackZone: action.primaryAttackZone,
          secondaryAttackZone: action.secondaryAttackZone,
          defenseZones: action.defenseZones,
          selectedTechnique: action.selectedTechnique ?? null,
          selectedConsumable: action.selectedConsumable ?? null,
          selectedSpell: action.selectedSpell ?? null,
          energyCost: action.energyCost ?? null
        }
      });
      const actions = await tx.battleAction.findMany({ where: { battleId, roundNumber: currentRound } });
      if (actions.length < 2) {
        await tx.battle.update({ where: { id: battleId }, data: { status: BattleStatus.PENDING_ACTIONS } });
        return { resolved: false, awaitingCharacterIds: battle.participants.filter((item) => item.characterId !== characterId).map((item) => item.characterId) };
      }
      return { resolved: true, result: await this.resolveCurrentRound(tx, battle, currentRound, actions as ActionRow[]) };
    });
  }

  async reportBattle(battleId: number, reporterCharacterId: number) {
    return this.prisma.$transaction(async (tx) => {
      const participant = await tx.battleParticipant.findUnique({ where: { battleId_characterId: { battleId, characterId: reporterCharacterId } } });
      if (!participant) throw new Error("Only a battle participant can report this battle");
      const flag = await tx.battleReviewFlag.create({
        data: { battleId, reporterCharacterId, reason: "USER_REPORTED", suspicionScore: 0.5 }
      });
      await tx.battle.update({ where: { id: battleId }, data: { reviewStatus: BattleReviewStatus.PENDING } });
      return flag;
    });
  }

  async listReviewFlags(status?: BattleReviewStatus) {
    return this.prisma.battleReviewFlag.findMany({
      where: status ? { status } : undefined,
      include: {
        battle: { include: { participants: { include: { character: true } } } },
        reporter: true,
        reviewedBy: { select: { id: true, username: true, firstName: true, lastName: true } }
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }]
    });
  }

  async resolveReviewFlag(flagId: number, reviewerUserId: number, status: Exclude<BattleReviewStatus, "NONE" | "PENDING">, reviewNote?: string) {
    return this.prisma.$transaction(async (tx) => {
      const flag = await tx.battleReviewFlag.update({
        where: { id: flagId },
        data: { status, reviewedByUserId: reviewerUserId, reviewNote: reviewNote?.trim() || null, reviewedAt: new Date() }
      });
      const remainingPending = await tx.battleReviewFlag.count({ where: { battleId: flag.battleId, status: BattleReviewStatus.PENDING } });
      await tx.battle.update({
        where: { id: flag.battleId },
        data: { reviewStatus: status === BattleReviewStatus.CONFIRMED_ABUSE ? status : remainingPending > 0 ? BattleReviewStatus.PENDING : status }
      });
      return flag;
    });
  }

  async getBattle(battleId: number, viewerCharacterId: number) {
    const battle = await this.prisma.battle.findUnique({
      where: { id: battleId },
      include: { participants: { include: { character: true }, orderBy: { position: "asc" } }, rounds: { orderBy: { roundNumber: "asc" } }, logs: { orderBy: { createdAt: "asc" } }, reviewFlags: true }
    });
    if (!battle || !battle.participants.some((participant) => participant.characterId === viewerCharacterId)) throw new Error("Battle not found");
    return battle;
  }

  private async resolveCurrentRound(tx: Transaction, battle: Awaited<ReturnType<Transaction["battle"]["findUnique"]>> & { participants: Array<{ characterId: number; currentHp: number; maxHpSnapshot: number; gearScore: number; combatBuffs: Prisma.JsonValue; position: number; id: number }> }, roundNumber: number, rows: ActionRow[]) {
    const [attackerParticipant, defenderParticipant] = battle.participants;
    if (!attackerParticipant || !defenderParticipant) throw new Error("A battle needs two participants");
    const [attacker, defender] = await Promise.all([
      this.loadCombatant(tx, attackerParticipant.characterId, attackerParticipant.currentHp, attackerParticipant.combatBuffs),
      this.loadCombatant(tx, defenderParticipant.characterId, defenderParticipant.currentHp, defenderParticipant.combatBuffs)
    ]);
    const attackerAction = actionFromRow(rows.find((row) => row.characterId === attacker.characterId));
    const defenderAction = actionFromRow(rows.find((row) => row.characterId === defender.characterId));
    const result = resolveBattleRound({ roundNumber, attacker, defender, attackerAction, defenderAction, seed: `${battle.randomSeed}:${roundNumber}` });

    for (const participant of battle.participants) {
      const hp = result.hpAfter[String(participant.characterId)] ?? participant.currentHp;
      const hitsByParticipant = result.hits.filter((hit) => hit.attackerCharacterId === participant.characterId);
      const received = result.hits.filter((hit) => hit.defenderCharacterId === participant.characterId);
      await tx.battleParticipant.update({
        where: { id: participant.id },
        data: {
          currentHp: hp,
          damageDealt: { increment: hitsByParticipant.reduce((sum, hit) => sum + hit.damage, 0) },
          damageReceived: { increment: received.reduce((sum, hit) => sum + hit.damage, 0) },
          successfulHits: { increment: hitsByParticipant.filter((hit) => hit.damage > 0).length }
        }
      });
    }
    await tx.battleRound.create({ data: { battleId: battle.id, roundNumber, actions: rows as unknown as Prisma.InputJsonValue, result: result as unknown as Prisma.InputJsonValue } });
    await tx.battleLogEntry.create({ data: { battleId: battle.id, roundNumber, eventType: "ROUND_RESOLVED", messageKey: "combat.round_resolved", metadata: result as unknown as Prisma.InputJsonValue } });
    for (const hit of result.hits) {
      await tx.battleLogEntry.create({ data: { battleId: battle.id, roundNumber, eventType: "HIT", messageKey: hit.logMessageKey, metadata: hit as unknown as Prisma.InputJsonValue } });
      if (hit.injuryCandidate.candidate) await tx.battleLogEntry.create({ data: { battleId: battle.id, roundNumber, eventType: "INJURY_CANDIDATE", messageKey: "combat.injury_candidate", metadata: hit as unknown as Prisma.InputJsonValue } });
      if (hit.durabilityDamage) await this.applyCriticalDurabilityDamage(tx, hit.defenderCharacterId, hit.durabilityDamage.zone, hit.durabilityDamage.amount);
    }
    const hpA = result.hpAfter[String(attacker.characterId)] ?? attacker.currentHp;
    const hpB = result.hpAfter[String(defender.characterId)] ?? defender.currentHp;
    const finished = hpA <= 0 || hpB <= 0 || roundNumber >= CombatBalanceConfig.combat.maximumRounds;
    if (!finished) {
      await tx.battle.update({ where: { id: battle.id }, data: { status: BattleStatus.ACTIVE } });
      return result;
    }
    const winnerCharacterId = hpA === hpB ? null : hpA > hpB ? attacker.characterId : defender.characterId;
    await tx.battle.update({ where: { id: battle.id }, data: { status: BattleStatus.FINISHED, winnerCharacterId, finishedAt: new Date() } });
    await tx.battleParticipant.updateMany({ where: { battleId: battle.id }, data: { isWinner: false } });
    if (winnerCharacterId) {
      await tx.battleParticipant.update({
        where: { battleId_characterId: { battleId: battle.id, characterId: winnerCharacterId } },
        data: { isWinner: true }
      });
    }
    const finishedParticipants = await tx.battleParticipant.findMany({ where: { battleId: battle.id } });
    const awards = await this.finalizeBattle(tx, battle.id, battle.type, battle.eventMultiplier, roundNumber, finishedParticipants, winnerCharacterId);
    const finalResult = { ...result, winnerCharacterId, awards };
    await tx.battle.update({ where: { id: battle.id }, data: { result: finalResult as unknown as Prisma.InputJsonValue } });
    await tx.battleLogEntry.create({ data: { battleId: battle.id, roundNumber, eventType: "BATTLE_FINISHED", messageKey: "combat.battle_finished", metadata: finalResult as unknown as Prisma.InputJsonValue } });
    return finalResult;
  }

  private async finalizeBattle(tx: Transaction, battleId: number, type: BattleTypeCode, eventMultiplier: number, rounds: number, participants: Array<{ characterId: number; currentHp: number; maxHpSnapshot: number; gearScore: number; damageDealt: number; damageReceived: number; successfulHits: number; combatBuffs: Prisma.JsonValue }>, winnerCharacterId: number | null) {
    const [first, second] = participants;
    if (!first || !second) throw new Error("A battle needs two participants");
    const pairHistory = await this.getPairHistory(tx, battleId, first.characterId, second.characterId);
    const suspicion = evaluateBattleSuspicion({
      pairBattlesToday: pairHistory.count + 1,
      repeatedLosses: winnerCharacterId ? pairHistory.lossesByCharacter.get(winnerCharacterId === first.characterId ? second.characterId : first.characterId) ?? 0 : 0,
      totalDamage: first.damageDealt + second.damageDealt,
      combinedMaxHp: first.maxHpSnapshot + second.maxHpSnapshot,
      rounds,
      gearDifference: Math.abs(first.gearScore - second.gearScore),
      hasSharedIpOrDevice: false
    });
    const reviewStatus = suspicion.suspicionScore >= CombatBalanceConfig.antiAbuse.autoFlagScore ? BattleReviewStatus.PENDING : BattleReviewStatus.NONE;
    await tx.battle.update({ where: { id: battleId }, data: { suspicionScore: suspicion.suspicionScore, reviewStatus } });
    for (const signal of suspicion.signals) {
      if (suspicion.suspicionScore >= CombatBalanceConfig.antiAbuse.autoFlagScore) {
        await tx.battleReviewFlag.create({ data: { battleId, reason: signal.reason, suspicionScore: signal.score } });
      }
    }
    if (suspicion.signals.length) await tx.battleLogEntry.create({ data: { battleId, eventType: "SUSPICION_FLAGGED", messageKey: "combat.suspicion_flagged", metadata: suspicion as unknown as Prisma.InputJsonValue } });

    const awards = [] as Array<{ characterId: number; experience: number; mastery: number }>;
    for (const participant of participants) {
      const opponent = participant.characterId === first.characterId ? second : first;
      const progression = await ensureCharacterProgression(tx, participant.characterId);
      const experience = calculateBattleExperience({
        level: progression.level,
        up: progression.up,
        damageDealt: participant.damageDealt,
        damageReceived: participant.damageReceived,
        opponentMaxHp: opponent.maxHpSnapshot,
        ownMaxHp: participant.maxHpSnapshot,
        opponentLevel: (await ensureCharacterProgression(tx, opponent.characterId)).level,
        ownGearScore: participant.gearScore,
        opponentGearScore: opponent.gearScore,
        duelType: type,
        eventMultiplier,
        buffs: parseBuffs(participant.combatBuffs),
        repeatOpponentCountToday: pairHistory.count + 1,
        suspicionScore: suspicion.suspicionScore
      });
      const updatedProgression = await addExperience(tx, participant.characterId, experience.amount, "battle", experience as unknown as Prisma.InputJsonValue, battleId);
      await tx.battleParticipant.update({ where: { battleId_characterId: { battleId, characterId: participant.characterId } }, data: { expAwarded: experience.amount } });
      await tx.battleLogEntry.create({ data: { battleId, eventType: "EXPERIENCE_AWARDED", messageKey: "combat.experience_awarded", metadata: { characterId: participant.characterId, ...experience } } });
      await recordCharacterAudit(tx, {
        characterId: participant.characterId,
        eventType: CharacterAuditEventType.EXPERIENCE_CHANGED,
        summary: `Опыт за поединок #${battleId}: +${experience.amount}. Всего опыта: ${progression.totalExp.toString()} → ${updatedProgression.totalExp.toString()}.`,
        beforeState: { level: progression.level, up: progression.up, totalExp: progression.totalExp.toString(), availableStatPoints: progression.availableStatPoints },
        afterState: { level: updatedProgression.level, up: updatedProgression.up, totalExp: updatedProgression.totalExp.toString(), availableStatPoints: updatedProgression.availableStatPoints },
        metadata: experience as unknown as Prisma.InputJsonValue,
        relatedBattleId: battleId
      });

      const combatant = await this.loadCombatant(tx, participant.characterId, participant.currentHp, participant.combatBuffs);
      const weapons = [combatant.primaryWeapon, combatant.secondaryWeapon].filter((weapon): weapon is EquipmentItem & { weaponType: NonNullable<EquipmentItem["weaponType"]> } => Boolean(weapon?.weaponType));
      let masteryAward = 0;
      for (const weapon of weapons) {
        const progress = calculateMasteryProgress({
          visibleSkillValue: 0,
          rounds,
          successfulAttacks: participant.successfulHits / weapons.length,
          damageDealt: participant.damageDealt / weapons.length,
          opponentMaxHp: opponent.maxHpSnapshot,
          opponentLevel: (await ensureCharacterProgression(tx, opponent.characterId)).level,
          duelType: type,
          suspicionScore: suspicion.suspicionScore
        });
        await addWeaponMasteryProgress(tx, participant.characterId, weapon.weaponType as WeaponType, progress);
        masteryAward += progress;
      }
      await tx.battleParticipant.update({ where: { battleId_characterId: { battleId, characterId: participant.characterId } }, data: { masteryProgressAwarded: masteryAward } });
      await tx.battleLogEntry.create({ data: { battleId, eventType: "MASTERY_AWARDED", messageKey: "combat.mastery_awarded", metadata: { characterId: participant.characterId, masteryAward } } });
      if (masteryAward > 0) {
        await recordCharacterAudit(tx, {
          characterId: participant.characterId,
          eventType: CharacterAuditEventType.MASTERY_CHANGED,
          summary: `Прогресс владения оружием за поединок #${battleId}: +${masteryAward.toFixed(2)} скрытого опыта.`,
          afterState: { masteryAward },
          metadata: { rounds, successfulHits: participant.successfulHits, damageDealt: participant.damageDealt },
          relatedBattleId: battleId
        });
      }
      awards.push({ characterId: participant.characterId, experience: experience.amount, mastery: masteryAward });
    }
    for (const participant of participants) {
      const isWinner = winnerCharacterId === participant.characterId;
      const resultLabel = winnerCharacterId === null ? "ничья" : isWinner ? "победа" : "поражение";
      await recordCharacterAudit(tx, {
        characterId: participant.characterId,
        eventType: CharacterAuditEventType.BATTLE_FINISHED,
        summary: `Завершён поединок #${battleId}: ${resultLabel}, раундов ${rounds}, урон нанесён ${participant.damageDealt.toFixed(1)}, получено ${participant.damageReceived.toFixed(1)}.`,
        afterState: {
          battleId,
          result: resultLabel,
          winnerCharacterId,
          currentHp: participant.currentHp,
          damageDealt: participant.damageDealt,
          damageReceived: participant.damageReceived,
          successfulHits: participant.successfulHits
        },
        metadata: { suspicionScore: suspicion.suspicionScore, reviewStatus },
        relatedBattleId: battleId
      });
    }
    return awards;
  }

  private async getPairHistory(tx: Transaction, currentBattleId: number, firstCharacterId: number, secondCharacterId: number) {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const battles = await tx.battle.findMany({
      where: { id: { not: currentBattleId }, status: BattleStatus.FINISHED, finishedAt: { gte: since }, participants: { some: { characterId: firstCharacterId } } },
      include: { participants: { select: { characterId: true } } }
    });
    const pairBattles = battles.filter((battle) => battle.participants.some((participant) => participant.characterId === secondCharacterId));
    const lossesByCharacter = new Map<number, number>();
    for (const battle of pairBattles) {
      if (battle.winnerCharacterId) lossesByCharacter.set(battle.winnerCharacterId, (lossesByCharacter.get(battle.winnerCharacterId) ?? 0) + 1);
    }
    return { count: pairBattles.length, lossesByCharacter };
  }

  private async loadCombatant(tx: Transaction, characterId: number, currentHp?: number, combatBuffs: Prisma.JsonValue = []) : Promise<RoundCombatant> {
    const [profile, stats, equipmentRows, masteries] = await Promise.all([
      tx.playerProfile.findUnique({ where: { id: characterId } }),
      ensureCharacterStats(tx, characterId),
      tx.itemInstance.findMany({ where: { characterId, equippedSlot: { not: null }, quantity: { gt: 0 } }, include: { template: true } }),
      tx.weaponMastery.findMany({ where: { characterId } })
    ]);
    if (!profile) throw new Error("Character not found");
    const equipment = equipmentRows.map(toEquipmentItem);
    const masteryByWeapon = Object.fromEntries(masteries.map((mastery) => [mastery.weaponType, mastery.visibleSkillValue]));
    const derived = deriveCombatStats(stats, equipment, masteryByWeapon, parseBuffs(combatBuffs));
    return buildCombatant({ characterId, currentHp: currentHp ?? derived.maxHp, derived, equipment });
  }

  private async applyCriticalDurabilityDamage(tx: Transaction, characterId: number, zone: string, amount: number) {
    const priorities: Record<string, Array<"HELMET" | "ARMOR" | "BELT" | "PANTS" | "BOOTS">> = {
      HEAD: ["HELMET"], CHEST: ["ARMOR"], ABDOMEN: ["BELT", "ARMOR", "PANTS"], LEGS: ["PANTS", "BOOTS"]
    };
    const candidates = await tx.itemInstance.findMany({ where: { characterId, equippedSlot: { in: priorities[zone] ?? [] } }, orderBy: { id: "asc" } });
    const item = candidates[0];
    if (!item) return;
    const nextDurability = Math.max(0, Number(item.currentDurability) - amount);
    const updated = await tx.itemInstance.update({ where: { id: item.id }, data: { currentDurability: nextDurability } });
    await recordCharacterAudit(tx, {
      characterId,
      eventType: CharacterAuditEventType.ITEM_DURABILITY_CHANGED,
      summary: `Прочность предмета #${item.id} снижена из-за удара в зону ${zone}: ${item.currentDurability.toString()} → ${updated.currentDurability.toString()}.`,
      beforeState: { itemInstanceId: item.id, currentDurability: item.currentDurability.toString() },
      afterState: { itemInstanceId: updated.id, currentDurability: updated.currentDurability.toString() },
      metadata: { zone, amount },
      relatedItemInstanceId: item.id
    });
  }

  private async consumeSelectedConsumable(tx: Transaction, characterId: number, selectedConsumable?: string | null) {
    if (!selectedConsumable) return;
    const itemId = Number(selectedConsumable);
    if (!Number.isInteger(itemId) || itemId <= 0) throw new Error("selectedConsumable must be an item instance id");
    const item = await tx.itemInstance.findFirst({ where: { id: itemId, characterId, template: { isConsumable: true }, quantity: { gt: 0 } }, include: { template: true } });
    if (!item) throw new Error("Consumable item is unavailable");
    const updated = await tx.itemInstance.update({ where: { id: item.id }, data: { quantity: { decrement: 1 } } });
    await recordCharacterAudit(tx, {
      characterId,
      eventType: CharacterAuditEventType.ITEM_CONSUMED,
      summary: `Использован расходник "${item.template.name}" (#${item.id}): ${item.quantity} → ${updated.quantity}.`,
      beforeState: { itemInstanceId: item.id, quantity: item.quantity },
      afterState: { itemInstanceId: updated.id, quantity: updated.quantity },
      metadata: { templateId: item.templateId, templateSlug: item.template.slug },
      relatedItemInstanceId: item.id
    });
  }
}

function actionFromRow(row: ActionRow | undefined): CombatAction {
  if (!row) throw new Error("Both battle actions are required");
  const defenseZones = Array.isArray(row.defenseZones) ? row.defenseZones.map((zone) => bodyZoneSchema.parse(zone)) : [];
  return {
    primaryAttackZone: row.primaryAttackZone,
    secondaryAttackZone: row.secondaryAttackZone,
    defenseZones,
    selectedTechnique: row.selectedTechnique,
    selectedConsumable: row.selectedConsumable,
    selectedSpell: row.selectedSpell,
    energyCost: row.energyCost
  };
}

function toEquipmentItem(row: {
  id: number; equippedSlot: "HELMET" | "ARMOR" | "BELT" | "PANTS" | "BOOTS" | "PRIMARY_HAND" | "OFF_HAND" | null; quantity: number; currentDurability: { toString(): string }; maxDurability: { toString(): string };
  template: { rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY"; levelRequirement: number; weaponType: string | null; handType: string | null; canDualWield: boolean; offhandDamageMultiplier: number; shieldBlockZoneBonus: number; baseWeaponDamage: number; baseArmor: number; modifiers: Prisma.JsonValue; armorByZone: Prisma.JsonValue; isConsumable: boolean }
}): EquipmentItem {
  if (!row.equippedSlot) throw new Error("Equipment slot is required");
  const modifiers = itemModifierSchema.array().safeParse(row.template.modifiers);
  const armor = z.record(bodyZoneSchema, z.number()).safeParse(row.template.armorByZone);
  const armorByZone = armor.success ? armor.data : {};
  return {
    id: row.id, slot: row.equippedSlot, rarity: row.template.rarity, levelRequirement: row.template.levelRequirement,
    weaponType: row.template.weaponType as EquipmentItem["weaponType"], handType: row.template.handType as EquipmentItem["handType"], canDualWield: row.template.canDualWield,
    offhandDamageMultiplier: row.template.offhandDamageMultiplier, shieldBlockZoneBonus: row.template.shieldBlockZoneBonus,
    baseWeaponDamage: row.template.baseWeaponDamage, baseArmor: row.template.baseArmor,
    currentDurability: Number(row.currentDurability), maxDurability: Number(row.maxDurability), modifiers: modifiers.success ? modifiers.data : [],
    armorByZone, isConsumable: row.template.isConsumable, quantity: row.quantity
  };
}

function parseBuffs(value: Prisma.JsonValue): CombatBuff[] {
  const parsed = combatBuffSchema.array().safeParse(value);
  return parsed.success ? parsed.data : [];
}
