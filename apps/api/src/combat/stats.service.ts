import { CharacterAuditEventType, type CharacterStatName, type Prisma, type PrismaClient } from "@prisma/client";
import { recordCharacterAudit } from "../characters/audit.service.js";
import { CombatBalanceConfig } from "./combat.config.js";
import type { CharacterBaseStats, CombatBuff, DerivedCombatStats, EquipmentItem, ItemModifier, WeaponTypeCode } from "./combat.types.js";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;
const zones = ["HEAD", "CHEST", "ABDOMEN", "LEGS"] as const;

export function deriveCombatStats(
  base: CharacterBaseStats,
  equipment: EquipmentItem[],
  masteryByWeapon: Partial<Record<WeaponTypeCode, number>> = {},
  temporaryEffects: CombatBuff[] = [],
  eventEffects: CombatBuff[] = []
): DerivedCombatStats {
  const statBonus = sumStatModifiers(equipment.flatMap((item) => item.modifiers));
  const effective = {
    strength: base.strength + statBonus.STRENGTH,
    agility: base.agility + statBonus.AGILITY,
    vitality: base.vitality + statBonus.VITALITY,
    intuition: base.intuition + statBonus.INTUITION,
    intelligence: base.intelligence + statBonus.INTELLIGENCE,
    wisdom: base.wisdom + statBonus.WISDOM
  };
  const modifiers = sumModifiers(equipment.flatMap((item) => item.modifiers));
  const effects = [...temporaryEffects, ...eventEffects];
  const primaryWeapon = equipment.find((item) => item.slot === "PRIMARY_HAND" && item.weaponType);
  const masteryPoints = primaryWeapon?.weaponType ? masteryByWeapon[primaryWeapon.weaponType] ?? 0 : 0;
  const armorByZone = Object.fromEntries(zones.map((zone) => [zone, 0])) as Record<(typeof zones)[number], number>;
  for (const item of equipment) {
    const durabilityRatio = item.maxDurability <= 0 ? 0 : clamp(item.currentDurability / item.maxDurability, 0, 1);
    for (const zone of zones) armorByZone[zone] += (item.baseArmor + (item.armorByZone[zone] ?? 0)) * durabilityRatio;
  }

  return {
    maxHp: Math.max(1, CombatBalanceConfig.stats.baseHp + effective.vitality * CombatBalanceConfig.stats.hpPerVitality),
    physicalDamageBonus: Math.max(0, effective.strength * CombatBalanceConfig.stats.physicalDamagePerStrength),
    dodgeChance: clamp(effective.agility * CombatBalanceConfig.stats.agilityDodgePerPoint + modifiers.DODGE_CHANCE + sumEffects(effects, "DODGE_CHANCE"), 0, CombatBalanceConfig.stats.maximumPercent),
    antiDodge: clamp(effective.agility * CombatBalanceConfig.stats.agilityAntiDodgePerPoint + effective.strength * CombatBalanceConfig.stats.strengthAntiDodgePerPoint + modifiers.ANTI_DODGE, 0, CombatBalanceConfig.stats.maximumPercent),
    counterAttackChance: clamp(effective.agility * CombatBalanceConfig.stats.agilityCounterAttackPerPoint, 0, CombatBalanceConfig.stats.maximumPercent),
    critChance: clamp(effective.intuition * CombatBalanceConfig.stats.intuitionCritPerPoint + modifiers.CRIT_CHANCE + sumEffects(effects, "CRIT_CHANCE"), 0, CombatBalanceConfig.stats.maximumPercent),
    antiCrit: clamp(effective.intuition * CombatBalanceConfig.stats.intuitionAntiCritPerPoint + effective.strength * CombatBalanceConfig.stats.strengthAntiCritPerPoint + modifiers.ANTI_CRIT, 0, CombatBalanceConfig.stats.maximumPercent),
    blockPierceChance: clamp(effective.strength * CombatBalanceConfig.stats.strengthBlockPiercePerPoint + modifiers.BLOCK_PIERCE_CHANCE, 0, CombatBalanceConfig.stats.maximumPercent),
    injuryChance: clamp(effective.intuition * CombatBalanceConfig.stats.intuitionInjuryChancePerPoint + modifiers.INJURY_CHANCE, 0, CombatBalanceConfig.stats.maximumPercent),
    injuryResistance: clamp(effective.vitality * CombatBalanceConfig.stats.vitalityInjuryResistancePerPoint + modifiers.INJURY_RESISTANCE, 0, CombatBalanceConfig.stats.maximumPercent),
    damageResistancePercent: clamp(effective.vitality * CombatBalanceConfig.stats.vitalityDamageResistancePerPoint + modifiers.DAMAGE_RESISTANCE + sumEffects(effects, "DAMAGE_RESISTANCE"), 0, CombatBalanceConfig.stats.maxDamageResistance),
    hpRegenOutOfCombat: Math.max(0, effective.vitality * CombatBalanceConfig.stats.vitalityHpRegenPerPoint),
    weaponDamageBonus: Math.max(0, modifiers.WEAPON_DAMAGE_BONUS),
    armorByZone,
    masteryDamageBonus: masteryPoints * CombatBalanceConfig.stats.masteryDamageBonusPerVisiblePoint
  };
}

export function calculateGearScore(equipment: EquipmentItem[]) {
  return equipment.reduce((total, item) => {
    const rarity = CombatBalanceConfig.stats.rarityGearScore[item.rarity];
    const modifiers = item.modifiers.reduce((sum, modifier) => sum + Math.abs(modifier.value) * (modifier.type.includes("CHANCE") ? 100 : 1), 0);
    const armor = item.baseArmor + Object.values(item.armorByZone).reduce((sum, value) => sum + (value ?? 0), 0);
    const durability = item.maxDurability > 0 ? clamp(item.currentDurability / item.maxDurability, 0, 1) : 0;
    return total + (rarity + item.levelRequirement * 1.5 + item.baseWeaponDamage * 2 + armor + modifiers) * durability;
  }, 0);
}

export async function ensureCharacterStats(executor: PrismaExecutor, characterId: number) {
  return executor.characterStats.upsert({ where: { characterId }, create: { characterId }, update: {} });
}

export async function spendStatPoint(executor: PrismaClient, characterId: number, statName: CharacterStatName, actorUserId?: number) {
  return executor.$transaction(async (tx) => {
    const progression = await tx.characterProgression.upsert({ where: { characterId }, create: { characterId }, update: {} });
    if (progression.availableStatPoints <= 0) throw new Error("No available stat points");
    const beforeStats = await tx.characterStats.upsert({ where: { characterId }, create: { characterId }, update: {} });
    const field = statName.toLowerCase() as keyof CharacterBaseStats;
    const stats = await tx.characterStats.update({
      where: { characterId },
      data: { [field]: { increment: 1 } }
    });
    const updatedProgression = await tx.characterProgression.update({
      where: { id: progression.id },
      data: { availableStatPoints: { decrement: 1 } }
    });
    await tx.characterStatAllocation.create({ data: { characterId, statName, points: 1 } });
    await recordCharacterAudit(tx, {
      characterId,
      actorUserId,
      eventType: CharacterAuditEventType.STATS_CHANGED,
      summary: `Характеристика ${statLabelByName[statName]} увеличена на 1: ${beforeStats[field]} → ${stats[field]}. Свободные очки: ${progression.availableStatPoints} → ${updatedProgression.availableStatPoints}.`,
      beforeState: { stats: serializeStats(beforeStats), progression: serializeProgression(progression) },
      afterState: { stats: serializeStats(stats), progression: serializeProgression(updatedProgression) },
      metadata: { statName, points: 1, reason: "manual_spend" }
    });
    return { stats, progression: updatedProgression };
  });
}

export async function saveStatAllocations(
  executor: PrismaClient,
  characterId: number,
  allocations: Record<keyof CharacterBaseStats, number>,
  actorUserId?: number
) {
  return executor.$transaction(async (tx) => {
    const total = Object.values(allocations).reduce((sum, value) => sum + value, 0);
    const progression = await tx.characterProgression.upsert({ where: { characterId }, create: { characterId }, update: {} });
    if (total > progression.availableStatPoints) throw new Error("Not enough available stat points");

    const beforeStats = await tx.characterStats.upsert({ where: { characterId }, create: { characterId }, update: {} });
    const stats = total === 0
      ? beforeStats
      : await tx.characterStats.update({
          where: { characterId },
          data: Object.fromEntries(
            Object.entries(allocations)
              .filter(([, value]) => value > 0)
              .map(([field, value]) => [field, { increment: value }])
          )
        });

    const updatedProgression = total === 0
      ? progression
      : await tx.characterProgression.update({
          where: { id: progression.id },
          data: { availableStatPoints: { decrement: total } }
        });

    const statNameByField: Record<keyof CharacterBaseStats, CharacterStatName> = {
      strength: "STRENGTH",
      agility: "AGILITY",
      vitality: "VITALITY",
      intuition: "INTUITION",
      intelligence: "INTELLIGENCE",
      wisdom: "WISDOM"
    };
    const auditRows = Object.entries(allocations)
      .filter(([, value]) => value > 0)
      .map(([field, points]) => ({
        characterId,
        statName: statNameByField[field as keyof CharacterBaseStats],
        points,
        reason: "fitting_room_save"
      }));
    if (auditRows.length > 0) await tx.characterStatAllocation.createMany({ data: auditRows });
    if (total > 0) {
      await recordCharacterAudit(tx, {
        characterId,
        actorUserId,
        eventType: CharacterAuditEventType.STATS_CHANGED,
        summary: `Распределены очки характеристик: ${formatAllocationSummary(allocations)}. Свободные очки: ${progression.availableStatPoints} → ${updatedProgression.availableStatPoints}.`,
        beforeState: { stats: serializeStats(beforeStats), progression: serializeProgression(progression) },
        afterState: { stats: serializeStats(stats), progression: serializeProgression(updatedProgression) },
        metadata: { allocations, total, reason: "fitting_room_save" }
      });
    }

    return { stats, progression: updatedProgression };
  });
}

const statLabelByField: Record<keyof CharacterBaseStats, string> = {
  strength: "Сила",
  agility: "Ловкость",
  vitality: "Выносливость",
  intuition: "Интуиция",
  intelligence: "Интеллект",
  wisdom: "Мудрость"
};

const statLabelByName: Record<CharacterStatName, string> = {
  STRENGTH: "Сила",
  AGILITY: "Ловкость",
  VITALITY: "Выносливость",
  INTUITION: "Интуиция",
  INTELLIGENCE: "Интеллект",
  WISDOM: "Мудрость"
};

function formatAllocationSummary(allocations: Record<keyof CharacterBaseStats, number>) {
  return Object.entries(allocations)
    .filter(([, value]) => value > 0)
    .map(([field, value]) => `${statLabelByField[field as keyof CharacterBaseStats]} +${value}`)
    .join(", ");
}

function serializeStats(stats: CharacterBaseStats) {
  return {
    strength: stats.strength,
    agility: stats.agility,
    vitality: stats.vitality,
    intuition: stats.intuition,
    intelligence: stats.intelligence,
    wisdom: stats.wisdom
  };
}

function serializeProgression(progression: { level: number; up: number; totalExp: bigint; availableStatPoints: number }) {
  return {
    level: progression.level,
    up: progression.up,
    totalExp: progression.totalExp.toString(),
    availableStatPoints: progression.availableStatPoints
  };
}

function sumStatModifiers(modifiers: ItemModifier[]) {
  const result = { STRENGTH: 0, AGILITY: 0, VITALITY: 0, INTUITION: 0, INTELLIGENCE: 0, WISDOM: 0 };
  for (const modifier of modifiers) if (modifier.type in result) result[modifier.type as keyof typeof result] += modifier.value;
  return result;
}

function sumModifiers(modifiers: ItemModifier[]) {
  const result = {
    ANTI_DODGE: 0, ANTI_CRIT: 0, CRIT_CHANCE: 0, DODGE_CHANCE: 0, BLOCK_PIERCE_CHANCE: 0,
    INJURY_CHANCE: 0, INJURY_RESISTANCE: 0, DAMAGE_RESISTANCE: 0, WEAPON_DAMAGE_BONUS: 0
  };
  for (const modifier of modifiers) if (modifier.type in result) result[modifier.type as keyof typeof result] += modifier.value;
  return result;
}

function sumEffects(effects: CombatBuff[], type: CombatBuff["type"]) {
  return effects.filter((effect) => effect.type === type).reduce((sum, effect) => sum + effect.value, 0);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
