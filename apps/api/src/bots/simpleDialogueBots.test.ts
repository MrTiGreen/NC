import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSimpleBotReply } from "./simpleDialogueBots.js";

describe("simple dialogue bots", () => {
  it("answers greetings and questions with short phrases", () => {
    assert.equal(getSimpleBotReply("public", "Привет"), "Привет! Я на связи.");
    assert.equal(getSimpleBotReply("public", "Кто идёт в дозор?"), "Понял вопрос. Проверю и отвечу позже.");
  });

  it("keeps channel context in private and guild replies", () => {
    assert.match(getSimpleBotReply("private", "проверь сообщение"), /^Лично:/);
    assert.match(getSimpleBotReply("guild", "проверь сообщение"), /^Гильдия:/);
  });
});
