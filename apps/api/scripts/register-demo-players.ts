import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const apiDir = resolve(scriptsDir, "..");
const rootDir = resolve(apiDir, "..", "..");

dotenv.config({ path: resolve(rootDir, ".env") });
dotenv.config({ path: resolve(apiDir, ".env"), override: true });

const prisma = new PrismaClient();

const demoPlayers = [
  { telegramId: 900000101n, nickname: "MrRed", age: 29 },
  { telegramId: 900000102n, nickname: "NightFox", age: 27 },
  { telegramId: 900000103n, nickname: "Ravenna", age: 31 }
] as const;

async function main() {
  const anchor = await prisma.playerProfile.findUnique({
    where: { nicknameNormalized: "mrgreen" }
  });

  if (!anchor) {
    throw new Error("MrGreen must be registered before demo players can join the same city.");
  }

  const registered = await prisma.$transaction(
    demoPlayers.map((player) =>
      prisma.user.upsert({
        where: { telegramId: player.telegramId },
        create: {
          telegramId: player.telegramId,
          username: player.nickname.toLocaleLowerCase("en-US"),
          firstName: player.nickname
        },
        update: {
          username: player.nickname.toLocaleLowerCase("en-US"),
          firstName: player.nickname
        }
      })
    )
  );

  await prisma.$transaction(
    registered.map((user, index) => {
      const player = demoPlayers[index];

      return prisma.playerProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          nickname: player.nickname,
          nicknameNormalized: player.nickname.toLocaleLowerCase("ru-RU"),
          age: player.age,
          birthCity: anchor.birthCity
        },
        update: {
          nickname: player.nickname,
          nicknameNormalized: player.nickname.toLocaleLowerCase("ru-RU"),
          age: player.age,
          birthCity: anchor.birthCity
        }
      });
    })
  );

  console.table(
    registered.map((user) => ({
      nickname: user.firstName,
      city: anchor.birthCity,
      online: true
    }))
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
