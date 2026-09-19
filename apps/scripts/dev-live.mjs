import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { npmCommand, readEnvironmentFile } from "./process-utils.mjs";

const appsRoot = fileURLToPath(new URL("..", import.meta.url));
const environmentPath = join(appsRoot, "native-bridge", ".env");

if (!existsSync(environmentPath)) {
  console.error("Missing native-bridge/.env. Copy native-bridge/.env.example first.");
  process.exit(1);
}

const environment = {
  ...readEnvironmentFile(environmentPath),
  ...process.env,
};

const processes = [
  spawn(npmCommand, ["run", "server", "--workspace=native-bridge"], {
    cwd: appsRoot,
    env: environment,
    stdio: "inherit",
    shell: false,
  }),
  spawn(npmCommand, ["run", "dev", "--workspace=dashboard"], {
    cwd: appsRoot,
    env: environment,
    stdio: "inherit",
    shell: false,
  }),
];

let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill("SIGTERM");
  process.exitCode = code;
}

for (const child of processes) {
  child.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    if (!stopping && (signal || code !== 0)) stop(code ?? 1);
  });
}

process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
