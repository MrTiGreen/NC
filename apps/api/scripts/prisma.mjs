import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(currentDir, "..");
const rootDir = resolve(apiDir, "../..");

dotenv.config({ path: resolve(rootDir, ".env") });
dotenv.config({ path: resolve(apiDir, ".env"), override: true });

const prismaCli = resolve(rootDir, "node_modules/prisma/build/index.js");
const child = spawn(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  cwd: apiDir,
  env: process.env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
