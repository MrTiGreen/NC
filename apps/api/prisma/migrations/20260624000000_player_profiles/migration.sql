CREATE TABLE "player_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "nickname" TEXT NOT NULL,
    "nickname_normalized" TEXT NOT NULL,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "age" INTEGER NOT NULL,
    "birth_city" TEXT NOT NULL,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "player_profiles_age_check" CHECK ("age" BETWEEN 1 AND 120),
    CONSTRAINT "player_profiles_nickname_letters_check" CHECK ("nickname" ~ '^[A-Za-zА-Яа-яЁё]+$')
);

CREATE UNIQUE INDEX "player_profiles_user_id_key" ON "player_profiles"("user_id");
CREATE UNIQUE INDEX "player_profiles_nickname_normalized_key" ON "player_profiles"("nickname_normalized");
CREATE INDEX "player_profiles_registered_at_idx" ON "player_profiles"("registered_at");

ALTER TABLE "player_profiles"
ADD CONSTRAINT "player_profiles_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
