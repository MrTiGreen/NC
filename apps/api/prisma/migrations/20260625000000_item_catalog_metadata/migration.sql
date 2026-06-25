CREATE TYPE "ItemCategory" AS ENUM ('EQUIPMENT', 'CONSUMABLE', 'MATERIAL');

ALTER TABLE "item_templates"
  ADD COLUMN "category" "ItemCategory" NOT NULL DEFAULT 'EQUIPMENT',
  ADD COLUMN "icon" TEXT NOT NULL DEFAULT '◆',
  ADD COLUMN "display_slot" TEXT,
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "requirements" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "properties" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX "item_templates_category_rarity_idx" ON "item_templates"("category", "rarity");
