import type { GuildMessage, PrivateMessage, PublicMessage, User } from "@prisma/client";
import type {
  CurrentUserDto,
  DialogDto,
  PrivateMessageDto,
  PublicMessageDto,
  PublicUserDto
} from "@telegram-mini-chat/shared";

export function serializePublicUser(user: User): PublicUserDto {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    coalition: user.coalition
  };
}

export function serializeCurrentUser(user: User): CurrentUserDto {
  return {
    ...serializePublicUser(user),
    telegramId: user.telegramId.toString(),
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export function serializePublicMessage(
  message: PublicMessage & { user: User }
): PublicMessageDto {
  return {
    id: message.id,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
    user: serializePublicUser(message.user)
  };
}

export function serializeGuildMessage(
  message: GuildMessage & { user: User }
): PublicMessageDto {
  return {
    id: message.id,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
    user: serializePublicUser(message.user)
  };
}

export function serializePrivateMessage(
  message: PrivateMessage & { sender: User; receiver: User }
): PrivateMessageDto {
  return {
    id: message.id,
    text: message.text,
    isRead: message.isRead,
    createdAt: message.createdAt.toISOString(),
    sender: serializePublicUser(message.sender),
    receiver: serializePublicUser(message.receiver)
  };
}

export function serializeDialog(user: User, lastMessage: PrivateMessage & { sender: User; receiver: User }): DialogDto {
  return {
    user: serializePublicUser(user),
    lastMessage: serializePrivateMessage(lastMessage)
  };
}
