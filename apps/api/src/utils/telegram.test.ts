import crypto from "node:crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateTelegramInitData } from "./telegram.js";

describe("validateTelegramInitData", () => {
  it("accepts valid initData", () => {
    const initData = buildInitData({
      botToken: "123456:token",
      user: {
        id: 42,
        username: "tester",
        first_name: "Test",
        last_name: "User",
        photo_url: "https://example.com/a.jpg"
      },
      authDate: Math.floor(Date.now() / 1000)
    });

    assert.deepEqual(validateTelegramInitData(initData, "123456:token", 60), {
      telegramId: "42",
      username: "tester",
      firstName: "Test",
      lastName: "User",
      avatarUrl: "https://example.com/a.jpg"
    });
  });

  it("rejects invalid hash", () => {
    const initData = `${buildInitData({
      botToken: "123456:token",
      user: { id: 42 },
      authDate: Math.floor(Date.now() / 1000)
    })}broken`;

    assert.throws(() => validateTelegramInitData(initData, "123456:token", 60), /hash is invalid/);
  });

  it("rejects expired auth date", () => {
    const initData = buildInitData({
      botToken: "123456:token",
      user: { id: 42 },
      authDate: Math.floor(Date.now() / 1000) - 120
    });

    assert.throws(() => validateTelegramInitData(initData, "123456:token", 60), /expired/);
  });
});

function buildInitData(input: { botToken: string; user: Record<string, unknown>; authDate: number }) {
  const params = new URLSearchParams({
    auth_date: String(input.authDate),
    query_id: "test-query",
    user: JSON.stringify(input.user)
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(input.botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}
