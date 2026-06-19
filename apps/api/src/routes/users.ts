import { Router } from "express";
import { AdminModerationActionType, UserRole } from "@prisma/client";
import {
  adminModerationRequestSchema,
  type AdminModerationResultDto,
  type BlockedUsersDto
} from "@telegram-mini-chat/shared";
import { requireAdmin } from "../middleware/auth.js";
import { adminModerationLabel, resolveAdminSanction } from "../moderation/adminModeration.js";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../types.js";
import { serializeCurrentUser, serializePublicUser } from "../utils/serialize.js";

export const usersRouter = Router();

usersRouter.get("/me", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: authUser.id } });
  res.json(serializeCurrentUser(user));
});

usersRouter.get("/users", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const users = await prisma.user.findMany({
    where: { id: { not: authUser.id } },
    orderBy: [{ firstName: "asc" }, { username: "asc" }, { id: "asc" }]
  });

  res.json(users.map(serializePublicUser));
});

usersRouter.get("/blocks", async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  res.json(await getBlockedUsers(authUser.id));
});

usersRouter.post("/blocks/:userId", async (req, res) => {
  const { authUser } = req as unknown as AuthenticatedRequest;
  const blockedId = Number(req.params.userId);

  if (!Number.isInteger(blockedId) || blockedId <= 0) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (blockedId === authUser.id) {
    res.status(400).json({ error: "Cannot block yourself" });
    return;
  }

  const blockedUser = await prisma.user.findUnique({ where: { id: blockedId }, select: { id: true } });
  if (!blockedUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: authUser.id, blockedId } },
    create: { blockerId: authUser.id, blockedId },
    update: {}
  });

  res.status(201).json(await getBlockedUsers(authUser.id));
});

usersRouter.delete("/blocks/:userId", async (req, res) => {
  const { authUser } = req as unknown as AuthenticatedRequest;
  const blockedId = Number(req.params.userId);

  if (!Number.isInteger(blockedId) || blockedId <= 0) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  await prisma.userBlock.deleteMany({
    where: { blockerId: authUser.id, blockedId }
  });

  res.json(await getBlockedUsers(authUser.id));
});

usersRouter.post("/admin/users/:userId/moderation", requireAdmin, async (req, res) => {
  const { authUser } = req as AuthenticatedRequest;
  const targetId = Number(req.params.userId);
  const body = adminModerationRequestSchema.safeParse(req.body);

  if (!Number.isInteger(targetId) || targetId <= 0) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (!body.success) {
    res.status(400).json({ error: "Invalid moderation action", details: body.error.flatten() });
    return;
  }

  if (targetId === authUser.id) {
    res.status(400).json({ error: "Administrators cannot moderate themselves" });
    return;
  }

  try {
    const result = await applyAdminModeration(authUser.id, targetId, body.data.action);
    res.json(result);
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "Unable to apply moderation action" });
  }
});

async function getBlockedUsers(blockerId: number): Promise<BlockedUsersDto> {
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId },
    select: { blockedId: true }
  });

  return { blockedUserIds: blocks.map((block) => block.blockedId) };
}

async function applyAdminModeration(actorId: number, targetId: number, action: "block" | "mute" | "jail" | "clear") {
  const sanction = resolveAdminSanction(action);

  return prisma.$transaction(async (tx): Promise<AdminModerationResultDto> => {
    const target = await tx.user.findUnique({ where: { id: targetId } });
    if (!target) {
      throw new Error("User not found");
    }

    if (target.role === UserRole.ADMIN) {
      throw new Error("Administrators cannot moderate another administrator");
    }

    const updatedTarget = await tx.user.update({
      where: { id: targetId },
      data: sanction
    });
    await tx.adminModerationAction.create({
      data: {
        actorId,
        targetId,
        action: toPrismaAdminAction(action),
        mutedUntil: sanction.publicMutedUntil,
        jailedUntil: sanction.jailedUntil,
        chatBlocked: Boolean(sanction.chatBlockedAt)
      }
    });

    return {
      action,
      target: serializePublicUser(updatedTarget),
      mutedUntil: sanction.publicMutedUntil?.toISOString() ?? null,
      jailedUntil: sanction.jailedUntil?.toISOString() ?? null,
      chatBlocked: Boolean(sanction.chatBlockedAt)
    };
  });
}

function toPrismaAdminAction(action: "block" | "mute" | "jail" | "clear") {
  const actions = {
    block: AdminModerationActionType.BLOCK_USER,
    mute: AdminModerationActionType.MUTE_USER,
    jail: AdminModerationActionType.JAIL_USER,
    clear: AdminModerationActionType.CLEAR_SANCTIONS
  } as const;

  return actions[action];
}
