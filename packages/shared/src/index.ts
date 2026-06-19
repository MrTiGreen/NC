import { z } from "zod";

export const MAX_MESSAGE_LENGTH = 1000;
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

export const telegramAuthRequestSchema = z.object({
  initData: z.string().default("")
});

export const messageTextSchema = z
  .string()
  .trim()
  .min(1, "Message cannot be empty")
  .max(MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`);

export const publicMessageRequestSchema = z.object({
  text: messageTextSchema
});

export const privateMessageRequestSchema = z.object({
  receiverId: z.number().int().positive(),
  text: messageTextSchema
});

export const moderationActionSchema = z.enum(["warn_message_muted", "user_muted", "user_jailed"]);
export const moderationSeveritySchema = z.enum(["mild", "moderate", "severe"]);
export const userRoleSchema = z.enum(["USER", "ADMIN"]);
export const coalitionSchema = z.enum(["GOLD_LIGHT", "CRIMSON", "MONO", "NONE"]);
export const adminModerationActionSchema = z.enum(["block", "mute", "jail", "clear"]);
export const adminModerationRequestSchema = z.object({
  action: adminModerationActionSchema
});

export type PublicUserDto = {
  id: number;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  coalition: CoalitionDto;
};

export type CurrentUserDto = PublicUserDto & {
  telegramId: string;
  role: UserRoleDto;
  createdAt: string;
  updatedAt: string;
};

export type PublicMessageDto = {
  id: number;
  text: string;
  createdAt: string;
  user: PublicUserDto;
};

export type PrivateMessageDto = {
  id: number;
  text: string;
  isRead: boolean;
  createdAt: string;
  sender: PublicUserDto;
  receiver: PublicUserDto;
};

export type DialogDto = {
  user: PublicUserDto;
  lastMessage: PrivateMessageDto;
};

export type ModerationActionDto = z.infer<typeof moderationActionSchema>;
export type ModerationSeverityDto = z.infer<typeof moderationSeveritySchema>;
export type UserRoleDto = z.infer<typeof userRoleSchema>;
export type CoalitionDto = z.infer<typeof coalitionSchema>;
export type AdminModerationActionDto = z.infer<typeof adminModerationActionSchema>;

export type ModerationNoticeDto = {
  action: ModerationActionDto;
  severity: ModerationSeverityDto;
  reason: string;
  message: string;
  mutedUntil: string | null;
  jailedUntil: string | null;
};

export type AuthResponseDto = {
  token: string;
  user: CurrentUserDto;
  blockedUserIds: number[];
};

export type BlockedUsersDto = {
  blockedUserIds: number[];
};

export type AdminModerationResultDto = {
  action: AdminModerationActionDto;
  target: PublicUserDto;
  mutedUntil: string | null;
  jailedUntil: string | null;
  chatBlocked: boolean;
};

export type ApiErrorDto = {
  error: string;
  details?: unknown;
  moderation?: ModerationNoticeDto;
};
