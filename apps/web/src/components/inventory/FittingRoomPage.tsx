import { useEffect, useMemo, useRef, useState } from "react";
import { getEquippedGear, getEquippedGearBySlot } from "../gear/equippedGear";
import { getCharacterProgression, saveCharacterStats } from "../../lib/api";
import { inventoryItemsById, type InventoryEquippedSlot, type InventoryStatId } from "./InventoryBagPage";
import { ItemDescriptionDialog, type ItemDescriptionData } from "./ItemDescriptionDialog";
import { announceItemDescriptionOpen, subscribeItemDescriptionOpen } from "./itemDescriptionEvents";
import styles from "./FittingRoomPage.module.css";

type StatId = InventoryStatId;
type EquippedGearViewItem = { slot: InventoryEquippedSlot; label: string; icon: string; inventoryItemId: string };

type Loadout = {
  id: string;
  name: string;
  subtitle: string;
  damage: string;
  armor: readonly [string, string, string, string];
  modifierBonus: { dodge: number; antiDodge: number; crit: number; antiCrit: number; magic: number; magicDefense: number; regeneration: number; counterAttack: number };
  gear: ReadonlyArray<{ slot: string; label: string; icon: string; inventoryItemId?: string }>;
};

const baseStats: ReadonlyArray<{ id: StatId; label: string; value: number }> = [
  { id: "strength", label: "Сила", value: 18 },
  { id: "agility", label: "Ловкость", value: 24 },
  { id: "vitality", label: "Выносливость", value: 20 },
  { id: "intuition", label: "Интуиция", value: 16 },
  { id: "intelligence", label: "Интеллект", value: 12 },
  { id: "wisdom", label: "Мудрость", value: 11 }
];

const inventoryItemIdBySlot: Record<string, string> = {
  "earring-left": "silver-earring",
  "earring-right": "duelist-ring",
  amulet: "amber-amulet",
  weapon: "night-blade",
  armor: "night-coat",
  pants: "guard-pants",
  helmet: "scout-hood",
  bracers: "iron-bracers",
  gloves: "shadow-gloves",
  belt: "guard-belt",
  shield: "arena-shield",
  boots: "runners-boots"
};

function attachInventoryItemId<T extends { slot: string }>(item: T): T & { inventoryItemId?: string } {
  return { ...item, inventoryItemId: inventoryItemIdBySlot[item.slot] };
}

const loadouts: readonly Loadout[] = [
  {
    id: "night-watch",
    name: "Ночной дозор",
    subtitle: "Основной комплект",
    damage: "12–18",
    armor: ["4–7", "12–18", "3–5", "5–8"],
    modifierBonus: { dodge: 2.4, antiDodge: 1.8, crit: 2.1, antiCrit: 2.4, magic: 0.8, magicDefense: 2.2, regeneration: 1.2, counterAttack: 2.4 },
    gear: getEquippedGear("player").map((item) => attachInventoryItemId({ slot: item.slot, label: item.name, icon: item.icon }))
  },
  {
    id: "shadow-hunter",
    name: "Теневой охотник",
    subtitle: "Уворот и крит",
    damage: "10–16",
    armor: ["2–4", "7–11", "2–3", "3–6"],
    modifierBonus: { dodge: 7.2, antiDodge: 0.5, crit: 5.8, antiCrit: 0.8, magic: 1.6, magicDefense: 0.7, regeneration: 0.4, counterAttack: 4.1 },
    gear: [
      { slot: "weapon", label: "Парные кинжалы", icon: "†" },
      { slot: "helmet", label: "Маска охотника", icon: "◉" },
      { slot: "armor", label: "Куртка тени", icon: "◒" },
      { slot: "gloves", label: "Кожаные перчатки", icon: "✦" },
      { slot: "belt", label: "Пояс зельев", icon: "═" },
      { slot: "boots", label: "Мягкие сапоги", icon: "⌁" },
      { slot: "shield", label: "Талисман", icon: "◇" }
    ].map(attachInventoryItemId)
  },
  {
    id: "arena",
    name: "Арена",
    subtitle: "Броня и стойкость",
    damage: "14–20",
    armor: ["7–11", "18–25", "5–8", "8–12"],
    modifierBonus: { dodge: -1.2, antiDodge: 3.4, crit: 0.9, antiCrit: 5.2, magic: 0.3, magicDefense: 4.8, regeneration: 2.8, counterAttack: 1.1 },
    gear: [
      { slot: "weapon", label: "Боевой меч", icon: "⚔" },
      { slot: "helmet", label: "Шлем арены", icon: "◓" },
      { slot: "armor", label: "Латы", icon: "▣" },
      { slot: "gloves", label: "Латные перчатки", icon: "✧" },
      { slot: "belt", label: "Пояс бойца", icon: "═" },
      { slot: "boots", label: "Сапоги арены", icon: "⌁" },
      { slot: "shield", label: "Круглый щит", icon: "◉" }
    ].map(attachInventoryItemId)
  }
];

const armorZones = ["Голова", "Корпус", "Пояс", "Ноги"] as const;
const savedLoadoutsStorageKey = "nightclub:fitting-room-loadouts";
const playerEquippedGearBySlot = getEquippedGearBySlot("player");
const leftFittingSlots = ["earring-left", "earring-right", "amulet", "weapon", "armor", "pants"] as const;
const rightFittingSlots = ["helmet", "bracers", "gloves", "quick-one", "quick-two", "quick-three", "belt", "shield", "boots"] as const;
type FittingSlot = (typeof leftFittingSlots)[number] | (typeof rightFittingSlots)[number];
const fittingSlotLabels: Record<FittingSlot, string> = {
  "earring-left": "Серьга",
  "earring-right": "Серьга",
  amulet: "Амулет",
  weapon: "Оружие",
  armor: "Броня",
  pants: "Штаны",
  helmet: "Шлем",
  bracers: "Наручи",
  gloves: "Перчатки",
  "quick-one": "Быстрый 1",
  "quick-two": "Быстрый 2",
  "quick-three": "Быстрый 3",
  belt: "Пояс",
  shield: "Щит",
  boots: "Обувь"
};
const fittingSlotInventoryItemIds = inventoryItemIdBySlot as Partial<Record<FittingSlot, string>>;
const gearSlotDetails: Partial<Record<FittingSlot, { description: string; requirements: string; bonuses: string; protection?: string }>> = {
  weapon: { description: "Основное оружие комплекта. Его урон учитывается в боевых показателях.", requirements: "Сила и ловкость", bonuses: "Урон, критический удар" },
  helmet: { description: "Защищает голову и добавляет свойства выбранного комплекта.", requirements: "Уровень персонажа", bonuses: "Интуиция, уворот", protection: "Голова" },
  armor: { description: "Основной защитный предмет комплекта.", requirements: "Выносливость", bonuses: "Сопротивление, защита от магии", protection: "Корпус" },
  gloves: { description: "Усиливают точность и контроль оружия.", requirements: "Ловкость", bonuses: "Крит, точность" },
  belt: { description: "Пояс для расходников и дополнительной защиты.", requirements: "Выносливость", bonuses: "Здоровье, слоты", protection: "Пояс" },
  shield: { description: "Защитный предмет второй руки.", requirements: "Сила", bonuses: "Антикрит, сопротивление" },
  boots: { description: "Обувь для движения и устойчивости.", requirements: "Ловкость", bonuses: "Инициатива, уворот", protection: "Ноги" }
};

const bonusStatLabels: Record<string, StatId> = {
  "Сила": "strength",
  "Ловкость": "agility",
  "Выносливость": "vitality",
  "Интуиция": "intuition",
  "Интеллект": "intelligence",
  "Мудрость": "wisdom"
};

function isInventoryEquippedSlot(slot: FittingSlot): slot is InventoryEquippedSlot {
  return slot !== "quick-one" && slot !== "quick-two" && slot !== "quick-three";
}

function collectEquippedBonuses(equippedItemIds: ReadonlySet<string>) {
  const stats: Record<StatId, number> = { strength: 0, agility: 0, vitality: 0, intuition: 0, intelligence: 0, wisdom: 0 };
  const modifiers = { dodge: 0, crit: 0, magicDefense: 0, regeneration: 0, counterAttack: 0 };

  for (const itemId of equippedItemIds) {
    const item = inventoryItemsById.get(itemId);
    if (!item) continue;

    for (const bonus of item.bonuses) {
      const match = bonus.match(/^([^:]+):\s*([+-]?\d+(?:[.,]\d+)?)/);
      if (!match) continue;

      const label = match[1].trim();
      const value = Number(match[2].replace(",", "."));
      if (!Number.isFinite(value)) continue;

      const statId = bonusStatLabels[label];
      if (statId) {
        stats[statId] += value;
        continue;
      }

      if (label.includes("Уворот") || label.includes("Уклонение")) modifiers.dodge += value;
      if (label.includes("Крит")) modifiers.crit += value;
      if (label.includes("Сопротивление магии") || label.includes("Защита от магии")) modifiers.magicDefense += value;
      if (label.includes("Регенерация")) modifiers.regeneration += value;
      if (label.includes("Контрудар") || label.includes("Шанс контрудара")) modifiers.counterAttack += value;
    }
  }

  return { stats, modifiers };
}

function normalizeLoadout(loadout: Loadout): Loadout {
  return { ...loadout, gear: loadout.gear.map(attachInventoryItemId) };
}

export function FittingRoomPage({
  equippedGear,
  equippedItemIds,
  token,
  onOpenBag,
  onCharacterProfileChanged,
  onUnequipInventoryItem,
  onUnequipInventorySlot
}: {
  equippedGear: ReadonlyArray<EquippedGearViewItem>;
  equippedItemIds: ReadonlySet<string>;
  token: string;
  onOpenBag: () => void;
  onCharacterProfileChanged?: () => void | Promise<void>;
  onUnequipInventoryItem: (itemId: string) => void;
  onUnequipInventorySlot: (slot: InventoryEquippedSlot) => void;
}) {
  const descriptionOwnerId = useRef(`fitting-room-${Math.random().toString(36).slice(2)}`);
  const [equippedLoadout, setEquippedLoadout] = useState(loadouts[0]);
  const [savedLoadouts, setSavedLoadouts] = useState<Array<Loadout | null>>(() => {
    try {
      const saved = window.localStorage.getItem(savedLoadoutsStorageKey);
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length === 3 ? parsed.map((loadout) => loadout ? normalizeLoadout(loadout) : null) : [...loadouts];
    } catch {
      return [...loadouts];
    }
  });
  const [openLoadoutMenu, setOpenLoadoutMenu] = useState<number | null>(null);
  const [clearConfirmation, setClearConfirmation] = useState<number | null>(null);
  const loadoutHoldTimerRef = useRef<number | null>(null);
  const suppressLoadoutTapRef = useRef(false);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState<number | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [storedStats, setStoredStats] = useState<Record<StatId, number>>(() => Object.fromEntries(baseStats.map((stat) => [stat.id, stat.value])) as Record<StatId, number>);
  const [upgrades, setUpgrades] = useState<Record<StatId, number>>({ strength: 0, agility: 0, vitality: 0, intuition: 0, intelligence: 0, wisdom: 0 });
  const [savingStats, setSavingStats] = useState(false);
  const [statsStatus, setStatsStatus] = useState("");
  const [selectedGearSlot, setSelectedGearSlot] = useState<FittingSlot | null>(null);
  const [selectedGearAnchor, setSelectedGearAnchor] = useState<DOMRect | null>(null);
  const [hoveredGearSlot, setHoveredGearSlot] = useState<FittingSlot | null>(null);
  const [hoveredGearAnchor, setHoveredGearAnchor] = useState<DOMRect | null>(null);
  const [gearActionMenu, setGearActionMenu] = useState<{ slot: FittingSlot; left: number; top: number } | null>(null);
  const gearHoldTimerRef = useRef<number | null>(null);
  const suppressGearTapRef = useRef(false);
  const equippedBonuses = useMemo(() => collectEquippedBonuses(equippedItemIds), [equippedItemIds]);
  const totalStats = useMemo(
    () => Object.fromEntries(baseStats.map((stat) => [stat.id, storedStats[stat.id] + upgrades[stat.id] + equippedBonuses.stats[stat.id]])) as Record<StatId, number>,
    [equippedBonuses, storedStats, upgrades]
  );
  const modifiers = useMemo(() => [
    ["Уворот", `${(15.4 + totalStats.agility * 0.13 + equippedLoadout.modifierBonus.dodge + equippedBonuses.modifiers.dodge).toFixed(1)}%`],
    ["Антиуворот", `${(18.2 + totalStats.intuition * 0.08 + equippedLoadout.modifierBonus.antiDodge).toFixed(1)}%`],
    ["Крит", `${(9.4 + totalStats.agility * 0.15 + equippedLoadout.modifierBonus.crit + equippedBonuses.modifiers.crit).toFixed(1)}%`],
    ["Антикрит", `${(14.1 + totalStats.vitality * 0.11 + equippedLoadout.modifierBonus.antiCrit).toFixed(1)}%`],
    ["Магия", `${(4.2 + totalStats.intelligence * 0.12 + equippedLoadout.modifierBonus.magic).toFixed(1)}%`],
    ["Защита от магии", `${(11 + totalStats.wisdom * 0.14 + equippedLoadout.modifierBonus.magicDefense + equippedBonuses.modifiers.magicDefense).toFixed(1)}%`],
    ["Регенерация", `${(1 + totalStats.vitality * 0.08 + equippedLoadout.modifierBonus.regeneration + equippedBonuses.modifiers.regeneration).toFixed(1)} HP/мин`],
    ["Шанс контрудара", `${(totalStats.agility * 0.18 + equippedLoadout.modifierBonus.counterAttack + equippedBonuses.modifiers.counterAttack).toFixed(1)}%`]
  ], [equippedBonuses, equippedLoadout, totalStats]);

  const pendingPoints = Object.values(upgrades).reduce((sum, value) => sum + value, 0);
  const gearBySlot = useMemo(() => new Map<string, EquippedGearViewItem>(equippedGear.map((item) => [item.slot, item])), [equippedGear]);
  const activeGearSlot = selectedGearSlot ?? hoveredGearSlot;
  const selectedGear = activeGearSlot ? gearBySlot.get(activeGearSlot) ?? null : null;
  const gearMenuItem = gearActionMenu ? gearBySlot.get(gearActionMenu.slot) ?? null : null;

  useEffect(() => {
    window.localStorage.setItem(savedLoadoutsStorageKey, JSON.stringify(savedLoadouts));
  }, [savedLoadouts]);

  function renderFittingSlot(slot: FittingSlot) {
    const item = gearBySlot.get(slot);
    return (
      <button aria-label={item ? `Описание предмета: ${item.label}` : `${fittingSlotLabels[slot]}: пусто`} className={styles.gearSlot} data-item-description-trigger={item ? "true" : undefined} data-slot={slot} disabled={!item} key={slot} type="button" onClick={(event) => { if (!item) return; if (suppressGearTapRef.current) { suppressGearTapRef.current = false; return; } announceItemDescriptionOpen(descriptionOwnerId.current); setGearActionMenu(null); setSelectedGearSlot((current) => current === slot ? null : slot); setSelectedGearAnchor(event.currentTarget.getBoundingClientRect()); }} onPointerCancel={stopGearHold} onPointerDown={(event) => { if (item) startGearHold(slot, event.currentTarget.getBoundingClientRect()); }} onPointerEnter={(event) => { if (item && !selectedGearSlot) { setHoveredGearSlot(slot); setHoveredGearAnchor(event.currentTarget.getBoundingClientRect()); } }} onPointerLeave={() => { stopGearHold(); if (!selectedGearSlot) setHoveredGearSlot(null); }} onPointerUp={stopGearHold}>
        <span aria-hidden="true">{item?.icon ?? "+"}</span>
      </button>
    );
  }

  useEffect(() => subscribeItemDescriptionOpen(descriptionOwnerId.current, () => {
    setSelectedGearSlot(null);
    setSelectedGearAnchor(null);
    setHoveredGearSlot(null);
    setHoveredGearAnchor(null);
  }), []);

  useEffect(() => {
    setSelectedGearSlot(null);
    setGearActionMenu(null);
  }, [equippedLoadout]);

  useEffect(() => () => {
    stopLoadoutHold();
    stopGearHold();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatsStatus("");
    setStatsLoaded(false);
    void getCharacterProgression(token)
      .then((result) => {
        if (cancelled) return;
        setStoredStats(result.stats);
        setLevel(result.progression.level);
        setPoints(result.progression.availableStatPoints);
        setUpgrades({ strength: 0, agility: 0, vitality: 0, intuition: 0, intelligence: 0, wisdom: 0 });
        setStatsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setStatsLoaded(true);
          setStatsStatus("Не удалось загрузить характеристики из базы.");
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  function changeStat(statId: StatId, direction: 1 | -1) {
    if (!statsLoaded || savingStats || (direction === 1 && points === 0)) return;
    if (direction === -1 && upgrades[statId] === 0) return;

    setUpgrades((current) => ({ ...current, [statId]: current[statId] + direction }));
    setPoints((current) => current - direction);
  }

  async function saveStats() {
    if (savingStats || pendingPoints === 0) return;
    setSavingStats(true);
    setStatsStatus("");
    try {
      const result = await saveCharacterStats(token, upgrades);
      setStoredStats(result.stats);
      setPoints(result.progression.availableStatPoints);
      setUpgrades({ strength: 0, agility: 0, vitality: 0, intelligence: 0, intuition: 0, wisdom: 0 });
      await Promise.resolve(onCharacterProfileChanged?.()).catch(() => undefined);
      setStatsStatus("Характеристики сохранены.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setStatsStatus(message === "Not enough available stat points" ? "Недостаточно свободных очков характеристик." : message || "Не удалось сохранить характеристики.");
    } finally {
      setSavingStats(false);
    }
  }

  function rememberLoadout(slotIndex: number) {
    setSavedLoadouts((current) => current.map((loadout, index) => index === slotIndex ? equippedLoadout : loadout));
    setOpenLoadoutMenu(null);
  }

  function wearLoadout(loadout: Loadout) {
    setEquippedLoadout({ ...loadout, gear: loadout.gear.map(attachInventoryItemId) });
    setClearConfirmation(null);
    setOpenLoadoutMenu(null);
  }

  function clearLoadout(slotIndex: number) {
    setSavedLoadouts((current) => current.map((loadout, index) => index === slotIndex ? null : loadout));
    setClearConfirmation(null);
    setOpenLoadoutMenu(null);
  }

  function stopLoadoutHold() {
    if (loadoutHoldTimerRef.current !== null) {
      window.clearTimeout(loadoutHoldTimerRef.current);
      loadoutHoldTimerRef.current = null;
    }
  }

  function startLoadoutHold(slotIndex: number) {
    stopLoadoutHold();
    loadoutHoldTimerRef.current = window.setTimeout(() => {
      suppressLoadoutTapRef.current = true;
      setClearConfirmation(null);
      setOpenLoadoutMenu(slotIndex);
      loadoutHoldTimerRef.current = null;
    }, 450);
  }

  function stopGearHold() {
    if (gearHoldTimerRef.current !== null) {
      window.clearTimeout(gearHoldTimerRef.current);
      gearHoldTimerRef.current = null;
    }
  }

  function startGearHold(slot: FittingSlot, rect: DOMRect) {
    stopGearHold();
    gearHoldTimerRef.current = window.setTimeout(() => {
      suppressGearTapRef.current = true;
      setSelectedGearSlot(null);
      setHoveredGearSlot(null);
      setGearActionMenu({
        slot,
        left: Math.min(rect.left + rect.width / 2, window.innerWidth - 116),
        top: Math.min(rect.top + rect.height / 2, window.innerHeight - 142)
      });
      gearHoldTimerRef.current = null;
    }, 560);
  }

  function unequipGearSlot(slot: FittingSlot) {
    const item = gearBySlot.get(slot);
    if (!item) return;
    const inventoryItemId = item.inventoryItemId ?? fittingSlotInventoryItemIds[slot];

    if (isInventoryEquippedSlot(slot)) onUnequipInventorySlot(slot);
    if (inventoryItemId) onUnequipInventoryItem(inventoryItemId);
    setGearActionMenu(null);
    setSelectedGearSlot(null);
    setStatsStatus(`${item.label}: снято и возвращено в сумку.`);
  }

  function deleteGearSlot(slot: FittingSlot) {
    const item = gearBySlot.get(slot);
    if (!item) return;

    if (isInventoryEquippedSlot(slot)) onUnequipInventorySlot(slot);
    setEquippedLoadout((current) => ({
      ...current,
      gear: current.gear.filter((gearItem) => gearItem.slot !== slot)
    }));
    setGearActionMenu(null);
    setSelectedGearSlot(null);
    setStatsStatus(`${item.label}: удалено из текущего комплекта.`);
  }

  return (
    <section className={styles.page} aria-label="Примерочная">
      <div className={styles.content} data-no-pager-drag="true">
        <nav className={styles.inventoryTabs} aria-label="Разделы инвентаря">
          <button aria-current="page" className={styles.activeInventoryTab} type="button">Примерочная</button>
          <button type="button" onClick={onOpenBag}>Сумка</button>
        </nav>

        <div className={styles.titleRow}>
          <div><p>Инвентарь</p><h1>Примерочная</h1></div>
          <span>ур. {level ?? "—"}</span>
        </div>

        <section className={styles.fittingGrid} aria-label="Экипировка и характеристики">
          <div className={styles.gearGrid}>
            <div className={styles.gearColumn} data-side="left">
              <div className={styles.earringRow}>{renderFittingSlot("earring-left")}{renderFittingSlot("earring-right")}</div>
              {renderFittingSlot("amulet")}
              {renderFittingSlot("weapon")}
              {renderFittingSlot("armor")}
              {renderFittingSlot("pants")}
            </div>
            <div className={styles.heroSilhouette}><img src="/assets/character-page/portrait.png" alt="Персонаж MrGreen" /></div>
            <div className={styles.gearColumn} data-side="right">
              {renderFittingSlot("helmet")}
              {renderFittingSlot("bracers")}
              {renderFittingSlot("gloves")}
              <div className={styles.quickSlotRow}>{renderFittingSlot("quick-one")}{renderFittingSlot("quick-two")}{renderFittingSlot("quick-three")}</div>
              {renderFittingSlot("belt")}
              {renderFittingSlot("shield")}
              {renderFittingSlot("boots")}
            </div>
          </div>

          <section className={styles.statsPanel} aria-label="Характеристики">
            <header><h2>Характеристики</h2><p className={styles.pointBadge}>{statsLoaded ? <>Очки <strong>{points}</strong></> : "Загрузка…"}</p></header>
            <div className={styles.statsList}>
              {baseStats.map((stat) => (
                <div key={stat.id}>
                  <span>{stat.label}</span><b>{totalStats[stat.id]}</b>
                  <button aria-label={`Уменьшить ${stat.label}`} disabled={upgrades[stat.id] === 0} type="button" onClick={() => changeStat(stat.id, -1)}>−</button>
                  <button aria-label={`Увеличить ${stat.label}`} disabled={!statsLoaded || savingStats || points === 0} type="button" onClick={() => changeStat(stat.id, 1)}>+</button>
                </div>
              ))}
            </div>
            <button className={styles.saveStats} disabled={!statsLoaded || savingStats || pendingPoints === 0} type="button" onClick={() => void saveStats()}>
              {savingStats ? "Сохранение…" : `Сохранить +${pendingPoints}`}
            </button>
            {statsStatus && <p className={styles.statsStatus} data-error={statsStatus.startsWith("Не ") || undefined}>{statsStatus}</p>}
            <div className={styles.loadouts} aria-label="Сохранённые комплекты">
              {savedLoadouts.map((loadout, index) => (
                <div className={styles.loadoutSlot} key={`saved-loadout-${index}`}>
                  <button
                    aria-expanded={openLoadoutMenu === index}
                    aria-label={`Меню комплекта ${index + 1}`}
                  className={loadout?.id === equippedLoadout.id ? styles.activeLoadout : ""}
                  type="button"
                  onClick={() => {
                    if (suppressLoadoutTapRef.current) {
                      suppressLoadoutTapRef.current = false;
                      return;
                    }
                    if (loadout) {
                      wearLoadout(loadout);
                    }
                  }}
                  onPointerCancel={stopLoadoutHold}
                  onPointerDown={() => startLoadoutHold(index)}
                  onPointerLeave={stopLoadoutHold}
                  onPointerUp={stopLoadoutHold}
                >
                    <span>{index + 1}</span><strong>{loadout?.name ?? "Пусто"}</strong>
                  </button>
                  {openLoadoutMenu === index && (
                    <div className={styles.loadoutMenu} aria-label={`Действия с комплектом ${index + 1}`}>
                      <button aria-label="Запомнить набор" title="Запомнить набор" type="button" onClick={() => rememberLoadout(index)}>▣</button>
                      <button aria-label="Очистить ячейку" disabled={!loadout} title="Очистить ячейку" type="button" onClick={() => setClearConfirmation(index)}>⌫</button>
                      {clearConfirmation === index && (
                        <div className={styles.clearConfirmation}>
                          <span>Очистить?</span>
                          <button aria-label="Подтвердить очистку" type="button" onClick={() => clearLoadout(index)}>✓</button>
                          <button aria-label="Отменить очистку" type="button" onClick={() => setClearConfirmation(null)}>×</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </section>

        {gearMenuItem && gearActionMenu && (
          <div
            className={styles.gearActionMenu}
            style={{ left: gearActionMenu.left, top: gearActionMenu.top }}
            role="menu"
            aria-label={`Действия: ${gearMenuItem.label}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setGearActionMenu(null);
                setStatsStatus(`${gearMenuItem.label}: уже надето.`);
              }}
            >
              <span aria-hidden="true">↟</span>
              Одеть
            </button>
            <button type="button" role="menuitem" onClick={() => unequipGearSlot(gearActionMenu.slot)}>
              <span aria-hidden="true">↡</span>
              Снять
            </button>
            <button className={styles.deleteAction} type="button" role="menuitem" onClick={() => deleteGearSlot(gearActionMenu.slot)}>
              <span aria-hidden="true">✕</span>
              Удалить
            </button>
          </div>
        )}

        {selectedGear && activeGearSlot && <ItemDescriptionDialog item={toItemDescription(selectedGear, activeGearSlot)} onClose={() => setSelectedGearSlot(null)} previewAnchor={selectedGearSlot ? selectedGearAnchor : hoveredGearAnchor} />}

        <section className={styles.combatStats} aria-label="Боевые показатели">
          <div><h2>Урон</h2><strong>{equippedLoadout.damage}</strong></div>
          <div><h2>Броня по зонам</h2>{armorZones.map((zone, index) => <p key={zone}><span>{zone}</span><b>{equippedLoadout.armor[index]}</b></p>)}</div>
        </section>

        <section className={styles.modifiers} aria-label="Полные модификаторы персонажа">
          <h2>Модификаторы</h2>
          <div>{modifiers.map(([label, value]) => <p key={label}><span>{label}</span><strong>{value}</strong></p>)}</div>
        </section>
      </div>
    </section>
  );
}

function toItemDescription(item: { label: string; icon: string; inventoryItemId?: string }, slot: FittingSlot): ItemDescriptionData {
  const inventoryItem = item.inventoryItemId ? inventoryItemsById.get(item.inventoryItemId) : null;
  if (inventoryItem) {
    return {
      name: inventoryItem.name,
      icon: inventoryItem.icon,
      slot: fittingSlotLabels[slot],
      rarity: inventoryItem.rarity,
      description: inventoryItem.description,
      requirements: inventoryItem.requirements,
      properties: inventoryItem.bonuses,
      armor: inventoryItem.protection,
      damageReduction: inventoryItem.damageReduction
    };
  }

  const sharedItem = playerEquippedGearBySlot.get(slot);
  if (sharedItem) {
    return {
      name: sharedItem.name,
      icon: sharedItem.icon,
      slot: fittingSlotLabels[slot],
      rarity: sharedItem.rarity,
      description: sharedItem.description,
      requirements: sharedItem.requirements,
      properties: sharedItem.properties,
      armor: sharedItem.armor,
      damageReduction: sharedItem.damageReduction
    };
  }

  const details = gearSlotDetails[slot] ?? {
    description: "Предмет экипировки из выбранного комплекта.",
    requirements: "Нет дополнительных требований",
    bonuses: "Свойства комплекта"
  };
  return {
    name: item.label,
    icon: item.icon,
    slot: fittingSlotLabels[slot],
    description: details.description,
    requirements: [details.requirements],
    properties: [details.bonuses],
    armor: details.protection
  };
}
