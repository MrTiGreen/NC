import { useState } from "react";
import styles from "./CharacterPage.module.css";

export function ChatDock({ tabs }: { tabs: readonly string[] }) {
  const [activeTab, setActiveTab] = useState(tabs[1] ?? tabs[0]);
  return (
    <section className={styles.chatDock} aria-label="Панель чата">
      <nav className={styles.chatTabs} aria-label="Вкладки чата">
        {tabs.map((tab) => <button className={activeTab === tab ? styles.activeChatTab : ""} type="button" key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>
      <p className={styles.chatPlaceholder}>{activeTab} · сообщения появятся здесь</p>
      <form className={styles.composer} onSubmit={(event) => event.preventDefault()}>
        <input aria-label="Сообщение" placeholder="Введите сообщение..." />
        <button type="submit" aria-label="Отправить сообщение"><img src="/assets/character-page/send.png" alt="" /></button>
      </form>
    </section>
  );
}
