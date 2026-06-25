import { CharacterAuditEventType, CombatEquipmentSlot, ItemCategory, ItemHandType, type Prisma } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { recordCharacterAudit } from "../characters/audit.service.js";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../types.js";

export const itemsRouter = Router();

const equipItemSchema = z.object({
  slot: z.nativeEnum(CombatEquipmentSlot).optional()
});
const inventoryLayoutSchema = z.object({
  items: z.array(z.object({
    itemInstanceId: z.coerce.number().int().positive(),
    position: z.coerce.number().int().min(0).nullable()
  })).max(300)
});
const inventoryCapacityBySection = { equipment: 72, supplies: 72 } as const;
const inventoryGridColumns = 6;

itemsRouter.get("/items/catalog", async (_req, res) => {
  const templates = await prisma.itemTemplate.findMany({
    orderBy: [{ category: "asc" }, { levelRequirement: "asc" }, { name: "asc" }]
  });

  res.json(templates.map(serializeTemplate));
});

itemsRouter.get("/items/me", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const profile = await prisma.playerProfile.findUnique({ where: { userId: authUser.id }, select: { id: true } });

  if (!profile) {
    res.status(404).json({ error: "Player profile has not been registered" });
    return;
  }

  const instances = await prisma.itemInstance.findMany({
    where: { characterId: profile.id },
    include: { template: true },
    orderBy: { createdAt: "asc" }
  });

  res.json(instances.map((instance) => ({
    id: instance.id,
    quantity: instance.quantity,
    equippedSlot: instance.equippedSlot,
    inventoryPosition: instance.inventoryPosition,
    currentDurability: instance.currentDurability.toString(),
    maxDurability: instance.maxDurability.toString(),
    template: serializeTemplate(instance.template)
  })));
});

itemsRouter.put("/items/me/layout", async (req, res) => {
  const { authUser } = req as unknown as AuthenticatedRequest;
  const body = inventoryLayoutSchema.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: "Invalid inventory layout", details: body.error.flatten() });
    return;
  }

  try {
    res.json(await saveInventoryLayout(authUser.id, body.data.items));
  } catch (error) {
    sendItemError(res, error);
  }
});

itemsRouter.post("/items/me/:itemInstanceId/equip", async (req, res) => {
  const { authUser } = req as unknown as AuthenticatedRequest;
  const itemInstanceId = readPositiveId(req.params.itemInstanceId);
  const body = equipItemSchema.safeParse(req.body ?? {});

  if (!itemInstanceId || !body.success) {
    res.status(400).json({ error: "Invalid equip request", details: body.success ? undefined : body.error.flatten() });
    return;
  }

  try {
    const result = await equipCharacterItem(authUser.id, itemInstanceId, body.data.slot);
    res.json(result);
  } catch (error) {
    sendItemError(res, error);
  }
});

itemsRouter.post("/items/me/:itemInstanceId/unequip", async (req, res) => {
  const { authUser } = req as unknown as AuthenticatedRequest;
  const itemInstanceId = readPositiveId(req.params.itemInstanceId);

  if (!itemInstanceId) {
    res.status(400).json({ error: "Invalid item instance id" });
    return;
  }

  try {
    const result = await unequipCharacterItem(authUser.id, itemInstanceId);
    res.json(result);
  } catch (error) {
    sendItemError(res, error);
  }
});

async function equipCharacterItem(actorUserId: number, itemInstanceId: number, requestedSlot?: CombatEquipmentSlot) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.playerProfile.findUnique({
      where: { userId: actorUserId },
      select: { id: true, progression: true, stats: true }
    });

    if (!profile) throw new Error("Player profile has not been registered");

    const item = await tx.itemInstance.findFirst({
      where: { id: itemInstanceId, characterId: profile.id },
      include: { template: true }
    });

    if (!item) throw new Error("Item instance not found");
    if (item.template.category !== ItemCategory.EQUIPMENT) throw new Error("This item cannot be equipped");
    if (Number(item.currentDurability) <= 0) throw new Error("Broken item cannot be equipped");

    const stats = profile.stats ?? defaultStats();
    const progression = profile.progression ?? { level: 1 };
    assertRequirements(item.template, stats, progression.level);

    const equippedItems = await tx.itemInstance.findMany({
      where: { characterId: profile.id, equippedSlot: { not: null } },
      include: { template: true }
    });
    const targetSlot = requestedSlot ?? chooseEquipmentSlot(item.template, equippedItems);
    assertItemFitsSlot(item.template, targetSlot);

    const currentBySlot = new Map(equippedItems.filter((equipped) => equipped.id !== item.id).map((equipped) => [equipped.equippedSlot, equipped]));
    const previousSlot = item.equippedSlot;
    const replaced = currentBySlot.get(targetSlot) ?? null;
    const forcedUnequipped = getForcedUnequippedItems(item.template, targetSlot, currentBySlot);
    const forcedIds = new Set(forcedUnequipped.map((forcedItem) => forcedItem.id));

    if (targetSlot === CombatEquipmentSlot.OFF_HAND) {
      const primary = currentBySlot.get(CombatEquipmentSlot.PRIMARY_HAND);
      if (primary?.template.handType === ItemHandType.TWO_HANDED) throw new Error("Cannot equip off-hand item while a two-handed weapon is equipped");
      if (item.template.handType === ItemHandType.ONE_HANDED && (!primary || primary.template.handType !== ItemHandType.ONE_HANDED || !primary.template.canDualWield)) {
        throw new Error("Current primary weapon does not allow a second weapon");
      }
    }

    const beforeState = serializeEquipmentState(equippedItems);

    await tx.itemInstance.update({ where: { id: item.id }, data: { equippedSlot: targetSlot, inventoryPosition: null } });

    if (replaced) {
      await tx.itemInstance.update({
        where: { id: replaced.id },
        data: { equippedSlot: previousSlot && previousSlot !== targetSlot ? previousSlot : null }
      });
    }

    for (const forcedItem of forcedUnequipped) {
      if (forcedItem.id === replaced?.id) continue;
      await tx.itemInstance.update({ where: { id: forcedItem.id }, data: { equippedSlot: null } });
    }

    const nextEquippedItems = await tx.itemInstance.findMany({
      where: { characterId: profile.id, equippedSlot: { not: null } },
      include: { template: true },
      orderBy: { updatedAt: "desc" }
    });

    await recordCharacterAudit(tx, {
      characterId: profile.id,
      actorUserId,
      eventType: CharacterAuditEventType.ITEM_EQUIPPED,
      relatedItemInstanceId: item.id,
      summary: replaced
        ? `${item.template.name} надет в слот ${targetSlot}; ${replaced.template.name} возвращён${previousSlot && previousSlot !== targetSlot ? ` в слот ${previousSlot}` : " в инвентарь"}.`
        : `${item.template.name} надет в слот ${targetSlot}.`,
      beforeState,
      afterState: serializeEquipmentState(nextEquippedItems),
      metadata: {
        itemInstanceId: item.id,
        targetSlot,
        previousSlot,
        replacedItemInstanceId: replaced?.id ?? null,
        forcedUnequippedItemInstanceIds: [...forcedIds]
      }
    });

    return {
      equipped: serializeInstance({ ...item, equippedSlot: targetSlot }),
      replaced: replaced ? serializeInstance({ ...replaced, equippedSlot: previousSlot && previousSlot !== targetSlot ? previousSlot : null }) : null,
      forcedUnequipped: forcedUnequipped.map((forcedItem) => serializeInstance({ ...forcedItem, equippedSlot: null })),
      equipment: nextEquippedItems.map(serializeInstance)
    };
  });
}

async function unequipCharacterItem(actorUserId: number, itemInstanceId: number) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.playerProfile.findUnique({ where: { userId: actorUserId }, select: { id: true } });
    if (!profile) throw new Error("Player profile has not been registered");

    const item = await tx.itemInstance.findFirst({
      where: { id: itemInstanceId, characterId: profile.id },
      include: { template: true }
    });
    if (!item) throw new Error("Item instance not found");
    if (!item.equippedSlot) throw new Error("Item is not equipped");

    const beforeItems = await tx.itemInstance.findMany({
      where: { characterId: profile.id, equippedSlot: { not: null } },
      include: { template: true }
    });

    const updated = await tx.itemInstance.update({
      where: { id: item.id },
      data: { equippedSlot: null },
      include: { template: true }
    });
    const afterItems = beforeItems.filter((equipped) => equipped.id !== item.id);

    await recordCharacterAudit(tx, {
      characterId: profile.id,
      actorUserId,
      eventType: CharacterAuditEventType.ITEM_UNEQUIPPED,
      relatedItemInstanceId: item.id,
      summary: `${item.template.name} снят со слота ${item.equippedSlot} и возвращён в инвентарь.`,
      beforeState: serializeEquipmentState(beforeItems),
      afterState: serializeEquipmentState(afterItems),
      metadata: { itemInstanceId: item.id, previousSlot: item.equippedSlot }
    });

    return { item: serializeInstance(updated), equipment: afterItems.map(serializeInstance) };
  });
}

async function saveInventoryLayout(actorUserId: number, layoutItems: Array<{ itemInstanceId: number; position: number | null }>) {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.playerProfile.findUnique({ where: { userId: actorUserId }, select: { id: true } });
    if (!profile) throw new Error("Player profile has not been registered");

    const itemIds = [...new Set(layoutItems.map((item) => item.itemInstanceId))];
    if (itemIds.length !== layoutItems.length) throw new Error("Duplicate item layout entries are not allowed");

    const instances = await tx.itemInstance.findMany({
      where: { id: { in: itemIds }, characterId: profile.id },
      include: { template: true }
    });
    if (instances.length !== itemIds.length) throw new Error("Item instance not found");

    validateInventoryLayout(layoutItems, instances);
    const beforeState = serializeInventoryLayoutState(instances);

    for (const item of layoutItems) {
      await tx.itemInstance.update({
        where: { id: item.itemInstanceId },
        data: { inventoryPosition: item.position }
      });
    }

    const updated = await tx.itemInstance.findMany({
      where: { id: { in: itemIds }, characterId: profile.id },
      include: { template: true },
      orderBy: { id: "asc" }
    });

    await recordCharacterAudit(tx, {
      characterId: profile.id,
      actorUserId,
      eventType: CharacterAuditEventType.ITEM_MOVED,
      summary: `Сохранена раскладка инвентаря: ${layoutItems.length} предметов.`,
      beforeState,
      afterState: serializeInventoryLayoutState(updated),
      metadata: { itemInstanceIds: itemIds }
    });

    return { items: updated.map(serializeInstance) };
  });
}

function validateInventoryLayout(
  layoutItems: Array<{ itemInstanceId: number; position: number | null }>,
  instances: Array<{ id: number; equippedSlot: CombatEquipmentSlot | null; template: { category: ItemCategory; displaySlot: string | null; handType: ItemHandType | null } }>
) {
  const instancesById = new Map(instances.map((instance) => [instance.id, instance]));
  const occupiedBySection = {
    equipment: new Map<number, number>(),
    supplies: new Map<number, number>()
  };

  for (const layoutItem of layoutItems) {
    const instance = instancesById.get(layoutItem.itemInstanceId);
    if (!instance) throw new Error("Item instance not found");
    if (instance.equippedSlot && layoutItem.position !== null) throw new Error("Equipped items cannot occupy inventory cells");
    if (layoutItem.position === null) continue;

    const section = getInventorySection(instance.template.category);
    const footprint = getInventoryFootprint(instance.template);
    assertInventoryFootprintFits(layoutItem.position, footprint, inventoryCapacityBySection[section]);

    for (const cell of getInventoryFootprintCells(layoutItem.position, footprint)) {
      const owner = occupiedBySection[section].get(cell);
      if (owner !== undefined && owner !== instance.id) throw new Error("Inventory layout has overlapping items");
      occupiedBySection[section].set(cell, instance.id);
    }
  }
}

function getInventorySection(category: ItemCategory) {
  return category === ItemCategory.EQUIPMENT ? "equipment" : "supplies";
}

function getInventoryFootprint(template: { category: ItemCategory; displaySlot: string | null; handType: ItemHandType | null }) {
  if (template.category !== ItemCategory.EQUIPMENT) return { width: 1, height: 1 };
  if (template.handType === ItemHandType.TWO_HANDED) return { width: 1, height: 4 };
  if (template.handType === ItemHandType.ONE_HANDED) return { width: 1, height: 3 };
  if (template.handType === ItemHandType.SHIELD || template.displaySlot === "Щит") return { width: 2, height: 3 };

  switch (template.displaySlot) {
    case "Шлем":
    case "Обувь":
      return { width: 2, height: 2 };
    case "Броня":
      return { width: 2, height: 3 };
    case "Лёгкая броня":
      return { width: 2, height: 2 };
    case "Ноги":
    case "Штаны":
      return { width: 2, height: 3 };
    case "Пояс":
      return { width: 2, height: 1 };
    default:
      return { width: 1, height: 1 };
  }
}

function assertInventoryFootprintFits(position: number, footprint: { width: number; height: number }, totalCells: number) {
  const column = position % inventoryGridColumns;
  const row = Math.floor(position / inventoryGridColumns);
  const rows = Math.ceil(totalCells / inventoryGridColumns);

  if (column + footprint.width > inventoryGridColumns || row + footprint.height > rows) {
    throw new Error("Inventory item does not fit at requested position");
  }
}

function getInventoryFootprintCells(position: number, footprint: { width: number; height: number }) {
  const column = position % inventoryGridColumns;
  const row = Math.floor(position / inventoryGridColumns);
  const cells: number[] = [];

  for (let y = 0; y < footprint.height; y += 1) {
    for (let x = 0; x < footprint.width; x += 1) {
      cells.push((row + y) * inventoryGridColumns + column + x);
    }
  }

  return cells;
}

function chooseEquipmentSlot(
  template: { displaySlot: string | null; handType: ItemHandType | null; canDualWield: boolean },
  equippedItems: Array<{ equippedSlot: CombatEquipmentSlot | null; template: { handType: ItemHandType | null } }>
) {
  const occupied = new Set(equippedItems.map((item) => item.equippedSlot).filter(Boolean));

  if (template.handType === ItemHandType.SHIELD) return CombatEquipmentSlot.OFF_HAND;
  if (template.handType === ItemHandType.TWO_HANDED) return CombatEquipmentSlot.PRIMARY_HAND;
  if (template.handType === ItemHandType.ONE_HANDED) {
    if (!occupied.has(CombatEquipmentSlot.PRIMARY_HAND)) return CombatEquipmentSlot.PRIMARY_HAND;
    return template.canDualWield ? CombatEquipmentSlot.OFF_HAND : CombatEquipmentSlot.PRIMARY_HAND;
  }

  switch (template.displaySlot) {
    case "Шлем": return CombatEquipmentSlot.HELMET;
    case "Броня": return CombatEquipmentSlot.ARMOR;
    case "Пояс": return CombatEquipmentSlot.BELT;
    case "Ноги": return CombatEquipmentSlot.PANTS;
    case "Штаны": return CombatEquipmentSlot.PANTS;
    case "Обувь": return CombatEquipmentSlot.BOOTS;
    case "Щит": return CombatEquipmentSlot.OFF_HAND;
    default: throw new Error("Unable to determine equipment slot");
  }
}

function assertItemFitsSlot(template: { displaySlot: string | null; handType: ItemHandType | null; canDualWield: boolean }, slot: CombatEquipmentSlot) {
  if (slot === CombatEquipmentSlot.PRIMARY_HAND) {
    if (template.handType === ItemHandType.SHIELD || !template.handType) throw new Error("Only weapons can be equipped in the primary hand");
    return;
  }

  if (slot === CombatEquipmentSlot.OFF_HAND) {
    if (template.handType === ItemHandType.SHIELD) return;
    if (template.handType === ItemHandType.ONE_HANDED && template.canDualWield) return;
    throw new Error("Only shields or dual-wield weapons can be equipped in the off-hand slot");
  }

  const expectedBySlot: Partial<Record<CombatEquipmentSlot, string[]>> = {
    HELMET: ["Шлем"],
    ARMOR: ["Броня", "Лёгкая броня"],
    BELT: ["Пояс"],
    PANTS: ["Ноги", "Штаны"],
    BOOTS: ["Обувь"]
  };
  if (!(expectedBySlot[slot] ?? []).includes(template.displaySlot ?? "")) throw new Error(`Item cannot be equipped in ${slot}`);
}

function getForcedUnequippedItems<T extends { id: number; equippedSlot: CombatEquipmentSlot | null; template: { handType: ItemHandType | null; canDualWield: boolean } }>(
  template: { handType: ItemHandType | null; canDualWield: boolean },
  targetSlot: CombatEquipmentSlot,
  currentBySlot: Map<CombatEquipmentSlot | null, T>
) {
  if (
    targetSlot === CombatEquipmentSlot.PRIMARY_HAND
    && (template.handType === ItemHandType.TWO_HANDED || (template.handType === ItemHandType.ONE_HANDED && !template.canDualWield))
  ) {
    const offhand = currentBySlot.get(CombatEquipmentSlot.OFF_HAND);
    if (!offhand) return [];
    if (template.handType === ItemHandType.TWO_HANDED || offhand.template.handType === ItemHandType.ONE_HANDED) return [offhand];
    return [];
  }

  return [];
}

function assertRequirements(
  template: { name: string; levelRequirement: number; requirements: Prisma.JsonValue },
  stats: ReturnType<typeof defaultStats>,
  level: number
) {
  if (level < template.levelRequirement) throw new Error(`${template.name}: required level ${template.levelRequirement}`);
  const statLabels: Record<string, keyof ReturnType<typeof defaultStats>> = {
    "Сила": "strength",
    "Ловкость": "agility",
    "Выносливость": "vitality",
    "Интуиция": "intuition",
    "Интеллект": "intelligence",
    "Мудрость": "wisdom"
  };

  if (!Array.isArray(template.requirements)) return;

  for (const requirement of template.requirements) {
    if (typeof requirement !== "string") continue;
    const match = requirement.match(/^([^:]+):\s*(\d+)/);
    if (!match) continue;
    const label = match[1].trim();
    const value = Number(match[2]);
    if (label === "Уровень" && level < value) throw new Error(`${template.name}: required level ${value}`);
    const stat = statLabels[label];
    if (stat && stats[stat] < value) throw new Error(`${template.name}: required ${label} ${value}`);
  }
}

function defaultStats() {
  return { strength: 10, agility: 10, vitality: 10, intuition: 10, intelligence: 10, wisdom: 10 };
}

function serializeEquipmentState(items: Array<{ id: number; equippedSlot: CombatEquipmentSlot | null; template: { id: number; slug: string; name: string } }>) {
  return items.map((item) => ({
    itemInstanceId: item.id,
    templateId: item.template.id,
    slug: item.template.slug,
    name: item.template.name,
    equippedSlot: item.equippedSlot
  }));
}

function serializeInventoryLayoutState(items: Array<{ id: number; inventoryPosition: number | null; equippedSlot: CombatEquipmentSlot | null; template: { id: number; slug: string; name: string; category: ItemCategory } }>) {
  return items.map((item) => ({
    itemInstanceId: item.id,
    templateId: item.template.id,
    slug: item.template.slug,
    name: item.template.name,
    category: item.template.category,
    equippedSlot: item.equippedSlot,
    inventoryPosition: item.inventoryPosition
  }));
}

type SerializableItemInstance = {
  id: number;
  quantity: number;
  equippedSlot: CombatEquipmentSlot | null;
  inventoryPosition?: number | null;
  currentDurability: { toString(): string };
  maxDurability: { toString(): string };
  template: Parameters<typeof serializeTemplate>[0];
};

function serializeInstance(instance: SerializableItemInstance) {
  return {
    id: instance.id,
    quantity: instance.quantity,
    equippedSlot: instance.equippedSlot,
    inventoryPosition: instance.inventoryPosition ?? null,
    currentDurability: instance.currentDurability.toString(),
    maxDurability: instance.maxDurability.toString(),
    template: serializeTemplate(instance.template)
  };
}

function serializeTemplate(template: {
  id: number;
  slug: string;
  name: string;
  category: string;
  icon: string;
  displaySlot: string | null;
  description: string;
  requirements: unknown;
  properties: unknown;
  rarity: string;
  levelRequirement: number;
  baseWeaponDamage: number;
  baseArmor: number;
  armorByZone: unknown;
}) {
  return {
    id: template.id,
    slug: template.slug,
    name: template.name,
    category: template.category,
    icon: template.icon,
    slot: template.displaySlot,
    description: template.description,
    requirements: template.requirements,
    properties: template.properties,
    rarity: template.rarity,
    levelRequirement: template.levelRequirement,
    baseWeaponDamage: template.baseWeaponDamage,
    baseArmor: template.baseArmor,
    armorByZone: template.armorByZone
  };
}

function readPositiveId(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function sendItemError(res: { status(code: number): { json(value: unknown): unknown } }, error: unknown) {
  const message = error instanceof Error ? error.message : "Item request failed";
  const status = /not found|registered/i.test(message)
    ? 404
    : /cannot|invalid|required|broken|unable|not equipped/i.test(message)
      ? 400
      : 500;
  res.status(status).json({ error: message });
}
