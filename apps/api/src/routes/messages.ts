import type { Server } from "socket.io";
import { ChatModerationAction, ChatModerationSeverity } from "@prisma/client";
import { type Response, Router } from "express";
import { MAX_PAGE_LIMIT, privateMessageRequestSchema, publicMessageRequestSchema } from "@telegram-mini-chat/shared";
import { config } from "../config.js";
import { createSimpleBotReply } from "../bots/simpleDialogueBots.js";
import {
  buildActiveJailNotice,
  buildActiveMuteNotice,
  inspectPublicMessage,
  resolveModerationOutcome,
  type ModerationOutcome
} from "../moderation/chatModeration.js";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../types.js";
import { serializeDialog, serializeGuildMessage, serializePrivateMessage, serializePublicMessage } from "../utils/serialize.js";

export const messagesRouter = Router();

messagesRouter.get("/public/messages", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const { limit, before } = getPagination(req.query);
  const blockedUserIds = await getBlockedByMeUserIds(authUser.id);
  const messages = await prisma.publicMessage.findMany({
    where: {
      ...(before ? { createdAt: { lt: before } } : {}),
      ...(blockedUserIds.length > 0 ? { userId: { notIn: blockedUserIds } } : {})
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  res.json(messages.reverse().map(serializePublicMessage));
});

messagesRouter.post("/public/messages", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const body = publicMessageRequestSchema.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: "Invalid message", details: body.error.flatten() });
    return;
  }

  if (await rejectChatBlockedUser(res, authUser.id)) {
    return;
  }

  if (await rejectModeratedMessage(res, authUser.id, body.data.text)) {
    return;
  }

  const message = await prisma.publicMessage.create({
    data: {
      userId: authUser.id,
      text: body.data.text
    },
    include: { user: true }
  });
  const dto = serializePublicMessage(message);
  getIo(req.app)?.to("public").emit("public:message", dto);
  res.status(201).json(dto);
  void emitSimpleBotReply(req.app, { channel: "public", senderId: authUser.id, text: body.data.text });
});

messagesRouter.get("/guild/messages", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const { limit, before } = getPagination(req.query);
  const blockedUserIds = await getBlockedByMeUserIds(authUser.id);
  const messages = await prisma.guildMessage.findMany({
    where: {
      ...(before ? { createdAt: { lt: before } } : {}),
      ...(blockedUserIds.length > 0 ? { userId: { notIn: blockedUserIds } } : {})
    },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  res.json(messages.reverse().map(serializeGuildMessage));
});

messagesRouter.post("/guild/messages", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const body = publicMessageRequestSchema.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: "Invalid guild message", details: body.error.flatten() });
    return;
  }

  if (await rejectChatBlockedUser(res, authUser.id)) {
    return;
  }

  if (await rejectModeratedMessage(res, authUser.id, body.data.text)) {
    return;
  }

  const message = await prisma.guildMessage.create({
    data: {
      userId: authUser.id,
      text: body.data.text
    },
    include: { user: true }
  });
  const dto = serializeGuildMessage(message);
  getIo(req.app)?.to("guild").emit("guild:message", dto);
  res.status(201).json(dto);
  void emitSimpleBotReply(req.app, { channel: "guild", senderId: authUser.id, text: body.data.text });
});

messagesRouter.get("/private/dialogs", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const blockedPeerIds = await getPrivateBlockedPeerIds(authUser.id);
  const messages = await prisma.privateMessage.findMany({
    where: {
      AND: [
        { OR: [{ senderId: authUser.id }, { receiverId: authUser.id }] },
        ...(blockedPeerIds.length > 0
          ? [{ senderId: { notIn: blockedPeerIds } }, { receiverId: { notIn: blockedPeerIds } }]
          : [])
      ]
    },
    include: { sender: true, receiver: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  const dialogs = new Map<number, ReturnType<typeof serializeDialog>>();
  for (const message of messages) {
    const other = message.senderId === authUser.id ? message.receiver : message.sender;
    if (!dialogs.has(other.id)) {
      dialogs.set(other.id, serializeDialog(other, message));
    }
  }

  res.json([...dialogs.values()]);
});

messagesRouter.get("/private/messages", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const { limit, before } = getPagination(req.query);
  const blockedPeerIds = await getPrivateBlockedPeerIds(authUser.id);

  const messages = await prisma.privateMessage.findMany({
    where: {
      AND: [
        before ? { createdAt: { lt: before } } : {},
        {
          OR: [{ senderId: authUser.id }, { receiverId: authUser.id }]
        },
        ...(blockedPeerIds.length > 0
          ? [{ senderId: { notIn: blockedPeerIds } }, { receiverId: { notIn: blockedPeerIds } }]
          : [])
      ]
    },
    include: { sender: true, receiver: true },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  res.json(messages.reverse().map(serializePrivateMessage));
});

messagesRouter.get("/private/messages/:userId", async (req, res) => {
  const { authUser } = req as unknown as AuthenticatedRequest;
  const otherUserId = Number(req.params.userId);
  const { limit, before } = getPagination(req.query);

  if (!Number.isInteger(otherUserId) || otherUserId <= 0) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!otherUser || otherUser.id === authUser.id) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (await isPrivateBlocked(authUser.id, otherUserId)) {
    res.status(403).json({ error: "Private messages are blocked between these users" });
    return;
  }

  const messages = await prisma.privateMessage.findMany({
    where: {
      AND: [
        before ? { createdAt: { lt: before } } : {},
        {
          OR: [
            { senderId: authUser.id, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: authUser.id }
          ]
        }
      ]
    },
    include: { sender: true, receiver: true },
    orderBy: { createdAt: "desc" },
    take: limit
  });

  await prisma.privateMessage.updateMany({
    where: {
      senderId: otherUserId,
      receiverId: authUser.id,
      isRead: false
    },
    data: { isRead: true }
  });

  res.json(messages.reverse().map(serializePrivateMessage));
});

messagesRouter.post("/private/messages", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const body = privateMessageRequestSchema.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: "Invalid private message", details: body.error.flatten() });
    return;
  }

  if (await rejectChatBlockedUser(res, authUser.id)) {
    return;
  }

  if (body.data.receiverId === authUser.id) {
    res.status(400).json({ error: "Cannot send private message to yourself" });
    return;
  }

  const receiver = await prisma.user.findUnique({ where: { id: body.data.receiverId } });
  if (!receiver) {
    res.status(404).json({ error: "Receiver not found" });
    return;
  }

  if (await isPrivateBlocked(authUser.id, body.data.receiverId)) {
    res.status(403).json({ error: "Private messages are blocked between these users" });
    return;
  }

  const message = await prisma.privateMessage.create({
    data: {
      senderId: authUser.id,
      receiverId: body.data.receiverId,
      text: body.data.text
    },
    include: { sender: true, receiver: true }
  });

  const dto = serializePrivateMessage(message);
  const io = getIo(req.app);
  io?.to(`user:${message.receiverId}`).emit("private:message", dto);
  io?.to(`user:${message.senderId}`).emit("private:message", dto);
  io?.to(`user:${message.receiverId}`).emit("private:dialog:update", dto);
  io?.to(`user:${message.senderId}`).emit("private:dialog:update", dto);

  res.status(201).json(dto);
  void emitSimpleBotReply(req.app, {
    channel: "private",
    senderId: authUser.id,
    receiverId: message.receiverId,
    text: body.data.text
  });
});

function getIo(app: { locals: Record<string, unknown> }) {
  return app.locals.io as Server | undefined;
}

async function emitSimpleBotReply(
  app: { locals: Record<string, unknown> },
  input: { channel: "public" | "guild" | "private"; senderId: number; receiverId?: number; text: string }
) {
  try {
    const reply = await createSimpleBotReply(input);
    if (!reply) {
      return;
    }

    const io = getIo(app);
    if (input.channel === "private") {
      const message = reply as import("@telegram-mini-chat/shared").PrivateMessageDto;
      io?.to(`user:${message.receiver.id}`).emit("private:message", message);
      io?.to(`user:${message.sender.id}`).emit("private:message", message);
      io?.to(`user:${message.receiver.id}`).emit("private:dialog:update", message);
      io?.to(`user:${message.sender.id}`).emit("private:dialog:update", message);
      return;
    }

    io?.to(input.channel).emit(`${input.channel}:message`, reply);
  } catch (error) {
    console.error("Simple dialogue bot reply failed", error);
  }
}

function getPagination(query: Record<string, unknown>) {
  const rawLimit = Number(query.limit ?? 50);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_PAGE_LIMIT) : 50;
  const rawBefore = typeof query.before === "string" ? query.before : "";
  const before = rawBefore ? new Date(rawBefore) : null;

  return {
    limit,
    before: before && !Number.isNaN(before.getTime()) ? before : null
  };
}

async function persistModerationOutcome(userId: number, messageText: string, outcome: ModerationOutcome) {
  await prisma.$transaction(async (tx) => {
    await tx.chatModerationEvent.create({
      data: {
        userId,
        action: toPrismaModerationAction(outcome.action),
        severity: toPrismaModerationSeverity(outcome.severity),
        reason: outcome.reason,
        messageText,
        mutedUntil: outcome.mutedUntil,
        jailedUntil: outcome.jailedUntil
      }
    });

    if (outcome.jailedUntil) {
      await tx.user.update({
        where: { id: userId },
        data: { jailedUntil: outcome.jailedUntil }
      });
    }

    if (outcome.mutedUntil) {
      await tx.user.update({
        where: { id: userId },
        data: { publicMutedUntil: outcome.mutedUntil }
      });
    }
  });
}

async function rejectModeratedMessage(
  res: Response,
  userId: number,
  messageText: string
) {
  if (!config.CHAT_MODERATION_ENABLED) {
    return false;
  }

  const now = new Date();
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { jailedUntil: true, publicMutedUntil: true }
  });

  if (currentUser?.jailedUntil && currentUser.jailedUntil > now) {
    const notice = buildActiveJailNotice(currentUser.jailedUntil);
    res.status(403).json({ error: notice.message, moderation: notice });
    return true;
  }

  if (currentUser?.publicMutedUntil && currentUser.publicMutedUntil > now) {
    const notice = buildActiveMuteNotice(currentUser.publicMutedUntil);
    res.status(403).json({ error: notice.message, moderation: notice });
    return true;
  }

  const violation = inspectPublicMessage(messageText);
  if (!violation) {
    return false;
  }

  const recurrenceWindowStart = new Date(
    now.getTime() - config.CHAT_MODERATION_RECURRENCE_WINDOW_HOURS * 60 * 60 * 1000
  );
  const recentViolationCount = await prisma.chatModerationEvent.count({
    where: {
      userId,
      createdAt: { gte: recurrenceWindowStart }
    }
  });
  const outcome = resolveModerationOutcome(violation, recentViolationCount, now);

  await persistModerationOutcome(userId, messageText, outcome);
  res.status(403).json({ error: outcome.notice.message, moderation: outcome.notice });
  return true;
}

async function rejectChatBlockedUser(res: Response, userId: number) {
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { chatBlockedAt: true }
  });

  if (!currentUser?.chatBlockedAt) {
    return false;
  }

  res.status(403).json({ error: "Доступ к чату заблокирован администратором." });
  return true;
}

function toPrismaModerationAction(action: ModerationOutcome["action"]) {
  if (action === "user_jailed") {
    return ChatModerationAction.USER_JAILED;
  }

  if (action === "user_muted") {
    return ChatModerationAction.USER_MUTED;
  }

  return ChatModerationAction.WARN_MESSAGE_MUTED;
}

function toPrismaModerationSeverity(severity: ModerationOutcome["severity"]) {
  if (severity === "severe") {
    return ChatModerationSeverity.SEVERE;
  }

  if (severity === "moderate") {
    return ChatModerationSeverity.MODERATE;
  }

  return ChatModerationSeverity.MILD;
}

async function getBlockedByMeUserIds(userId: number) {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    select: { blockedId: true }
  });

  return blocks.map((block) => block.blockedId);
}

async function getPrivateBlockedPeerIds(userId: number) {
  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }]
    },
    select: { blockerId: true, blockedId: true }
  });

  return [
    ...new Set(
      blocks.map((block) => (block.blockerId === userId ? block.blockedId : block.blockerId))
    )
  ];
}

async function isPrivateBlocked(userId: number, otherUserId: number) {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId }
      ]
    },
    select: { id: true }
  });

  return Boolean(block);
}
