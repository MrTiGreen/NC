import type {
  AdminModerationActionDto,
  AdminModerationResultDto,
  AuthResponseDto,
  BlockedUsersDto,
  CharacterPublicProfileDto,
  CharacterStatsSaveResponseDto,
  CurrentUserDto,
  DialogDto,
  PrivateMessageDto,
  PlayerProfileDto,
  PublicMessageDto,
  PublicUserDto
} from "@telegram-mini-chat/shared";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export async function authTelegram(initData: string) {
  return request<AuthResponseDto>("/api/auth/telegram", {
    method: "POST",
    body: JSON.stringify({ initData })
  });
}

export async function getMe(token: string) {
  return request<CurrentUserDto>("/api/me", {}, token);
}

export async function getPlayerProfile(token: string, userId: number) {
  return request<PlayerProfileDto>(`/api/player-profile/${userId}`, {}, token);
}

export async function getCharacterPublicProfile(token: string, userId: number) {
  return request<CharacterPublicProfileDto>(`/api/player-profile/${userId}/character`, {}, token);
}

export async function getCharacterProgression(token: string) {
  return request<CharacterStatsSaveResponseDto>("/api/characters/me/progression", {}, token);
}

export async function saveCharacterStats(
  token: string,
  allocations: { strength: number; agility: number; vitality: number; intuition: number; intelligence: number; wisdom: number }
) {
  return request<CharacterStatsSaveResponseDto>(
    "/api/characters/me/stats",
    { method: "PUT", body: JSON.stringify({ allocations }) },
    token
  );
}

export type InventoryItemInstanceDto = {
  id: number;
  quantity: number;
  equippedSlot: string | null;
  inventoryPosition: number | null;
  currentDurability: string;
  maxDurability: string;
  template: {
    id: number;
    slug: string;
    name: string;
    category: string;
    icon: string;
    slot: string | null;
    description: string;
    requirements: unknown;
    properties: unknown;
    rarity: string;
    levelRequirement: number;
    baseWeaponDamage: number;
    baseArmor: number;
    armorByZone: unknown;
  };
};

export async function getMyInventoryItems(token: string) {
  return request<InventoryItemInstanceDto[]>("/api/items/me", {}, token);
}

export async function saveMyInventoryLayout(token: string, items: Array<{ itemInstanceId: number; position: number | null }>) {
  return request<{ items: InventoryItemInstanceDto[] }>(
    "/api/items/me/layout",
    { method: "PUT", body: JSON.stringify({ items }) },
    token
  );
}

export async function getUsers(token: string) {
  return request<PublicUserDto[]>("/api/users", {}, token);
}

export async function getBlockedUsers(token: string) {
  return request<BlockedUsersDto>("/api/blocks", {}, token);
}

export async function blockUser(token: string, userId: number) {
  return request<BlockedUsersDto>(
    `/api/blocks/${userId}`,
    {
      method: "POST"
    },
    token
  );
}

export async function unblockUser(token: string, userId: number) {
  return request<BlockedUsersDto>(
    `/api/blocks/${userId}`,
    {
      method: "DELETE"
    },
    token
  );
}

export async function moderateUser(token: string, userId: number, action: AdminModerationActionDto) {
  return request<AdminModerationResultDto>(
    `/api/admin/users/${userId}/moderation`,
    {
      method: "POST",
      body: JSON.stringify({ action })
    },
    token
  );
}

export async function getPublicMessages(token: string) {
  return request<PublicMessageDto[]>("/api/public/messages", {}, token);
}

export async function sendPublicMessage(token: string, text: string) {
  return request<PublicMessageDto>(
    "/api/public/messages",
    {
      method: "POST",
      body: JSON.stringify({ text })
    },
    token
  );
}

export async function getGuildMessages(token: string) {
  return request<PublicMessageDto[]>("/api/guild/messages", {}, token);
}

export async function sendGuildMessage(token: string, text: string) {
  return request<PublicMessageDto>(
    "/api/guild/messages",
    {
      method: "POST",
      body: JSON.stringify({ text })
    },
    token
  );
}

export async function getDialogs(token: string) {
  return request<DialogDto[]>("/api/private/dialogs", {}, token);
}

export async function getPrivateMessages(token: string, userId: number) {
  return request<PrivateMessageDto[]>(`/api/private/messages/${userId}`, {}, token);
}

export async function getPrivateFeedMessages(token: string) {
  return request<PrivateMessageDto[]>("/api/private/messages", {}, token);
}

export async function sendPrivateMessage(token: string, receiverId: number, text: string) {
  return request<PrivateMessageDto>(
    "/api/private/messages",
    {
      method: "POST",
      body: JSON.stringify({ receiverId, text })
    },
    token
  );
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(payload.error ?? "Request failed");
  }

  return response.json() as Promise<T>;
}
