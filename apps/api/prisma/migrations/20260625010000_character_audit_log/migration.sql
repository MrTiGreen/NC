CREATE TYPE "CharacterAuditEventType" AS ENUM (
  'STATS_CHANGED',
  'ITEM_GRANTED',
  'ITEM_EQUIPPED',
  'ITEM_UNEQUIPPED',
  'ITEM_CONSUMED',
  'ITEM_DURABILITY_CHANGED',
  'ITEM_DELETED',
  'ITEM_MOVED',
  'CURRENCY_CHANGED',
  'BATTLE_CREATED',
  'BATTLE_FINISHED',
  'EXPERIENCE_CHANGED',
  'MASTERY_CHANGED',
  'ADMIN_NOTE'
);

CREATE TABLE "character_audit_logs" (
  "id" SERIAL NOT NULL,
  "character_id" INTEGER NOT NULL,
  "actor_user_id" INTEGER,
  "event_type" "CharacterAuditEventType" NOT NULL,
  "summary" TEXT NOT NULL,
  "before_state" JSONB,
  "after_state" JSONB,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "related_item_instance_id" INTEGER,
  "related_battle_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "character_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "character_audit_logs_character_id_created_at_idx" ON "character_audit_logs"("character_id", "created_at");
CREATE INDEX "character_audit_logs_event_type_created_at_idx" ON "character_audit_logs"("event_type", "created_at");
CREATE INDEX "character_audit_logs_actor_user_id_created_at_idx" ON "character_audit_logs"("actor_user_id", "created_at");
CREATE INDEX "character_audit_logs_related_battle_id_idx" ON "character_audit_logs"("related_battle_id");
CREATE INDEX "character_audit_logs_related_item_instance_id_idx" ON "character_audit_logs"("related_item_instance_id");

ALTER TABLE "character_audit_logs" ADD CONSTRAINT "character_audit_logs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_audit_logs" ADD CONSTRAINT "character_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "character_audit_logs" ADD CONSTRAINT "character_audit_logs_related_item_instance_id_fkey" FOREIGN KEY ("related_item_instance_id") REFERENCES "item_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "character_audit_logs" ADD CONSTRAINT "character_audit_logs_related_battle_id_fkey" FOREIGN KEY ("related_battle_id") REFERENCES "battles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "character_audit_logs" ENABLE ROW LEVEL SECURITY;
