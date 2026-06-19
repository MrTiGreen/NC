import type { Request } from "express";

export type AuthUser = {
  id: number;
  telegramId: string;
};

export type AuthenticatedRequest = Request & {
  authUser: AuthUser;
};
