import type { Prisma, PrismaClient, WeaponType } from "@prisma/client";
import { CombatBalanceConfig } from "./combat.config.js";
import type { BattleTypeCode } from "./combat.types.js";

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export type MasteryProgressInput = {
  visibleSkillValue: number;
  rounds: number;
  successfulAttacks: number;
  damageDealt: number;
  opponentMaxHp: number;
  opponentLevel: number;
  duelType: BattleTypeCode;
  suspicionScore: number;
  confirmedAbuse?: boolean;
};

export function getRequiredHiddenProgress(visibleSkillValue: number) {
  return CombatBalanceConfig.mastery.thresholdBase
    * Math.pow(visibleSkillValue + 1, CombatBalanceConfig.mastery.thresholdExponent);
}

export function getWeaponMasteryDamageBonus(visibleSkillValue: number) {
  return visibleSkillValue * CombatBalanceConfig.stats.masteryDamageBonusPerVisiblePoint;
}

export function calculateMasteryProgress(input: MasteryProgressInput) {
  if (input.confirmedAbuse || input.suspicionScore >= CombatBalanceConfig.experience.zeroExpSuspicionScore) return 0;
  const duration = Math.max(0, input.rounds) * CombatBalanceConfig.mastery.durationProgressPerRound;
  const successfulAttacks = Math.max(0, input.successfulAttacks) * CombatBalanceConfig.mastery.successfulAttackProgress;
  const damage = Math.max(0, input.damageDealt / Math.max(1, input.opponentMaxHp)) * CombatBalanceConfig.mastery.damageProgressPerMaxHp;
  const opponentStrength = Math.max(0, input.opponentLevel - 1) * CombatBalanceConfig.mastery.opponentStrengthProgressPerLevel;
  const duelMultiplier = CombatBalanceConfig.mastery.duelTypeMultiplier[input.duelType];
  return Math.max(0, (CombatBalanceConfig.mastery.baseProgress + duration + successfulAttacks + damage + opponentStrength) * duelMultiplier);
}

export function applyHiddenMasteryProgress(
  current: { visibleSkillValue: number; hiddenProgress: number; totalHiddenProgress: number },
  progress: number
) {
  let visibleSkillValue = current.visibleSkillValue;
  let hiddenProgress = current.hiddenProgress + Math.max(0, progress);
  while (hiddenProgress >= getRequiredHiddenProgress(visibleSkillValue)) {
    hiddenProgress -= getRequiredHiddenProgress(visibleSkillValue);
    visibleSkillValue += 1;
  }
  return {
    visibleSkillValue,
    hiddenProgress,
    totalHiddenProgress: current.totalHiddenProgress + Math.max(0, progress)
  };
}

export async function addWeaponMasteryProgress(
  executor: PrismaExecutor,
  characterId: number,
  weaponType: WeaponType,
  progress: number
) {
  const current = await executor.weaponMastery.upsert({
    where: { characterId_weaponType: { characterId, weaponType } },
    create: { characterId, weaponType },
    update: {}
  });
  const next = applyHiddenMasteryProgress(current, progress);
  return executor.weaponMastery.update({ where: { id: current.id }, data: next });
}
