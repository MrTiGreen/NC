CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "telegram_id" BIGINT NOT NULL,
  "username" TEXT,
  "first_name" TEXT,
  "last_name" TEXT,
  "avatar_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public_messages" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "public_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "private_messages" (
  "id" SERIAL NOT NULL,
  "sender_id" INTEGER NOT NULL,
  "receiver_id" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "private_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");
CREATE INDEX "public_messages_user_id_idx" ON "public_messages"("user_id");
CREATE INDEX "public_messages_created_at_idx" ON "public_messages"("created_at");
CREATE INDEX "private_messages_sender_id_receiver_id_created_at_idx" ON "private_messages"("sender_id", "receiver_id", "created_at");
CREATE INDEX "private_messages_receiver_id_sender_id_created_at_idx" ON "private_messages"("receiver_id", "sender_id", "created_at");
CREATE INDEX "private_messages_created_at_idx" ON "private_messages"("created_at");

ALTER TABLE "public_messages"
  ADD CONSTRAINT "public_messages_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "private_messages"
  ADD CONSTRAINT "private_messages_sender_id_fkey"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "private_messages"
  ADD CONSTRAINT "private_messages_receiver_id_fkey"
  FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
