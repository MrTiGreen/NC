import { getCharacterPageData } from "./characterData";
import { CharacterPreview } from "./CharacterPreview";
import { EquipmentPanel } from "./EquipmentPanel";
import { ProfileInfo } from "./ProfileInfo";
import { StatsPanel } from "./StatsPanel";
import styles from "./CharacterPage.module.css";

type CharacterPageProps = { characterName: string };

function EncounterBar({ current, maximum, tone }: { current: number; maximum: number; tone: "health" | "energy" }) {
  return (
    <span className={styles.sceneProgress} data-tone={tone}>
      <i style={{ width: String(Math.min(100, (current / maximum) * 100)) + "%" }} />
      <b>{current}/{maximum}</b>
    </span>
  );
}

export function CharacterPage({ characterName }: CharacterPageProps) {
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
              <span>{data.encounter.opponentName}</span>
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
