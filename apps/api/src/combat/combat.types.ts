import { z } from "zod";

export const bodyZoneSchema = z.enum(["HEAD", "CHEST", "ABDOMEN", "LEGS"]);
export type BodyZone = z.infer<typeof bodyZoneSchema>;

export const weaponTypeSchema = z.enum(["SWORDS", "AXES", "DAGGERS", "HAMMERS", "FISTS", "STAFFS", "WANDS"]);
export type WeaponTypeCode = z.infer<typeof weaponTypeSchema>;

export const battleTypeSchema = z.enum(["TRAINING", "FRIENDLY", "NORMAL", "RANKED", "TOWER", "SURVIVAL", "EVENT"]);
export type BattleTypeCode = z.infer<typeof battleTypeSchema>;

export const itemModifierSchema = z.object({
  type: z.enum([
    "ANTI_DODGE",
    "ANTI_CRIT",
    "CRIT_CHANCE",
    "DODGE_CHANCE",
    "BLOCK_PIERCE_CHANCE",
    "INJURY_CHANCE",
    "INJURY_RESISTANCE",
    "DAMAGE_RESISTANCE",
    "WEAPON_DAMAGE_BONUS",
    "STRENGTH",
    "AGILITY",
    "VITALITY",
    "INTUITION",
    "INTELLIGENCE",
    "WISDOM"
  ]),
  value: z.number().finite()
});

export type ItemModifier = z.infer<typeof itemModifierSchema>;
export type ItemModifierType = ItemModifier["type"];

export const combatBuffSchema = z.object({
  type: z.enum(["EXP_MULTIPLIER", "DAMAGE_MULTIPLIER", "DAMAGE_RESISTANCE", "CRIT_CHANCE", "DODGE_CHANCE"]),
  value: z.number().finite(),
  source: z.string().min(1).max(80).optional()
});
export type CombatBuff = z.infer<typeof combatBuffSchema>;

export type CharacterBaseStats = {
  strength: number;
  agility: number;
  vitality: number;
  intuition: number;
  intelligence: number;
  wisdom: number;
};

export type EquipmentItem = {
  id: number;
  slot: "HELMET" | "ARMOR" | "BELT" | "PANTS" | "BOOTS" | "PRIMARY_HAND" | "OFF_HAND";
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY";
  levelRequirement: number;
  weaponType: WeaponTypeCode | null;
  handType: "ONE_HANDED" | "TWO_HANDED" | "SHIELD" | null;
  canDualWield: boolean;
  offhandDamageMultiplier: number;
  shieldBlockZoneBonus: number;
  baseWeaponDamage: number;
  baseArmor: number;
  currentDurability: number;
  maxDurability: number;
  modifiers: ItemModifier[];
  armorByZone: Partial<Record<BodyZone, number>>;
  isConsumable: boolean;
  quantity: number;
};

export type DerivedCombatStats = {
  maxHp: number;
  physicalDamageBonus: number;
  dodgeChance: number;
  antiDodge: number;
  counterAttackChance: number;
  critChance: number;
  antiCrit: number;
  blockPierceChance: number;
  injuryChance: number;
  injuryResistance: number;
  damageResistancePercent: number;
  hpRegenOutOfCombat: number;
  weaponDamageBonus: number;
  armorByZone: Record<BodyZone, number>;
  masteryDamageBonus: number;
};

export type EquipmentMode = "ONE_HANDED" | "DUAL_WIELD" | "SHIELD" | "TWO_HANDED" | "FISTS";

export const combatActionSchema = z.object({
  primaryAttackZone: bodyZoneSchema,
  secondaryAttackZone: bodyZoneSchema.optional().nullable(),
  defenseZones: z.array(bodyZoneSchema).min(1).max(2),
  selectedTechnique: z.string().nullable().optional(),
  selectedConsumable: z.string().nullable().optional(),
  selectedSpell: z.string().nullable().optional(),
  energyCost: z.number().nonnegative().nullable().optional()
});
export type CombatAction = z.infer<typeof combatActionSchema>;

export type InjuryRollResult = {
  candidate: boolean;
  chance: number;
  reason: "SEVERE_CRIT" | "NONE";
};

export type HitResult = {
  attackerCharacterId: number;
  defenderCharacterId: number;
  attackZone: BodyZone;
  damage: number;
  wasDodged: boolean;
  blockResult: "BLOCKED" | "BLOCK_PIERCED" | "PARTIAL_BLOCK" | "NOT_BLOCKED";
  wasCrit: boolean;
  wasSevereCrit: boolean;
  wasRareCircumstance: boolean;
  circumstanceType: "NONE" | "WEAPON_SLIPPED" | "GLANCING_BLOW" | "LAST_SECOND_EVADE" | "ARMOR_ABSORBED" | "POOR_STANCE";
  circumstanceMultiplier: number;
  logMessageKey: string;
  injuryCandidate: InjuryRollResult;
  durabilityDamage: { zone: BodyZone; amount: number } | null;
};

export type RoundCombatant = {
  characterId: number;
  currentHp: number;
  derived: DerivedCombatStats;
  equipment: EquipmentItem[];
  equipmentMode: EquipmentMode;
  primaryWeapon: EquipmentItem | null;
  secondaryWeapon: EquipmentItem | null;
};

export type BattleRoundResult = {
  roundNumber: number;
  hits: HitResult[];
  hpAfter: Record<string, number>;
};
