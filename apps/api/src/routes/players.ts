import { Prisma } from "@prisma/client";
import { Router, type Response } from "express";
import { playerRegistrationRequestSchema, type CharacterPublicProfileDto, type PlayerProfileDto } from "@telegram-mini-chat/shared";
import type { AuthenticatedRequest } from "../types.js";
import { prisma } from "../prisma.js";
import { assignBirthCity, normalizeNickname } from "../players/playerRegistration.js";

export const playersRouter = Router();

type PublicCharacterProfileRecord = Prisma.PlayerProfileGetPayload<{
  include: {
    user: { select: { publicMutedUntil: true; jailedUntil: true } };
    progression: true;
    stats: true;
    itemInstances: { include: { template: true } };
  };
}>;

playersRouter.get("/player-profile", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  await sendPlayerProfile(res, authUser.id);
});

playersRouter.get("/player-profile/:userId", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  await sendPlayerProfile(res, userId);
});

playersRouter.get("/player-profile/:userId/character", async (req, res) => {
  const userId = Number(req.params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const profile = await prisma.playerProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { publicMutedUntil: true, jailedUntil: true } },
      progression: true,
      stats: true,
      itemInstances: {
        where: { equippedSlot: { not: null } },
        include: { template: true },
        orderBy: { updatedAt: "desc" }
      }
    }
  });

  if (!profile) {
    res.status(404).json({ error: "Player profile has not been registered" });
    return;
  }

  const [wins, losses, draws, activeParticipant] = await Promise.all([
    prisma.battleParticipant.count({
      where: { characterId: profile.id, isWinner: true, battle: { status: "FINISHED" } }
    }),
    prisma.battleParticipant.count({
      where: { characterId: profile.id, isWinner: false, battle: { status: "FINISHED", winnerCharacterId: { not: null } } }
    }),
    prisma.battleParticipant.count({
      where: { characterId: profile.id, battle: { status: "FINISHED", winnerCharacterId: null } }
    }),
    prisma.battleParticipant.findFirst({
      where: { characterId: profile.id, battle: { status: { in: ["ACTIVE", "PENDING_ACTIONS"] } } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  res.json(serializeCharacterPublicProfile(profile, { wins, losses, draws }, activeParticipant));
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

async function sendPlayerProfile(res: Response, userId: number) {
  const profile = await prisma.playerProfile.findUnique({ where: { userId } });

  if (!profile) {
    res.status(404).json({ error: "Player profile has not been registered" });
    return;
  }

  res.json(serializePlayerProfile(profile));
}

function serializeCharacterPublicProfile(
  profile: PublicCharacterProfileRecord,
  record: { wins: number; losses: number; draws: number },
  activeParticipant: { currentHp: number; maxHpSnapshot: number; combatBuffs: unknown; createdAt: Date } | null
): CharacterPublicProfileDto {
  const stats = profile.stats ?? {
    strength: 10,
    agility: 10,
    vitality: 10,
    intuition: 10,
    intelligence: 10,
    wisdom: 10
  };
  const equippedItems = profile.itemInstances;
  const equipmentRegen = equippedItems.reduce((sum, instance) => sum + extractRegenerationBonus(instance.template.properties), 0);
  const maxHp = Math.round(activeParticipant?.maxHpSnapshot ?? 100 + stats.vitality * 12);
  const regenPerMinute = Number((1 + stats.vitality * 0.08 + equipmentRegen).toFixed(1));
  const currentHp = Math.min(maxHp, Math.round(activeParticipant?.currentHp ?? maxHp));
  const statusEffects = [
    ...serializeCombatBuffs(activeParticipant?.combatBuffs),
    ...serializeModerationEffects(profile.user.publicMutedUntil, profile.user.jailedUntil)
  ];

  return {
    userId: profile.userId,
    characterId: profile.id,
    nickname: profile.nickname,
    registeredAt: profile.registeredAt.toISOString(),
    age: profile.age,
    birthCity: profile.birthCity,
    aboutMe: `${profile.age} лет. Родной город: ${profile.birthCity}. Персональное описание профиля пока не заполнено.`,
    level: profile.progression?.level ?? 1,
    totalExp: String(profile.progression?.totalExp ?? 0n),
    stats,
    combatRecord: record,
    health: {
      current: currentHp,
      maximum: maxHp,
      regeneratedAt: new Date().toISOString(),
      regenPerMinute
    },
    modifiers: {
      dodge: Number((stats.agility * 0.22 + stats.intuition * 0.08).toFixed(1)),
      crit: Number((stats.agility * 0.15 + stats.intuition * 0.1).toFixed(1)),
      counterAttack: Number((stats.agility * 0.18).toFixed(1)),
      regeneration: regenPerMinute
    },
    equipment: equippedItems.map((instance) => ({
      id: instance.id,
      slot: instance.equippedSlot ?? "UNKNOWN",
      name: instance.template.name,
      icon: instance.template.icon,
      rarity: instance.template.rarity,
      description: instance.template.description,
      requirements: instance.template.requirements,
      properties: instance.template.properties,
      armor: instance.template.baseArmor,
      durability: {
        current: instance.currentDurability.toString(),
        maximum: instance.maxDurability.toString()
      }
    })),
    statusEffects
  };
}

function extractRegenerationBonus(properties: unknown) {
  if (!Array.isArray(properties)) return 0;

  return properties.reduce((sum, property) => {
    if (typeof property !== "string" || !/регенерац/i.test(property)) return sum;
    const match = property.match(/([+-]?\d+(?:[.,]\d+)?)/);
    return sum + (match ? Number(match[1].replace(",", ".")) : 0);
  }, 0);
}

function serializeCombatBuffs(combatBuffs: unknown) {
  if (!Array.isArray(combatBuffs)) return [];

  return combatBuffs.map((buff, index) => {
    const value = typeof buff === "object" && buff !== null ? buff as Record<string, unknown> : {};
    const label = typeof value.label === "string" ? value.label : typeof value.name === "string" ? value.name : "Эффект";
    const expiresAt = typeof value.expiresAt === "string" ? value.expiresAt : null;

    return {
      id: `combat-buff-${index}`,
      icon: typeof value.icon === "string" ? value.icon : "✦",
      label,
      kind: "buff" as const,
      description: typeof value.description === "string" ? value.description : label,
      expiresAt
    };
  });
}

function serializeModerationEffects(publicMutedUntil: Date | null, jailedUntil: Date | null) {
  const effects = [];
  const now = Date.now();

  if (publicMutedUntil && publicMutedUntil.getTime() > now) {
    effects.push({
      id: "public-muted",
      icon: "🔇",
      label: "Молчание",
      kind: "debuff" as const,
      description: "Ограничение публичного чата.",
      expiresAt: publicMutedUntil.toISOString()
    });
  }

  if (jailedUntil && jailedUntil.getTime() > now) {
    effects.push({
      id: "jailed",
      icon: "⛓",
      label: "Тюрьма",
      kind: "injury" as const,
      description: "Персонаж временно ограничен.",
      expiresAt: jailedUntil.toISOString()
    });
  }

  return effects;
}
