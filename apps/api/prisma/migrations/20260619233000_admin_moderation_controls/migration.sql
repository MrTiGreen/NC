ALTER TABLE "users"
  ADD COLUMN "chat_blocked_at" TIMESTAMP(3);

CREATE TYPE "AdminModerationActionType" AS ENUM (
  'BLOCK_USER',
  'MUTE_USER',
  'JAIL_USER',
  'CLEAR_SANCTIONS'
);

CREATE TABLE "admin_moderation_actions" (
  "id" SERIAL NOT NULL,
  "actor_id" INTEGER NOT NULL,
  "target_id" INTEGER NOT NULL,
  "action" "AdminModerationActionType" NOT NULL,
  "muted_until" TIMESTAMP(3),
  "jailed_until" TIMESTAMP(3),
  "chat_blocked" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_moderation_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_moderation_actions_target_id_created_at_idx"
  ON "admin_moderation_actions"("target_id", "created_at");
CREATE INDEX "admin_moderation_actions_actor_id_created_at_idx"
  ON "admin_moderation_actions"("actor_id", "created_at");

ALTER TABLE "admin_moderation_actions"
  ADD CONSTRAINT "admin_moderation_actions_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admin_moderation_actions"
  ADD CONSTRAINT "admin_moderation_actions_target_id_fkey"
  FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
