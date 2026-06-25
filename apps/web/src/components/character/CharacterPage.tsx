import { getCharacterPageData } from "./characterData";
import { CharacterPreview } from "./CharacterPreview";
import { EquipmentPanel } from "./EquipmentPanel";
import { ProfileInfo } from "./ProfileInfo";
import { StatsPanel } from "./StatsPanel";
import { getEquippedGear } from "../gear/equippedGear";
import type { EquipmentSlot } from "./types";
import { getCharacterPublicProfile } from "../../lib/api";
import styles from "./CharacterPage.module.css";

type CharacterPageProps = {
  characterName: string;
  token?: string;
  profileUser?: PublicUserDto | CurrentUserDto;
  isBlocked?: boolean;
  canBlock?: boolean;
  onOpenPrivate?: () => void;
  onToggleBlocked?: () => void;
};

function EncounterBar({ current, maximum, tone }: { current: number; maximum: number; tone: "health" | "energy" }) {
  return (
    <span className={styles.sceneProgress} data-tone={tone}>
      <i style={{ width: String(Math.min(100, (current / maximum) * 100)) + "%" }} />
      <b>{current}/{maximum}</b>
    </span>
  );
}

export function CharacterPage({
  characterName,
  token,
  profileUser,
  isBlocked = false,
  canBlock = false,
  onOpenPrivate,
  onToggleBlocked
}: CharacterPageProps) {
  const [publicProfile, setPublicProfile] = useState<CharacterPublicProfileDto | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!token || !profileUser?.id) {
      setPublicProfile(null);
      setProfileLoading(false);
      return undefined;
    }

    let cancelled = false;
    setProfileLoading(true);

    void getCharacterPublicProfile(token, profileUser.id)
      .then((profile) => {
        if (!cancelled) setPublicProfile(profile);
      })
      .catch(() => {
        if (!cancelled) setPublicProfile(null);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileUser?.id, token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const profileData = getCharacterPageData(characterName);
  const liveHp = publicProfile ? getRegeneratedHp(publicProfile, now) : null;
  const data = publicProfile ? createLiveCharacterData(publicProfile, liveHp ?? publicProfile.health.current) : {
    ...profileData,
    encounter: {
      ...profileData.encounter,
      opponentName: `${characterName} ур.${profileData.level}`
    }
  };

  return (
    <section className={styles.page} aria-label={`Профиль героя ${characterName}`}>
      <main className={styles.content}>
        <section className={styles.overview} aria-label="Экипировка и характеристики">
          <div className={styles.sceneMeta}>
            <div className={styles.opponentInfo}>
              <ProfileNicknameMenu
                label={data.encounter.opponentName}
                canBlock={canBlock}
                isBlocked={isBlocked}
                onOpenPrivate={onOpenPrivate}
                onToggleBlocked={onToggleBlocked}
                profileUser={profileUser}
              />
              <div className={styles.opponentBars}>
                <EncounterBar {...data.encounter.health} />
                <EncounterBar {...data.encounter.energy} />
              </div>
            </div>
            <StatusEffects effects={publicProfile?.statusEffects ?? []} loading={profileLoading} />
          </div>
          <div className={styles.overviewBody}>
            <EquipmentPanel slots={data.equipment} side="left" />
            <CharacterPreview characterName={characterName} />
            <EquipmentPanel slots={data.equipment} side="right" />
            <StatsPanel stats={data.stats} records={data.records} />
          </div>
        </section>
        <ProfileInfo sections={data.profileSections} />
      </main>
    </section>
  );
}

function StatusEffects({ effects, loading }: { effects: readonly CharacterPublicStatusEffectDto[]; loading: boolean }) {
  if (effects.length === 0) {
    return <span className={styles.buffsLabel}>{loading ? "Загрузка…" : "Эффекты: нет"}</span>;
  }

  return (
    <span className={styles.statusEffects} aria-label="Бафы, дебафы и травмы">
      {effects.map((effect) => (
        <span
          className={styles.statusEffect}
          data-kind={effect.kind}
          key={effect.id}
          title={`${effect.label}: ${effect.description}${effect.expiresAt ? ` · осталось ${formatRemaining(effect.expiresAt)}` : ""}`}
        >
          {effect.icon}
        </span>
      ))}
    </span>
  );
}

function createLiveCharacterData(profile: CharacterPublicProfileDto, currentHp: number) {
  const owner = profile.nickname.trim().toLocaleLowerCase("ru-RU") === "mrgreen" ? "player" : "enemy";
  const equipment = createLiveEquipment(profile.equipment, owner);
  const maxExp = Math.max(1000, profile.level * 5000);
  const currentExp = Number(BigInt(profile.totalExp) % BigInt(maxExp));

  return {
    ...getCharacterPageData(profile.nickname),
    level: profile.level,
    health: { current: currentHp, maximum: profile.health.maximum, tone: "health" as const },
    energy: { current: 100, maximum: 100, tone: "energy" as const },
    experience: { current: currentExp, maximum: maxExp, tone: "experience" as const },
    statusBadges: profile.statusEffects.map((effect) => ({
      id: effect.id,
      label: effect.icon,
      icon: effect.icon,
      tone: effect.kind === "buff" ? "green" as const : effect.kind === "injury" ? "red" as const : "purple" as const,
      title: effect.label,
      expiresAt: effect.expiresAt
    })),
    encounter: {
      opponentName: `${profile.nickname} ур.${profile.level}`,
      buffsLabel: "Эффекты:",
      health: { current: currentHp, maximum: profile.health.maximum, tone: "health" as const },
      energy: { current: 100, maximum: 100, tone: "energy" as const }
    },
    stats: [
      { id: "strength" as const, label: "Сила", value: profile.stats.strength },
      { id: "agility" as const, label: "Ловкость", value: profile.stats.agility },
      { id: "vitality" as const, label: "Выносливость", value: profile.stats.vitality },
      { id: "intuition" as const, label: "Интуиция", value: profile.stats.intuition },
      { id: "intelligence" as const, label: "Интеллект", value: profile.stats.intelligence },
      { id: "wisdom" as const, label: "Мудрость", value: profile.stats.wisdom }
    ],
    equipment,
    records: [
      { label: "Поражения", value: profile.combatRecord.losses },
      { label: "Ничьи", value: profile.combatRecord.draws },
      { label: "Победы", value: profile.combatRecord.wins }
    ],
    profileSections: [
      { title: "About me:", content: profile.aboutMe }
    ]
  };
}

function createLiveEquipment(equipment: readonly CharacterPublicProfileDto["equipment"][number][], owner: "player" | "enemy") {
  const baseSlots: EquipmentSlot[] = getCharacterPageData("").equipment.map((slot) => ({ ...slot }));
  const slotsById = new Map(baseSlots.map((slot) => [slot.id, slot]));

  for (const item of getEquippedGear(owner)) {
    const slot = slotsById.get(item.slot);
    if (!slot) continue;
    slotsById.set(item.slot, {
      ...slot,
      itemName: item.name,
      icon: item.icon,
      rarity: item.rarity,
      description: item.description,
      requirements: item.requirements,
      properties: item.properties,
      armor: item.armor,
      damageReduction: item.damageReduction
    });
  }

  for (const item of equipment) {
    const slotId = mapApiEquipmentSlot(item.slot);
    if (!slotId) continue;
    const slot = slotsById.get(slotId);
    if (!slot) continue;
    slotsById.set(slotId, {
      ...slot,
      itemName: item.name,
      icon: item.icon,
      rarity: mapRarity(item.rarity),
      description: item.description || "Описание предмета не заполнено.",
      requirements: normalizeStringList(item.requirements),
      properties: [...normalizeStringList(item.properties), `Прочность: ${item.durability.current}/${item.durability.maximum}`],
      armor: item.armor > 0 ? `${item.armor}` : undefined
    });
  }

  return [...slotsById.values()];
}

function mapApiEquipmentSlot(slot: string) {
  const map: Record<string, CharacterPublicEquipmentSlotId> = {
    HELMET: "helmet",
    ARMOR: "armor",
    BELT: "belt",
    PANTS: "pants",
    BOOTS: "boots",
    PRIMARY_HAND: "weapon",
    OFF_HAND: "shield"
  };

  return map[slot] ?? null;
}

type CharacterPublicEquipmentSlotId = ReturnType<typeof getCharacterPageData>["equipment"][number]["id"];

function mapRarity(rarity: string): "common" | "rare" | "epic" {
  if (rarity === "EPIC" || rarity === "LEGENDARY") return "epic";
  if (rarity === "RARE" || rarity === "UNCOMMON") return "rare";
  return "common";
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => typeof entry === "string" ? [entry] : []);
}

function getRegeneratedHp(profile: CharacterPublicProfileDto, now: number) {
  const elapsedMinutes = Math.max(0, (now - Date.parse(profile.health.regeneratedAt)) / 60_000);
  return Math.min(profile.health.maximum, Math.floor(profile.health.current + elapsedMinutes * profile.health.regenPerMinute));
}

function formatRemaining(expiresAt: string) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;

  return minutes > 0 ? `${minutes}м ${restSeconds}с` : `${restSeconds}с`;
}

function ProfileNicknameMenu({
  label,
  profileUser,
  isBlocked,
  canBlock,
  onOpenPrivate,
  onToggleBlocked
}: {
  label: string;
  profileUser?: PublicUserDto | CurrentUserDto;
  isBlocked: boolean;
  canBlock: boolean;
  onOpenPrivate?: () => void;
  onToggleBlocked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement | null>(null);
  const menuIdRef = useRef(`profile-nickname-menu-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  useEffect(() => {
    function closeWhenAnotherMenuOpens(event: Event) {
      if ((event as CustomEvent<string>).detail !== menuIdRef.current) {
        setOpen(false);
      }
    }

    document.addEventListener("player-menu:open", closeWhenAnotherMenuOpens);
    return () => document.removeEventListener("player-menu:open", closeWhenAnotherMenuOpens);
  }, []);

  function toggleMenu() {
    if (!open) {
      document.dispatchEvent(new CustomEvent("player-menu:open", { detail: menuIdRef.current }));
    }
    setOpen((current) => !current);
  }

  return (
    <span className={styles.profileNicknameMenu} ref={menuRef}>
      <button className={styles.sceneOpponentButton} type="button" onClick={toggleMenu}>
        {label}
      </button>
      {open && (
        <span className={styles.profileNicknameActions} aria-label={`Действия игрока ${profileUser ? label : ""}`}>
          <button aria-label="Профиль" disabled title="Открыт текущий профиль" type="button">👤</button>
          <button
            aria-label="Личное сообщение"
            disabled={!onOpenPrivate}
            title="Личное сообщение"
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenPrivate?.();
            }}
          >
            ✉
          </button>
          <button
            aria-label={isBlocked ? "Разблокировать" : "Заблокировать"}
            disabled={!canBlock || !onToggleBlocked}
            title={isBlocked ? "Разблокировать" : "Заблокировать"}
            type="button"
            onClick={() => {
              setOpen(false);
              onToggleBlocked?.();
            }}
          >
            ⊘
          </button>
        </span>
      )}
    </span>
  );
}
import type { CharacterPublicProfileDto, CharacterPublicStatusEffectDto, CurrentUserDto, PublicUserDto } from "@telegram-mini-chat/shared";
import { useEffect, useRef, useState } from "react";
