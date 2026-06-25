ALTER TABLE "item_instances"
ADD COLUMN "inventory_position" INTEGER;

CREATE INDEX "item_instances_character_id_inventory_position_idx"
ON "item_instances"("character_id", "inventory_position");
