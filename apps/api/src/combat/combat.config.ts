export type ExperienceTableEntry = {
  level: number;
  up: number;
  requiredTotalExp: number;
};

/**
 * All balance values used by the first server-authoritative PvP iteration.
 * Deploying a balance change should normally touch this file, not resolver code.
 */
export const CombatBalanceConfig = {
  progression: {
    upsPerLevel: 10,
    /** Optional exact milestones. When present, they override the generated curve. */
    experienceTable: [] as ExperienceTableEntry[],
    baseExpForFirstUp: 120,
    exponentialGrowth: 1.235,
    levelAcceleration: 1.16,
    statPointsOnLevel: 3,
    statPointsEveryUps: 2
  },
  experience: {
    baseProgressFraction: 0.06,
    minimumDamageContribution: 0.02,
    dangerousFightDamageReceivedRatio: 0.12,
    dangerousFightBonus: 0.15,
    levelDifferenceStep: 0.1,
    levelDifferenceMinimum: 0.05,
    levelDifferenceMaximum: 1.5,
    gearDifferencePer100: 0.12,
    gearDifferenceMinimum: 0.2,
    gearDifferenceMaximum: 1.4,
    duelTypeMultiplier: {
      TRAINING: 0.2,
      FRIENDLY: 0.35,
      NORMAL: 1,
      RANKED: 1.2,
      TOWER: 1.25,
      SURVIVAL: 1.3,
      EVENT: 1
    },
    repeat: {
      fullRewardThrough: 3,
      reducedRewardThrough: 6,
      reducedMultiplier: 0.5,
      farmMultiplier: 0.1
    },
    zeroExpSuspicionScore: 0.7
  },
  stats: {
    baseHp: 100,
    hpPerVitality: 8,
    physicalDamagePerStrength: 0.45,
    strengthBlockPiercePerPoint: 0.0005,
    strengthAntiDodgePerPoint: 0.00025,
    strengthAntiCritPerPoint: 0.0002,
    agilityDodgePerPoint: 0.007,
    agilityAntiDodgePerPoint: 0.001,
    agilityCounterAttackPerPoint: 0.00045,
    vitalityDamageResistancePerPoint: 0.001,
    vitalityInjuryResistancePerPoint: 0.001,
    vitalityHpRegenPerPoint: 0.08,
    intuitionCritPerPoint: 0.012,
    intuitionAntiCritPerPoint: 0.001,
    intuitionInjuryChancePerPoint: 0.00035,
    maximumPercent: 0.65,
    maxDamageResistance: 0.35,
    masteryDamageBonusPerVisiblePoint: 0.0001,
    rarityGearScore: { COMMON: 4, UNCOMMON: 10, RARE: 22, EPIC: 42, LEGENDARY: 72 }
  },
  mastery: {
    baseProgress: 1.5,
    durationProgressPerRound: 0.22,
    successfulAttackProgress: 0.75,
    damageProgressPerMaxHp: 3,
    opponentStrengthProgressPerLevel: 0.18,
    duelTypeMultiplier: { TRAINING: 0.3, FRIENDLY: 0.5, NORMAL: 1, RANKED: 1.2, TOWER: 1.25, SURVIVAL: 1.3, EVENT: 1 },
    thresholdBase: 12,
    thresholdExponent: 1.12
  },
  combat: {
    defaultWeaponDamage: 8,
    dualWieldSecondHitMultiplier: 0.6,
    twoHandedBlockPierceBonus: 0.4,
    twoHandedDamageMultiplier: 1.2,
    shieldBlockDamageReduction: 0.2,
    shieldPartialBlockChance: 0.18,
    shieldPartialBlockDamageMinimum: 0.1,
    shieldPartialBlockDamageMaximum: 0.2,
    blockPiercedDamageMinimum: 0.25,
    blockPiercedDamageMaximum: 0.45,
    criticalDamageMultiplier: 3,
    rareCircumstanceChance: 0.012,
    rareCircumstanceMinimumMultiplier: 0.02,
    rareCircumstanceMaximumMultiplier: 0.2,
    armorReductionPerPoint: 0.012,
    maximumArmorReduction: 0.7,
    severeCritDamageOfMaxHp: 0.18,
    maxDodgeChance: 0.65,
    maxCritChance: 0.55,
    maxBlockPierceChance: 0.65,
    maximumRounds: 80
  },
  antiAbuse: {
    repeatPairThreshold: 6,
    repeatPairScore: 0.42,
    repeatedLossThreshold: 5,
    repeatedLossScore: 0.25,
    lowDamageRatio: 0.03,
    lowDamageScore: 0.3,
    shortBattleRounds: 1,
    shortBattleScore: 0.2,
    largeGearDifference: 180,
    gearMismatchScore: 0.12,
    sharedDeviceScore: 0.7,
    autoFlagScore: 0.45
  },
  durability: {
    criticalZoneDamage: 0.5,
    damageWinnerOnlyOnCriticalZone: true
  }
} as const;

export type DuelType = keyof typeof CombatBalanceConfig.experience.duelTypeMultiplier;
