import { createServer } from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { prisma } from "./prisma.js";
import { createRealtimeServer } from "./realtime.js";

const app = createApp();
const server = createServer(app);
const io = createRealtimeServer(server);
app.locals.io = io;

server.listen(config.PORT, () => {
  console.log(`API listening on http://localhost:${config.PORT}`);
});

async function shutdown() {
  io.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
