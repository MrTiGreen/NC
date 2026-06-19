CREATE TYPE "ChatModerationAction" AS ENUM ('WARN_MESSAGE_MUTED', 'USER_MUTED');
CREATE TYPE "ChatModerationSeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

ALTER TABLE "users"
  ADD COLUMN "public_muted_until" TIMESTAMP(3);

CREATE TABLE "chat_moderation_events" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "action" "ChatModerationAction" NOT NULL,
  "severity" "ChatModerationSeverity" NOT NULL,
  "reason" TEXT NOT NULL,
  "message_text" TEXT NOT NULL,
  "muted_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chat_moderation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chat_moderation_events_user_id_created_at_idx" ON "chat_moderation_events"("user_id", "created_at");
CREATE INDEX "chat_moderation_events_muted_until_idx" ON "chat_moderation_events"("muted_until");

ALTER TABLE "chat_moderation_events"
  ADD CONSTRAINT "chat_moderation_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
