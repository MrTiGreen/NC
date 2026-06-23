import {
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject
} from "react";
import styles from "./ChatPanel.module.css";

export type ChatPanelTab<TTab extends string> = {
  value: TTab;
  label: string;
  tone?: "back";
};

export type ChatPanelProps<TTab extends string> = {
  activeTab: TTab;
  tabs: ReadonlyArray<ChatPanelTab<TTab>>;
  onTabChange: (value: TTab) => void;
  children: ReactNode;
  height?: number;
  onHeightChange?: (value: number) => void;
  backAction?: ReactNode;
  footer?: ReactNode;
  loadingText?: string;
  tone?: string;
};

export function ChatPanel<TTab extends string>({
  activeTab,
  tabs,
  onTabChange,
  children,
  height,
  onHeightChange,
  backAction,
  footer,
  loadingText,
  tone
}: ChatPanelProps<TTab>) {
  const isCollapsed = Boolean(height && height <= 10);

  return (
    <section
      className={styles.panel}
      data-collapsed={isCollapsed || undefined}
      data-panel={tone ?? activeTab}
      style={height ? ({ "--chat-panel-height": `${height}dvh` } as CSSProperties) : undefined}
    >
      <div className={styles.resizeZone}>
        {height && onHeightChange && <ChatResizeHandle value={height} onChange={onHeightChange} />}
      </div>
      {backAction && (
        <div className={styles.backAction} data-no-pager-drag="true">
          {backAction}
        </div>
      )}
      <div className={styles.tabs} data-no-pager-drag="true">
        {tabs.map((tab) => (
          <button
            className={[
              activeTab === tab.value ? styles.activeTab : "",
              tab.tone === "back" ? styles.backTab : ""
            ]
              .filter(Boolean)
              .join(" ")}
            key={tab.value}
            type="button"
            onClick={() => onTabChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {loadingText && <p className={styles.loading}>{loadingText}</p>}
      {children}
      {footer}
    </section>
  );
}

export type ChatComposerProps = {
  placeholder: string;
  initialText?: string;
  error?: string;
  onSend: (text: string) => Promise<boolean | void>;
};

export function ChatComposer({ placeholder, initialText = "", error, onSend }: ChatComposerProps) {
  const [text, setText] = useState(initialText);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextText = text.trim();
    if (!nextText || sending) {
      return;
    }

    setSending(true);
    try {
      const shouldClear = await onSend(nextText);
      if (shouldClear !== false) {
        setText("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={styles.composerWrap} data-no-pager-drag="true">
      {error && <p className={styles.composerError}>{error}</p>}
      <form className={styles.composer} onSubmit={submit}>
        <input
          maxLength={1000}
          placeholder={placeholder}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <button aria-label="Отправить сообщение" disabled={!text.trim() || sending} title="Отправить" type="submit">
          {sending ? <span aria-hidden="true">...</span> : <span className={styles.sendIcon} aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
}

export type ChatMessageListProps = {
  children: ReactNode;
  emptyText?: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
};

export function ChatMessageList({ children, emptyText, scrollRef }: ChatMessageListProps) {
  return (
    <div className={styles.messages} data-no-pager-drag="true" ref={scrollRef}>
      {emptyText && <p className={styles.empty}>{emptyText}</p>}
      {children}
    </div>
  );
}

export type ChatMessageProps = {
  author: ReactNode;
  time: string;
  children: ReactNode;
  align?: "start" | "end";
  badge?: string;
  recipient?: ReactNode;
  tone?: "default" | "private";
};

export function ChatMessage({
  author,
  time,
  children,
  align = "start",
  badge,
  recipient,
  tone = "default"
}: ChatMessageProps) {
  const className = [
    styles.message,
    align === "end" ? styles.messageEnd : styles.messageStart,
    tone === "private" ? styles.privateMessage : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={className}>
      <div className={styles.messageMeta}>
        <span className={styles.messageIdentity}>
          {badge && <span className={styles.privateBadge}>{badge}</span>}
          {author}
          {recipient && <span className={styles.privateRecipient}>{recipient}</span>}
        </span>
        <time>{time}</time>
      </div>
      <p>{children}</p>
    </article>
  );
}

export type LogPanelEntry = {
  id: string;
  text: string;
  time?: string;
  actor?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

export type LogPanelProps = {
  entries: LogPanelEntry[];
  emptyText?: string;
};

export function LogPanel({ entries, emptyText = "Записей пока нет." }: LogPanelProps) {
  return (
    <div className={styles.logPanel} data-no-pager-drag="true">
      {entries.length === 0 && <p className={styles.empty}>{emptyText}</p>}
      {entries.map((entry) => (
        <article className={styles.logEntry} data-tone={entry.tone ?? "neutral"} key={entry.id}>
          {entry.time ? <time>{entry.time}</time> : <span className={styles.logMarker} aria-hidden="true" />}
          <p>
            {entry.actor && <strong>{entry.actor}</strong>}
            {entry.actor ? " " : ""}
            {entry.text}
          </p>
        </article>
      ))}
    </div>
  );
}

function ChatResizeHandle({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const startRef = useRef<{ pointerY: number; value: number } | null>(null);

  function updateHeight(pointerY: number) {
    if (!startRef.current) {
      return;
    }

    const deltaPercent = ((startRef.current.pointerY - pointerY) / window.innerHeight) * 100;
    onChange(Math.round(startRef.current.value + deltaPercent));
  }

  return (
    <button
      aria-label="Изменить высоту чата"
      className={styles.resizeHandle}
      data-no-pager-drag="true"
      type="button"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        startRef.current = { pointerY: event.clientY, value };
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          updateHeight(event.clientY);
        }
      }}
      onPointerUp={(event) => {
        updateHeight(event.clientY);
        event.currentTarget.releasePointerCapture(event.pointerId);
        startRef.current = null;
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        startRef.current = null;
      }}
    >
      <span />
    </button>
  );
}
