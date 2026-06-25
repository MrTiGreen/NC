import { buildCombatant, resolveBattleRound } from "../src/combat/combat.engine.js";
import { CombatBalanceConfig } from "../src/combat/combat.config.js";
import type { CharacterBaseStats, EquipmentItem, RoundCombatant } from "../src/combat/combat.types.js";
import { calculateBattleExperience } from "../src/combat/experience.service.js";
import { calculateMasteryProgress } from "../src/combat/mastery.service.js";
import { deriveCombatStats } from "../src/combat/stats.service.js";

const fightsPerMatchup = 1000;
const setups = [
  { name: "strength build vs agility build", left: build("strength", { strength: 42, agility: 12, vitality: 18, intuition: 12 }, [weapon("PRIMARY_HAND", "ONE_HANDED")]), right: build("agility", { strength: 18, agility: 42, vitality: 18, intuition: 12 }, [weapon("PRIMARY_HAND", "ONE_HANDED")]) },
  { name: "intuition crit build vs vitality build", left: build("intuition", { strength: 25, agility: 12, vitality: 18, intuition: 45 }, [weapon("PRIMARY_HAND", "ONE_HANDED")]), right: build("vitality", { strength: 24, agility: 12, vitality: 45, intuition: 19 }, [weapon("PRIMARY_HAND", "ONE_HANDED")]) },
  { name: "shield build vs two-handed build", left: build("shield", { strength: 24, agility: 14, vitality: 36, intuition: 14 }, [weapon("PRIMARY_HAND", "ONE_HANDED"), weapon("OFF_HAND", "SHIELD")]), right: build("two-handed", { strength: 38, agility: 12, vitality: 20, intuition: 14 }, [weapon("PRIMARY_HAND", "TWO_HANDED")]) },
  { name: "dual wield vs shield build", left: build("dual", { strength: 32, agility: 24, vitality: 24, intuition: 14 }, [weapon("PRIMARY_HAND", "ONE_HANDED", true), weapon("OFF_HAND", "ONE_HANDED", true)]), right: build("shield", { strength: 26, agility: 14, vitality: 38, intuition: 16 }, [weapon("PRIMARY_HAND", "ONE_HANDED"), weapon("OFF_HAND", "SHIELD")]) }
];

for (const setup of setups) {
  const summary = simulate(setup.left, setup.right, fightsPerMatchup, setup.name);
  console.log(`${summary.name}: winrate ${summary.leftWinRate.toFixed(1)}% / ${(100 - summary.leftWinRate).toFixed(1)}%, rounds ${summary.averageRounds.toFixed(2)}, damage ${summary.averageDamage.toFixed(2)}, crit ${(summary.critFrequency * 100).toFixed(2)}%, dodge ${(summary.dodgeFrequency * 100).toFixed(2)}%, pierce ${(summary.blockPierceFrequency * 100).toFixed(2)}%, EXP ${summary.averageExp.toFixed(2)}, mastery ${summary.averageMastery.toFixed(2)}`);
  if (Math.max(summary.leftWinRate, 100 - summary.leftWinRate) >= 80) console.log("  WARNING: one build exceeds the 80% win-rate review threshold.");
}

function simulate(left: CombatantTemplate, right: CombatantTemplate, count: number, name: string) {
  let leftWins = 0; let roundsTotal = 0; let damageTotal = 0; let crits = 0; let dodges = 0; let pierces = 0; let hits = 0; let expTotal = 0; let masteryTotal = 0;
  for (let fight = 0; fight < count; fight += 1) {
    let a = instantiate(left, 1); let b = instantiate(right, 2); let round = 0; let damageA = 0; let damageB = 0; let hitsA = 0; let hitsB = 0;
    while (a.currentHp > 0 && b.currentHp > 0 && round < CombatBalanceConfig.combat.maximumRounds) {
      round += 1;
      const result = resolveBattleRound({ roundNumber: round, attacker: a, defender: b, attackerAction: actionFor(round, a.equipmentMode, 0), defenderAction: actionFor(round, b.equipmentMode, 1), seed: `${name}:${fight}:${round}` });
      a = { ...a, currentHp: result.hpAfter[String(a.characterId)] ?? a.currentHp };
      b = { ...b, currentHp: result.hpAfter[String(b.characterId)] ?? b.currentHp };
      for (const hit of result.hits) {
        hits += 1; damageTotal += hit.damage; crits += Number(hit.wasCrit); dodges += Number(hit.wasDodged); pierces += Number(hit.blockResult === "BLOCK_PIERCED");
        if (hit.attackerCharacterId === 1) { damageA += hit.damage; if (hit.damage > 0) hitsA += 1; } else { damageB += hit.damage; if (hit.damage > 0) hitsB += 1; }
      }
    }
    roundsTotal += round;
    if (a.currentHp > b.currentHp) leftWins += 1;
    expTotal += calculateBattleExperience({ level: 3, up: 2, damageDealt: damageA, damageReceived: damageB, opponentMaxHp: b.derived.maxHp, ownMaxHp: a.derived.maxHp, opponentLevel: 3, ownGearScore: left.gearScore, opponentGearScore: right.gearScore, duelType: "NORMAL", repeatOpponentCountToday: 1, suspicionScore: 0 }).amount;
    masteryTotal += calculateMasteryProgress({ visibleSkillValue: 0, rounds: round, successfulAttacks: hitsA, damageDealt: damageA, opponentMaxHp: b.derived.maxHp, opponentLevel: 3, duelType: "NORMAL", suspicionScore: 0 });
    masteryTotal += calculateMasteryProgress({ visibleSkillValue: 0, rounds: round, successfulAttacks: hitsB, damageDealt: damageB, opponentMaxHp: a.derived.maxHp, opponentLevel: 3, duelType: "NORMAL", suspicionScore: 0 });
  }
  return { name, leftWinRate: leftWins / count * 100, averageRounds: roundsTotal / count, averageDamage: damageTotal / count, critFrequency: crits / hits, dodgeFrequency: dodges / hits, blockPierceFrequency: pierces / hits, averageExp: expTotal / count, averageMastery: masteryTotal / count };
}

type CombatantTemplate = { stats: CharacterBaseStats; equipment: EquipmentItem[]; gearScore: number };
function build(_name: string, input: Partial<CharacterBaseStats>, equipment: EquipmentItem[]): CombatantTemplate { return { stats: { strength: 10, agility: 10, vitality: 10, intuition: 10, intelligence: 10, wisdom: 10, ...input }, equipment, gearScore: equipment.reduce((sum, item) => sum + item.baseWeaponDamage + item.baseArmor * 2, 0) }; }
function instantiate(template: CombatantTemplate, characterId: number): RoundCombatant { const derived = deriveCombatStats(template.stats, template.equipment); return buildCombatant({ characterId, currentHp: derived.maxHp, derived, equipment: template.equipment }); }
function weapon(slot: EquipmentItem["slot"], handType: NonNullable<EquipmentItem["handType"]>, canDualWield = false): EquipmentItem { return { id: slot === "PRIMARY_HAND" ? 1 : 2, slot, rarity: "COMMON", levelRequirement: 1, weaponType: "SWORDS", handType, canDualWield, offhandDamageMultiplier: 0.6, shieldBlockZoneBonus: handType === "SHIELD" ? 1 : 0, baseWeaponDamage: handType === "TWO_HANDED" ? 20 : handType === "SHIELD" ? 0 : 12, baseArmor: handType === "SHIELD" ? 10 : 0, currentDurability: 100, maxDurability: 100, modifiers: [], armorByZone: {}, isConsumable: false, quantity: 1 }; }
function actionFor(round: number, mode: RoundCombatant["equipmentMode"], offset: number) { const zones = ["HEAD", "CHEST", "ABDOMEN", "LEGS"] as const; const attack = (round + offset) % zones.length; const defense = (round * 2 + offset) % zones.length; return { primaryAttackZone: zones[attack]!, secondaryAttackZone: mode === "DUAL_WIELD" ? zones[(attack + 1) % zones.length]! : null, defenseZones: mode === "SHIELD" ? [zones[defense]!, zones[(defense + 1) % zones.length]!] : [zones[defense]!] }; }
