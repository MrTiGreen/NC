import { z } from "zod";

export const MAX_MESSAGE_LENGTH = 1000;
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;

export const telegramAuthRequestSchema = z.object({
  initData: z.string().default("")
});

export const playerNicknameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-zА-Яа-яЁё]+$/u, "Nickname may contain letters only")
  .max(32, "Nickname cannot exceed 32 characters");

export const playerRegistrationRequestSchema = z.object({
  nickname: playerNicknameSchema,
  age: z.coerce.number().int().min(1).max(120)
});

export const characterStatKeySchema = z.enum(["strength", "agility", "vitality", "intuition", "intelligence", "wisdom"]);
export const characterStatsSaveRequestSchema = z.object({
  allocations: z.object({
    strength: z.coerce.number().int().min(0).max(100),
    agility: z.coerce.number().int().min(0).max(100),
    vitality: z.coerce.number().int().min(0).max(100),
    intuition: z.coerce.number().int().min(0).max(100),
    intelligence: z.coerce.number().int().min(0).max(100),
    wisdom: z.coerce.number().int().min(0).max(100)
  })
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

export type PlayerProfileDto = {
  id: number;
  userId: number;
  nickname: string;
  registeredAt: string;
  age: number;
  birthCity: string;
};

export type CharacterStatsDto = {
  strength: number;
  agility: number;
  vitality: number;
  intuition: number;
  intelligence: number;
  wisdom: number;
};

export type CharacterProgressionDto = {
  level: number;
  availableStatPoints: number;
};

export type CharacterStatsSaveResponseDto = {
  stats: CharacterStatsDto;
  progression: CharacterProgressionDto;
};

export type CharacterPublicEquipmentDto = {
  id: number;
  slot: string;
  name: string;
  icon: string;
  rarity: string;
  description: string;
  requirements: unknown;
  properties: unknown;
  armor: number;
  durability: {
    current: string;
    maximum: string;
  };
};

export type CharacterPublicStatusEffectDto = {
  id: string;
  icon: string;
  label: string;
  kind: "buff" | "debuff" | "injury";
  description: string;
  expiresAt: string | null;
};

export type CharacterPublicProfileDto = {
  userId: number;
  characterId: number;
  nickname: string;
  registeredAt: string;
  age: number;
  birthCity: string;
  aboutMe: string;
  level: number;
  totalExp: string;
  stats: CharacterStatsDto;
  combatRecord: {
    wins: number;
    losses: number;
    draws: number;
  };
  health: {
    current: number;
    maximum: number;
    regeneratedAt: string;
    regenPerMinute: number;
  };
  modifiers: {
    dodge: number;
    crit: number;
    counterAttack: number;
    regeneration: number;
  };
  equipment: CharacterPublicEquipmentDto[];
  statusEffects: CharacterPublicStatusEffectDto[];
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
