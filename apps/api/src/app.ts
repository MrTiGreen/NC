import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { config } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { messagesRouter } from "./routes/messages.js";
import { usersRouter } from "./routes/users.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.CLIENT_ORIGIN,
      credentials: false
    })
  );
  app.use(express.json({ limit: "64kb" }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false
    })
  );

  const messageLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: config.MESSAGE_RATE_LIMIT_PER_MINUTE,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api", requireAuth, usersRouter);
  app.use("/api", requireAuth, messageLimiter, messagesRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
