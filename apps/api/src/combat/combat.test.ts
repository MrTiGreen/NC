import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateBattleSuspicion } from "./anti-abuse.service.js";
import { BattleService } from "./battle.service.js";
import { buildCombatant, determineEquipmentMode, resolveBattleRound, resolveHit, validateAndNormalizeAction } from "./combat.engine.js";
import { CombatBalanceConfig } from "./combat.config.js";
import type { CharacterBaseStats, DerivedCombatStats, EquipmentItem, RoundCombatant } from "./combat.types.js";
import { calculateBattleExperience, getRequiredExpForNextUp, getRequiredTotalExp } from "./experience.service.js";
import { applyHiddenMasteryProgress, calculateMasteryProgress, getRequiredHiddenProgress, getWeaponMasteryDamageBonus } from "./mastery.service.js";
import { deriveCombatStats } from "./stats.service.js";

const baseStats: CharacterBaseStats = { strength: 10, agility: 10, vitality: 10, intuition: 10, intelligence: 10, wisdom: 10 };

describe("experience progression and rewards", () => {
  it("requires more EXP for higher level/up positions", () => {
    assert.ok(getRequiredExpForNextUp(5, 8) > getRequiredExpForNextUp(1, 0));
    assert.ok(getRequiredTotalExp(10, 0) > getRequiredTotalExp(5, 0) * 2);
  });

  it("makes battle EXP depend on dealt damage, opponent strength, repeats and suspicion", () => {
    const base = { level: 3, up: 2, damageReceived: 25, opponentMaxHp: 250, ownMaxHp: 250, opponentLevel: 3, ownGearScore: 100, opponentGearScore: 100, duelType: "NORMAL" as const, repeatOpponentCountToday: 1, suspicionScore: 0 };
    const littleDamage = calculateBattleExperience({ ...base, damageDealt: 5 });
    const meaningfulDamage = calculateBattleExperience({ ...base, damageDealt: 150 });
    assert.ok(meaningfulDamage.amount > littleDamage.amount);
    assert.ok(calculateBattleExperience({ ...base, damageDealt: 100, opponentLevel: 6 }).amount > calculateBattleExperience({ ...base, damageDealt: 100, opponentLevel: 1 }).amount);
    assert.ok(calculateBattleExperience({ ...base, damageDealt: 100, repeatOpponentCountToday: 7 }).amount < calculateBattleExperience({ ...base, damageDealt: 100 }).amount);
    assert.equal(calculateBattleExperience({ ...base, damageDealt: 100, suspicionScore: 0.9 }).amount, 0);
  });
});

describe("derived stats", () => {
  it("maps Strength, Agility, Vitality and Intuition to distinct combat values", () => {
    const strength = deriveCombatStats({ ...baseStats, strength: 30 }, []);
    const agility = deriveCombatStats({ ...baseStats, agility: 30 }, []);
    const vitality = deriveCombatStats({ ...baseStats, vitality: 30 }, []);
    const intuition = deriveCombatStats({ ...baseStats, intuition: 30 }, []);
    assert.ok(strength.physicalDamageBonus > deriveCombatStats(baseStats, []).physicalDamageBonus);
    assert.ok(agility.dodgeChance > deriveCombatStats(baseStats, []).dodgeChance && agility.antiDodge > deriveCombatStats(baseStats, []).antiDodge);
    assert.ok(vitality.maxHp > deriveCombatStats(baseStats, []).maxHp && vitality.damageResistancePercent > 0);
    assert.ok(intuition.critChance > deriveCombatStats(baseStats, []).critChance && intuition.antiCrit > deriveCombatStats(baseStats, []).antiCrit);
  });

  it("does not use Intelligence or Wisdom in current combat formulas", () => {
    const baseline = deriveCombatStats(baseStats, []);
    assert.deepEqual(deriveCombatStats({ ...baseStats, intelligence: 500, wisdom: 500 }, []), baseline);
  });
});

describe("weapon mastery", () => {
  it("grows hidden mastery, raises visible skill at thresholds, and gives exactly 0.01 percent per point", () => {
    assert.ok(getRequiredHiddenProgress(10) > getRequiredHiddenProgress(0));
    const next = applyHiddenMasteryProgress({ visibleSkillValue: 0, hiddenProgress: 0, totalHiddenProgress: 0 }, getRequiredHiddenProgress(0));
    assert.equal(next.visibleSkillValue, 1);
    assert.equal(getWeaponMasteryDamageBonus(100), 0.01);
    assert.ok(calculateMasteryProgress({ visibleSkillValue: 0, rounds: 4, successfulAttacks: 2, damageDealt: 100, opponentMaxHp: 100, opponentLevel: 2, duelType: "NORMAL", suspicionScore: 0 }) > 0);
    assert.equal(calculateMasteryProgress({ visibleSkillValue: 0, rounds: 4, successfulAttacks: 2, damageDealt: 100, opponentMaxHp: 100, opponentLevel: 2, duelType: "NORMAL", suspicionScore: 1 }), 0);
  });
});

describe("combat resolver", () => {
  const attacker = makeCombatant(1, { strength: 45, agility: 10, vitality: 10, intuition: 45, intelligence: 10, wisdom: 10 }, [weapon("PRIMARY_HAND", "ONE_HANDED")]);
  const defender = makeCombatant(2, { ...baseStats, vitality: 25 }, []);

  it("blocks matching normal hits, supports pierce, dodge, critical pierced hits and rare circumstances", () => {
    const blocked = resolveHit(attacker, defender, "HEAD", ["HEAD"], false, scripted(0.99, 0.99));
    assert.equal(blocked.blockResult, "BLOCKED");
    assert.equal(blocked.damage, 0);
    const pierced = resolveHit(attacker, defender, "HEAD", ["HEAD"], false, scripted(0.99, 0, 0, 0.99));
    assert.equal(pierced.blockResult, "BLOCK_PIERCED");
    assert.equal(pierced.wasCrit, true);
    assert.ok(pierced.damage > 0);
    const shieldDefender = makeCombatant(7, baseStats, [weapon("PRIMARY_HAND", "ONE_HANDED"), weapon("OFF_HAND", "SHIELD")]);
    const partial = resolveHit(attacker, shieldDefender, "HEAD", ["HEAD"], false, scripted(0.99, 0.99, 0, 0.99, 0.99));
    assert.equal(partial.blockResult, "PARTIAL_BLOCK");
    assert.ok(partial.damage > 0);
    const dodgeDefender = makeCombatant(6, { ...baseStats, agility: 60 }, []);
    const dodged = resolveHit(attacker, dodgeDefender, "HEAD", [], false, scripted(0));
    assert.equal(dodged.wasDodged, true);
    const rare = resolveHit(attacker, defender, "HEAD", [], false, scripted(0.99, 0, 0, 0, 0.4, 0));
    assert.equal(rare.wasRareCircumstance, true);
    assert.ok(rare.damage <= 2);
  });

  it("applies dual wield, shield and two-handed action restrictions without techniques, spells or energy", () => {
    const dual = makeCombatant(3, baseStats, [weapon("PRIMARY_HAND", "ONE_HANDED", true), weapon("OFF_HAND", "ONE_HANDED", true)]);
    const shield = makeCombatant(4, baseStats, [weapon("PRIMARY_HAND", "ONE_HANDED"), weapon("OFF_HAND", "SHIELD")]);
    const twoHanded = makeCombatant(5, baseStats, [weapon("PRIMARY_HAND", "TWO_HANDED")]);
    const round = resolveBattleRound({ roundNumber: 1, attacker: dual, defender: shield, attackerAction: { primaryAttackZone: "HEAD", secondaryAttackZone: "LEGS", defenseZones: ["CHEST"] }, defenderAction: { primaryAttackZone: "CHEST", defenseZones: ["HEAD", "LEGS"] }, seed: "dual" });
    assert.equal(round.hits.filter((hit) => hit.attackerCharacterId === dual.characterId).length, 2);
    assert.equal(validateAndNormalizeAction({ primaryAttackZone: "HEAD", defenseZones: ["HEAD", "LEGS"] }, shield.equipmentMode).defenseZones.length, 2);
    assert.throws(() => validateAndNormalizeAction({ primaryAttackZone: "HEAD", secondaryAttackZone: "LEGS", defenseZones: ["HEAD"] }, twoHanded.equipmentMode));
    assert.throws(() => determineEquipmentMode([weapon("PRIMARY_HAND", "TWO_HANDED"), weapon("OFF_HAND", "SHIELD")]));
  });

  it("creates only critical-zone durability damage, including on a winner that received that critical", () => {
    const normal = resolveHit(attacker, defender, "CHEST", [], false, scripted(0.99, 0.99));
    const critical = resolveHit(attacker, defender, "CHEST", [], false, scripted(0.99, 0, 0.99));
    assert.equal(normal.durabilityDamage, null);
    assert.deepEqual(critical.durabilityDamage, { zone: "CHEST", amount: 0.5 });
  });
});

describe("anti-abuse flags", () => {
  it("scores repeated pairs and zero-damage short battles as suspicious", () => {
    const repeated = evaluateBattleSuspicion({ pairBattlesToday: 7, repeatedLosses: 0, totalDamage: 200, combinedMaxHp: 200, rounds: 4, gearDifference: 0, hasSharedIpOrDevice: false });
    const zeroDamage = evaluateBattleSuspicion({ pairBattlesToday: 1, repeatedLosses: 0, totalDamage: 0, combinedMaxHp: 200, rounds: 1, gearDifference: 0, hasSharedIpOrDevice: false });
    assert.ok(repeated.suspicionScore > 0 && repeated.signals.some((signal) => signal.reason === "REPEATED_OPPONENT"));
    assert.ok(zeroDamage.suspicionScore > 0 && zeroDamage.signals.some((signal) => signal.reason === "LOW_DAMAGE"));
  });

  it("creates a BattleReviewFlag when a participant reports a battle", async () => {
    const created: Array<Record<string, unknown>> = [];
    const service = new BattleService({
      $transaction: async (callback: (tx: unknown) => unknown) => callback({
        battleParticipant: { findUnique: async () => ({ id: 1 }) },
        battleReviewFlag: { create: async ({ data }: { data: Record<string, unknown> }) => { created.push(data); return data; } },
        battle: { update: async () => ({}) }
      })
    } as never);
    await service.reportBattle(15, 4);
    assert.deepEqual(created, [{ battleId: 15, reporterCharacterId: 4, reason: "USER_REPORTED", suspicionScore: 0.5 }]);
  });
});

function makeCombatant(characterId: number, stats: CharacterBaseStats, equipment: EquipmentItem[]): RoundCombatant {
  const derived = deriveCombatStats(stats, equipment);
  return buildCombatant({ characterId, currentHp: derived.maxHp, derived, equipment });
}

function weapon(slot: EquipmentItem["slot"], handType: NonNullable<EquipmentItem["handType"]>, canDualWield = false): EquipmentItem {
  return { id: Math.floor(Math.random() * 100000), slot, rarity: "COMMON", levelRequirement: 1, weaponType: "SWORDS", handType, canDualWield, offhandDamageMultiplier: 0.6, shieldBlockZoneBonus: handType === "SHIELD" ? 1 : 0, baseWeaponDamage: handType === "SHIELD" ? 0 : 12, baseArmor: 0, currentDurability: 100, maxDurability: 100, modifiers: [], armorByZone: {}, isConsumable: false, quantity: 1 };
}

function scripted(...values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0.99;
}
