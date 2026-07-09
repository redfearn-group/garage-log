import { execSync } from "node:child_process";
import readline from "node:readline";

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: new URL("..", import.meta.url), encoding: "utf-8", ...opts });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

const status = run("git status --porcelain").trim();
if (!status) {
  console.log("Nothing to publish — working tree is clean.");
  process.exit(0);
}

run("git add -A");
console.log(run("git diff --cached --stat"));
console.log("---");
console.log(run("git diff --cached", { maxBuffer: 20 * 1024 * 1024 }));
console.log("---");

const proceed = await ask("Push this to GitHub? [y/N] ");
if (!proceed.trim().toLowerCase().startsWith("y")) {
  run("git reset");
  console.log("Cancelled — changes left unstaged.");
  process.exit(0);
}

const defaultMsg = `Update vehicle data — ${new Date().toISOString().slice(0, 10)}`;
const customMsg = await ask(`Commit message [${defaultMsg}]: `);
const message = customMsg.trim() || defaultMsg;

run(`git commit -m ${JSON.stringify(message)}`);
console.log(run("git push"));
console.log("Pushed. GitHub Actions will rebuild and redeploy the site in a minute or two.");
