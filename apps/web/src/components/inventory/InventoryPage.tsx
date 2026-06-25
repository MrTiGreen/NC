import { useEffect, useMemo, useState } from "react";
import { getCharacterProgression } from "../../lib/api";
import {
  InventoryBagPage,
  inventoryItemsById,
  type EquippedInventorySlots,
  type InventoryEquippedSlot,
  type InventoryStatId
} from "./InventoryBagPage";
import { FittingRoomPage } from "./FittingRoomPage";

const initialEquippedSlots: EquippedInventorySlots = {
  weapon: "night-blade",
  helmet: "scout-hood",
  armor: "night-coat",
  gloves: "shadow-gloves",
  belt: "guard-belt",
  boots: "runners-boots",
  shield: "arena-shield",
  pants: "guard-pants",
  amulet: "amber-amulet",
  bracers: "iron-bracers",
  "earring-left": "silver-earring",
  "earring-right": "duelist-ring"
};

export function InventoryPage({ token, onCharacterProfileChanged }: { token: string; onCharacterProfileChanged?: () => void | Promise<void> }) {
  const [activePage, setActivePage] = useState<"fitting" | "bag">("fitting");
  const [equippedSlots, setEquippedSlots] = useState<EquippedInventorySlots>(() => initialEquippedSlots);
  const [characterStats, setCharacterStats] = useState<Record<InventoryStatId, number> | null>(null);
  const [characterLevel, setCharacterLevel] = useState<number | null>(null);
  const equippedItemIds = useMemo(() => new Set(Object.values(equippedSlots).filter(Boolean) as string[]), [equippedSlots]);
  const equippedGear = useMemo(
    () => Object.entries(equippedSlots).flatMap(([slot, itemId]) => {
      if (!itemId) return [];
      const item = inventoryItemsById.get(itemId);
      if (!item) return [];
      return [{ slot: slot as InventoryEquippedSlot, label: item.name, icon: item.icon, inventoryItemId: item.id }];
    }),
    [equippedSlots]
  );

  useEffect(() => {
    let cancelled = false;
    void getCharacterProgression(token)
      .then((result) => {
        if (cancelled) return;
        setCharacterStats(result.stats);
        setCharacterLevel(result.progression.level);
      })
      .catch(() => {
        if (cancelled) return;
        setCharacterStats(null);
        setCharacterLevel(null);
      });
    return () => { cancelled = true; };
  }, [token]);

  function equipInventoryItem(itemId: string, targetSlot: InventoryEquippedSlot) {
    const replacedItemId = equippedSlots[targetSlot] ?? null;
    setEquippedSlots((current) => {
      const next: EquippedInventorySlots = {};

      for (const [slot, equippedItemId] of Object.entries(current)) {
        if (equippedItemId !== itemId) {
          next[slot as InventoryEquippedSlot] = equippedItemId;
        }
      }

      next[targetSlot] = itemId;
      return next;
    });
    return replacedItemId;
  }

  function unequipInventoryItem(itemId: string) {
    setEquippedSlots((current) => {
      const next: EquippedInventorySlots = {};
      for (const [slot, equippedItemId] of Object.entries(current)) {
        if (equippedItemId !== itemId) {
          next[slot as InventoryEquippedSlot] = equippedItemId;
        }
      }
      return next;
    });
  }

  function unequipInventorySlot(slot: InventoryEquippedSlot) {
    setEquippedSlots((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
  }

  async function handleCharacterProfileChanged() {
    await Promise.resolve(onCharacterProfileChanged?.());
    try {
      const result = await getCharacterProgression(token);
      setCharacterStats(result.stats);
      setCharacterLevel(result.progression.level);
    } catch {
      setCharacterStats(null);
      setCharacterLevel(null);
    }
  }

  return activePage === "fitting" ? (
    <FittingRoomPage
      equippedGear={equippedGear}
      equippedItemIds={equippedItemIds}
      token={token}
      onCharacterProfileChanged={handleCharacterProfileChanged}
      onOpenBag={() => setActivePage("bag")}
      onUnequipInventoryItem={unequipInventoryItem}
      onUnequipInventorySlot={unequipInventorySlot}
    />
  ) : (
    <InventoryBagPage
      characterLevel={characterLevel}
      characterStats={characterStats}
      equippedItemIds={equippedItemIds}
      equippedSlots={equippedSlots}
      onEquipInventoryItem={equipInventoryItem}
      onOpenFittingRoom={() => setActivePage("fitting")}
      onUnequipInventoryItem={unequipInventoryItem}
    />
  );
}
