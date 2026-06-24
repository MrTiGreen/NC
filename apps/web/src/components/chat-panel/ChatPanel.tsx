import {
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject
} from "react";
import styles from "./ChatPanel.module.css";
import { useBattleNavigation, useChatDockState } from "./ChatDockState";

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
  const dockState = useChatDockState();
  const battleNavigation = useBattleNavigation();
  const isCollapsed = dockState?.collapsed ?? false;
  const battleTab = "battle" as TTab;

  return (
    <section
      className={styles.panel}
      data-collapsed={isCollapsed || undefined}
      data-panel={tone ?? activeTab}
      style={
        {
          "--chat-panel-height": height ? `${height}%` : undefined,
          "--chat-tab-count": tabs.length
        } as CSSProperties
      }
    >
      <div className={styles.resizeZone}>
        {height && onHeightChange && (
          <ChatResizeHandle
            collapsed={isCollapsed}
            value={height}
            onChange={onHeightChange}
            onCollapse={() => dockState?.setCollapsed(true)}
            onExpand={() => dockState?.setCollapsed(false)}
          />
        )}
        {dockState && (
          <button
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Развернуть нижнюю панель" : "Свернуть нижнюю панель"}
            className={styles.collapseToggle}
            data-no-pager-drag="true"
            type="button"
            onClick={() => {
              if (isCollapsed) {
                onHeightChange?.(35);
                dockState.setCollapsed(false);
                return;
              }

              dockState.setCollapsed(true);
            }}
          >
            <span aria-hidden="true">{isCollapsed ? "+" : "−"}</span>
          </button>
        )}
      </div>
      {backAction && (
        <div className={styles.backAction} data-no-pager-drag="true">
          {backAction}
        </div>
      )}
      <div className={styles.topMenu} data-no-pager-drag="true">
        <div className={styles.tabs}>
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
        <div className={styles.gameActions} aria-label="Игровые действия">
          <button
            aria-label="Бой: открыть лог"
            className={styles.gameAction}
            data-action="battle"
            title="Бой: лог боя"
            type="button"
            onClick={() => {
              onTabChange(battleTab);
              battleNavigation?.returnToBattle();
            }}
          >
            <span aria-hidden="true">⚔</span>
          </button>
          <button aria-label="Карта" className={styles.gameAction} data-action="map" title="Карта" type="button">
            <span aria-hidden="true">⌘</span>
          </button>
          <button aria-label="Настройки" className={styles.gameAction} data-action="settings" title="Настройки" type="button">
            <span aria-hidden="true">⚙</span>
          </button>
          <button aria-label="Инвентарь" className={styles.gameAction} data-action="inventory" title="Инвентарь" type="button">
            <span aria-hidden="true">▣</span>
          </button>
        </div>
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

function ChatResizeHandle({
  collapsed,
  value,
  onChange,
  onCollapse,
  onExpand
}: {
  collapsed: boolean;
  value: number;
  onChange: (value: number) => void;
  onCollapse: () => void;
  onExpand: () => void;
}) {
  const startRef = useRef<{ pointerY: number; value: number; collapsed: boolean; expanded: boolean } | null>(null);
  const [collapseArmed, setCollapseArmed] = useState(false);

  function updateHeight(pointerY: number, finish = false) {
    const start = startRef.current;
    if (!start) {
      return;
    }

    let deltaPixels = start.pointerY - pointerY;

    if (start.collapsed && !start.expanded) {
      if (deltaPixels < 12) {
        return;
      }

      start.expanded = true;
      start.pointerY = pointerY;
      start.value = 35;
      onChange(35);
      onExpand();
      deltaPixels = 0;
    }

    const deltaPercent = (deltaPixels / window.innerHeight) * 100;
    const nextValue = Math.round(start.value + deltaPercent);
    const shouldCollapse = nextValue <= 10;

    setCollapseArmed(shouldCollapse);

    if (finish && shouldCollapse) {
      onCollapse();
      return;
    }

    if (!shouldCollapse) {
      onChange(nextValue);
    }
  }

  return (
    <button
      aria-label="Изменить высоту чата"
      className={styles.resizeHandle}
      data-collapse-armed={collapseArmed || undefined}
      data-no-pager-drag="true"
      type="button"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        startRef.current = {
          pointerY: event.clientY,
          value: collapsed ? 35 : value,
          collapsed,
          expanded: false
        };
        setCollapseArmed(false);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          updateHeight(event.clientY);
        }
      }}
      onPointerUp={(event) => {
        updateHeight(event.clientY, true);
        event.currentTarget.releasePointerCapture(event.pointerId);
        startRef.current = null;
        setCollapseArmed(false);
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        startRef.current = null;
        setCollapseArmed(false);
      }}
    >
      <span />
    </button>
  );
}
