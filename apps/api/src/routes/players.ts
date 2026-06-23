import { Prisma } from "@prisma/client";
import { Router } from "express";
import { playerRegistrationRequestSchema, type PlayerProfileDto } from "@telegram-mini-chat/shared";
import type { AuthenticatedRequest } from "../types.js";
import { prisma } from "../prisma.js";
import { assignBirthCity, normalizeNickname } from "../players/playerRegistration.js";

export const playersRouter = Router();

playersRouter.get("/player-profile", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const profile = await prisma.playerProfile.findUnique({ where: { userId: authUser.id } });

  if (!profile) {
    res.status(404).json({ error: "Player profile has not been registered" });
    return;
  }

  res.json(serializePlayerProfile(profile));
});

playersRouter.post("/player-profile", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const body = playerRegistrationRequestSchema.safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: "Invalid player registration", details: body.error.flatten() });
    return;
  }

  try {
    const profile = await prisma.playerProfile.create({
      data: {
        userId: authUser.id,
        nickname: body.data.nickname,
        nicknameNormalized: normalizeNickname(body.data.nickname),
        age: body.data.age,
        birthCity: assignBirthCity()
      }
    });

    res.status(201).json(serializePlayerProfile(profile));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: "Nickname is already registered" });
      return;
    }

    res.status(500).json({ error: "Unable to register player" });
  }
});

function serializePlayerProfile(profile: {
  id: number;
  userId: number;
  nickname: string;
  registeredAt: Date;
  age: number;
  birthCity: string;
}): PlayerProfileDto {
  return {
    id: profile.id,
    userId: profile.userId,
    nickname: profile.nickname,
    registeredAt: profile.registeredAt.toISOString(),
    age: profile.age,
    birthCity: profile.birthCity
  };
}
