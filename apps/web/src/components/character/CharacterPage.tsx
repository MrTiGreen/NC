import { getCharacterPageData } from "./characterData";
import { CharacterPreview } from "./CharacterPreview";
import { EquipmentPanel } from "./EquipmentPanel";
import { ProfileInfo } from "./ProfileInfo";
import { StatsPanel } from "./StatsPanel";
import styles from "./CharacterPage.module.css";

type CharacterPageProps = {
  characterName: string;
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
  profileUser,
  isBlocked = false,
  canBlock = false,
  onOpenPrivate,
  onToggleBlocked
}: CharacterPageProps) {
  const profileData = getCharacterPageData(characterName);
  const data = {
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
            <span className={styles.buffsLabel}>{data.encounter.buffsLabel}</span>
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
import type { CurrentUserDto, PublicUserDto } from "@telegram-mini-chat/shared";
import { useEffect, useRef, useState } from "react";
