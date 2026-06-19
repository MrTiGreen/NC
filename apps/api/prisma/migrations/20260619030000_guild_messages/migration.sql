CREATE TABLE "guild_messages" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guild_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "guild_messages_user_id_idx" ON "guild_messages"("user_id");
CREATE INDEX "guild_messages_created_at_idx" ON "guild_messages"("created_at");

ALTER TABLE "guild_messages"
  ADD CONSTRAINT "guild_messages_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
