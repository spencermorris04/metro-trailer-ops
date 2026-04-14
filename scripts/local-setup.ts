import "dotenv/config";

import { spawnSync } from "node:child_process";

function runStep(command: string, args: string[]) {
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/c", command, ...args], {
          cwd: process.cwd(),
          stdio: "inherit",
          env: process.env,
        })
      : spawnSync(command, args, {
          cwd: process.cwd(),
          stdio: "inherit",
          env: process.env,
        });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 0) !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

async function main() {
  runStep("npm", ["run", "local:db:start"]);
  runStep("npm", ["run", "db:push"]);
  runStep("npm", ["run", "local:bootstrap:admin"]);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
