import { useEffect } from "react";
import styles from "./ItemDescriptionDialog.module.css";

export type ItemDescriptionData = {
  name: string;
  icon: string;
  slot: string;
  rarity?: "common" | "rare" | "epic";
  description: string;
  requirements?: readonly string[];
  unmetRequirements?: readonly string[];
  properties: readonly string[];
  armor?: string;
  damageReduction?: string;
};

type ItemDescriptionDialogProps = {
  item: ItemDescriptionData;
  onClose?: () => void;
  previewAnchor?: DOMRect | null;
};

export function ItemDescriptionDialog({ item, onClose, previewAnchor }: ItemDescriptionDialogProps) {
  const rarity = item.rarity ?? "rare";
  const rarityLabel = rarity === "epic" ? "Эпический предмет" : rarity === "common" ? "Обычный предмет" : "Редкий предмет";

  useEffect(() => {
    const close = onClose;
    if (!close || !previewAnchor) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-item-description-trigger='true']")) return;
      close?.();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [onClose, previewAnchor]);

  const card = (
    <aside aria-label={`Описание предмета ${item.name}`} className={`${styles.dialog} ${previewAnchor ? styles.preview : ""}`} data-rarity={rarity} role={previewAnchor ? "tooltip" : "dialog"} style={previewAnchor ? getPreviewPosition(previewAnchor) : undefined} onPointerDown={(event) => event.stopPropagation()}>
        <button aria-label="Закрыть описание предмета" className={styles.close} type="button" onClick={onClose}>×</button>
        <div className={styles.heading}>
          <span className={styles.icon} aria-hidden="true">{item.icon}</span>
          <div><p>{rarityLabel} · {item.slot}</p><h2>{item.name}</h2></div>
        </div>
        <section className={styles.description}><h3>Описание</h3><p>{item.description}</p></section>
        {item.requirements && item.requirements.length > 0 && <DetailSection label="Требования" values={item.requirements} tone="requirements" unmetValues={item.unmetRequirements} />}
        <DetailSection label="Свойства" values={item.properties} tone="properties" />
        {(item.armor || item.damageReduction) && <section className={styles.protection}><h3>Защита</h3>{item.armor && <DetailRow label="Броня" value={item.armor} />}{item.damageReduction && <DetailRow label="Снижение урона" value={item.damageReduction} />}</section>}
    </aside>
  );

  if (previewAnchor) return card;
  return <div className={styles.backdrop} role="presentation" onPointerDown={onClose}>{card}</div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className={styles.row}><dt>{label}</dt><dd>{value}</dd></div>;
}

function DetailSection({ label, values, tone, unmetValues = [] }: { label: string; values: readonly string[]; tone: "requirements" | "properties"; unmetValues?: readonly string[] }) {
  const unmet = new Set(unmetValues);
  return (
    <section className={`${styles.detailSection} ${styles[tone]}`}>
      <h3>{label}</h3>
      <ul>{values.map((value) => <li data-unmet={unmet.has(value) ? "true" : undefined} key={value}>{value}</li>)}</ul>
    </section>
  );
}

function getPreviewPosition(anchor: DOMRect) {
  const gap = 8;
  const width = 292;
  const height = 250;
  return {
    left: `${Math.max(8, Math.min(anchor.right + gap, window.innerWidth - width - 8))}px`,
    top: `${Math.max(8, Math.min(anchor.top, window.innerHeight - height - 8))}px`
  };
}
