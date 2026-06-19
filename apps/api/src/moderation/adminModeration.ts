import type { AdminModerationActionDto } from "@telegram-mini-chat/shared";

export const ADMIN_MUTE_DURATION_MINUTES = 60;
export const ADMIN_JAIL_DURATION_MINUTES = 24 * 60;

export type AdminSanctionUpdate = {
  chatBlockedAt: Date | null;
  publicMutedUntil: Date | null;
  jailedUntil: Date | null;
};

export function resolveAdminSanction(action: AdminModerationActionDto, now = new Date()): AdminSanctionUpdate {
  if (action === "block") {
    return {
      chatBlockedAt: now,
      publicMutedUntil: null,
      jailedUntil: null
    };
  }

  if (action === "mute") {
    return {
      chatBlockedAt: null,
      publicMutedUntil: addMinutes(now, ADMIN_MUTE_DURATION_MINUTES),
      jailedUntil: null
    };
  }

  if (action === "jail") {
    return {
      chatBlockedAt: null,
      publicMutedUntil: null,
      jailedUntil: addMinutes(now, ADMIN_JAIL_DURATION_MINUTES)
    };
  }

  return {
    chatBlockedAt: null,
    publicMutedUntil: null,
    jailedUntil: null
  };
}

export function adminModerationLabel(action: AdminModerationActionDto) {
  const labels: Record<AdminModerationActionDto, string> = {
    block: "доступ к чату заблокирован",
    mute: "молчанка выдана на 1 час",
    jail: "тюрьма выдана на 1 сутки",
    clear: "ручные санкции сняты"
  };

  return labels[action];
}

function addMinutes(now: Date, minutes: number) {
  return new Date(now.getTime() + minutes * 60 * 1000);
}
