import crypto from "node:crypto";

export type TelegramAuthUser = {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
};

type TelegramInitUser = {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
};

export function validateTelegramInitData(initData: string, botToken: string, maxAgeSeconds: number): TelegramAuthUser {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = params.get("auth_date");
  const userRaw = params.get("user");

  if (!hash || !authDate || !userRaw) {
    throw new Error("Telegram initData is missing required fields");
  }

  const authTimestamp = Number(authDate);
  if (!Number.isFinite(authTimestamp)) {
    throw new Error("Telegram auth_date is invalid");
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authTimestamp;
  if (ageSeconds < 0 || ageSeconds > maxAgeSeconds) {
    throw new Error("Telegram initData is expired");
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!safeEqualHex(hash, calculatedHash)) {
    throw new Error("Telegram initData hash is invalid");
  }

  const user = JSON.parse(userRaw) as TelegramInitUser;
  if (!user.id) {
    throw new Error("Telegram user id is missing");
  }

  return {
    telegramId: String(user.id),
    username: user.username ?? null,
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null,
    avatarUrl: user.photo_url ?? null
  };
}

export function buildDevTelegramUser(input: {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
}): TelegramAuthUser {
  return {
    telegramId: input.id,
    username: input.username || null,
    firstName: input.firstName || null,
    lastName: input.lastName || null,
    avatarUrl: input.avatarUrl || null
  };
}

function safeEqualHex(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
