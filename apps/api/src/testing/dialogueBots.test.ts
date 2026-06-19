import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { privateMessageRequestSchema, publicMessageRequestSchema } from "@telegram-mini-chat/shared";
import { dialogueBots, playerDialogue } from "./dialogueBots.js";

describe("player dialogue bots", () => {
  it("defines exactly two unique test players", () => {
    assert.equal(dialogueBots.length, 2);
    assert.equal(new Set(dialogueBots.map((bot) => bot.key)).size, dialogueBots.length);
    assert.equal(new Set(dialogueBots.map((bot) => bot.telegramId)).size, dialogueBots.length);
    assert.ok(dialogueBots.every((bot) => bot.username.startsWith("test_")));
  });

  it("keeps every dialogue step valid for its target message endpoint", () => {
    const knownBotKeys = new Set(dialogueBots.map((bot) => bot.key));

    for (const step of playerDialogue) {
      assert.ok(knownBotKeys.has(step.sender));

      if (step.channel === "private") {
        assert.ok(step.receiver);
        assert.notEqual(step.sender, step.receiver);
        assert.ok(knownBotKeys.has(step.receiver));
        assert.equal(
          privateMessageRequestSchema.safeParse({ receiverId: 1, text: step.text }).success,
          true
        );
      } else {
        assert.equal(publicMessageRequestSchema.safeParse({ text: step.text }).success, true);
      }
    }
  });

  it("covers public, guild, and private correspondence", () => {
    const channels = new Set(playerDialogue.map((step) => step.channel));
    assert.deepEqual(channels, new Set(["public", "guild", "private"]));
  });
});
