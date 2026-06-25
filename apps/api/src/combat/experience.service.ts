import type { Prisma, PrismaClient } from "@prisma/client";
import { CombatBalanceConfig, type ExperienceTableEntry } from "./combat.config.js";
import type { BattleTypeCode, CombatBuff } from "./combat.types.js";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export type ProgressionState = { level: number; up: number; totalExp: bigint; availableStatPoints: number };

export type BattleExperienceInput = {
  level: number;
  up: number;
  damageDealt: number;
  damageReceived: number;
  opponentMaxHp: number;
  ownMaxHp: number;
  opponentLevel: number;
  ownGearScore: number;
  opponentGearScore: number;
  duelType: BattleTypeCode;
  eventMultiplier?: number;
  buffs?: CombatBuff[];
  repeatOpponentCountToday: number;
  suspicionScore: number;
  confirmedAbuse?: boolean;
};

export type BattleExperienceResult = {
  amount: number;
  baseProgressExp: number;
  damageContribution: number;
  levelDifferenceMultiplier: number;
  gearDifferenceMultiplier: number;
  duelTypeMultiplier: number;
  eventMultiplier: number;
  buffMultiplier: number;
  repeatOpponentMultiplier: number;
  suspicionMultiplier: number;
};

export function getRequiredTotalExp(level: number, up: number, table = CombatBalanceConfig.progression.experienceTable): number {
  assertProgressionPosition(level, up);
  const configured = findExperienceEntry(level, up, table);
  if (configured !== undefined) return configured;
  if (level === 1 && up === 0) return 0;

  const { upsPerLevel, baseExpForFirstUp, exponentialGrowth, levelAcceleration } = CombatBalanceConfig.progression;
  let total = 0;
  for (let currentLevel = 1; currentLevel <= level; currentLevel += 1) {
    const lastUp = currentLevel === level ? up : upsPerLevel;
    for (let currentUp = 0; currentUp < lastUp; currentUp += 1) {
      const globalUp = (currentLevel - 1) * upsPerLevel + currentUp;
      total += baseExpForFirstUp * Math.pow(exponentialGrowth, globalUp) * Math.pow(levelAcceleration, currentLevel - 1);
    }
  }
  return Math.floor(total);
}

export function getRequiredExpForNextUp(level: number, up: number) {
  const next = getNextProgressionPosition(level, up);
  return getRequiredTotalExp(next.level, next.up) - getRequiredTotalExp(level, up);
}

export function getNextProgressionPosition(level: number, up: number) {
  assertProgressionPosition(level, up);
  if (up + 1 >= CombatBalanceConfig.progression.upsPerLevel) return { level: level + 1, up: 0 };
  return { level, up: up + 1 };
}

export function calculateBattleExperience(input: BattleExperienceInput): BattleExperienceResult {
  const baseProgressExp = getRequiredExpForNextUp(input.level, input.up) * CombatBalanceConfig.experience.baseProgressFraction;
  const dealtRatio = clamp(input.damageDealt / Math.max(1, input.opponentMaxHp), 0, 1.25);
  const receivedRatio = input.damageReceived / Math.max(1, input.ownMaxHp);
  const dangerousBonus = receivedRatio >= CombatBalanceConfig.experience.dangerousFightDamageReceivedRatio
    ? CombatBalanceConfig.experience.dangerousFightBonus
    : 0;
  const damageContribution = clamp(
    dealtRatio * 1.1 + dangerousBonus,
    CombatBalanceConfig.experience.minimumDamageContribution,
    1.25
  );
  const levelDifferenceMultiplier = clamp(
    1 + (input.opponentLevel - input.level) * CombatBalanceConfig.experience.levelDifferenceStep,
    CombatBalanceConfig.experience.levelDifferenceMinimum,
    CombatBalanceConfig.experience.levelDifferenceMaximum
  );
  const gearDifferenceMultiplier = clamp(
    1 + ((input.opponentGearScore - input.ownGearScore) / 100) * CombatBalanceConfig.experience.gearDifferencePer100,
    CombatBalanceConfig.experience.gearDifferenceMinimum,
    CombatBalanceConfig.experience.gearDifferenceMaximum
  );
  const duelTypeMultiplier = CombatBalanceConfig.experience.duelTypeMultiplier[input.duelType];
  const eventMultiplier = clamp(input.eventMultiplier ?? 1, 0, 5);
  const buffMultiplier = (input.buffs ?? [])
    .filter((buff) => buff.type === "EXP_MULTIPLIER")
    .reduce((multiplier, buff) => multiplier * Math.max(0, buff.value), 1);
  const repeatOpponentMultiplier = getRepeatOpponentMultiplier(input.repeatOpponentCountToday);
  const suspicionMultiplier = input.confirmedAbuse || input.suspicionScore >= CombatBalanceConfig.experience.zeroExpSuspicionScore ? 0 : 1;
  const amount = Math.max(0, Math.floor(
    baseProgressExp
    * damageContribution
    * levelDifferenceMultiplier
    * gearDifferenceMultiplier
    * duelTypeMultiplier
    * eventMultiplier
    * buffMultiplier
    * repeatOpponentMultiplier
    * suspicionMultiplier
  ));

  return {
    amount,
    baseProgressExp,
    damageContribution,
    levelDifferenceMultiplier,
    gearDifferenceMultiplier,
    duelTypeMultiplier,
    eventMultiplier,
    buffMultiplier,
    repeatOpponentMultiplier,
    suspicionMultiplier
  };
}

export function getRepeatOpponentMultiplier(repeatOpponentCountToday: number) {
  if (repeatOpponentCountToday <= CombatBalanceConfig.experience.repeat.fullRewardThrough) return 1;
  if (repeatOpponentCountToday <= CombatBalanceConfig.experience.repeat.reducedRewardThrough) {
    return CombatBalanceConfig.experience.repeat.reducedMultiplier;
  }
  return CombatBalanceConfig.experience.repeat.farmMultiplier;
}

export async function ensureCharacterProgression(executor: PrismaExecutor, characterId: number) {
  return executor.characterProgression.upsert({
    where: { characterId },
    create: { characterId },
    update: {}
  });
}

export async function addExperience(
  executor: PrismaExecutor,
  characterId: number,
  amount: number,
  source: string,
  metadata: Prisma.InputJsonValue = {},
  battleId?: number
) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Experience amount must be a non-negative integer");
  const progression = await ensureCharacterProgression(executor, characterId);
  const updated = await executor.characterProgression.update({
    where: { id: progression.id },
    data: { totalExp: { increment: BigInt(amount) } }
  });
  await executor.experienceLedger.create({
    data: { progressionId: progression.id, battleId, amount: BigInt(amount), source, metadata }
  });
  return checkLevelUpAndUp(executor, updated.id);
}

export async function checkLevelUpAndUp(executor: PrismaExecutor, progressionId: number): Promise<ProgressionState> {
  const progression = await executor.characterProgression.findUniqueOrThrow({ where: { id: progressionId } });
  let level = progression.level;
  let up = progression.up;
  let availableStatPoints = progression.availableStatPoints;
  let next = getNextProgressionPosition(level, up);

  while (progression.totalExp >= BigInt(getRequiredTotalExp(next.level, next.up))) {
    const didGainLevel = next.level > level;
    level = next.level;
    up = next.up;
    availableStatPoints += didGainLevel
      ? CombatBalanceConfig.progression.statPointsOnLevel
      : up % CombatBalanceConfig.progression.statPointsEveryUps === 0
        ? 1
        : 0;
    next = getNextProgressionPosition(level, up);
  }

  const result = await executor.characterProgression.update({
    where: { id: progressionId },
    data: { level, up, availableStatPoints }
  });
  return result;
}

function assertProgressionPosition(level: number, up: number) {
  if (!Number.isInteger(level) || level < 1 || !Number.isInteger(up) || up < 0 || up >= CombatBalanceConfig.progression.upsPerLevel) {
    throw new Error("Invalid level/up position");
  }
}

function findExperienceEntry(level: number, up: number, table: readonly ExperienceTableEntry[]) {
  return table.find((entry) => entry.level === level && entry.up === up)?.requiredTotalExp;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
