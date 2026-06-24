export type ProgressMetric = {
  current: number;
  maximum: number;
  tone: "health" | "energy" | "experience";
};

export type Currency = {
  id: "coins" | "shards";
  symbol: string;
  value: number;
};

export type StatusBadge = {
  id: "survival" | "reputation" | "prestige";
  label: string;
  tone: "green" | "red" | "purple";
};

export type CharacterEncounter = {
  opponentName: string;
  buffsLabel: string;
  health: ProgressMetric & { tone: "health" };
  energy: ProgressMetric & { tone: "energy" };
};

export type CharacterStat = {
  id: "strength" | "vitality" | "intuition" | "intelligence" | "wisdom" | "agility";
  label: string;
  value: number;
};

export type EquipmentSlot = {
  id:
    | "earring-left"
    | "earring-right"
    | "amulet"
    | "helmet"
    | "armor"
    | "gloves"
    | "bracers"
    | "weapon"
    | "quick-one"
    | "quick-two"
    | "quick-three"
    | "shield"
    | "belt"
    | "pants"
    | "boots";
  label: string;
  side: "left" | "right";
  size: "small" | "medium" | "large";
};

export type Ability = {
  id: string;
  name: string;
  icon: string;
};

export type ProfileSection = {
  title: string;
  content: string;
};

export type CombatRecord = {
  label: string;
  value: number;
};

export type CharacterPageData = {
  level: number;
  health: ProgressMetric;
  energy: ProgressMetric;
  experience: ProgressMetric;
  currencies: readonly Currency[];
  statusBadges: readonly StatusBadge[];
  encounter: CharacterEncounter;
  stats: readonly CharacterStat[];
  equipment: readonly EquipmentSlot[];
  abilities: readonly Ability[];
  records: readonly CombatRecord[];
  profileSections: readonly ProfileSection[];
  actionTabs: readonly string[];
  chatTabs: readonly string[];
};
