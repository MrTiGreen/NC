import styles from "./CharacterPage.module.css";

export function CharacterPreview({ characterName }: { characterName: string }) {
  return (
    <div className={styles.characterPreview}>
      <div className={styles.aura} />
      <img src="/assets/character-page/masked-duelist.png" alt={`Персонаж ${characterName}`} />
    </div>
  );
}
