import { CombatBalanceConfig } from "./combat.config.js";
import { createSeededRandom, randomBetween, type RandomSource } from "./deterministic-rng.js";
import type { BattleRoundResult, BodyZone, CombatAction, EquipmentItem, EquipmentMode, HitResult, RoundCombatant } from "./combat.types.js";

export function determineEquipmentMode(equipment: EquipmentItem[]): EquipmentMode {
  const primary = equipment.find((item) => item.slot === "PRIMARY_HAND");
  const offhand = equipment.find((item) => item.slot === "OFF_HAND");
  if (primary?.handType === "TWO_HANDED") {
    if (offhand) throw new Error("Two-handed weapons cannot be used with an offhand item");
    return "TWO_HANDED";
  }
  if (offhand?.handType === "SHIELD") return "SHIELD";
  if (primary?.handType === "ONE_HANDED" && offhand?.handType === "ONE_HANDED" && primary.canDualWield) return "DUAL_WIELD";
  if (primary?.handType === "ONE_HANDED") return "ONE_HANDED";
  return "FISTS";
}

export function validateAndNormalizeAction(action: CombatAction, mode: EquipmentMode): CombatAction {
  const defenseZones = [...new Set(action.defenseZones)];
  const maxDefenseZones = mode === "SHIELD" ? 2 : 1;
  if (defenseZones.length > maxDefenseZones) throw new Error("Equipment mode does not allow that many defense zones");
  if (mode === "TWO_HANDED" && action.secondaryAttackZone) throw new Error("Two-handed weapons cannot make a secondary attack");
  return {
    ...action,
    defenseZones,
    secondaryAttackZone: mode === "DUAL_WIELD" ? action.secondaryAttackZone ?? action.primaryAttackZone : null
  };
}

export function buildCombatant(input: Omit<RoundCombatant, "equipmentMode" | "primaryWeapon" | "secondaryWeapon">): RoundCombatant {
  const equipmentMode = determineEquipmentMode(input.equipment);
  return {
    ...input,
    equipmentMode,
    primaryWeapon: input.equipment.find((item) => item.slot === "PRIMARY_HAND") ?? null,
    secondaryWeapon: input.equipment.find((item) => item.slot === "OFF_HAND" && item.handType !== "SHIELD") ?? null
  };
}

export function resolveBattleRound(input: {
  roundNumber: number;
  attacker: RoundCombatant;
  defender: RoundCombatant;
  attackerAction: CombatAction;
  defenderAction: CombatAction;
  seed: string | number;
}): BattleRoundResult {
  const random = createSeededRandom(input.seed);
  const attackerAction = validateAndNormalizeAction(input.attackerAction, input.attacker.equipmentMode);
  const defenderAction = validateAndNormalizeAction(input.defenderAction, input.defender.equipmentMode);
  const hits: HitResult[] = [];
  hits.push(resolveHit(input.attacker, input.defender, attackerAction.primaryAttackZone, defenderAction.defenseZones, false, random));
  if (input.attacker.equipmentMode === "DUAL_WIELD") {
    hits.push(resolveHit(input.attacker, input.defender, attackerAction.secondaryAttackZone ?? attackerAction.primaryAttackZone, defenderAction.defenseZones, true, random));
  }
  hits.push(resolveHit(input.defender, input.attacker, defenderAction.primaryAttackZone, attackerAction.defenseZones, false, random));
  if (input.defender.equipmentMode === "DUAL_WIELD") {
    hits.push(resolveHit(input.defender, input.attacker, defenderAction.secondaryAttackZone ?? defenderAction.primaryAttackZone, attackerAction.defenseZones, true, random));
  }

  const damageToAttacker = hits.filter((hit) => hit.defenderCharacterId === input.attacker.characterId).reduce((sum, hit) => sum + hit.damage, 0);
  const damageToDefender = hits.filter((hit) => hit.defenderCharacterId === input.defender.characterId).reduce((sum, hit) => sum + hit.damage, 0);
  return {
    roundNumber: input.roundNumber,
    hits,
    hpAfter: {
      [input.attacker.characterId]: Math.max(0, round(input.attacker.currentHp - damageToAttacker)),
      [input.defender.characterId]: Math.max(0, round(input.defender.currentHp - damageToDefender))
    }
  };
}

export function resolveHit(
  attacker: RoundCombatant,
  defender: RoundCombatant,
  attackZone: BodyZone,
  defenseZones: BodyZone[],
  isSecondary: boolean,
  random: RandomSource
): HitResult {
  const dodgeChance = clamp(defender.derived.dodgeChance - attacker.derived.antiDodge, 0, CombatBalanceConfig.combat.maxDodgeChance);
  if (random() < dodgeChance) {
    return emptyHit(attacker.characterId, defender.characterId, attackZone, "DODGED");
  }
  const blockMatched = defenseZones.includes(attackZone);
  const twoHandedBonus = attacker.equipmentMode === "TWO_HANDED" ? CombatBalanceConfig.combat.twoHandedBlockPierceBonus : 0;
  const pierceChance = clamp(attacker.derived.blockPierceChance + twoHandedBonus, 0, CombatBalanceConfig.combat.maxBlockPierceChance);
  const blockPierced = blockMatched && random() < pierceChance;
  const partialBlock = blockMatched
    && !blockPierced
    && defender.equipmentMode === "SHIELD"
    && random() < CombatBalanceConfig.combat.shieldPartialBlockChance;
  const blockResult = !blockMatched ? "NOT_BLOCKED" : blockPierced ? "BLOCK_PIERCED" : partialBlock ? "PARTIAL_BLOCK" : "BLOCKED";
  if (blockResult === "BLOCKED") return emptyHit(attacker.characterId, defender.characterId, attackZone, "BLOCKED");

  const weapon = isSecondary ? attacker.secondaryWeapon : attacker.primaryWeapon;
  const baseWeaponDamage = weapon?.baseWeaponDamage ?? CombatBalanceConfig.combat.defaultWeaponDamage;
  const secondaryMultiplier = isSecondary ? weapon?.offhandDamageMultiplier ?? CombatBalanceConfig.combat.dualWieldSecondHitMultiplier : 1;
  const damageMultiplier = 1 + attacker.derived.masteryDamageBonus;
  const twoHandedMultiplier = attacker.equipmentMode === "TWO_HANDED" ? CombatBalanceConfig.combat.twoHandedDamageMultiplier : 1;
  let damage = (baseWeaponDamage + attacker.derived.physicalDamageBonus + attacker.derived.weaponDamageBonus) * secondaryMultiplier * damageMultiplier * twoHandedMultiplier;
  const critChance = clamp(attacker.derived.critChance - defender.derived.antiCrit, 0, CombatBalanceConfig.combat.maxCritChance);
  const wasCrit = random() < critChance;
  if (wasCrit) damage *= CombatBalanceConfig.combat.criticalDamageMultiplier;
  if (blockPierced) {
    const shieldMultiplier = defender.equipmentMode === "SHIELD" ? 1 - CombatBalanceConfig.combat.shieldBlockDamageReduction : 1;
    damage *= randomBetween(random, CombatBalanceConfig.combat.blockPiercedDamageMinimum, CombatBalanceConfig.combat.blockPiercedDamageMaximum) * shieldMultiplier;
  }
  if (partialBlock) {
    damage *= randomBetween(random, CombatBalanceConfig.combat.shieldPartialBlockDamageMinimum, CombatBalanceConfig.combat.shieldPartialBlockDamageMaximum);
  }

  const circumstance = rollCircumstance(random);
  damage *= circumstance.multiplier;
  const armorReduction = clamp(defender.derived.armorByZone[attackZone] * CombatBalanceConfig.combat.armorReductionPerPoint, 0, CombatBalanceConfig.combat.maximumArmorReduction);
  damage *= 1 - armorReduction;
  damage *= 1 - defender.derived.damageResistancePercent;
  if (circumstance.type !== "NONE") damage = Math.min(damage, 2);
  damage = Math.max(1, round(damage));
  const wasSevereCrit = wasCrit && damage / Math.max(1, defender.derived.maxHp) >= CombatBalanceConfig.combat.severeCritDamageOfMaxHp;
  const injuryChance = wasSevereCrit
    ? clamp(attacker.derived.injuryChance - defender.derived.injuryResistance + (weapon?.modifiers.find((modifier) => modifier.type === "INJURY_CHANCE")?.value ?? 0), 0, 1)
    : 0;
  const injuryCandidate = { candidate: wasSevereCrit && random() < injuryChance, chance: injuryChance, reason: wasSevereCrit ? "SEVERE_CRIT" as const : "NONE" as const };
  return {
    attackerCharacterId: attacker.characterId,
    defenderCharacterId: defender.characterId,
    attackZone,
    damage,
    wasDodged: false,
    blockResult,
    wasCrit,
    wasSevereCrit,
    wasRareCircumstance: circumstance.type !== "NONE",
    circumstanceType: circumstance.type,
    circumstanceMultiplier: circumstance.multiplier,
    logMessageKey: circumstance.logMessageKey,
    injuryCandidate,
    durabilityDamage: wasCrit ? { zone: attackZone, amount: CombatBalanceConfig.durability.criticalZoneDamage } : null
  };
}

function emptyHit(attackerCharacterId: number, defenderCharacterId: number, attackZone: BodyZone, state: "DODGED" | "BLOCKED"): HitResult {
  return {
    attackerCharacterId, defenderCharacterId, attackZone, damage: 0, wasDodged: state === "DODGED", blockResult: state === "BLOCKED" ? "BLOCKED" : "NOT_BLOCKED",
    wasCrit: false, wasSevereCrit: false, wasRareCircumstance: false, circumstanceType: "NONE", circumstanceMultiplier: 1,
    logMessageKey: state === "DODGED" ? "combat.dodged" : "combat.blocked", injuryCandidate: { candidate: false, chance: 0, reason: "NONE" }, durabilityDamage: null
  };
}

function rollCircumstance(random: RandomSource) {
  if (random() >= CombatBalanceConfig.combat.rareCircumstanceChance) return { type: "NONE" as const, multiplier: 1, logMessageKey: "combat.normal_hit" };
  const options = ["WEAPON_SLIPPED", "GLANCING_BLOW", "LAST_SECOND_EVADE", "ARMOR_ABSORBED", "POOR_STANCE"] as const;
  const type = options[Math.floor(random() * options.length)] ?? "GLANCING_BLOW";
  return {
    type,
    multiplier: randomBetween(random, CombatBalanceConfig.combat.rareCircumstanceMinimumMultiplier, CombatBalanceConfig.combat.rareCircumstanceMaximumMultiplier),
    logMessageKey: `combat.circumstance.${type.toLowerCase()}`
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
