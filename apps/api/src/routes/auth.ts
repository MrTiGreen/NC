import { Router } from "express";
import { UserRole } from "@prisma/client";
import { telegramAuthRequestSchema } from "@telegram-mini-chat/shared";
import { config } from "../config.js";
import { prisma } from "../prisma.js";
import { signAuthToken } from "../utils/jwt.js";
import { serializeCurrentUser } from "../utils/serialize.js";
import { buildDevTelegramUser, validateTelegramInitData } from "../utils/telegram.js";

export const authRouter = Router();

authRouter.post("/telegram", async (req, res) => {
  const body = telegramAuthRequestSchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid auth payload", details: body.error.flatten() });
    return;
  }

  try {
    const telegramUser =
      config.DEV_TELEGRAM_AUTH && !body.data.initData
        ? buildDevTelegramUser({
            id: config.DEV_TELEGRAM_ID,
            username: config.DEV_TELEGRAM_USERNAME,
            firstName: config.DEV_TELEGRAM_FIRST_NAME,
            lastName: config.DEV_TELEGRAM_LAST_NAME,
            avatarUrl: config.DEV_TELEGRAM_AVATAR_URL
          })
        : validateTelegramInitData(body.data.initData, config.BOT_TOKEN, config.TELEGRAM_AUTH_MAX_AGE_SECONDS);

    const isAdmin = isAdminTelegramId(telegramUser.telegramId);
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(telegramUser.telegramId) },
      create: {
        telegramId: BigInt(telegramUser.telegramId),
        username: telegramUser.username,
        firstName: telegramUser.firstName,
        lastName: telegramUser.lastName,
        avatarUrl: telegramUser.avatarUrl,
        role: isAdmin ? UserRole.ADMIN : UserRole.USER
      },
      update: {
        username: telegramUser.username,
        firstName: telegramUser.firstName,
        lastName: telegramUser.lastName,
        avatarUrl: telegramUser.avatarUrl,
        ...(isAdmin ? { role: UserRole.ADMIN } : {})
      }
    });
    const blockedUserIds = await prisma.userBlock.findMany({
      where: { blockerId: user.id },
      select: { blockedId: true }
    });

    const token = signAuthToken(
      {
        sub: String(user.id),
        telegramId: user.telegramId.toString()
      },
      config.JWT_SECRET
    );

    res.json({ token, user: serializeCurrentUser(user), blockedUserIds: blockedUserIds.map((block) => block.blockedId) });
  } catch (error) {
    res.status(401).json({ error: error instanceof Error ? error.message : "Telegram auth failed" });
  }
});

function isAdminTelegramId(telegramId: string) {
  const adminIds = new Set([
    ...(config.DEV_TELEGRAM_AUTH ? [config.DEV_TELEGRAM_ID] : []),
    ...config.ADMIN_TELEGRAM_IDS.split(",").map((value) => value.trim()).filter(Boolean)
  ]);

  return adminIds.has(telegramId);
}
