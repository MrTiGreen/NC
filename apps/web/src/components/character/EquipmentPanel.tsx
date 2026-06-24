import type { EquipmentSlot } from "./types";
import styles from "./CharacterPage.module.css";

export function EquipmentPanel({ slots, side }: { slots: readonly EquipmentSlot[]; side: EquipmentSlot["side"] }) {
  return (
    <div className={`${styles.equipmentPanel} ${styles[side]}`} aria-label={side === "left" ? "Экипировка слева" : "Экипировка справа"}>
      {slots.filter((slot) => slot.side === side).map((slot) => (
        <button className={`${styles.equipmentSlot} ${styles[slot.size]}`} data-slot={slot.id} type="button" key={slot.id} aria-label={slot.label}>
          {slot.label}
        </button>
      ))}
    </div>
  );
}
