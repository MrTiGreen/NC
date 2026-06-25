import type { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { config } from "../config.js";
import type { AuthenticatedRequest } from "../types.js";
import { prisma } from "../prisma.js";
import { verifyAuthToken } from "../utils/jwt.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = verifyAuthToken(token, config.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });

    if (!user || user.telegramId.toString() !== payload.telegramId) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    Object.assign(req, {
      authUser: {
        id: user.id,
        telegramId: user.telegramId.toString()
      }
    });
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { authUser } = req as AuthenticatedRequest;
  const user = await prisma.user.findUnique({ where: { id: authUser.id }, select: { role: true } });

  if (user?.role !== UserRole.ADMIN) {
    res.status(403).json({ error: "Administrator access required" });
    return;
  }

  next();
}

export async function requirePrimaryAdmin(req: Request, res: Response, next: NextFunction) {
  const { authUser } = req as AuthenticatedRequest;
  const user = await prisma.user.findUnique({ where: { id: authUser.id }, select: { role: true, telegramId: true } });
  const primaryAdminTelegramId = getPrimaryAdminTelegramId();

  if (!primaryAdminTelegramId || user?.role !== UserRole.ADMIN || user.telegramId.toString() !== primaryAdminTelegramId) {
    res.status(403).json({ error: "Primary administrator access required" });
    return;
  }

  next();
}

function getPrimaryAdminTelegramId() {
  const configuredAdminIds = config.ADMIN_TELEGRAM_IDS.split(",").map((value) => value.trim()).filter(Boolean);

  if (configuredAdminIds.length > 0) {
    return configuredAdminIds[0];
  }

  return config.DEV_TELEGRAM_AUTH ? config.DEV_TELEGRAM_ID : "";
}
