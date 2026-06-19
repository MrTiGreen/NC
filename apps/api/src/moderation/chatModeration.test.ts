import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMuteDurationMinutes,
  inspectPublicMessage,
  resolveModerationOutcome
} from "./chatModeration.js";

describe("chat moderation", () => {
  it("allows normal public messages", () => {
    assert.equal(inspectPublicMessage("Привет всем, кто онлайн"), null);
  });

  it("detects rude Russian messages", () => {
    const violation = inspectPublicMessage("ты мудак");

    assert.equal(violation?.reason, "harassment");
    assert.equal(violation?.severity, "mild");
  });

  it("detects Russian obscene messages", () => {
    const violation = inspectPublicMessage("трах и минет");

    assert.equal(violation?.reason, "obscene");
    assert.equal(violation?.severity, "moderate");
  });

  it("detects obfuscated English profanity", () => {
    const violation = inspectPublicMessage("f.u.c.k this");

    assert.equal(violation?.reason, "profanity");
    assert.equal(violation?.severity, "moderate");
  });

  it("detects Japanese harassment", () => {
    const violation = inspectPublicMessage("バカ");

    assert.equal(violation?.reason, "harassment");
    assert.equal(violation?.severity, "mild");
  });

  it("warns and hides the first mild violation", () => {
    const violation = inspectPublicMessage("идиот");
    assert.ok(violation);

    const outcome = resolveModerationOutcome(violation, 0, new Date("2026-06-19T00:00:00.000Z"));

    assert.equal(outcome.action, "warn_message_muted");
    assert.equal(outcome.mutedUntil, null);
    assert.equal(outcome.notice.mutedUntil, null);
  });

  it("mutes the second mild violation for 15 minutes", () => {
    assert.equal(getMuteDurationMinutes("mild", 1), 15);
  });

  it("jails the player on the third violation", () => {
    const violation = inspectPublicMessage("идиот");
    assert.ok(violation);

    const outcome = resolveModerationOutcome(violation, 2, new Date("2026-06-19T00:00:00.000Z"));

    assert.equal(outcome.action, "user_jailed");
    assert.equal(outcome.muteDurationMinutes, null);
    assert.equal(outcome.jailDurationMinutes, 1440);
    assert.equal(outcome.notice.mutedUntil, null);
    assert.equal(outcome.notice.jailedUntil, "2026-06-20T00:00:00.000Z");
  });

  it("mutes severe violations immediately", () => {
    const violation = inspectPublicMessage("kill yourself");
    assert.ok(violation);

    const outcome = resolveModerationOutcome(violation, 0, new Date("2026-06-19T00:00:00.000Z"));

    assert.equal(outcome.action, "user_muted");
    assert.equal(outcome.muteDurationMinutes, 60);
    assert.equal(outcome.notice.mutedUntil, "2026-06-19T01:00:00.000Z");
  });
});
