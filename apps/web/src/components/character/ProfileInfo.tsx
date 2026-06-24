import type { ProfileSection } from "./types";
import styles from "./CharacterPage.module.css";

export function ProfileInfo({ sections }: { sections: readonly ProfileSection[] }) {
  return (
    <section className={styles.profileInfo} aria-label="Информация профиля">
      {sections.map((section) => (
        <div className={styles.profileSection} key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.content}</p>
        </div>
      ))}
    </section>
  );
}
