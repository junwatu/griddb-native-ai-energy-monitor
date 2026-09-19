import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { readEnvironmentFile, runOrExit } from "./process-utils.mjs";

const appsRoot = fileURLToPath(new URL("..", import.meta.url));
const environmentPath = join(appsRoot, "native-bridge", ".env");

if (!existsSync(environmentPath)) {
  console.error("Missing native-bridge/.env. Copy native-bridge/.env.example first.");
  process.exit(1);
}

await runOrExit(process.execPath, ["src/server.js"], {
  cwd: join(appsRoot, "native-bridge"),
  env: { ...readEnvironmentFile(environmentPath), ...process.env },
});
