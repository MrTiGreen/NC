import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAdminSanction } from "./adminModeration.js";

describe("manual admin moderation", () => {
  const now = new Date("2026-06-19T12:00:00.000Z");

  it("blocks all chat access and clears temporary sanctions", () => {
    const result = resolveAdminSanction("block", now);

    assert.equal(result.chatBlockedAt, now);
    assert.equal(result.publicMutedUntil, null);
    assert.equal(result.jailedUntil, null);
  });

  it("uses fixed manual durations for mute and jail", () => {
    assert.equal(resolveAdminSanction("mute", now).publicMutedUntil?.toISOString(), "2026-06-19T13:00:00.000Z");
    assert.equal(resolveAdminSanction("jail", now).jailedUntil?.toISOString(), "2026-06-20T12:00:00.000Z");
  });

  it("clears every active manual sanction", () => {
    assert.deepEqual(resolveAdminSanction("clear", now), {
      chatBlockedAt: null,
      publicMutedUntil: null,
      jailedUntil: null
    });
  });
});
