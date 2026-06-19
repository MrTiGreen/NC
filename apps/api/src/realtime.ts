import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { prisma } from "./prisma.js";
import { verifyAuthToken } from "./utils/jwt.js";

export function createRealtimeServer(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: config.CLIENT_ORIGIN,
      credentials: false
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = typeof socket.handshake.auth.token === "string" ? socket.handshake.auth.token : "";
      const payload = verifyAuthToken(token, config.JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });

      if (!user || user.telegramId.toString() !== payload.telegramId || user.chatBlockedAt) {
        next(new Error("Unauthorized"));
        return;
      }

      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = Number(socket.data.userId);
    socket.join("public");
    socket.join("guild");
    socket.join(`user:${userId}`);
  });

  return io;
}
