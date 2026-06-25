import { useEffect, useMemo, useRef, useState } from "react";
import { ItemDescriptionDialog } from "./ItemDescriptionDialog";
import { announceItemDescriptionOpen, subscribeItemDescriptionOpen } from "./itemDescriptionEvents";
import styles from "./InventoryBagPage.module.css";

type InventoryCategory = "equipment" | "supplies";
type EquipmentKind = "all" | "weapon" | "helmet" | "armor" | "accessory" | "legs";
export type InventoryStatId = "strength" | "agility" | "vitality" | "intuition" | "intelligence" | "wisdom";
export type InventoryEquippedSlot =
  | "earring-left"
  | "earring-right"
  | "amulet"
  | "weapon"
  | "armor"
  | "pants"
  | "helmet"
  | "bracers"
  | "gloves"
  | "belt"
  | "shield"
  | "boots";

export type InventoryItem = {
  id: string;
  name: string;
  category: "equipment" | "consumables" | "materials";
  equipmentKind?: Exclude<EquipmentKind, "all">;
  slot: string;
  handedness?: "one-handed" | "two-handed" | "shield";
  footprint: {
    width: number;
    height: number;
    label: string;
  };
  rarity: "common" | "rare" | "epic";
  amount?: number;
  description: string;
  requirements?: readonly string[];
  bonuses: readonly string[];
  protection?: string;
  damageReduction?: string;
  icon: string;
};

export type EquippedInventorySlots = Partial<Record<InventoryEquippedSlot, string>>;

const categories: ReadonlyArray<{ id: InventoryCategory; label: string }> = [
  { id: "equipment", label: "Снаряжение" },
  { id: "supplies", label: "Материалы/расходники" }
];

const inventoryCapacity: Record<InventoryCategory, number> = {
  equipment: 72,
  supplies: 72
};

const gridColumns = 6;
const pointerDragStartDistance = 3;
const inventoryLayoutsStorageKey = "nightclub:inventory-layouts:v2";

type InventoryLayouts = Record<InventoryCategory, Record<string, number>>;
type DragPreviewState = { itemId: string; left: number; top: number; width: number; height: number };

function getInventoryCategory(item: InventoryItem): InventoryCategory {
  return item.category === "equipment" ? "equipment" : "supplies";
}

function getItemCells(item: InventoryItem, startCell: number) {
  const startColumn = startCell % gridColumns;
  const startRow = Math.floor(startCell / gridColumns);
  const cells: number[] = [];

  for (let rowOffset = 0; rowOffset < item.footprint.height; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < item.footprint.width; columnOffset += 1) {
      cells.push((startRow + rowOffset) * gridColumns + startColumn + columnOffset);
    }
  }

  return cells;
}

function canPlaceItemAt(
  item: InventoryItem,
  startCell: number,
  layout: Record<string, number>,
  inventoryItems: readonly InventoryItem[],
  totalCells: number,
  excludedItemId = item.id
) {
  const startColumn = startCell % gridColumns;
  const startRow = Math.floor(startCell / gridColumns);
  const rowCount = Math.ceil(totalCells / gridColumns);

  if (startColumn + item.footprint.width > gridColumns || startRow + item.footprint.height > rowCount) {
    return false;
  }

  const candidateCells = new Set(getItemCells(item, startCell));
  if ([...candidateCells].some((cell) => cell < 0 || cell >= totalCells)) {
    return false;
  }

  return !inventoryItems.some((otherItem) => {
    if (otherItem.id === excludedItemId || getInventoryCategory(otherItem) !== getInventoryCategory(item)) return false;
    const otherStart = layout[otherItem.id];
    if (otherStart === undefined) return false;
    return getItemCells(otherItem, otherStart).some((cell) => candidateCells.has(cell));
  });
}

function findPlacementNearCell(
  item: InventoryItem,
  targetCell: number,
  layout: Record<string, number>,
  inventoryItems: readonly InventoryItem[],
  totalCells: number
) {
  if (canPlaceItemAt(item, targetCell, layout, inventoryItems, totalCells)) {
    return targetCell;
  }

  const targetColumn = targetCell % gridColumns;
  const targetRow = Math.floor(targetCell / gridColumns);
  const rowCount = Math.ceil(totalCells / gridColumns);
  const candidates: Array<{ cell: number; distance: number }> = [];

  for (let row = 0; row < rowCount; row += 1) {
    for (let column = 0; column < gridColumns; column += 1) {
      const startCell = row * gridColumns + column;
      if (!canPlaceItemAt(item, startCell, layout, inventoryItems, totalCells)) {
        continue;
      }

      const left = column;
      const right = column + item.footprint.width - 1;
      const top = row;
      const bottom = row + item.footprint.height - 1;
      const columnDistance = targetColumn < left ? left - targetColumn : targetColumn > right ? targetColumn - right : 0;
      const rowDistance = targetRow < top ? top - targetRow : targetRow > bottom ? targetRow - bottom : 0;

      candidates.push({
        cell: startCell,
        distance: columnDistance + rowDistance
      });
    }
  }

  candidates.sort((left, right) => left.distance - right.distance || left.cell - right.cell);
  return candidates[0]?.cell ?? null;
}

function packInventory(itemsToPack: readonly InventoryItem[], category: InventoryCategory) {
  const totalCells = inventoryCapacity[category];
  const layout: Record<string, number> = {};

  for (const item of itemsToPack) {
    for (let cell = 0; cell < totalCells; cell += 1) {
      if (canPlaceItemAt(item, cell, layout, itemsToPack, totalCells)) {
        layout[item.id] = cell;
        break;
      }
    }
  }

  return layout;
}

function createInitialLayouts(itemsToPack: readonly InventoryItem[]): InventoryLayouts {
  const equipmentItems = itemsToPack.filter((item) => getInventoryCategory(item) === "equipment");
  const supplyItems = itemsToPack.filter((item) => getInventoryCategory(item) === "supplies");

  return {
    equipment: packInventory(equipmentItems, "equipment"),
    supplies: packInventory(supplyItems, "supplies")
  };
}

function readStoredInventoryLayouts(itemsToPack: readonly InventoryItem[]): InventoryLayouts {
  const fallbackLayouts = createInitialLayouts(itemsToPack);

  try {
    const saved = window.localStorage.getItem(inventoryLayoutsStorageKey);
    if (!saved) return fallbackLayouts;

    const parsed = JSON.parse(saved) as Partial<InventoryLayouts> | null;
    if (!parsed || typeof parsed !== "object") return fallbackLayouts;

    const itemIds = new Set(itemsToPack.map((item) => item.id));

    return {
      equipment: mergeStoredLayout(fallbackLayouts.equipment, parsed.equipment, itemIds),
      supplies: mergeStoredLayout(fallbackLayouts.supplies, parsed.supplies, itemIds)
    };
  } catch {
    return fallbackLayouts;
  }
}

function mergeStoredLayout(
  fallbackLayout: Record<string, number>,
  storedLayout: Record<string, number> | undefined,
  itemIds: ReadonlySet<string>
) {
  if (!storedLayout || typeof storedLayout !== "object") return fallbackLayout;

  const merged = { ...fallbackLayout };

  for (const [itemId, cell] of Object.entries(storedLayout)) {
    if (!itemIds.has(itemId) || !Number.isInteger(cell) || cell < 0) continue;
    merged[itemId] = cell;
  }

  return merged;
}

function repairInventoryLayout(itemsToPlace: readonly InventoryItem[], category: InventoryCategory, currentLayout: Record<string, number>) {
  const totalCells = inventoryCapacity[category];
  const nextLayout: Record<string, number> = {};
  let changed = false;

  for (const item of itemsToPlace) {
    const currentCell = currentLayout[item.id];
    const canKeepCurrentCell = currentCell !== undefined && canPlaceItemAt(item, currentCell, nextLayout, itemsToPlace, totalCells);
    const nextCell = canKeepCurrentCell ? currentCell : findPlacementNearCell(item, currentCell ?? 0, nextLayout, itemsToPlace, totalCells);

    if (nextCell !== null) {
      nextLayout[item.id] = nextCell;
      changed = changed || nextCell !== currentCell;
    } else if (currentCell !== undefined) {
      nextLayout[item.id] = currentCell;
    }
  }

  return { layout: nextLayout, changed: changed || Object.keys(nextLayout).length !== Object.keys(currentLayout).length };
}

const equipmentFilters: ReadonlyArray<{ id: EquipmentKind; label: string }> = [
  { id: "all", label: "Всё" },
  { id: "weapon", label: "Оружие" },
  { id: "helmet", label: "Шлемы" },
  { id: "armor", label: "Броня" },
  { id: "accessory", label: "Аксессуары" },
  { id: "legs", label: "Ноги" }
];

export const inventoryItemsCatalog: readonly InventoryItem[] = [
  {
    id: "night-blade",
    name: "Ночной клинок",
    category: "equipment",
    equipmentKind: "weapon",
    slot: "Оружие",
    handedness: "one-handed",
    footprint: { width: 1, height: 3, label: "Оружие: 3 ячейки" },
    rarity: "epic",
    description: "Клинок для быстрых выпадов из тени. Особенно опасен после успешного уворота.",
    requirements: ["Сила: 18", "Ловкость: 24", "Уровень: 12"],
    bonuses: ["Урон: 12–18", "Критический удар: +4%", "Уворот после атаки: +2%"],
    icon: "⚔"
  },
  {
    id: "scout-hood",
    name: "Капюшон следопыта",
    category: "equipment",
    equipmentKind: "helmet",
    slot: "Шлем",
    footprint: { width: 2, height: 2, label: "Шлем: 4 ячейки" },
    rarity: "rare",
    description: "Лёгкий капюшон, скрывающий силуэт в тёмных кварталах.",
    requirements: ["Интуиция: 16", "Уровень: 9"],
    bonuses: ["Уворот: +3%", "Интуиция: +2"],
    protection: "4–7",
    damageReduction: "Физический урон: 4–7",
    icon: "◒"
  },
  {
    id: "night-coat",
    name: "Плащ ночного дозора",
    category: "equipment",
    equipmentKind: "armor",
    slot: "Броня",
    footprint: { width: 2, height: 3, label: "Броня: 6 ячеек" },
    rarity: "epic",
    description: "Усиленный плащ с пластинами на груди и спине. Защищает, не ограничивая движение.",
    requirements: ["Выносливость: 20", "Ловкость: 18", "Уровень: 11"],
    bonuses: ["Выносливость: +5", "Сопротивление магии: +3%"],
    protection: "12–18",
    damageReduction: "Физический урон: 12–18; магический: 4–6",
    icon: "▣"
  },
  {
    id: "shadow-gloves",
    name: "Перчатки теней",
    category: "equipment",
    equipmentKind: "accessory",
    slot: "Перчатки",
    footprint: { width: 2, height: 1, label: "Перчатки: 2 ячейки" },
    rarity: "rare",
    description: "Тонкие перчатки с серебряной нитью для точных ударов.",
    requirements: ["Ловкость: 14", "Уровень: 8"],
    bonuses: ["Точность: +3", "Критический удар: +2%"],
    protection: "2–4",
    damageReduction: "Физический урон: 2–4",
    icon: "✧"
  },
  {
    id: "guard-belt",
    name: "Пояс стража",
    category: "equipment",
    equipmentKind: "accessory",
    slot: "Пояс",
    footprint: { width: 2, height: 1, label: "Пояс: 2 ячейки" },
    rarity: "common",
    description: "Практичный пояс с креплениями для расходников и инструментов.",
    requirements: ["Выносливость: 10"],
    bonuses: ["Макс. здоровье: +15", "Слотов для расходников: +1"],
    protection: "3–5",
    damageReduction: "Физический урон: 3–5",
    icon: "═"
  },
  {
    id: "runners-boots",
    name: "Ботинки беглеца",
    category: "equipment",
    equipmentKind: "legs",
    slot: "Обувь",
    footprint: { width: 2, height: 2, label: "Обувь: 4 ячейки" },
    rarity: "rare",
    description: "Укреплённая обувь для рывков по мокрому камню и крышам.",
    requirements: ["Ловкость: 17", "Уровень: 10"],
    bonuses: ["Ловкость: +3", "Инициатива: +4"],
    protection: "5–8",
    damageReduction: "Физический урон: 5–8",
    icon: "⌁"
  },
  {
    id: "silver-earring",
    name: "Серебряная серьга",
    category: "equipment",
    equipmentKind: "accessory",
    slot: "Серьга",
    footprint: { width: 1, height: 1, label: "Серьга: 1 ячейка" },
    rarity: "common",
    description: "Небольшая серьга с защитной гравировкой.",
    requirements: ["Уровень: 3"],
    bonuses: ["Интуиция: +1", "Сопротивление оглушению: +1%"],
    icon: "◦"
  },
  {
    id: "duelist-ring",
    name: "Кольцо дуэлянта",
    category: "equipment",
    equipmentKind: "accessory",
    slot: "Кольцо",
    footprint: { width: 1, height: 1, label: "Кольцо: 1 ячейка" },
    rarity: "rare",
    description: "Тонкое кольцо, помогающее держать темп в ближнем бою.",
    requirements: ["Ловкость: 12"],
    bonuses: ["Шанс контрудара: +2%", "Инициатива: +1"],
    icon: "○"
  },
  {
    id: "amber-amulet",
    name: "Амулет янтаря",
    category: "equipment",
    equipmentKind: "accessory",
    slot: "Амулет",
    footprint: { width: 1, height: 1, label: "Амулет: 1 ячейка" },
    rarity: "epic",
    description: "Амулет удерживает тепло тела и ускоряет восстановление после боя.",
    requirements: ["Мудрость: 14", "Уровень: 8"],
    bonuses: ["Регенерация HP: +3/мин", "Сопротивление магии: +4%"],
    icon: "◇"
  },
  {
    id: "iron-bracers",
    name: "Железные наручи",
    category: "equipment",
    equipmentKind: "accessory",
    slot: "Наручи",
    footprint: { width: 2, height: 1, label: "Наручи: 2 ячейки" },
    rarity: "common",
    description: "Простые наручи для защиты предплечий.",
    requirements: ["Сила: 10"],
    bonuses: ["Блок: +2%", "Сила: +1"],
    protection: "3–5",
    damageReduction: "Рубящий урон: 3–5",
    icon: "▱"
  },
  {
    id: "arena-shield",
    name: "Щит арены",
    category: "equipment",
    equipmentKind: "armor",
    slot: "Щит",
    handedness: "shield",
    footprint: { width: 2, height: 3, label: "Крупный щит: 6 ячеек" },
    rarity: "rare",
    description: "Крупный щит для удержания линии. Занимает больше места, но лучше гасит удар.",
    requirements: ["Сила: 18", "Выносливость: 16"],
    bonuses: ["Блок: +7%", "Шанс контрудара: +1%"],
    protection: "10–16",
    damageReduction: "Физический урон: 10–16",
    icon: "⬟"
  },
  {
    id: "light-vest",
    name: "Лёгкая броня разведчика",
    category: "equipment",
    equipmentKind: "armor",
    slot: "Лёгкая броня",
    footprint: { width: 2, height: 2, label: "Лёгкая броня: 4 ячейки" },
    rarity: "rare",
    description: "Лёгкая броня занимает меньше места и почти не мешает увороту.",
    requirements: ["Ловкость: 15", "Уровень: 7"],
    bonuses: ["Уворот: +2%", "Макс. здоровье: +10"],
    protection: "7–11",
    damageReduction: "Физический урон: 7–11",
    icon: "▤"
  },
  {
    id: "guard-pants",
    name: "Штаны стража",
    category: "equipment",
    equipmentKind: "legs",
    slot: "Штаны",
    footprint: { width: 2, height: 3, label: "Штаны: 6 ячеек" },
    rarity: "common",
    description: "Плотные штаны с кожаными вставками на бёдрах и коленях.",
    requirements: ["Выносливость: 12"],
    bonuses: ["Выносливость: +2", "Сопротивление кровотечению: +2%"],
    protection: "6–10",
    damageReduction: "Колющий урон: 6–10",
    icon: "▥"
  },
  {
    id: "duelist-spear",
    name: "Копьё дуэлянта",
    category: "equipment",
    equipmentKind: "weapon",
    slot: "Оружие",
    handedness: "two-handed",
    footprint: { width: 1, height: 4, label: "Длинное оружие: 4 ячейки" },
    rarity: "rare",
    description: "Длинное оружие требует больше места в сумке, зато даёт преимущество на дистанции.",
    requirements: ["Сила: 16", "Ловкость: 14"],
    bonuses: ["Урон: 10–16", "Точность: +2", "Контрудар: +2%"],
    icon: "╽"
  },
  {
    id: "healing-elixir",
    name: "Эликсир лечения",
    category: "consumables",
    slot: "Быстрый слот",
    footprint: { width: 1, height: 1, label: "Расходник: 1 ячейка" },
    rarity: "common",
    amount: 6,
    description: "Восстанавливает здоровье после применения.",
    bonuses: ["Лечение: 60 HP", "Перезарядка: 3 хода"],
    icon: "✚"
  },
  {
    id: "shadow-oil",
    name: "Масло тени",
    category: "consumables",
    slot: "Быстрый слот",
    footprint: { width: 1, height: 1, label: "Расходник: 1 ячейка" },
    rarity: "rare",
    amount: 2,
    description: "Ненадолго усиливает уход в тень и усложняет противнику попадание.",
    bonuses: ["Уворот: +8% на 2 хода", "Скрытность: +1"],
    icon: "◈"
  },
  {
    id: "iron-ore",
    name: "Чёрное железо",
    category: "materials",
    slot: "Материал",
    footprint: { width: 1, height: 1, label: "Материал: 1 ячейка" },
    rarity: "common",
    amount: 18,
    description: "Ресурс для ремонта и создания тяжёлого снаряжения.",
    bonuses: ["Ремонт предметов", "Создание брони"],
    icon: "◆"
  },
  {
    id: "amber-shard",
    name: "Янтарный осколок",
    category: "materials",
    slot: "Материал",
    footprint: { width: 1, height: 1, label: "Материал: 1 ячейка" },
    rarity: "epic",
    amount: 3,
    description: "Редкий осколок с сохранённым отблеском старой магии.",
    bonuses: ["Улучшение редкого снаряжения", "Наложение чар"],
    icon: "✦"
  }
];

const items = inventoryItemsCatalog;

export const inventoryItemsById = new Map(inventoryItemsCatalog.map((item) => [item.id, item]));

const requirementStatLabels: Record<string, InventoryStatId> = {
  "Сила": "strength",
  "Ловкость": "agility",
  "Выносливость": "vitality",
  "Интуиция": "intuition",
  "Интеллект": "intelligence",
  "Мудрость": "wisdom"
};

export function getInventoryItemPreferredSlot(item: InventoryItem, equippedSlots: EquippedInventorySlots): InventoryEquippedSlot | null {
  if (item.category !== "equipment") return null;

  if (item.slot === "Серьга") return equippedSlots["earring-left"] ? "earring-right" : "earring-left";
  if (item.slot === "Кольцо") return equippedSlots["earring-right"] ? "earring-left" : "earring-right";
  if (item.slot === "Амулет") return "amulet";
  if (item.slot === "Шлем") return "helmet";
  if (item.slot === "Наручи") return "bracers";
  if (item.slot === "Перчатки") return "gloves";
  if (item.slot === "Пояс") return "belt";
  if (item.slot === "Броня" || item.slot === "Лёгкая броня") return "armor";
  if (item.slot === "Штаны") return "pants";
  if (item.slot === "Обувь") return "boots";
  if (item.slot === "Щит") return "shield";
  if (item.slot === "Оружие") {
    if (!equippedSlots.weapon) return "weapon";
    if (item.handedness === "one-handed") return "shield";
    return "weapon";
  }

  return null;
}

export function validateInventoryItemRequirements(
  item: InventoryItem,
  characterStats: Record<InventoryStatId, number> | null,
  characterLevel: number | null
) {
  if (item.category !== "equipment") return { ok: false, message: "Этот предмет нельзя одеть." };
  if (!characterStats || characterLevel === null) return { ok: false, message: "Характеристики ещё загружаются. Нельзя проверить требования предмета." };

  const unmetRequirements = getInventoryItemUnmetRequirements(item, characterStats, characterLevel);
  if (unmetRequirements.length > 0) {
    return { ok: false, message: unmetRequirements[0]?.message ?? "Требования предмета не выполнены." };
  }

  return { ok: true, message: "" };
}

function getInventoryItemUnmetRequirements(
  item: InventoryItem,
  characterStats: Record<InventoryStatId, number> | null,
  characterLevel: number | null
) {
  if (item.category !== "equipment" || !characterStats || characterLevel === null) {
    return [];
  }

  const unmet: Array<{ requirement: string; message: string }> = [];

  for (const requirement of item.requirements ?? []) {
    const match = requirement.match(/^([^:]+):\s*(\d+)/);
    if (!match) continue;

    const label = match[1].trim();
    const requiredValue = Number(match[2]);

    if (label === "Уровень" && characterLevel < requiredValue) {
      unmet.push({ requirement, message: `${item.name}: нужен Уровень ${requiredValue}. Сейчас ${characterLevel}.` });
      continue;
    }

    const statId = requirementStatLabels[label];
    if (statId && characterStats[statId] < requiredValue) {
      unmet.push({ requirement, message: `${item.name}: нужно ${label} ${requiredValue}. Сейчас ${characterStats[statId]}.` });
    }
  }

  return unmet;
}

export function InventoryBagPage({
  characterLevel,
  characterStats,
  equippedItemIds,
  equippedSlots,
  onEquipInventoryItem,
  onOpenFittingRoom,
  onUnequipInventoryItem
}: {
  characterLevel: number | null;
  characterStats: Record<InventoryStatId, number> | null;
  equippedItemIds: ReadonlySet<string>;
  equippedSlots: EquippedInventorySlots;
  onEquipInventoryItem: (itemId: string, targetSlot: InventoryEquippedSlot) => string | null;
  onOpenFittingRoom: () => void;
  onUnequipInventoryItem: (itemId: string) => void;
}) {
  const descriptionOwnerId = useRef(`inventory-bag-${Math.random().toString(36).slice(2)}`);
  const [inventoryItems, setInventoryItems] = useState<readonly InventoryItem[]>(items);
  const [inventoryLayouts, setInventoryLayouts] = useState<InventoryLayouts>(() => readStoredInventoryLayouts(items));
  const [category, setCategory] = useState<InventoryCategory>("equipment");
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentKind>("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemAnchor, setSelectedItemAnchor] = useState<DOMRect | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [hoveredItemAnchor, setHoveredItemAnchor] = useState<DOMRect | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragTargetCell, setDragTargetCell] = useState<number | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);
  const [droppedItemId, setDroppedItemId] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<{ itemId: string; left: number; top: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const gridRef = useRef<HTMLDivElement | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const suppressNextClick = useRef(false);
  const pointerDragRef = useRef<{
    itemId: string;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    active: boolean;
  } | null>(null);
  const dropAnimationTimer = useRef<number | null>(null);
  const availableInventoryItems = useMemo(
    () => inventoryItems.filter((item) => !equippedItemIds.has(item.id)),
    [equippedItemIds, inventoryItems]
  );
  const activeInventoryItems = useMemo(
    () => availableInventoryItems.filter((item) => category === "equipment" ? item.category === "equipment" : item.category === "consumables" || item.category === "materials"),
    [availableInventoryItems, category]
  );
  const visibleItems = useMemo(
    () => {
      const query = searchQuery.trim().toLocaleLowerCase("ru-RU");

      return activeInventoryItems.filter((item) => {
        const matchesEquipmentType = category !== "equipment" || equipmentFilter === "all" || item.equipmentKind === equipmentFilter;
        const matchesSearch = !query || `${item.name} ${item.description}`.toLocaleLowerCase("ru-RU").includes(query);
        return matchesEquipmentType && matchesSearch;
      });
    },
    [activeInventoryItems, category, equipmentFilter, searchQuery]
  );
  const unmetRequirementsByItemId = useMemo(() => {
    const entries = activeInventoryItems.map((item) => [
      item.id,
      getInventoryItemUnmetRequirements(item, characterStats, characterLevel)
    ] as const);
    return new Map(entries);
  }, [activeInventoryItems, characterLevel, characterStats]);
  const activeItemId = selectedItemId ?? hoveredItemId;
  const selectedItem = visibleItems.find((item) => item.id === activeItemId) ?? null;
  const selectedItemUnmetRequirements = selectedItem
    ? unmetRequirementsByItemId.get(selectedItem.id)?.map((entry) => entry.requirement) ?? []
    : [];
  const menuItem = actionMenu ? inventoryItems.find((item) => item.id === actionMenu.itemId) ?? null : null;
  const confirmDeleteItem = confirmDeleteId ? inventoryItems.find((item) => item.id === confirmDeleteId) ?? null : null;
  const occupiedCells = activeInventoryItems.reduce((sum, item) => sum + item.footprint.width * item.footprint.height, 0);
  const totalCells = inventoryCapacity[category];
  const rowCount = Math.ceil(totalCells / gridColumns);
  const activeLayout = inventoryLayouts[category];
  const occupiedCellOwners = useMemo(() => {
    const owners = new Map<number, string>();

    for (const item of activeInventoryItems) {
      const startCell = activeLayout[item.id];
      if (startCell === undefined) continue;
      for (const cell of getItemCells(item, startCell)) {
        owners.set(cell, item.id);
      }
    }

    return owners;
  }, [activeInventoryItems, activeLayout]);
  const draggedInventoryItem = useMemo(
    () => draggedItemId ? availableInventoryItems.find((item) => item.id === draggedItemId) ?? null : null,
    [availableInventoryItems, draggedItemId]
  );
  const activeDropCells = useMemo(() => {
    if (!draggedInventoryItem) return new Set<number>();

    const startCell = dragPreview
      ? getPreviewStartCell(draggedInventoryItem, dragPreview)
      : dragTargetCell;

    if (startCell === null || startCell === undefined) return new Set<number>();
    if (!canPlaceItemAt(draggedInventoryItem, startCell, activeLayout, activeInventoryItems, totalCells)) return new Set<number>();

    return new Set(getItemCells(draggedInventoryItem, startCell));
  }, [activeInventoryItems, activeLayout, dragPreview, dragTargetCell, draggedInventoryItem, totalCells]);

  useEffect(() => () => {
    clearLongPress();
    clearDropAnimation();
  }, []);

  useEffect(() => {
    const equipmentItems = availableInventoryItems.filter((item) => getInventoryCategory(item) === "equipment");
    const supplyItems = availableInventoryItems.filter((item) => getInventoryCategory(item) === "supplies");

    setInventoryLayouts((currentLayouts) => {
      const equipment = repairInventoryLayout(equipmentItems, "equipment", currentLayouts.equipment);
      const supplies = repairInventoryLayout(supplyItems, "supplies", currentLayouts.supplies);

      if (!equipment.changed && !supplies.changed) return currentLayouts;
      return { equipment: equipment.layout, supplies: supplies.layout };
    });
  }, [availableInventoryItems]);

  useEffect(() => {
    window.localStorage.setItem(inventoryLayoutsStorageKey, JSON.stringify(inventoryLayouts));
  }, [inventoryLayouts]);

  useEffect(() => subscribeItemDescriptionOpen(descriptionOwnerId.current, () => {
    setSelectedItemId(null);
    setSelectedItemAnchor(null);
    setHoveredItemId(null);
    setHoveredItemAnchor(null);
  }), []);

  function selectCategory(nextCategory: InventoryCategory) {
    setCategory(nextCategory);
    setEquipmentFilter("all");
    setSelectedItemId(null);
    setActionMenu(null);
  }

  function selectEquipmentType(nextFilter: EquipmentKind) {
    setCategory("equipment");
    setEquipmentFilter(nextFilter);
    setSelectedItemId(null);
    setActionMenu(null);
  }

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function clearDropAnimation() {
    if (dropAnimationTimer.current !== null) {
      window.clearTimeout(dropAnimationTimer.current);
      dropAnimationTimer.current = null;
    }
  }

  function openActionMenu(itemId: string, rect: DOMRect) {
    clearLongPress();
    suppressNextClick.current = true;
    setSelectedItemId(null);
    setHoveredItemId(null);
    setActionMenu({
      itemId,
      left: Math.min(rect.left + rect.width / 2, window.innerWidth - 94),
      top: Math.min(rect.top + rect.height / 2, window.innerHeight - 118)
    });
  }

  function startLongPress(itemId: string, rect: DOMRect) {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => openActionMenu(itemId, rect), 560);
  }

  function getGridCellFromPoint(clientX: number, clientY: number) {
    const grid = gridRef.current;
    if (!grid) return null;

    const rect = grid.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return null;
    }

    const slots = [...grid.querySelectorAll<HTMLElement>("[data-cell]")];
    const hoveredSlot = slots.find((slot) => {
      const slotRect = slot.getBoundingClientRect();
      return clientX >= slotRect.left && clientX <= slotRect.right && clientY >= slotRect.top && clientY <= slotRect.bottom;
    });

    if (hoveredSlot?.dataset.cell) {
      return Number(hoveredSlot.dataset.cell) - 1;
    }

    let nearestCell: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const slot of slots) {
      const slotCell = slot.dataset.cell ? Number(slot.dataset.cell) - 1 : null;
      if (slotCell === null || slotCell < 0 || slotCell >= totalCells) continue;

      const slotRect = slot.getBoundingClientRect();
      const centerX = slotRect.left + slotRect.width / 2;
      const centerY = slotRect.top + slotRect.height / 2;
      const distance = Math.abs(clientX - centerX) + Math.abs(clientY - centerY);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestCell = slotCell;
      }
    }

    return nearestCell;
  }

  function moveItemToCell(itemId: string, targetCell: number) {
    const draggedItem = availableInventoryItems.find((item) => item.id === itemId);
    if (!draggedItem || getInventoryCategory(draggedItem) !== category) return false;

    const placementCell = findPlacementNearCell(draggedItem, targetCell, activeLayout, activeInventoryItems, totalCells);

    if (placementCell === null) {
      setActionFeedback("Сюда нельзя положить предмет: не хватает свободных ячеек.");
      return false;
    }

    setInventoryLayouts((currentLayouts) => {
      const nextCategoryLayout = { ...currentLayouts[category], [draggedItem.id]: placementCell };
      return { ...currentLayouts, [category]: nextCategoryLayout };
    });
    clearDropAnimation();
    setDroppedItemId(draggedItem.id);
    dropAnimationTimer.current = window.setTimeout(() => setDroppedItemId(null), 260);
    return true;
  }

  function moveItemToExactCell(itemId: string, targetCell: number) {
    const draggedItem = availableInventoryItems.find((item) => item.id === itemId);
    if (!draggedItem || getInventoryCategory(draggedItem) !== category) return false;

    if (!canPlaceItemAt(draggedItem, targetCell, activeLayout, activeInventoryItems, totalCells)) {
      setActionFeedback("Сюда нельзя положить предмет: не хватает свободных ячеек.");
      return false;
    }

    setInventoryLayouts((currentLayouts) => {
      const nextCategoryLayout = { ...currentLayouts[category], [draggedItem.id]: targetCell };
      return { ...currentLayouts, [category]: nextCategoryLayout };
    });
    clearDropAnimation();
    setDroppedItemId(draggedItem.id);
    dropAnimationTimer.current = window.setTimeout(() => setDroppedItemId(null), 260);
    return true;
  }

  function moveDraggedItemToCell(targetCell: number) {
    if (!draggedItemId) return;
    moveItemToCell(draggedItemId, targetCell);
    setDraggedItemId(null);
    setDragTargetCell(null);
    setDragPreview(null);
    setActionMenu(null);
  }

  function getDragCenterPoint(clientX: number, clientY: number, pointerDrag: NonNullable<typeof pointerDragRef.current>) {
    return {
      x: clientX - pointerDrag.offsetX + pointerDrag.width / 2,
      y: clientY - pointerDrag.offsetY + pointerDrag.height / 2
    };
  }

  function getPreviewStartCell(item: InventoryItem, preview: DragPreviewState) {
    const singleCellWidth = preview.width / item.footprint.width;
    const singleCellHeight = preview.height / item.footprint.height;

    return getGridCellFromPoint(
      preview.left + singleCellWidth / 2,
      preview.top + singleCellHeight / 2
    );
  }

  function beginPointerDrag(itemId: string, pointerId: number) {
    clearLongPress();
    const pointerDrag = pointerDragRef.current;
    pointerDragRef.current = pointerDrag ? { ...pointerDrag, active: true } : null;
    setDraggedItemId(itemId);
    if (pointerDrag) {
      setDragPreview({
        itemId,
        left: pointerDrag.startX - pointerDrag.offsetX,
        top: pointerDrag.startY - pointerDrag.offsetY,
        width: pointerDrag.width,
        height: pointerDrag.height
      });
    }
    setSelectedItemId(null);
    setHoveredItemId(null);
    setActionMenu(null);
    setDragTargetCell(null);
  }

  function finishPointerDrag(clientX: number, clientY: number) {
    const pointerDrag = pointerDragRef.current;
    pointerDragRef.current = null;

    if (!pointerDrag?.active) {
      setDraggedItemId(null);
      setDragTargetCell(null);
      setDragPreview(null);
      return;
    }

    const draggedItem = availableInventoryItems.find((item) => item.id === pointerDrag.itemId) ?? null;
    const nextPreview = {
      itemId: pointerDrag.itemId,
      left: clientX - pointerDrag.offsetX,
      top: clientY - pointerDrag.offsetY,
      width: pointerDrag.width,
      height: pointerDrag.height
    };
    const dragCenter = getDragCenterPoint(clientX, clientY, pointerDrag);
    const targetCell = draggedItem ? getPreviewStartCell(draggedItem, nextPreview) : getGridCellFromPoint(dragCenter.x, dragCenter.y);
    if (targetCell !== null) {
      if (draggedItem) {
        moveItemToExactCell(pointerDrag.itemId, targetCell);
      } else {
        moveItemToCell(pointerDrag.itemId, targetCell);
      }
    }
    suppressNextClick.current = true;
    setDraggedItemId(null);
    setDragTargetCell(null);
    setDragPreview(null);
  }

  function equipItem(item: InventoryItem) {
    setActionMenu(null);

    const requirements = validateInventoryItemRequirements(item, characterStats, characterLevel);
    if (!requirements.ok) {
      setActionFeedback(requirements.message);
      return;
    }

    const targetSlot = getInventoryItemPreferredSlot(item, equippedSlots);
    if (!targetSlot) {
      setActionFeedback(`${item.name}: нет подходящего слота для экипировки.`);
      return;
    }

    const replacedItemId = onEquipInventoryItem(item.id, targetSlot);
    const replacedItem = replacedItemId ? inventoryItems.find((candidate) => candidate.id === replacedItemId) : null;
    setSelectedItemId(null);
    setHoveredItemId(null);
    setActionFeedback(replacedItem ? `${item.name}: надето. ${replacedItem.name} возвращено в сумку.` : `${item.name}: надето. Пока предмет надет, он не занимает место в сумке.`);
  }

  function unequipItem(item: InventoryItem) {
    onUnequipInventoryItem(item.id);
    setActionMenu(null);
    setActionFeedback(`${item.name}: снято и возвращено в сумку.`);
  }

  function deleteItem(itemId: string) {
    onUnequipInventoryItem(itemId);
    setInventoryItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
    setInventoryLayouts((currentLayouts) => ({
      equipment: Object.fromEntries(Object.entries(currentLayouts.equipment).filter(([id]) => id !== itemId)),
      supplies: Object.fromEntries(Object.entries(currentLayouts.supplies).filter(([id]) => id !== itemId))
    }));
    setSelectedItemId((currentId) => currentId === itemId ? null : currentId);
    setHoveredItemId((currentId) => currentId === itemId ? null : currentId);
    setActionMenu(null);
    setConfirmDeleteId(null);
    setActionFeedback("Предмет удалён из сумки.");
  }

  return (
    <section className={styles.page} aria-label="Сумка персонажа">
      <div className={styles.content} data-no-pager-drag="true">
        <nav className={styles.inventoryTabs} aria-label="Разделы инвентаря">
          <button type="button" onClick={onOpenFittingRoom}>Примерочная</button>
          <button aria-current="page" className={styles.activeInventoryTab} type="button">Сумка</button>
        </nav>
        <div className={styles.titleRow}>
          <div>
            <p className={styles.eyebrow}>Инвентарь</p>
            <h1>Сумка</h1>
          </div>
          <form className={styles.search} role="search" onSubmit={(event) => event.preventDefault()}>
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Поиск предмета в инвентаре"
              autoComplete="off"
              placeholder="Поиск"
              type="search"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSelectedItemId(null);
              }}
            />
            {searchQuery && (
              <button aria-label="Очистить поиск" type="button" onClick={() => setSearchQuery("")}>×</button>
            )}
          </form>
          <p className={styles.capacity}><strong>{occupiedCells}</strong> / {totalCells}</p>
        </div>
        {actionFeedback && (
          <p className={styles.actionFeedback} data-warning={/нуж(ен|но)|требован/i.test(actionFeedback) ? "true" : undefined} role="status">
            {actionFeedback}
            <button aria-label="Закрыть сообщение" type="button" onClick={() => setActionFeedback(null)}>×</button>
          </p>
        )}

        <nav className={styles.categoryTabs} aria-label="Инвентари сумки">
          {categories.map((nextCategory) => (
            <button
              aria-pressed={category === nextCategory.id}
              className={category === nextCategory.id ? styles.activeCategory : ""}
              key={nextCategory.id}
              type="button"
              onClick={() => selectCategory(nextCategory.id)}
            >
              {nextCategory.label}
            </button>
          ))}
        </nav>

        {category === "equipment" && (
          <nav className={styles.equipmentFilters} aria-label="Сортировка снаряжения">
            <span>Снаряжение</span>
            <div>
              {equipmentFilters.map((filter) => (
                <button
                  aria-pressed={equipmentFilter === filter.id}
                  className={equipmentFilter === filter.id ? styles.activeEquipmentFilter : ""}
                  key={filter.id}
                  type="button"
                  onClick={() => selectEquipmentType(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        <div
          ref={gridRef}
          className={styles.itemGrid}
          style={{
            gridTemplateRows: `repeat(${rowCount}, var(--slot-size))`
          }}
          aria-label="Предметы в сумке"
          onDragOver={(event) => {
            if (!draggedItemId) return;
            const targetCell = getGridCellFromPoint(event.clientX, event.clientY);
            setDragTargetCell(targetCell);
            if (targetCell !== null) event.preventDefault();
          }}
          onDrop={(event) => {
            if (!draggedItemId) return;
            const targetCell = getGridCellFromPoint(event.clientX, event.clientY);
            if (targetCell === null) return;
            event.preventDefault();
            moveDraggedItemToCell(targetCell);
          }}
        >
          {Array.from({ length: totalCells }, (_, cellIndex) => {
            const ownerId = occupiedCellOwners.get(cellIndex);
            const canDropFromHere = Boolean(draggedInventoryItem && findPlacementNearCell(draggedInventoryItem, cellIndex, activeLayout, activeInventoryItems, totalCells) !== null);
            const isActiveDropTarget = activeDropCells.has(cellIndex);

            return (
              <span
                className={`${styles.emptySlot} ${ownerId ? styles.occupiedCell : ""} ${isActiveDropTarget ? styles.dropTarget : ""}`}
                data-cell={cellIndex + 1}
                data-active-drop-target={isActiveDropTarget ? "true" : undefined}
                data-drop-footprint={isActiveDropTarget ? "true" : undefined}
                key={`cell-${cellIndex}`}
                aria-hidden="true"
                style={{
                  gridColumnStart: cellIndex % gridColumns + 1,
                  gridRowStart: Math.floor(cellIndex / gridColumns) + 1
                }}
                onDragOver={(event) => {
                  setDragTargetCell(cellIndex);
                  if (canDropFromHere) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  moveDraggedItemToCell(cellIndex);
                }}
              />
            );
          })}
          {visibleItems.length === 0 && (
            <p className={styles.emptySearch}>Ничего не найдено. Попробуйте другое название или описание.</p>
          )}
          {visibleItems.map((item) => {
            const startCell = activeLayout[item.id];
            if (startCell === undefined) return null;
            const hasUnmetRequirements = (unmetRequirementsByItemId.get(item.id)?.length ?? 0) > 0;

            return (
              <button
                aria-expanded={selectedItem?.id === item.id}
                aria-pressed={selectedItem?.id === item.id}
                className={styles.itemSlot}
                draggable={false}
                data-dragging={draggedItemId === item.id ? "true" : undefined}
                data-dropped={droppedItemId === item.id ? "true" : undefined}
                data-item-description-trigger="true"
                data-unmet-requirements={hasUnmetRequirements ? "true" : undefined}
                data-rarity={item.rarity}
                key={item.id}
                style={{
                  gridColumn: `${startCell % gridColumns + 1} / span ${item.footprint.width}`,
                  gridRow: `${Math.floor(startCell / gridColumns) + 1} / span ${item.footprint.height}`
                }}
                type="button"
                onClick={(event) => {
                  if (suppressNextClick.current) {
                    suppressNextClick.current = false;
                    return;
                  }
                  announceItemDescriptionOpen(descriptionOwnerId.current);
                  setActionMenu(null);
                  setSelectedItemId((current) => current === item.id ? null : item.id);
                  setSelectedItemAnchor(event.currentTarget.getBoundingClientRect());
                }}
                onDragEnd={() => {
                  setDraggedItemId(null);
                  setDragTargetCell(null);
                }}
                onDragStart={(event) => {
                  clearLongPress();
                  setDraggedItemId(item.id);
                  setDragTargetCell(null);
                  setSelectedItemId(null);
                  setActionMenu(null);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", item.id);
                }}
                onPointerCancel={() => {
                  clearLongPress();
                  pointerDragRef.current = null;
                  setDraggedItemId(null);
                  setDragTargetCell(null);
                  setDragPreview(null);
                }}
                onPointerDown={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  pointerDragRef.current = {
                    itemId: item.id,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    offsetX: event.clientX - rect.left,
                    offsetY: event.clientY - rect.top,
                    width: rect.width,
                    height: rect.height,
                    active: false
                  };
                  startLongPress(item.id, event.currentTarget.getBoundingClientRect());
                }}
                onPointerEnter={(event) => {
                  if (!selectedItemId) {
                    setHoveredItemId(item.id);
                    setHoveredItemAnchor(event.currentTarget.getBoundingClientRect());
                  }
                }}
                onPointerLeave={() => {
                  clearLongPress();
                  if (!selectedItemId) setHoveredItemId(null);
                }}
                onPointerMove={(event) => {
                  const pointerDrag = pointerDragRef.current;
                  if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

                  const distance = Math.abs(event.clientX - pointerDrag.startX) + Math.abs(event.clientY - pointerDrag.startY);
                  if (distance > pointerDragStartDistance) {
                    clearLongPress();
                  }
                  if (!pointerDrag.active && distance > pointerDragStartDistance) {
                    beginPointerDrag(item.id, event.pointerId);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }

                  if (pointerDragRef.current?.active) {
                    event.preventDefault();
                    const activeDrag = pointerDragRef.current;
                    const dragCenter = getDragCenterPoint(event.clientX, event.clientY, activeDrag);
                    setDragPreview({
                      itemId: activeDrag.itemId,
                      left: event.clientX - activeDrag.offsetX,
                      top: event.clientY - activeDrag.offsetY,
                      width: activeDrag.width,
                      height: activeDrag.height
                    });
                    setDragTargetCell(getGridCellFromPoint(dragCenter.x, dragCenter.y));
                  }
                }}
                onPointerUp={(event) => {
                  clearLongPress();
                  if (pointerDragRef.current?.pointerId === event.pointerId) {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    finishPointerDrag(event.clientX, event.clientY);
                  }
                }}
              >
                <span className={styles.itemIcon} aria-hidden="true">{item.icon}</span>
                {item.amount && item.amount > 1 && <span className={styles.itemAmount} aria-label={`Количество: ${item.amount}`}>×{item.amount}</span>}
              </button>
            );
          })}
        </div>
        {dragPreview && (() => {
          const previewItem = availableInventoryItems.find((item) => item.id === dragPreview.itemId);
          if (!previewItem) return null;

          return (
            <div
              className={styles.dragPreview}
              data-rarity={previewItem.rarity}
              style={{
                left: dragPreview.left,
                top: dragPreview.top,
                width: dragPreview.width,
                height: dragPreview.height
              }}
              aria-hidden="true"
            >
              <span className={styles.itemIcon}>{previewItem.icon}</span>
            </div>
          );
        })()}

        <section className={styles.quickSlots} aria-label="Быстрые слоты">
          <p>Быстрые слоты</p>
          <div>
            <button type="button"><span>1</span> Эликсир лечения</button>
            <button type="button"><span>2</span> Масло тени</button>
            <button type="button"><span>3</span> Пусто</button>
          </div>
        </section>
      </div>
      {selectedItem && (
        <ItemDescriptionDialog
          item={{
            name: selectedItem.name,
            icon: selectedItem.icon,
            slot: selectedItem.slot,
            description: selectedItem.description,
            requirements: selectedItem.requirements,
            unmetRequirements: selectedItemUnmetRequirements,
            properties: [...selectedItem.bonuses, selectedItem.footprint.label],
            armor: selectedItem.protection,
            damageReduction: selectedItem.damageReduction
          }}
          onClose={() => setSelectedItemId(null)}
          previewAnchor={selectedItemId ? selectedItemAnchor : hoveredItemAnchor}
        />
      )}
      {menuItem && actionMenu && (
        <div
          className={styles.itemActionMenu}
          style={{ left: actionMenu.left, top: actionMenu.top }}
          role="menu"
          aria-label={`Действия: ${menuItem.name}`}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => equipItem(menuItem)}>
            <span aria-hidden="true">↟</span>
            Одеть
          </button>
          <button
            className={styles.unequipAction}
            disabled={!equippedItemIds.has(menuItem.id)}
            type="button"
            role="menuitem"
            onClick={() => unequipItem(menuItem)}
          >
            <span aria-hidden="true">↡</span>
            Снять
          </button>
          <button
            className={styles.deleteAction}
            type="button"
            role="menuitem"
            onClick={() => {
              setConfirmDeleteId(menuItem.id);
              setActionMenu(null);
            }}
          >
            <span aria-hidden="true">✕</span>
            Удалить
          </button>
        </div>
      )}
      {confirmDeleteItem && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true" aria-label="Подтверждение удаления">
          <div className={styles.confirmDialog}>
            <p>Удалить предмет?</p>
            <h2>{confirmDeleteItem.name}</h2>
            <div>
              <button className={styles.confirmDelete} type="button" onClick={() => deleteItem(confirmDeleteItem.id)}>Удалить</button>
              <button type="button" onClick={() => setConfirmDeleteId(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
