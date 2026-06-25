CREATE TYPE "CharacterStatName" AS ENUM ('STRENGTH', 'AGILITY', 'VITALITY', 'INTUITION', 'INTELLIGENCE', 'WISDOM');
CREATE TYPE "WeaponType" AS ENUM ('SWORDS', 'AXES', 'DAGGERS', 'HAMMERS', 'FISTS', 'STAFFS', 'WANDS');
CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');
CREATE TYPE "ItemHandType" AS ENUM ('ONE_HANDED', 'TWO_HANDED', 'SHIELD');
CREATE TYPE "CombatEquipmentSlot" AS ENUM ('HELMET', 'ARMOR', 'BELT', 'PANTS', 'BOOTS', 'PRIMARY_HAND', 'OFF_HAND');
CREATE TYPE "BattleType" AS ENUM ('TRAINING', 'FRIENDLY', 'NORMAL', 'RANKED', 'TOWER', 'SURVIVAL', 'EVENT');
CREATE TYPE "BattleStatus" AS ENUM ('PENDING_ACTIONS', 'ACTIVE', 'FINISHED', 'CANCELLED');
CREATE TYPE "BattleReviewStatus" AS ENUM ('NONE', 'PENDING', 'REVIEWED', 'DISMISSED', 'CONFIRMED_ABUSE');
CREATE TYPE "BattleZone" AS ENUM ('HEAD', 'CHEST', 'ABDOMEN', 'LEGS');
CREATE TYPE "BattleLogEventType" AS ENUM ('ROUND_RESOLVED', 'HIT', 'BATTLE_FINISHED', 'EXPERIENCE_AWARDED', 'MASTERY_AWARDED', 'SUSPICION_FLAGGED', 'INJURY_CANDIDATE');
CREATE TYPE "BattleReviewReason" AS ENUM ('USER_REPORTED', 'REPEATED_OPPONENT', 'REPEATED_LOSS_PATTERN', 'LOW_DAMAGE', 'SHORT_BATTLE', 'GEAR_MISMATCH', 'SHARED_DEVICE_OR_IP', 'SUSPICIOUS_REWARD_TRANSFER');

CREATE TABLE "character_progressions" (
  "id" SERIAL NOT NULL,
  "character_id" INTEGER NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "up" INTEGER NOT NULL DEFAULT 0,
  "total_exp" BIGINT NOT NULL DEFAULT 0,
  "available_stat_points" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "character_progressions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "character_stats" (
  "id" SERIAL NOT NULL,
  "character_id" INTEGER NOT NULL,
  "strength" INTEGER NOT NULL DEFAULT 10,
  "agility" INTEGER NOT NULL DEFAULT 10,
  "vitality" INTEGER NOT NULL DEFAULT 10,
  "intuition" INTEGER NOT NULL DEFAULT 10,
  "intelligence" INTEGER NOT NULL DEFAULT 10,
  "wisdom" INTEGER NOT NULL DEFAULT 10,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "character_stats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "character_stat_allocations" (
  "id" SERIAL NOT NULL,
  "character_id" INTEGER NOT NULL,
  "stat_name" "CharacterStatName" NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 1,
  "reason" TEXT NOT NULL DEFAULT 'manual_spend',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "character_stat_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "weapon_masteries" (
  "id" SERIAL NOT NULL,
  "character_id" INTEGER NOT NULL,
  "weapon_type" "WeaponType" NOT NULL,
  "visible_skill_value" INTEGER NOT NULL DEFAULT 0,
  "hidden_progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total_hidden_progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "weapon_masteries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_templates" (
  "id" SERIAL NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rarity" "ItemRarity" NOT NULL DEFAULT 'COMMON',
  "level_requirement" INTEGER NOT NULL DEFAULT 1,
  "weapon_type" "WeaponType",
  "hand_type" "ItemHandType",
  "can_dual_wield" BOOLEAN NOT NULL DEFAULT false,
  "offhand_damage_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
  "shield_block_zone_bonus" INTEGER NOT NULL DEFAULT 0,
  "base_weapon_damage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "base_armor" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "modifiers" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "armor_by_zone" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "is_consumable" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "item_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_instances" (
  "id" SERIAL NOT NULL,
  "character_id" INTEGER NOT NULL,
  "template_id" INTEGER NOT NULL,
  "equipped_slot" "CombatEquipmentSlot",
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "current_durability" DECIMAL(10,1) NOT NULL DEFAULT 100,
  "max_durability" DECIMAL(10,1) NOT NULL DEFAULT 100,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "item_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "battles" (
  "id" SERIAL NOT NULL,
  "type" "BattleType" NOT NULL DEFAULT 'NORMAL',
  "status" "BattleStatus" NOT NULL DEFAULT 'PENDING_ACTIONS',
  "suspicion_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "review_status" "BattleReviewStatus" NOT NULL DEFAULT 'NONE',
  "event_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "random_seed" TEXT NOT NULL,
  "winner_character_id" INTEGER,
  "result" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "battle_participants" (
  "id" SERIAL NOT NULL,
  "battle_id" INTEGER NOT NULL,
  "character_id" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "current_hp" DOUBLE PRECISION NOT NULL,
  "max_hp_snapshot" DOUBLE PRECISION NOT NULL,
  "gear_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "combat_buffs" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "damage_dealt" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "damage_received" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "successful_hits" INTEGER NOT NULL DEFAULT 0,
  "exp_awarded" INTEGER NOT NULL DEFAULT 0,
  "mastery_progress_awarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "is_winner" BOOLEAN NOT NULL DEFAULT false,
  "ip_hash" TEXT,
  "device_fingerprint" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "battle_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "battle_rounds" (
  "id" SERIAL NOT NULL,
  "battle_id" INTEGER NOT NULL,
  "round_number" INTEGER NOT NULL,
  "actions" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "battle_rounds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "battle_actions" (
  "id" SERIAL NOT NULL,
  "battle_id" INTEGER NOT NULL,
  "round_number" INTEGER NOT NULL,
  "character_id" INTEGER NOT NULL,
  "primary_attack_zone" "BattleZone" NOT NULL,
  "secondary_attack_zone" "BattleZone",
  "defense_zones" JSONB NOT NULL,
  "selected_technique" TEXT,
  "selected_consumable" TEXT,
  "selected_spell" TEXT,
  "energy_cost" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "battle_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "battle_log_entries" (
  "id" SERIAL NOT NULL,
  "battle_id" INTEGER NOT NULL,
  "round_number" INTEGER,
  "event_type" "BattleLogEventType" NOT NULL,
  "message_key" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "battle_log_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "battle_review_flags" (
  "id" SERIAL NOT NULL,
  "battle_id" INTEGER NOT NULL,
  "reporter_character_id" INTEGER,
  "reason" "BattleReviewReason" NOT NULL,
  "suspicion_score" DOUBLE PRECISION NOT NULL,
  "status" "BattleReviewStatus" NOT NULL DEFAULT 'PENDING',
  "reviewed_by" INTEGER,
  "review_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3),
  CONSTRAINT "battle_review_flags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experience_ledger" (
  "id" SERIAL NOT NULL,
  "progression_id" INTEGER NOT NULL,
  "battle_id" INTEGER,
  "amount" BIGINT NOT NULL,
  "source" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "experience_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "character_progressions_character_id_key" ON "character_progressions"("character_id");
CREATE INDEX "character_progressions_level_up_idx" ON "character_progressions"("level", "up");
CREATE UNIQUE INDEX "character_stats_character_id_key" ON "character_stats"("character_id");
CREATE INDEX "character_stat_allocations_character_id_created_at_idx" ON "character_stat_allocations"("character_id", "created_at");
CREATE UNIQUE INDEX "weapon_masteries_character_id_weapon_type_key" ON "weapon_masteries"("character_id", "weapon_type");
CREATE UNIQUE INDEX "item_templates_slug_key" ON "item_templates"("slug");
CREATE INDEX "item_instances_character_id_equipped_slot_idx" ON "item_instances"("character_id", "equipped_slot");
CREATE INDEX "battles_status_created_at_idx" ON "battles"("status", "created_at");
CREATE INDEX "battles_review_status_created_at_idx" ON "battles"("review_status", "created_at");
CREATE UNIQUE INDEX "battle_participants_battle_id_character_id_key" ON "battle_participants"("battle_id", "character_id");
CREATE INDEX "battle_participants_character_id_created_at_idx" ON "battle_participants"("character_id", "created_at");
CREATE UNIQUE INDEX "battle_rounds_battle_id_round_number_key" ON "battle_rounds"("battle_id", "round_number");
CREATE UNIQUE INDEX "battle_actions_battle_id_round_number_character_id_key" ON "battle_actions"("battle_id", "round_number", "character_id");
CREATE INDEX "battle_log_entries_battle_id_created_at_idx" ON "battle_log_entries"("battle_id", "created_at");
CREATE INDEX "battle_review_flags_status_created_at_idx" ON "battle_review_flags"("status", "created_at");
CREATE INDEX "battle_review_flags_battle_id_idx" ON "battle_review_flags"("battle_id");
CREATE INDEX "experience_ledger_progression_id_created_at_idx" ON "experience_ledger"("progression_id", "created_at");

ALTER TABLE "character_progressions" ADD CONSTRAINT "character_progressions_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_stats" ADD CONSTRAINT "character_stats_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_stat_allocations" ADD CONSTRAINT "character_stat_allocations_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "weapon_masteries" ADD CONSTRAINT "weapon_masteries_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_instances" ADD CONSTRAINT "item_instances_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_instances" ADD CONSTRAINT "item_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "item_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "battles" ADD CONSTRAINT "battles_winner_character_id_fkey" FOREIGN KEY ("winner_character_id") REFERENCES "player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_participants" ADD CONSTRAINT "battle_participants_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_rounds" ADD CONSTRAINT "battle_rounds_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_actions" ADD CONSTRAINT "battle_actions_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_log_entries" ADD CONSTRAINT "battle_log_entries_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_review_flags" ADD CONSTRAINT "battle_review_flags_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "battle_review_flags" ADD CONSTRAINT "battle_review_flags_reporter_character_id_fkey" FOREIGN KEY ("reporter_character_id") REFERENCES "player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "battle_review_flags" ADD CONSTRAINT "battle_review_flags_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "experience_ledger" ADD CONSTRAINT "experience_ledger_progression_id_fkey" FOREIGN KEY ("progression_id") REFERENCES "character_progressions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "experience_ledger" ADD CONSTRAINT "experience_ledger_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "character_progressions" ("character_id", "updated_at") SELECT "id", CURRENT_TIMESTAMP FROM "player_profiles";
INSERT INTO "character_stats" ("character_id", "updated_at") SELECT "id", CURRENT_TIMESTAMP FROM "player_profiles";

-- Prisma uses the database owner. RLS prevents accidental Supabase Data API exposure.
ALTER TABLE "character_progressions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "character_stats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "character_stat_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "weapon_masteries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "item_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "battles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "battle_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "battle_rounds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "battle_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "battle_log_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "battle_review_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "experience_ledger" ENABLE ROW LEVEL SECURITY;
