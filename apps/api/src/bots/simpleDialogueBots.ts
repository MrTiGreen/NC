import { Coalition } from "@prisma/client";
import type { PrivateMessageDto, PublicMessageDto } from "@telegram-mini-chat/shared";
import { prisma } from "../prisma.js";
import { serializeGuildMessage, serializePrivateMessage, serializePublicMessage } from "../utils/serialize.js";

export type BotChatChannel = "public" | "guild" | "private";

const botProfiles = [
  {
    telegramId: 9100000001n,
    username: "test_scout_bot",
    firstName: "Тестовый",
    lastName: "Разведчик",
    coalition: Coalition.GOLD_LIGHT
  },
  {
    telegramId: 9100000002n,
    username: "test_healer_bot",
    firstName: "Тестовый",
    lastName: "Лекарь",
    coalition: Coalition.CRIMSON
  }
] as const;

export function getSimpleBotReply(channel: BotChatChannel, text: string) {
  const normalized = text.toLowerCase();
  const isGreeting = /привет|здравствуй|добрый/.test(normalized);
  const isQuestion = /\?|кто|где|когда|как/.test(normalized);
  const response = isGreeting ? "Привет! Я на связи." : isQuestion ? "Понял вопрос. Проверю и отвечу позже." : "Принято. Спасибо за сообщение.";

  if (channel === "private") {
    return `Лично: ${response}`;
  }

  if (channel === "guild") {
    return `Гильдия: ${response}`;
  }

  return response;
}

export async function createSimpleBotReply(input: {
  channel: BotChatChannel;
  senderId: number;
  receiverId?: number;
  text: string;
}): Promise<PublicMessageDto | PrivateMessageDto | null> {
  const bots = await ensureSimpleDialogueBots();
  if (bots.some((bot) => bot.id === input.senderId)) {
    return null;
  }

  const replyingBot = input.channel === "private"
    ? bots.find((bot) => bot.id === input.receiverId)
    : bots[0];
  if (!replyingBot) {
    return null;
  }

  const text = getSimpleBotReply(input.channel, input.text);
  if (input.channel === "private") {
    const message = await prisma.privateMessage.create({
      data: { senderId: replyingBot.id, receiverId: input.senderId, text },
      include: { sender: true, receiver: true }
    });
    return serializePrivateMessage(message);
  }

  if (input.channel === "guild") {
    const message = await prisma.guildMessage.create({
      data: { userId: replyingBot.id, text },
      include: { user: true }
    });
    return serializeGuildMessage(message);
  }

  const message = await prisma.publicMessage.create({
    data: { userId: replyingBot.id, text },
    include: { user: true }
  });
  return serializePublicMessage(message);
}

async function ensureSimpleDialogueBots() {
  return Promise.all(
    botProfiles.map((bot) =>
      prisma.user.upsert({
        where: { telegramId: bot.telegramId },
        create: bot,
        update: {
          username: bot.username,
          firstName: bot.firstName,
          lastName: bot.lastName,
          coalition: bot.coalition
        }
      })
    )
  );
}
