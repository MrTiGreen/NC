import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { playerRegistrationRequestSchema } from "@telegram-mini-chat/shared";
import { assignBirthCity, BIRTH_CITIES, normalizeNickname } from "./playerRegistration.js";

describe("player registration", () => {
  it("accepts a letter-only nickname and valid age", () => {
    assert.deepEqual(playerRegistrationRequestSchema.parse({ nickname: "  MrGreen  ", age: 18 }), {
      nickname: "MrGreen",
      age: 18
    });
  });

  it("rejects nickname digits and punctuation", () => {
    assert.equal(playerRegistrationRequestSchema.safeParse({ nickname: "MrGreen42", age: 18 }).success, false);
    assert.equal(playerRegistrationRequestSchema.safeParse({ nickname: "Mr-Green", age: 18 }).success, false);
  });

  it("normalizes nicknames and assigns a city from the approved list", () => {
    assert.equal(normalizeNickname("Ёлка"), "ёлка");
    assert.equal(assignBirthCity(() => 0), BIRTH_CITIES[0]);
    assert.equal(assignBirthCity(() => 0.9999), BIRTH_CITIES[BIRTH_CITIES.length - 1]);
  });
});
