import { useEffect, useRef, useState } from "react";
import { ItemDescriptionDialog, type ItemDescriptionData } from "../inventory/ItemDescriptionDialog";
import { announceItemDescriptionOpen, subscribeItemDescriptionOpen } from "../inventory/itemDescriptionEvents";
import type { EquipmentSlot } from "./types";
import styles from "./CharacterPage.module.css";

export function EquipmentPanel({ slots, side }: { slots: readonly EquipmentSlot[]; side: EquipmentSlot["side"] }) {
  const descriptionOwnerId = useRef(`equipment-panel-${side}-${Math.random().toString(36).slice(2)}`);
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);
  const [selectedAnchor, setSelectedAnchor] = useState<DOMRect | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<EquipmentSlot | null>(null);
  const [hoveredAnchor, setHoveredAnchor] = useState<DOMRect | null>(null);
  const activeSlot = selectedSlot ?? hoveredSlot;

  useEffect(() => subscribeItemDescriptionOpen(descriptionOwnerId.current, () => {
    setSelectedSlot(null);
    setSelectedAnchor(null);
    setHoveredSlot(null);
    setHoveredAnchor(null);
  }), []);

  return (
    <div className={`${styles.equipmentPanel} ${styles[side]}`} aria-label={side === "left" ? "Экипировка слева" : "Экипировка справа"}>
      {slots.filter((slot) => slot.side === side).map((slot) => (
        <button className={`${styles.equipmentSlot} ${styles[slot.size]}`} data-has-item={slot.itemName ? "true" : undefined} data-item-description-trigger={slot.itemName ? "true" : undefined} data-slot={slot.id} type="button" key={slot.id} aria-label={slot.itemName ? `Описание: ${slot.itemName}` : `${slot.label}: пусто`} disabled={!slot.itemName} onClick={(event) => { if (!slot.itemName) return; announceItemDescriptionOpen(descriptionOwnerId.current); setSelectedSlot((current) => current?.id === slot.id ? null : slot); setSelectedAnchor(event.currentTarget.getBoundingClientRect()); }} onPointerEnter={(event) => { if (slot.itemName && !selectedSlot) { setHoveredSlot(slot); setHoveredAnchor(event.currentTarget.getBoundingClientRect()); } }} onPointerLeave={() => { if (!selectedSlot) setHoveredSlot(null); }}>
          {slot.itemName && <span aria-hidden="true">{slot.icon ?? "◆"}</span>}
        </button>
      ))}
      {activeSlot && <ItemDescriptionDialog item={toItemDescription(activeSlot)} onClose={() => setSelectedSlot(null)} previewAnchor={selectedSlot ? selectedAnchor : hoveredAnchor} />}
    </div>
  );
}

function toItemDescription(slot: EquipmentSlot): ItemDescriptionData {
  const details: Partial<Record<EquipmentSlot["id"], Omit<ItemDescriptionData, "name" | "icon" | "slot">>> = {
    weapon: { rarity: "epic", description: "Основное оружие персонажа. Урон и боевые свойства учитываются в дуэли.", requirements: ["Уровень персонажа"], properties: ["Урон", "Критический удар"] },
    helmet: { rarity: "rare", description: "Экипировка для защиты головы.", requirements: ["Уровень персонажа"], properties: ["Интуиция", "Уворот"], armor: "Голова" },
    armor: { rarity: "epic", description: "Основной защитный предмет персонажа.", requirements: ["Выносливость"], properties: ["Сопротивление", "Защита от магии"], armor: "Корпус" },
    gloves: { rarity: "rare", description: "Перчатки усиливают контроль оружия.", requirements: ["Ловкость"], properties: ["Крит", "Точность"] },
    bracers: { rarity: "rare", description: "Наручи защищают руки во время атаки и блока.", requirements: ["Уровень персонажа"], properties: ["Блок", "Стойкость"] },
    shield: { rarity: "rare", description: "Предмет второй руки для защиты от ударов.", requirements: ["Сила"], properties: ["Антикрит", "Сопротивление"], armor: "Корпус" },
    belt: { rarity: "common", description: "Пояс хранит расходники и усиливает защиту корпуса.", requirements: ["Нет дополнительных требований"], properties: ["Здоровье", "Быстрые слоты"] },
    pants: { rarity: "rare", description: "Защитные поножи для устойчивости в бою.", requirements: ["Выносливость"], properties: ["Защита", "Стойкость"], armor: "Ноги" },
    boots: { rarity: "rare", description: "Обувь влияет на движение и шанс уворота.", requirements: ["Ловкость"], properties: ["Инициатива", "Уворот"], armor: "Ноги" }
  };
  const isQuickSlot = slot.id.startsWith("quick-");
  const fallback: Omit<ItemDescriptionData, "name" | "icon" | "slot"> = isQuickSlot
    ? { rarity: "common", description: "Быстрый слот для расходуемого предмета.", properties: ["Использование в бою"] }
    : { rarity: "common", description: "Предмет экипировки персонажа.", properties: ["Свойства комплекта"] };

  const base = details[slot.id] ?? fallback;

  return {
    name: slot.itemName ?? slot.label,
    icon: slot.icon ?? (isQuickSlot ? "✦" : "◆"),
    slot: slot.label,
    rarity: slot.rarity ?? base.rarity,
    description: slot.description ?? base.description,
    requirements: slot.requirements ?? base.requirements,
    properties: slot.properties ?? base.properties,
    armor: slot.armor ?? base.armor,
    damageReduction: slot.damageReduction ?? base.damageReduction
  };
}
