import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  AdminModerationActionDto,
  CurrentUserDto,
  DialogDto,
  PrivateMessageDto,
  PublicMessageDto,
  PublicUserDto
} from "@telegram-mini-chat/shared";
import {
  authTelegram,
  blockUser,
  getDialogs,
  getGuildMessages,
  getPrivateFeedMessages,
  getPrivateMessages,
  getPublicMessages,
  getUsers,
  moderateUser,
  sendGuildMessage,
  sendPrivateMessage,
  sendPublicMessage,
  unblockUser
} from "./lib/api";
import { createSocket } from "./lib/socket";
import { getTelegramInitData } from "./lib/telegram";
import {
  ChatComposer,
  ChatMessage,
  ChatMessageList,
  ChatPanel,
  LogPanel,
  type ChatPanelTab,
  type LogPanelEntry
} from "./components/chat-panel";
import styles from "./App.module.css";

type Status = "loading" | "ready" | "error";
type ActivePanel = "chat" | "private" | "guild" | "battle";
type DrawerControls = {
  open: boolean;
  pinned: boolean;
  onOpenChange: (value: boolean) => void;
  onPinnedChange: (value: boolean) => void;
};
type AdminControls = {
  currentUserId: number;
  isAdmin: boolean;
  onModerate: (user: PublicUserDto, action: AdminModerationActionDto) => Promise<void>;
};

const AdminControlsContext = createContext<AdminControls | null>(null);

const chatPanelTabs: ChatPanelTab<ActivePanel>[] = [
  { value: "chat", label: "Чат" },
  { value: "private", label: "Личные" },
  { value: "guild", label: "Гильдия" },
  { value: "battle", label: "История" }
];

export function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [me, setMe] = useState<CurrentUserDto | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<PublicUserDto | CurrentUserDto | null>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("chat");
  const [users, setUsers] = useState<PublicUserDto[]>([]);
  const [dialogs, setDialogs] = useState<DialogDto[]>([]);
  const [publicMessages, setPublicMessages] = useState<PublicMessageDto[]>([]);
  const [guildMessages, setGuildMessages] = useState<PublicMessageDto[]>([]);
  const [privateFeedMessages, setPrivateFeedMessages] = useState<PrivateMessageDto[]>([]);
  const [selectedUser, setSelectedUser] = useState<PublicUserDto | null>(null);
  const [privateMessages, setPrivateMessages] = useState<PrivateMessageDto[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<number[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [chatHeight, setChatHeight] = useState(() => readChatHeight());
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [onlinePinned, setOnlinePinned] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [friendsPinned, setFriendsPinned] = useState(false);
  const [guildOpen, setGuildOpen] = useState(false);
  const [guildPinned, setGuildPinned] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsPinned, setParticipantsPinned] = useState(false);
  const [adminNotice, setAdminNotice] = useState("");

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const knownUsers = useMemo(() => (me ? [me, ...users] : users), [me, users]);
  const blockedUserIdSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);
  const openUserProfile = useCallback((user: PublicUserDto | CurrentUserDto) => {
    setProfileOpen(false);
    setSelectedProfile(user);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        const response = await authTelegram(getTelegramInitData());
        if (!mounted) {
          return;
        }

        setToken(response.token);
        setMe(response.user);
        const [publicHistory, guildHistory, privateFeed, userList, dialogList] = await Promise.all([
          getPublicMessages(response.token),
          getGuildMessages(response.token),
          getPrivateFeedMessages(response.token),
          getUsers(response.token),
          getDialogs(response.token)
        ]);

        if (!mounted) {
          return;
        }

        setPublicMessages(publicHistory);
        setGuildMessages(guildHistory);
        setPrivateFeedMessages(privateFeed);
        setUsers(userList);
        setDialogs(dialogList);
        setBlockedUserIds(response.blockedUserIds);
        setStatus("ready");
      } catch (bootError) {
        setError(bootError instanceof Error ? bootError.message : "Не удалось загрузить приложение");
        setStatus("error");
      }
    }

    boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = createSocket(token);
    socket.on("public:message", (message: PublicMessageDto) => {
      if (blockedUserIdSet.has(message.user.id)) {
        return;
      }

      setPublicMessages((current) => appendUnique(current, message));
    });
    socket.on("guild:message", (message: PublicMessageDto) => {
      if (blockedUserIdSet.has(message.user.id)) {
        return;
      }

      setGuildMessages((current) => appendUnique(current, message));
    });
    socket.on("private:message", (message: PrivateMessageDto) => {
      if (blockedUserIdSet.has(message.sender.id) || blockedUserIdSet.has(message.receiver.id)) {
        return;
      }

      setPrivateFeedMessages((current) => appendUnique(current, message));
      if (selectedUser && isMessageWithUser(message, me?.id, selectedUser.id)) {
        setPrivateMessages((current) => appendUnique(current, message));
      }
      setDialogs((current) => upsertDialog(current, message, me?.id));
    });
    socket.on("private:dialog:update", (message: PrivateMessageDto) => {
      if (blockedUserIdSet.has(message.sender.id) || blockedUserIdSet.has(message.receiver.id)) {
        return;
      }

      setDialogs((current) => upsertDialog(current, message, me?.id));
    });

    return () => {
      socket.disconnect();
    };
  }, [blockedUserIdSet, me?.id, selectedUser, token]);

  const openDialog = useCallback(
    async (user: PublicUserDto) => {
      if (!token) {
        return;
      }

      setSelectedUser(user);
      setHistoryError("");
      setHistoryLoading(true);
      try {
        setPrivateMessages(await getPrivateMessages(token, user.id));
      } catch (historyLoadError) {
        setPrivateMessages([]);
        setHistoryError(errorMessage(historyLoadError, "Не удалось загрузить историю переписки"));
      } finally {
        setHistoryLoading(false);
      }
    },
    [token]
  );

  const openPrivateDialog = useCallback(
    (user: PublicUserDto) => {
      setActivePanel("private");
      void openDialog(user);
    },
    [openDialog]
  );

  const toggleBlockedUser = useCallback(
    async (user: PublicUserDto) => {
      if (!token || user.id === me?.id) {
        return;
      }

      const response = blockedUserIdSet.has(user.id)
        ? await unblockUser(token, user.id)
        : await blockUser(token, user.id);
      const nextBlockedIds = new Set(response.blockedUserIds);

      setBlockedUserIds(response.blockedUserIds);
      setPublicMessages((current) => current.filter((message) => !nextBlockedIds.has(message.user.id)));
      setGuildMessages((current) => current.filter((message) => !nextBlockedIds.has(message.user.id)));
      setPrivateFeedMessages((current) => current.filter((message) => !hasBlockedParticipant(message, nextBlockedIds)));
      setPrivateMessages((current) => current.filter((message) => !hasBlockedParticipant(message, nextBlockedIds)));
      setDialogs((current) => current.filter((dialog) => !nextBlockedIds.has(dialog.user.id)));
      setSelectedUser((current) => (current && nextBlockedIds.has(current.id) ? null : current));
    },
    [blockedUserIdSet, me?.id, token]
  );

  const moderateChatUser = useCallback(
    async (user: PublicUserDto, action: AdminModerationActionDto) => {
      if (!token || me?.role !== "ADMIN") {
        return;
      }

      try {
        const result = await moderateUser(token, user.id, action);
        const actionLabels: Record<AdminModerationActionDto, string> = {
          block: "доступ к чату заблокирован",
          mute: "выдана молчанка на 1 час",
          jail: "отправлен в тюрьму на 1 сутки",
          clear: "ручные санкции сняты"
        };
        setAdminNotice(`${displayName(result.target)}: ${actionLabels[result.action]}.`);
      } catch (moderationError) {
        setAdminNotice(errorMessage(moderationError, "Не удалось применить админское действие"));
      }
    },
    [me?.role, token]
  );

  if (status === "loading") {
    return <CenteredState text="Загрузка чата..." />;
  }

  if (status === "error") {
    return <CenteredState text={error} />;
  }

  return (
    <AdminControlsContext.Provider
      value={{ currentUserId: me?.id ?? 0, isAdmin: me?.role === "ADMIN", onModerate: moderateChatUser }}
    >
    <div className={styles.app} style={{ "--chat-height": `${chatHeight}dvh` } as React.CSSProperties}>
      <header className={styles.header}>
        <div className={styles.headerStatus}>
          <p className={styles.eyebrow}>Telegram Mini App</p>
          <h1>Mini Chat</h1>
        </div>
        <div className={styles.headerMeta}>
          <div className={styles.timerPanel} aria-label="Пользователей онлайн" title="Пользователей онлайн">
            <strong>{users.length + (me ? 1 : 0)}</strong>
            <span>онлайн</span>
          </div>
          <button
            className={styles.avatarButton}
            type="button"
            onClick={() => {
              setSelectedProfile(null);
              setProfileOpen(true);
            }}
          >
            <Avatar user={me} />
          </button>
        </div>
        {me?.role === "ADMIN" && adminNotice && <p className={styles.adminNotice}>{adminNotice}</p>}
      </header>

      <main className={styles.main}>
        {profileOpen && me && (
          <div className={styles.topProfile}>
            <Profile user={me} onBack={() => setProfileOpen(false)} />
          </div>
        )}
        {!profileOpen && selectedProfile && (
          <div className={styles.topProfile}>
            <UserProfile
              user={selectedProfile}
              isBlocked={blockedUserIdSet.has(selectedProfile.id)}
              canBlock={selectedProfile.id !== me?.id}
              onBack={() => setSelectedProfile(null)}
              onToggleBlockedUser={toggleBlockedUser}
            />
          </div>
        )}
          <section className={styles.chatPage}>
            {activePanel === "chat" && (
              <PublicChat
                currentUserId={me?.id ?? 0}
                messages={publicMessages}
                privateMessages={privateFeedMessages}
                token={token}
                users={knownUsers}
                chatHeight={chatHeight}
                onChatHeightChange={setPersistedChatHeight(setChatHeight)}
                activePanel={activePanel}
                onActivePanelChange={setActivePanel}
                drawerControls={{
                  open: onlineOpen,
                  pinned: onlinePinned,
                  onOpenChange: setOnlineOpen,
                  onPinnedChange: setOnlinePinned
                }}
                blockedUserIds={blockedUserIdSet}
                onOpenUserProfile={openUserProfile}
                onOpenPrivateDialog={openPrivateDialog}
                onToggleBlockedUser={toggleBlockedUser}
                onSent={(message) => setPublicMessages((current) => appendUnique(current, message))}
                onPrivateSent={(message) => {
                  setPrivateFeedMessages((current) => appendUnique(current, message));
                  setPrivateMessages((current) => appendUnique(current, message));
                  setDialogs((current) => upsertDialog(current, message, me?.id));
                }}
              />
            )}
            {activePanel === "private" && (
              <PrivateArea
                currentUserId={me?.id ?? 0}
                dialogs={dialogs}
                users={users}
                userById={userById}
                selectedUser={selectedUser}
                messages={privateMessages}
                token={token}
                historyLoading={historyLoading}
                historyError={historyError}
                chatHeight={chatHeight}
                onChatHeightChange={setPersistedChatHeight(setChatHeight)}
                activePanel={activePanel}
                onActivePanelChange={setActivePanel}
                friendsControls={{
                  open: friendsOpen,
                  pinned: friendsPinned,
                  onOpenChange: setFriendsOpen,
                  onPinnedChange: setFriendsPinned
                }}
                blockedUserIds={blockedUserIdSet}
                onOpenDialog={openDialog}
                onOpenUserProfile={openUserProfile}
                onBack={() => setSelectedUser(null)}
                onToggleBlockedUser={toggleBlockedUser}
                onSent={(message) => {
                  setPrivateFeedMessages((current) => appendUnique(current, message));
                  setPrivateMessages((current) => appendUnique(current, message));
                  setDialogs((current) => upsertDialog(current, message, me?.id));
                }}
              />
            )}
            {activePanel === "guild" && (
              <GuildChatPanel
                currentUserId={me?.id ?? 0}
                chatHeight={chatHeight}
                onChatHeightChange={setPersistedChatHeight(setChatHeight)}
                activePanel={activePanel}
                onActivePanelChange={setActivePanel}
                messages={guildMessages}
                guildmates={users}
                token={token}
                drawerControls={{
                  open: guildOpen,
                  pinned: guildPinned,
                  onOpenChange: setGuildOpen,
                  onPinnedChange: setGuildPinned
                }}
                blockedUserIds={blockedUserIdSet}
                onOpenUserProfile={openUserProfile}
                onOpenPrivateDialog={openPrivateDialog}
                onToggleBlockedUser={toggleBlockedUser}
                onSent={(message) => setGuildMessages((current) => appendUnique(current, message))}
              />
            )}
            {activePanel === "battle" && (
              <BattleLogPanel
                chatHeight={chatHeight}
                onChatHeightChange={setPersistedChatHeight(setChatHeight)}
                activePanel={activePanel}
                onActivePanelChange={setActivePanel}
                participants={users}
                drawerControls={{
                  open: participantsOpen,
                  pinned: participantsPinned,
                  onOpenChange: setParticipantsOpen,
                  onPinnedChange: setParticipantsPinned
                }}
                onOpenUserProfile={openUserProfile}
                onOpenPrivateDialog={openPrivateDialog}
                blockedUserIds={blockedUserIdSet}
                onToggleBlockedUser={toggleBlockedUser}
              />
            )}
          </section>
      </main>
    </div>
    </AdminControlsContext.Provider>
  );
}

function PublicChat({
  currentUserId,
  messages,
  privateMessages,
  token,
  users,
  chatHeight,
  onChatHeightChange,
  activePanel,
  onActivePanelChange,
  drawerControls,
  blockedUserIds,
  onOpenUserProfile,
  onOpenPrivateDialog,
  onToggleBlockedUser,
  onSent,
  onPrivateSent
}: {
  currentUserId: number;
  messages: PublicMessageDto[];
  privateMessages: PrivateMessageDto[];
  token: string;
  users: PublicUserDto[];
  chatHeight: number;
  onChatHeightChange: (value: number) => void;
  activePanel: ActivePanel;
  onActivePanelChange: (value: ActivePanel) => void;
  drawerControls: DrawerControls;
  blockedUserIds: Set<number>;
  onOpenUserProfile: (user: PublicUserDto | CurrentUserDto) => void;
  onOpenPrivateDialog: (user: PublicUserDto) => void;
  onToggleBlockedUser: (user: PublicUserDto) => void | Promise<void>;
  onSent: (message: PublicMessageDto) => void;
  onPrivateSent: (message: PrivateMessageDto) => void;
}) {
  const [replyPrefix, setReplyPrefix] = useState("");
  const [composerError, setComposerError] = useState("");

  return (
    <ChatPanel
      activeTab={activePanel}
      height={chatHeight}
      tabs={chatPanelTabs}
      onHeightChange={onChatHeightChange}
      onTabChange={onActivePanelChange}
      footer={
        <ChatComposer
          key={replyPrefix}
          placeholder="Сообщение в общий чат"
          initialText={replyPrefix}
          error={composerError}
          onSend={async (text) => {
            const command = parsePrivateCommand(text, users);
            setComposerError("");

            if (command) {
              if (!command.user) {
                setComposerError(`Пользователь ${command.nick} не найден`);
                return false;
              }

              if (command.user.id === currentUserId) {
                setComposerError("Нельзя отправить личное сообщение самому себе");
                return false;
              }

              try {
                onPrivateSent(await sendPrivateMessage(token, command.user.id, command.text));
                setReplyPrefix("");
                return true;
              } catch (sendError) {
                setComposerError(errorMessage(sendError, "Не удалось отправить личное сообщение"));
                return false;
              }
            }

            if (isPrivateCommandStart(text)) {
              setComposerError("Формат: /r nick сообщение");
              return false;
            }

            try {
              onSent(await sendPublicMessage(token, text));
              setReplyPrefix("");
              return true;
            } catch (sendError) {
              setComposerError(errorMessage(sendError, "Не удалось отправить сообщение"));
              return false;
            }
          }}
        />
      }
    >
        <OnlineSplitView
          currentUserId={currentUserId}
          users={users}
          open={drawerControls.open}
          pinned={drawerControls.pinned}
          onOpenChange={drawerControls.onOpenChange}
          onPinnedChange={drawerControls.onPinnedChange}
          onOpenUserProfile={onOpenUserProfile}
          onPrivateReply={onOpenPrivateDialog}
          blockedUserIds={blockedUserIds}
          onToggleBlockedUser={onToggleBlockedUser}
          chat={
            <MainMessageList
              currentUserId={currentUserId}
              publicMessages={messages}
              privateMessages={privateMessages}
              blockedUserIds={blockedUserIds}
              onPrivateReply={onOpenPrivateDialog}
              onOpenUserProfile={onOpenUserProfile}
              onToggleBlockedUser={onToggleBlockedUser}
            />
          }
        />
    </ChatPanel>
  );
}

function PrivateArea({
  currentUserId,
  dialogs,
  users,
  selectedUser,
  messages,
  token,
  historyLoading,
  historyError,
  chatHeight,
  onChatHeightChange,
  activePanel,
  onActivePanelChange,
  friendsControls,
  blockedUserIds,
  onOpenDialog,
  onOpenUserProfile,
  onBack,
  onToggleBlockedUser,
  onSent
}: {
  currentUserId: number;
  dialogs: DialogDto[];
  users: PublicUserDto[];
  userById: Map<number, PublicUserDto>;
  selectedUser: PublicUserDto | null;
  messages: PrivateMessageDto[];
  token: string;
  historyLoading: boolean;
  historyError: string;
  chatHeight: number;
  onChatHeightChange: (value: number) => void;
  activePanel: ActivePanel;
  onActivePanelChange: (value: ActivePanel) => void;
  friendsControls: DrawerControls;
  blockedUserIds: Set<number>;
  onOpenDialog: (user: PublicUserDto) => void;
  onOpenUserProfile: (user: PublicUserDto | CurrentUserDto) => void;
  onBack: () => void;
  onToggleBlockedUser: (user: PublicUserDto) => void | Promise<void>;
  onSent: (message: PrivateMessageDto) => void;
}) {
  const [composerError, setComposerError] = useState("");

  if (selectedUser) {
    return (
      <ChatPanel
        activeTab={activePanel}
        height={chatHeight}
        loadingText={historyLoading ? "Загрузка истории..." : historyError || undefined}
        tabs={chatPanelTabs}
        onHeightChange={onChatHeightChange}
        onTabChange={onActivePanelChange}
        footer={
          <ChatComposer
            placeholder="Личное сообщение"
            error={composerError}
            onSend={async (text) => {
              setComposerError("");
              try {
                onSent(await sendPrivateMessage(token, selectedUser.id, text));
                return true;
              } catch (sendError) {
                setComposerError(errorMessage(sendError, "Не удалось отправить личное сообщение"));
                return false;
              }
            }}
          />
        }
      >
        <div className={styles.privateDialogBar} data-no-pager-drag="true">
          <button className={styles.privateBack} type="button" onClick={onBack}>
            Назад
          </button>
          <span>{displayName(selectedUser)}</span>
        </div>
        <PrivateMessageList
          currentUserId={currentUserId}
          messages={messages}
          blockedUserIds={blockedUserIds}
          onOpenUserProfile={onOpenUserProfile}
          onToggleBlockedUser={onToggleBlockedUser}
        />
      </ChatPanel>
    );
  }

  return (
    <ChatPanel
      activeTab={activePanel}
      height={chatHeight}
      tabs={chatPanelTabs}
      onHeightChange={onChatHeightChange}
      onTabChange={onActivePanelChange}
    >
        <FriendsSplitView
          dialogs={dialogs}
          friends={users}
          open={friendsControls.open}
          pinned={friendsControls.pinned}
          onOpenChange={friendsControls.onOpenChange}
          onPinnedChange={friendsControls.onPinnedChange}
          onOpenDialog={onOpenDialog}
          onOpenUserProfile={onOpenUserProfile}
          blockedUserIds={blockedUserIds}
          onToggleBlockedUser={onToggleBlockedUser}
        />
    </ChatPanel>
  );
}

function FriendsSplitView({
  dialogs,
  friends,
  open,
  pinned,
  onOpenChange,
  onPinnedChange,
  onOpenDialog,
  onOpenUserProfile,
  blockedUserIds,
  onToggleBlockedUser
}: {
  dialogs: DialogDto[];
  friends: PublicUserDto[];
  open: boolean;
  pinned: boolean;
  onOpenChange: (value: boolean) => void;
  onPinnedChange: (value: boolean) => void;
  onOpenDialog: (user: PublicUserDto) => void;
  onOpenUserProfile: (user: PublicUserDto) => void;
  blockedUserIds: Set<number>;
  onToggleBlockedUser: (user: PublicUserDto) => void | Promise<void>;
}) {
  const dragRef = useRef<{ x: number; open: boolean } | null>(null);
  const visible = open || pinned;

  return (
    <div
      className={`${styles.friendsSplit} ${visible ? styles.friendsSplitOpen : ""}`}
      onPointerDown={(event) => {
        if (shouldIgnoreDrawerDrag(event.target)) {
          return;
        }
        dragRef.current = { x: event.clientX, open: visible };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) {
          return;
        }
        const delta = event.clientX - dragRef.current.x;
        if (!dragRef.current.open && delta < -42) {
          onOpenChange(true);
        }
        if (dragRef.current.open && delta > 42 && !pinned) {
          onOpenChange(false);
        }
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
      }}
    >
      <div className={styles.drawerDragEdge} aria-hidden="true" />
      <section className={styles.listScreen} data-no-pager-drag="true">
        <div className={styles.privateQuickContacts}>
          {friends.filter((friend) => !blockedUserIds.has(friend.id)).map((friend) => (
            <button className={styles.privateContact} key={friend.id} type="button" onClick={() => onOpenDialog(friend)}>
              <Avatar user={friend} />
              <span>{displayName(friend)}</span>
            </button>
          ))}
        </div>
        {dialogs.length === 0 && <p className={styles.empty}>Диалогов пока нет. Начните переписку с игроком выше.</p>}
        {dialogs.length > 0 && (
          <div className={styles.userList}>
            {dialogs.map((dialog) => (
              <div
                aria-label={`Открыть переписку с ${displayName(dialog.user)}`}
                className={styles.userRow}
                key={dialog.user.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenDialog(dialog.user)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenDialog(dialog.user);
                  }
                }}
              >
                <Avatar user={dialog.user} />
                <span>
                  <strong>
                    <UserActionName
                      user={dialog.user}
                      isBlocked={blockedUserIds.has(dialog.user.id)}
                      onOpenProfile={onOpenUserProfile}
                      onPrivateReply={onOpenDialog}
                      onToggleBlockedUser={onToggleBlockedUser}
                    />
                  </strong>
                  <small>{dialog.lastMessage.text}</small>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      <aside className={styles.friendsPane} data-no-pager-drag="true">
        <div className={styles.onlineHeader}>
          <span>Игроки</span>
          <PinToggleButton pinned={pinned} onToggle={() => onPinnedChange(!pinned)} />
        </div>
        <div className={styles.onlineList} data-no-pager-drag="true">
          {friends.map((friend) => (
            <div className={styles.onlineUser} key={friend.id}>
              <Avatar user={friend} />
              <UserActionName
                user={friend}
                isBlocked={blockedUserIds.has(friend.id)}
                onOpenProfile={onOpenUserProfile}
                onPrivateReply={onOpenDialog}
                onToggleBlockedUser={onToggleBlockedUser}
              />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function MainMessageList({
  currentUserId,
  publicMessages,
  privateMessages,
  blockedUserIds,
  onPrivateReply,
  onOpenUserProfile,
  onToggleBlockedUser
}: {
  currentUserId: number;
  publicMessages: PublicMessageDto[];
  privateMessages: PrivateMessageDto[];
  blockedUserIds: Set<number>;
  onPrivateReply: (user: PublicUserDto) => void;
  onOpenUserProfile: (user: PublicUserDto) => void;
  onToggleBlockedUser: (user: PublicUserDto) => void | Promise<void>;
}) {
  const items = useMemo(
    () =>
      [
        ...publicMessages.map((message) => ({ kind: "public" as const, createdAt: message.createdAt, message })),
        ...privateMessages.map((message) => ({ kind: "private" as const, createdAt: message.createdAt, message }))
      ].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
    [privateMessages, publicMessages]
  );
  const ref = useAutoScroll(items.length);

  return (
    <ChatMessageList emptyText={items.length === 0 ? "Сообщений пока нет." : undefined} scrollRef={ref}>
      {items.map((item) => {
        if (item.kind === "public") {
          const { message } = item;
          return (
            <ChatMessage
              author={
                <UserActionName
                  user={message.user}
                  isBlocked={blockedUserIds.has(message.user.id)}
                  canBlock={message.user.id !== currentUserId}
                  onOpenProfile={onOpenUserProfile}
                  onPrivateReply={onPrivateReply}
                  onToggleBlockedUser={onToggleBlockedUser}
                />
              }
              key={`public-${message.id}`}
              time={formatTime(message.createdAt)}
            >
              {message.text}
            </ChatMessage>
          );
        }

        const { message } = item;
        const isMine = message.sender.id === currentUserId;
        const other = isMine ? message.receiver : message.sender;

        return (
          <ChatMessage
            align={isMine ? "end" : "start"}
            author={
              <UserActionName
                user={message.sender}
                isBlocked={blockedUserIds.has(other.id)}
                canBlock={!isMine}
                onOpenProfile={onOpenUserProfile}
                onPrivateReply={onPrivateReply}
                onToggleBlockedUser={onToggleBlockedUser}
              />
            }
            badge="Лично"
            key={`private-${message.id}`}
            recipient={
              isMine ? (
                <>
                  для{" "}
                  <UserActionName
                    user={message.receiver}
                    isBlocked={blockedUserIds.has(message.receiver.id)}
                    onOpenProfile={onOpenUserProfile}
                    onPrivateReply={onPrivateReply}
                    onToggleBlockedUser={onToggleBlockedUser}
                  />
                </>
              ) : undefined
            }
            time={formatTime(message.createdAt)}
            tone="private"
          >
            {message.text}
          </ChatMessage>
        );
      })}
    </ChatMessageList>
  );
}

function GuildChatPanel({
  currentUserId,
  chatHeight,
  onChatHeightChange,
  activePanel,
  onActivePanelChange,
  messages,
  guildmates,
  token,
  drawerControls,
  blockedUserIds,
  onOpenUserProfile,
  onOpenPrivateDialog,
  onToggleBlockedUser,
  onSent
}: {
  currentUserId: number;
  chatHeight: number;
  onChatHeightChange: (value: number) => void;
  activePanel: ActivePanel;
  onActivePanelChange: (value: ActivePanel) => void;
  messages: PublicMessageDto[];
  guildmates: PublicUserDto[];
  token: string;
  drawerControls: DrawerControls;
  blockedUserIds: Set<number>;
  onOpenUserProfile: (user: PublicUserDto) => void;
  onOpenPrivateDialog: (user: PublicUserDto) => void;
  onToggleBlockedUser: (user: PublicUserDto) => void | Promise<void>;
  onSent: (message: PublicMessageDto) => void;
}) {
  const ref = useAutoScroll(messages.length);
  const [composerError, setComposerError] = useState("");

  return (
    <ChatPanel
      activeTab={activePanel}
      height={chatHeight}
      tabs={chatPanelTabs}
      onHeightChange={onChatHeightChange}
      onTabChange={onActivePanelChange}
      footer={
        <ChatComposer
          placeholder="Сообщение в гильд чат"
          error={composerError}
          onSend={async (text) => {
            setComposerError("");
            try {
              onSent(await sendGuildMessage(token, text));
              return true;
            } catch (sendError) {
              setComposerError(errorMessage(sendError, "Не удалось отправить сообщение"));
              return false;
            }
          }}
        />
      }
    >
        <DrawerSplitView
          open={drawerControls.open}
          pinned={drawerControls.pinned}
          title="Согильдийцы"
          onOpenChange={drawerControls.onOpenChange}
          onPinnedChange={drawerControls.onPinnedChange}
          side={
            <div className={styles.onlineList} data-no-pager-drag="true">
              {guildmates.map((user) => (
                <div className={styles.onlineUser} key={user.id}>
                  <Avatar user={user} />
                  <UserActionName
                    user={user}
                    isBlocked={blockedUserIds.has(user.id)}
                    canBlock={user.id !== currentUserId}
                    onOpenProfile={onOpenUserProfile}
                    onPrivateReply={onOpenPrivateDialog}
                    onToggleBlockedUser={onToggleBlockedUser}
                  />
                </div>
              ))}
            </div>
          }
          main={
            <ChatMessageList emptyText={messages.length === 0 ? "В гильдии пока нет сообщений." : undefined} scrollRef={ref}>
              {messages.map((message) => (
                <ChatMessage
                  author={
                    <UserActionName
                      user={message.user}
                      isBlocked={blockedUserIds.has(message.user.id)}
                      canBlock={message.user.id !== currentUserId}
                      onOpenProfile={onOpenUserProfile}
                      onPrivateReply={onOpenPrivateDialog}
                      onToggleBlockedUser={onToggleBlockedUser}
                    />
                  }
                  key={message.id}
                  time={formatTime(message.createdAt)}
                >
                  {message.text}
                </ChatMessage>
              ))}
            </ChatMessageList>
          }
        />
    </ChatPanel>
  );
}

function BattleLogPanel({
  chatHeight,
  onChatHeightChange,
  activePanel,
  onActivePanelChange,
  participants,
  drawerControls,
  onOpenUserProfile,
  onOpenPrivateDialog,
  blockedUserIds,
  onToggleBlockedUser
}: {
  chatHeight: number;
  onChatHeightChange: (value: number) => void;
  activePanel: ActivePanel;
  onActivePanelChange: (value: ActivePanel) => void;
  participants: PublicUserDto[];
  drawerControls: DrawerControls;
  onOpenUserProfile: (user: PublicUserDto) => void;
  onOpenPrivateDialog: (user: PublicUserDto) => void;
  blockedUserIds: Set<number>;
  onToggleBlockedUser: (user: PublicUserDto) => void | Promise<void>;
}) {
  const entries: LogPanelEntry[] = [
    { id: "round-1-alice", time: "01", actor: "Alice", text: "применяет защитную стойку.", tone: "success" },
    { id: "round-1-bob", time: "02", actor: "Bob", text: "наносит 12 урона тренировочной цели.", tone: "warning" },
    { id: "round-2-carol", time: "03", actor: "Carol", text: "усиливает группу на 2 хода.", tone: "success" },
    { id: "round-2-dmitry", time: "04", actor: "Dmitry", text: "блокирует входящую атаку.", tone: "neutral" },
    { id: "round-3-eva", time: "05", actor: "Eva", text: "завершает бой критическим ударом.", tone: "danger" }
  ];

  return (
    <ChatPanel
      activeTab={activePanel}
      height={chatHeight}
      tabs={chatPanelTabs}
      onHeightChange={onChatHeightChange}
      onTabChange={onActivePanelChange}
    >
        <DrawerSplitView
          open={drawerControls.open}
          pinned={drawerControls.pinned}
          title="Участники"
          onOpenChange={drawerControls.onOpenChange}
          onPinnedChange={drawerControls.onPinnedChange}
          side={
            participants.length > 0 ? (
              <div className={styles.onlineList} data-no-pager-drag="true">
                {participants.map((user) => (
                  <div className={styles.onlineUser} key={user.id}>
                    <Avatar user={user} />
                    <UserActionName
                      user={user}
                      isBlocked={blockedUserIds.has(user.id)}
                      onOpenProfile={onOpenUserProfile}
                      onPrivateReply={onOpenPrivateDialog}
                      onToggleBlockedUser={onToggleBlockedUser}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.drawerEmpty}>Вы не в поединке</p>
            )
          }
          main={<LogPanel entries={entries} />}
        />
    </ChatPanel>
  );
}

function PrivateMessageList({
  currentUserId,
  messages,
  blockedUserIds,
  onOpenUserProfile,
  onToggleBlockedUser
}: {
  currentUserId: number;
  messages: PrivateMessageDto[];
  blockedUserIds: Set<number>;
  onOpenUserProfile: (user: PublicUserDto) => void;
  onToggleBlockedUser: (user: PublicUserDto) => void | Promise<void>;
}) {
  const ref = useAutoScroll(messages.length);

  return (
    <ChatMessageList emptyText={messages.length === 0 ? "История переписки пуста." : undefined} scrollRef={ref}>
      {messages.map((message) => {
        const isMine = message.sender.id === currentUserId;
        const menuUser = isMine ? message.receiver : message.sender;
        return (
          <ChatMessage
            align={isMine ? "end" : "start"}
            author={
              <UserActionName
                user={menuUser}
                isBlocked={blockedUserIds.has(menuUser.id)}
                canBlock={!isMine}
                onOpenProfile={onOpenUserProfile}
                onToggleBlockedUser={onToggleBlockedUser}
              />
            }
            key={message.id}
            time={formatTime(message.createdAt)}
            tone="private"
          >
            {message.text}
          </ChatMessage>
        );
      })}
    </ChatMessageList>
  );
}

function UserActionName({
  user,
  isBlocked = false,
  canBlock = true,
  onOpenProfile,
  onPrivateReply,
  onToggleBlockedUser
}: {
  user: PublicUserDto;
  isBlocked?: boolean;
  canBlock?: boolean;
  onOpenProfile?: (user: PublicUserDto) => void;
  onPrivateReply?: (user: PublicUserDto) => void;
  onToggleBlockedUser?: (user: PublicUserDto) => void | Promise<void>;
}) {
  const adminControls = useContext(AdminControlsContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 8, top: 8 });
  const timerRef = useRef<number | null>(null);
  const menuRef = useRef<HTMLSpanElement | null>(null);
  const portalMenuRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target) &&
        !portalMenuRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [menuOpen]);

  function openMenu() {
    const rect = menuRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({
        left: Math.min(Math.max(8, rect.left), window.innerWidth - 126),
        top: Math.min(rect.bottom + 6, window.innerHeight - 96)
      });
    }
    setMenuOpen(true);
  }

  function clearTimer() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  const canModerate = Boolean(adminControls?.isAdmin && user.id !== adminControls.currentUserId);
  const moderationActions: Array<{ action: AdminModerationActionDto; icon: string; title: string; className?: string }> = [
    { action: "block", icon: "⛔", title: "Заблокировать доступ к чату", className: styles.userMenuAdminBlock },
    { action: "mute", icon: "🔇", title: "Выдать молчанку на 1 час", className: styles.userMenuAdminMute },
    { action: "jail", icon: "⛓", title: "Отправить в тюрьму на 1 сутки", className: styles.userMenuAdminJail },
    { action: "clear", icon: "🔓", title: "Снять ручные санкции", className: styles.userMenuAdminClear }
  ];

  function runModerationAction(action: AdminModerationActionDto, title: string) {
    if (!adminControls || !window.confirm(`${title}: ${displayName(user)}?`)) {
      return;
    }

    setMenuOpen(false);
    void adminControls.onModerate(user, action);
  }

  return (
    <span className={styles.userAction} ref={menuRef}>
      <button
        className={styles.userNameButton}
        type="button"
        onContextMenu={(event) => {
          event.preventDefault();
          openMenu();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          clearTimer();
          timerRef.current = window.setTimeout(openMenu, 450);
        }}
        onPointerLeave={(event) => {
          event.stopPropagation();
          clearTimer();
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          clearTimer();
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (menuOpen) {
            setMenuOpen(false);
          } else {
            openMenu();
          }
        }}
      >
        {displayName(user)}
      </button>
      {menuOpen &&
        createPortal(
        <span
          className={styles.userMenu}
          data-no-pager-drag="true"
          ref={portalMenuRef}
          style={{ left: menuPosition.left, position: "fixed", top: menuPosition.top }}
        >
          <button
            aria-label="Profile"
            className={styles.userMenuIcon}
            disabled={!onOpenProfile}
            title="Profile"
            type="button"
            onClick={() => {
              if (!onOpenProfile) {
                return;
              }
              setMenuOpen(false);
              onOpenProfile(user);
            }}
          >
            <span aria-hidden="true">👤</span>
          </button>
          <button
            aria-label="Private"
            className={styles.userMenuIcon}
            disabled={!onPrivateReply || !canBlock}
            title="Private"
            type="button"
            onClick={() => {
              if (!onPrivateReply || !canBlock) {
                return;
              }
              setMenuOpen(false);
              onPrivateReply(user);
            }}
          >
            <span aria-hidden="true">✉</span>
          </button>
          <button
            aria-label="Вызвать на дуэль"
            className={`${styles.userMenuIcon} ${styles.userMenuDuel}`}
            disabled
            title="Вызвать на дуэль — будет доступно с боевым модулем"
            type="button"
          >
            <span aria-hidden="true">⚔</span>
          </button>
          <button
            aria-label="Предложить обмен"
            className={`${styles.userMenuIcon} ${styles.userMenuExchange}`}
            disabled
            title="Предложить обмен — будет доступно с модулем обмена"
            type="button"
          >
            <span aria-hidden="true">⇄</span>
          </button>
          <button
            aria-label={isBlocked ? "Unignore" : "Ignore"}
            className={`${styles.userMenuIcon} ${styles.userMenuIgnore}`}
            disabled={!canBlock || !onToggleBlockedUser}
            title={isBlocked ? "Unignore" : "Ignore"}
            type="button"
            onClick={() => {
              if (!canBlock || !onToggleBlockedUser) {
                return;
              }
              setMenuOpen(false);
              void onToggleBlockedUser(user);
            }}
          >
            <span aria-hidden="true">⊘</span>
          </button>
          {canModerate &&
            moderationActions.map((action) => (
              <button
                aria-label={action.title}
                className={`${styles.userMenuIcon} ${action.className ?? ""}`}
                key={action.action}
                title={action.title}
                type="button"
                onClick={() => runModerationAction(action.action, action.title)}
              >
                <span aria-hidden="true">{action.icon}</span>
              </button>
            ))}
        </span>,
        document.body
        )}
    </span>
  );
}

function Profile({ user, onBack }: { user: CurrentUserDto; onBack: () => void }) {
  return (
    <section className={styles.profile}>
      <button className={styles.profileBack} type="button" onClick={onBack}>
        Назад
      </button>
      <Avatar user={user} />
      <h2>{displayName(user)}</h2>
      <p>{user.username ? `@${user.username}` : "Без username"}</p>
      <dl>
        <div>
          <dt>Telegram ID</dt>
          <dd>{user.telegramId}</dd>
        </div>
        <div>
          <dt>Роль</dt>
          <dd>{user.role}</dd>
        </div>
        <div>
          <dt>Создан</dt>
          <dd>{formatDate(user.createdAt)}</dd>
        </div>
      </dl>
      {user.role === "ADMIN" && (
        <section className={styles.adminGuide}>
          <h3>Команды администратора</h3>
          <p>В меню у ника: ⛔ блокировка доступа к чату, 🔇 молчанка на 1 час, ⛓ тюрьма на 1 сутки, 🔓 снять все ручные санкции.</p>
          <p>Админские иконки видны только вам.</p>
        </section>
      )}
    </section>
  );
}

function UserProfile({
  user,
  isBlocked = false,
  canBlock = true,
  onBack,
  onToggleBlockedUser
}: {
  user: PublicUserDto | CurrentUserDto;
  isBlocked?: boolean;
  canBlock?: boolean;
  onBack: () => void;
  onToggleBlockedUser?: (user: PublicUserDto) => void | Promise<void>;
}) {
  return (
    <section className={styles.profile}>
      <button className={styles.profileBack} type="button" onClick={onBack}>
        Назад
      </button>
      <Avatar user={user} />
      <h2>{displayName(user)}</h2>
      <p>{user.username ? `@${user.username}` : "Без username"}</p>
      <dl>
        {"telegramId" in user && (
          <div>
            <dt>Telegram ID</dt>
            <dd>{user.telegramId}</dd>
          </div>
        )}
        <div>
          <dt>Статус</dt>
          <dd>Онлайн</dd>
        </div>
      </dl>
      {canBlock && onToggleBlockedUser && (
        <button
          className={styles.profileBlock}
          type="button"
          onClick={() => {
            void onToggleBlockedUser(user);
          }}
        >
          {isBlocked ? "Разблокировать" : "Заблокировать"}
        </button>
      )}
    </section>
  );
}

function OnlineSplitView({
  currentUserId,
  users,
  open,
  pinned,
  chat,
  onOpenChange,
  onPinnedChange,
  onOpenUserProfile,
  onPrivateReply,
  blockedUserIds,
  onToggleBlockedUser
}: {
  currentUserId: number;
  users: PublicUserDto[];
  open: boolean;
  pinned: boolean;
  chat: React.ReactNode;
  onOpenChange: (value: boolean) => void;
  onPinnedChange: (value: boolean) => void;
  onOpenUserProfile: (user: PublicUserDto) => void;
  onPrivateReply: (user: PublicUserDto) => void;
  blockedUserIds: Set<number>;
  onToggleBlockedUser: (user: PublicUserDto) => void | Promise<void>;
}) {
  const dragRef = useRef<{ x: number; open: boolean } | null>(null);
  const visible = open || pinned;
  const onlineUsers = users.filter((user) => user.id !== currentUserId);

  return (
    <div
      className={`${styles.onlineSplit} ${visible ? styles.onlineSplitOpen : ""}`}
      onPointerDown={(event) => {
        if (shouldIgnoreDrawerDrag(event.target)) {
          return;
        }
        dragRef.current = { x: event.clientX, open: visible };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) {
          return;
        }
        const delta = event.clientX - dragRef.current.x;
        if (!dragRef.current.open && delta < -42) {
          onOpenChange(true);
        }
        if (dragRef.current.open && delta > 42 && !pinned) {
          onOpenChange(false);
        }
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
      }}
    >
      <div className={styles.drawerDragEdge} aria-hidden="true" />
      <div className={styles.onlineChatPane}>{chat}</div>
      <aside className={styles.onlinePane} data-no-pager-drag="true">
        <div className={styles.onlineHeader}>
          <span>Онлайн</span>
          <PinToggleButton pinned={pinned} onToggle={() => onPinnedChange(!pinned)} />
        </div>
        <div className={styles.onlineList} data-no-pager-drag="true">
          {onlineUsers.map((user) => (
            <div className={styles.onlineUser} key={user.id}>
              <Avatar user={user} />
              <UserActionName
                user={user}
                isBlocked={blockedUserIds.has(user.id)}
                onOpenProfile={onOpenUserProfile}
                onPrivateReply={onPrivateReply}
                onToggleBlockedUser={onToggleBlockedUser}
              />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function DrawerSplitView({
  open,
  pinned,
  title,
  main,
  side,
  onOpenChange,
  onPinnedChange
}: {
  open: boolean;
  pinned: boolean;
  title: string;
  main: React.ReactNode;
  side: React.ReactNode;
  onOpenChange: (value: boolean) => void;
  onPinnedChange: (value: boolean) => void;
}) {
  const dragRef = useRef<{ x: number; open: boolean } | null>(null);
  const visible = open || pinned;

  return (
    <div
      className={`${styles.onlineSplit} ${visible ? styles.onlineSplitOpen : ""}`}
      onPointerDown={(event) => {
        if (shouldIgnoreDrawerDrag(event.target)) {
          return;
        }
        dragRef.current = { x: event.clientX, open: visible };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragRef.current) {
          return;
        }
        const delta = event.clientX - dragRef.current.x;
        if (!dragRef.current.open && delta < -42) {
          onOpenChange(true);
        }
        if (dragRef.current.open && delta > 42 && !pinned) {
          onOpenChange(false);
        }
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        dragRef.current = null;
      }}
    >
      <div className={styles.drawerDragEdge} aria-hidden="true" />
      <div className={styles.onlineChatPane}>{main}</div>
      <aside className={styles.onlinePane} data-no-pager-drag="true">
        <div className={styles.onlineHeader}>
          <span>{title}</span>
          <PinToggleButton pinned={pinned} onToggle={() => onPinnedChange(!pinned)} />
        </div>
        {side}
      </aside>
    </div>
  );
}

function PinToggleButton({ pinned, onToggle }: { pinned: boolean; onToggle: () => void }) {
  const label = pinned ? "Открепить панель" : "Закрепить панель";

  return (
    <button
      aria-label={label}
      aria-pressed={pinned}
      className={styles.pinButton}
      title={label}
      type="button"
      onClick={onToggle}
    >
      <span aria-hidden="true">📌</span>
    </button>
  );
}

function Avatar({ user }: { user?: PublicUserDto | CurrentUserDto | null }) {
  const name = user ? displayName(user) : "?";
  const coalition = user?.coalition ?? "NONE";
  const className = `${styles.avatar} ${styles[`avatarCoalition${coalition}`]}`;
  if (user?.avatarUrl) {
    return <img className={className} src={user.avatarUrl} alt={name} />;
  }

  return <span className={className}>{name.slice(0, 1).toUpperCase()}</span>;
}

function CenteredState({ text }: { text: string }) {
  return (
    <div className={styles.centered}>
      <p>{text}</p>
    </div>
  );
}

function useAutoScroll(dependency: number) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [dependency]);

  return ref;
}

function useSwipePager() {
  const ref = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    dragging: boolean;
  } | null>(null);

  return {
    ref,
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      if (shouldIgnorePagerDrag(event.target)) {
        return;
      }

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: element.scrollLeft,
        dragging: false
      };
      element.dataset.dragging = "false";
      element.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragRef.current.startX;
      const deltaY = event.clientY - dragRef.current.startY;

      if (!dragRef.current.dragging && Math.abs(deltaX) < 8) {
        return;
      }

      if (!dragRef.current.dragging && Math.abs(deltaY) > Math.abs(deltaX)) {
        releasePagerPointer(element, event.pointerId);
        delete element.dataset.dragging;
        dragRef.current = null;
        return;
      }

      dragRef.current.dragging = true;
      element.dataset.dragging = "true";
      element.scrollLeft = dragRef.current.scrollLeft - deltaX;
      event.preventDefault();
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
        return;
      }

      const wasDragging = dragRef.current.dragging;
      releasePagerPointer(element, event.pointerId);
      delete element.dataset.dragging;
      dragRef.current = null;

      if (wasDragging) {
        snapPager(element);
      }
    },
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
        return;
      }

      releasePagerPointer(element, event.pointerId);
      delete element.dataset.dragging;
      dragRef.current = null;
    }
  };
}

function shouldIgnorePagerDrag(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("button, input, textarea, select, a, [role='button'], [data-no-pager-drag='true']"));
}

function shouldIgnoreDrawerDrag(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("button, input, textarea, select, a, [role='button'], [data-no-pager-drag='true']"));
}

function releasePagerPointer(element: HTMLElement, pointerId: number) {
  if (element.hasPointerCapture(pointerId)) {
    element.releasePointerCapture(pointerId);
  }
}

function snapPager(element: HTMLElement) {
  const pageWidth = element.clientWidth || window.innerWidth;
  const page = Math.round(element.scrollLeft / pageWidth);
  element.scrollTo({ left: page * pageWidth, behavior: "smooth" });
}

function appendUnique<T extends { id: number }>(items: T[], next: T) {
  if (items.some((item) => item.id === next.id)) {
    return items;
  }
  return [...items, next];
}

function upsertDialog(dialogs: DialogDto[], message: PrivateMessageDto, currentUserId?: number): DialogDto[] {
  if (!currentUserId) {
    return dialogs;
  }

  const other = message.sender.id === currentUserId ? message.receiver : message.sender;
  const nextDialog = { user: other, lastMessage: message };
  return [nextDialog, ...dialogs.filter((dialog) => dialog.user.id !== other.id)];
}

function isMessageWithUser(message: PrivateMessageDto, currentUserId: number | undefined, otherUserId: number) {
  if (!currentUserId) {
    return false;
  }

  return (
    (message.sender.id === currentUserId && message.receiver.id === otherUserId) ||
    (message.receiver.id === currentUserId && message.sender.id === otherUserId)
  );
}

function hasBlockedParticipant(message: PrivateMessageDto, blockedUserIds: Set<number>) {
  return blockedUserIds.has(message.sender.id) || blockedUserIds.has(message.receiver.id);
}

function displayName(user: PublicUserDto | CurrentUserDto) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return fullName || (user.username ? `@${user.username}` : `User ${user.id}`);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function parsePrivateCommand(text: string, users: PublicUserDto[]) {
  const match = text.match(/^\/r\s+(\S+)\s+([\s\S]+)$/i);
  if (!match) {
    return null;
  }

  const nick = normalizeNick(match[1]);
  const messageText = match[2].trim();
  const user = users.find((candidate) => userMatchesNick(candidate, nick));

  return {
    nick: match[1],
    text: messageText,
    user
  };
}

function isPrivateCommandStart(text: string) {
  return /^\/r\b/i.test(text.trim());
}

function userMatchesNick(user: PublicUserDto, nick: string) {
  const names = [
    user.username,
    `id${user.id}`,
    user.firstName,
    [user.firstName, user.lastName].filter(Boolean).join(" ")
  ];

  return names.some((name) => name && normalizeNick(name) === nick);
}

function normalizeNick(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function readChatHeight() {
  const saved = Number(localStorage.getItem("telegram-mini-chat-height"));
  if (saved >= 30 && saved <= 90) {
    return saved;
  }

  return 40;
}

function setPersistedChatHeight(setter: React.Dispatch<React.SetStateAction<number>>) {
  return (value: number) => {
    const nextValue = Math.min(90, Math.max(30, value));
    localStorage.setItem("telegram-mini-chat-height", String(nextValue));
    setter(nextValue);
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}
