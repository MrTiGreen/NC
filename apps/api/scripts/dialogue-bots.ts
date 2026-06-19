import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import type { PrivateMessageDto, PublicMessageDto } from "@telegram-mini-chat/shared";
import { io, type Socket } from "socket.io-client";
import { config } from "../src/config.js";
import { prisma } from "../src/prisma.js";
import {
  dialogueBots,
  formatDialogueText,
  playerDialogue,
  type DialogueBotKey,
  type DialogueChannel
} from "../src/testing/dialogueBots.js";
import { signAuthToken } from "../src/utils/jwt.js";

type RunOptions = {
  apiUrl: string;
  cleanup: boolean;
};

type ProvisionedBot = {
  key: DialogueBotKey;
  user: User;
  token: string;
};

async function main() {
  const options = readOptions(process.argv.slice(2));
  rejectProductionRun();

  let sockets: Socket[] = [];

  try {
    const bots = await provisionBots();
    const botByKey = new Map(bots.map((bot) => [bot.key, bot]));
    await resetBotState(bots.map((bot) => bot.user.id));

    sockets = await Promise.all(bots.map((bot) => connectSocket(options.apiUrl, bot.token)));
    const socketByKey = new Map(bots.map((bot, index) => [bot.key, sockets[index]]));
    const runId = randomUUID().slice(0, 8);

    await verifyAuthenticatedUsers(options.apiUrl, bots);

    for (const step of playerDialogue) {
      const sender = requireBot(botByKey, step.sender);
      const receiver = step.receiver ? requireBot(botByKey, step.receiver) : undefined;
      const receivingBotKey = step.channel === "private" ? receiver?.key : otherBotKey(step.sender);
      if (!receivingBotKey) {
        throw new Error("Private dialogue step has no receiving bot");
      }
      const receivingSocket = socketByKey.get(receivingBotKey);
      assert.ok(receivingSocket, `Missing receiving socket for ${step.channel} message`);

      const text = formatDialogueText(step, runId);
      const expectedEvent = eventForChannel(step.channel);
      const delivery = waitForEvent(receivingSocket, expectedEvent, (message: unknown) => hasText(message, text));

      const created = await sendStep(options.apiUrl, sender, receiver, step.channel, text);
      assert.equal(created.text, text);
      const delivered = await delivery;
      assert.equal(readMessageText(delivered), text);
    }

    await verifyHistories(options.apiUrl, bots, runId);
    console.log(
      `Dialogue bots completed: 2 players, ${playerDialogue.length} messages, public/guild/private REST and Socket.IO delivery verified.`
    );

    if (options.cleanup) {
      await resetBotState(bots.map((bot) => bot.user.id));
      console.log("Test dialogue was removed.");
    } else {
      console.log("The fresh test dialogue remains available in the UI. Run bots:dialogue:cleanup to remove it after a check.");
    }
  } finally {
    for (const socket of sockets) {
      socket.close();
    }
    await prisma.$disconnect();
  }
}

function readOptions(args: string[]): RunOptions {
  let apiUrl = `http://localhost:${config.PORT}`;
  let cleanup = false;

  for (const arg of args) {
    if (arg === "--cleanup" || arg === "cleanup") {
      cleanup = true;
      continue;
    }

    if (arg.startsWith("--api-url=") || arg.startsWith("api-url=")) {
      apiUrl = arg.slice(arg.indexOf("=") + 1);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}. Supported arguments: api-url=<url>, cleanup`);
  }

  const normalizedApiUrl = apiUrl.replace(/\/$/, "");
  if (!/^https?:\/\/.+/.test(normalizedApiUrl)) {
    throw new Error("--api-url must be an absolute HTTP(S) URL");
  }

  return { apiUrl: normalizedApiUrl, cleanup };
}

function rejectProductionRun() {
  if (config.NODE_ENV === "production") {
    throw new Error("Dialogue bots are disabled in production.");
  }
}

async function provisionBots(): Promise<ProvisionedBot[]> {
  return Promise.all(
    dialogueBots.map(async (bot) => {
      const user = await prisma.user.upsert({
        where: { telegramId: bot.telegramId },
        create: {
          telegramId: bot.telegramId,
          username: bot.username,
          firstName: bot.firstName,
          lastName: bot.lastName,
          coalition: bot.key === "scout" ? "GOLD_LIGHT" : "CRIMSON"
        },
        update: {
          username: bot.username,
          firstName: bot.firstName,
          lastName: bot.lastName,
          coalition: bot.key === "scout" ? "GOLD_LIGHT" : "CRIMSON",
          publicMutedUntil: null,
          jailedUntil: null
        }
      });

      return {
        key: bot.key,
        user,
        token: signAuthToken(
          { sub: String(user.id), telegramId: user.telegramId.toString() },
          config.JWT_SECRET
        )
      };
    })
  );
}

async function resetBotState(botUserIds: number[]) {
  await prisma.$transaction([
    prisma.publicMessage.deleteMany({ where: { userId: { in: botUserIds } } }),
    prisma.guildMessage.deleteMany({ where: { userId: { in: botUserIds } } }),
    prisma.privateMessage.deleteMany({
      where: { OR: [{ senderId: { in: botUserIds } }, { receiverId: { in: botUserIds } }] }
    }),
    prisma.chatModerationEvent.deleteMany({ where: { userId: { in: botUserIds } } }),
    prisma.userBlock.deleteMany({
      where: { OR: [{ blockerId: { in: botUserIds } }, { blockedId: { in: botUserIds } }] }
    }),
    prisma.user.updateMany({
      where: { id: { in: botUserIds } },
      data: { publicMutedUntil: null, jailedUntil: null, chatBlockedAt: null }
    })
  ]);
}

async function connectSocket(apiUrl: string, token: string) {
  const socket = io(apiUrl, { auth: { token }, transports: ["websocket"] });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Socket connection timed out for ${apiUrl}`)), 5_000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      reject(new Error(`Socket authentication failed: ${error.message}`));
    });
  });

  return socket;
}

async function verifyAuthenticatedUsers(apiUrl: string, bots: ProvisionedBot[]) {
  await Promise.all(
    bots.map(async (bot) => {
      const currentUser = await request<{ id: number }>(apiUrl, bot.token, "/api/me");
      assert.equal(currentUser.id, bot.user.id);
    })
  );
}

async function sendStep(
  apiUrl: string,
  sender: ProvisionedBot,
  receiver: ProvisionedBot | undefined,
  channel: DialogueChannel,
  text: string
) {
  if (channel === "private") {
    assert.ok(receiver, "Private dialogue step has no receiver");
    return request<PrivateMessageDto>(apiUrl, sender.token, "/api/private/messages", {
      method: "POST",
      body: JSON.stringify({ receiverId: receiver.user.id, text })
    });
  }

  return request<PublicMessageDto>(apiUrl, sender.token, `/api/${channel}/messages`, {
    method: "POST",
    body: JSON.stringify({ text })
  });
}

async function verifyHistories(apiUrl: string, bots: ProvisionedBot[], runId: string) {
  const expectedPublic = playerDialogue
    .filter((step) => step.channel === "public")
    .map((step) => formatDialogueText(step, runId));
  const expectedGuild = playerDialogue
    .filter((step) => step.channel === "guild")
    .map((step) => formatDialogueText(step, runId));
  const expectedPrivate = playerDialogue
    .filter((step) => step.channel === "private")
    .map((step) => formatDialogueText(step, runId));

  const [scout, healer] = bots;
  const [publicMessages, guildMessages, scoutPrivateMessages, healerPrivateMessages] = await Promise.all([
    request<PublicMessageDto[]>(apiUrl, scout.token, "/api/public/messages?limit=100"),
    request<PublicMessageDto[]>(apiUrl, healer.token, "/api/guild/messages?limit=100"),
    request<PrivateMessageDto[]>(apiUrl, scout.token, `/api/private/messages/${healer.user.id}?limit=100`),
    request<PrivateMessageDto[]>(apiUrl, healer.token, `/api/private/messages/${scout.user.id}?limit=100`)
  ]);

  assertHistoryContains(publicMessages, expectedPublic, "public history");
  assertHistoryContains(guildMessages, expectedGuild, "guild history");
  assertHistoryContains(scoutPrivateMessages, expectedPrivate, "scout private history");
  assertHistoryContains(healerPrivateMessages, expectedPrivate, "healer private history");
}

function assertHistoryContains(messages: Array<PublicMessageDto | PrivateMessageDto>, expectedTexts: string[], label: string) {
  const actualTexts = new Set(messages.map((message) => message.text));
  for (const text of expectedTexts) {
    assert.ok(actualTexts.has(text), `${label} is missing test dialogue message: ${text}`);
  }
}

function waitForEvent(socket: Socket, event: string, predicate: (payload: unknown) => boolean) {
  return new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out while waiting for ${event}`));
    }, 5_000);

    const handler = (payload: unknown) => {
      if (!predicate(payload)) {
        return;
      }

      clearTimeout(timeout);
      socket.off(event, handler);
      resolve(payload);
    };

    socket.on(event, handler);
  });
}

function eventForChannel(channel: DialogueChannel) {
  if (channel === "private") {
    return "private:message";
  }

  return `${channel}:message`;
}

function hasText(message: unknown, text: string) {
  return readMessageText(message) === text;
}

function readMessageText(message: unknown) {
  return typeof message === "object" && message !== null && "text" in message && typeof message.text === "string"
    ? message.text
    : "";
}

function requireBot(botByKey: Map<DialogueBotKey, ProvisionedBot>, key: DialogueBotKey) {
  const bot = botByKey.get(key);
  assert.ok(bot, `Unknown dialogue bot: ${key}`);
  return bot;
}

function otherBotKey(key: DialogueBotKey): DialogueBotKey {
  return key === "scout" ? "healer" : "scout";
}

async function request<T>(apiUrl: string, token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(`${init.method ?? "GET"} ${path} failed (${response.status}): ${payload.error ?? response.statusText}`);
  }

  return response.json() as Promise<T>;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
