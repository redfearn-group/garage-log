import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PUBLIC_ROOT = new URL("..", import.meta.url);
const PRIVATE_ROOT = new URL("../../garage-log-private/", import.meta.url);

function run(cmd, cwd, opts = {}) {
  return execSync(cmd, { cwd, encoding: "utf-8", ...opts });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function publishRepo(label, cwd) {
  const status = run("git status --porcelain", cwd).trim();
  if (!status) {
    console.log(`${label}: nothing to publish — working tree is clean.`);
    return;
  }

  console.log(`\n=== ${label} (${cwd}) ===`);
  run("git add -A", cwd);
  console.log(run("git diff --cached --stat", cwd));
  console.log("---");
  console.log(run("git diff --cached", cwd, { maxBuffer: 20 * 1024 * 1024 }));
  console.log("---");

  const proceed = await ask(`Push ${label} to GitHub? [y/N] `);
  if (!proceed.trim().toLowerCase().startsWith("y")) {
    run("git reset", cwd);
    console.log(`${label}: cancelled — changes left unstaged.`);
    return;
  }

  const defaultMsg = `Update vehicle data — ${new Date().toISOString().slice(0, 10)}`;
  const customMsg = await ask(`Commit message [${defaultMsg}]: `);
  const message = customMsg.trim() || defaultMsg;

  run(`git commit -m ${JSON.stringify(message)}`, cwd);
  console.log(run("git push", cwd));
  console.log(`${label}: pushed.`);
}

const publicDir = fileURLToPath(PUBLIC_ROOT);
const privateDir = fileURLToPath(PRIVATE_ROOT);

if (existsSync(path.join(privateDir, ".git"))) {
  // Private repo first: if a public entry references a doc, the doc should
  // already exist upstream by the time anyone looks.
  await publishRepo("garage-log-private", privateDir);
} else {
  console.log("garage-log-private not found as a sibling folder — skipping (documents won't be backed up).");
}

await publishRepo("garage-log", publicDir);
console.log("\nDone. GitHub Actions will rebuild and redeploy the public site in a minute or two.");
