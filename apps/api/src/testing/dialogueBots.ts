export const DIALOGUE_BOT_MARKER = "[тест-боты]";

export type DialogueBotKey = "scout" | "healer";
export type DialogueChannel = "public" | "guild" | "private";

export type DialogueBotProfile = {
  key: DialogueBotKey;
  telegramId: bigint;
  username: string;
  firstName: string;
  lastName: string;
};

export type DialogueStep = {
  channel: DialogueChannel;
  sender: DialogueBotKey;
  receiver?: DialogueBotKey;
  text: string;
};

// These identities are reserved for local and test environments. Do not use
// real Telegram IDs here: the runner signs local JWTs for these users.
export const dialogueBots: readonly DialogueBotProfile[] = [
  {
    key: "scout",
    telegramId: 9100000001n,
    username: "test_scout_bot",
    firstName: "Тестовый",
    lastName: "Разведчик"
  },
  {
    key: "healer",
    telegramId: 9100000002n,
    username: "test_healer_bot",
    firstName: "Тестовый",
    lastName: "Лекарь"
  }
];

export const playerDialogue: readonly DialogueStep[] = [
  {
    channel: "public",
    sender: "scout",
    text: "В дозоре тихо. Кто идёт в гильдейский зал?"
  },
  {
    channel: "public",
    sender: "healer",
    text: "Иду. Заодно проверю общую ленту и уведомления."
  },
  {
    channel: "guild",
    sender: "scout",
    text: "Беру северные ворота. Нужны припасы к следующему обходу."
  },
  {
    channel: "guild",
    sender: "healer",
    text: "Принято. Соберу припасы и отмечусь в журнале гильдии."
  },
  {
    channel: "private",
    sender: "scout",
    receiver: "healer",
    text: "После дозора проверь журнал заданий, пожалуйста."
  },
  {
    channel: "private",
    sender: "healer",
    receiver: "scout",
    text: "Принято. Напишу сразу после проверки."
  }
];

export function formatDialogueText(step: DialogueStep, runId: string) {
  return `${DIALOGUE_BOT_MARKER} ${step.text} · прогон ${runId}`;
}
