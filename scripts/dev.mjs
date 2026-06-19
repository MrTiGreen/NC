import { spawn } from "node:child_process";

const commands = [
  { name: "api", args: ["run", "dev", "-w", "apps/api"] },
  { name: "web", args: ["run", "dev", "-w", "apps/web"] }
];

const children = commands.map(({ name, args }) => {
  const child = spawn("npm", args, {
    stdio: "pipe",
    shell: process.platform === "win32"
  });

  child.stdout.on("data", (chunk) => process.stdout.write(prefix(name, chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(prefix(name, chunk)));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });

  return child;
});

function prefix(name, chunk) {
  return String(chunk)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `[${name}] ${line}\n`)
    .join("");
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
