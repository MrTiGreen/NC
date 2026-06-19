import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { privateMessageRequestSchema, publicMessageRequestSchema } from "@telegram-mini-chat/shared";

describe("message validation", () => {
  it("trims valid public messages", () => {
    assert.deepEqual(publicMessageRequestSchema.parse({ text: "  hello  " }), { text: "hello" });
  });

  it("rejects empty public messages", () => {
    assert.equal(publicMessageRequestSchema.safeParse({ text: "   " }).success, false);
  });

  it("rejects messages over 1000 characters", () => {
    assert.equal(publicMessageRequestSchema.safeParse({ text: "x".repeat(1001) }).success, false);
  });

  it("requires valid private receiver id", () => {
    assert.equal(privateMessageRequestSchema.safeParse({ receiverId: 0, text: "hello" }).success, false);
  });
});
