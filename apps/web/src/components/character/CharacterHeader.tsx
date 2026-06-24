import type { CharacterPageData, ProgressMetric } from "./types";
import styles from "./CharacterPage.module.css";

type CharacterHeaderProps = {
  characterName: string;
  data: Pick<CharacterPageData, "level" | "health" | "energy" | "experience" | "currencies" | "statusBadges">;
  onClose: () => void;
};

function ProgressBar({ metric }: { metric: ProgressMetric }) {
  const value = Math.min(100, (metric.current / metric.maximum) * 100);
  return (
    <div className={styles.progressLine}>
      <span className={`${styles.progressFill} ${styles[metric.tone]}`} style={{ width: `${value}%` }} />
      <span className={styles.progressValue}>{metric.current}/{metric.maximum}</span>
    </div>
  );
}

export function CharacterHeader({ characterName, data, onClose }: CharacterHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerTopline}>
        <img className={styles.headerPortrait} src="/assets/character-page/portrait.png" alt="" />
        <div className={styles.identity}>
          <strong>{characterName} · ур.{data.level}</strong>
          <div className={styles.resourceRows}>
            <ProgressBar metric={data.health} />
            <ProgressBar metric={data.energy} />
          </div>
        </div>
        <div className={styles.statusBadges} aria-label="Статусы персонажа">
          {data.statusBadges.map((badge) => (
            <span className={styles[badge.tone]} key={badge.id}>{badge.label}</span>
          ))}
        </div>
        <div className={styles.currencies} aria-label="Валюты">
          {data.currencies.map((currency) => (
            <span key={currency.id}>{currency.symbol} {currency.value.toLocaleString("ru-RU")}</span>
          ))}
        </div>
        <button className={styles.closeButton} type="button" aria-label="Закрыть профиль" onClick={onClose}>×</button>
      </div>
      <div className={styles.experienceLine}>
        <span className={styles.experienceFill} style={{ width: `${(data.experience.current / data.experience.maximum) * 100}%` }} />
        <span>EXP {data.experience.current.toLocaleString("ru-RU")} / {data.experience.maximum.toLocaleString("ru-RU")}</span>
      </div>
    </header>
  );
}
