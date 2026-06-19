import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });

const configSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BOT_TOKEN: z.string().default(""),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  DEV_TELEGRAM_AUTH: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  DEV_TELEGRAM_ID: z.string().default("100000001"),
  DEV_TELEGRAM_USERNAME: z.string().default("dev_user"),
  DEV_TELEGRAM_FIRST_NAME: z.string().default("Dev"),
  DEV_TELEGRAM_LAST_NAME: z.string().default("User"),
  DEV_TELEGRAM_AVATAR_URL: z.string().default(""),
  ADMIN_TELEGRAM_IDS: z.string().default(""),
  TELEGRAM_AUTH_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86400),
  MESSAGE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
  CHAT_MODERATION_ENABLED: z
    .string()
    .default("true")
    .transform((value) => value !== "false"),
  CHAT_MODERATION_RECURRENCE_WINDOW_HOURS: z.coerce.number().int().positive().default(24)
});

const parsed = configSchema.parse(process.env);

if (!parsed.DEV_TELEGRAM_AUTH && !parsed.BOT_TOKEN) {
  throw new Error("BOT_TOKEN is required when DEV_TELEGRAM_AUTH is disabled");
}

export const config = parsed;
