ALTER TYPE "ChatModerationAction" ADD VALUE 'USER_JAILED';

ALTER TABLE "users"
  ADD COLUMN "jailed_until" TIMESTAMP(3);

ALTER TABLE "chat_moderation_events"
  ADD COLUMN "jailed_until" TIMESTAMP(3);
