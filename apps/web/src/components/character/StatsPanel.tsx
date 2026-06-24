import type { CharacterStat, CombatRecord } from "./types";
import styles from "./CharacterPage.module.css";

export function StatsPanel({ stats, records }: { stats: readonly CharacterStat[]; records: readonly CombatRecord[] }) {
  return (
    <section className={styles.statsPanel} aria-label="Характеристики">
      <dl className={styles.statsList}>
        {stats.map((stat) => <div key={stat.id}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
      </dl>
      <div className={styles.records}>
        {records.map((record) => <span key={record.label}><b>{record.value}</b>{record.label}</span>)}
      </div>
    </section>
  );
}
