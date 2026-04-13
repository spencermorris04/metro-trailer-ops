import { spawnSync } from "node:child_process";

const result =
  process.platform === "win32"
    ? spawnSync(
        "cmd.exe",
        ["/c", "npx", "next", "build", "--experimental-build-mode", "compile"],
        {
          cwd: process.cwd(),
          stdio: "inherit",
        },
      )
    : spawnSync("npx", ["next", "build", "--experimental-build-mode", "compile"], {
        cwd: process.cwd(),
        stdio: "inherit",
      });

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
