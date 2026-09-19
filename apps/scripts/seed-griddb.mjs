import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readEnvironmentFile, runOrExit } from "./process-utils.mjs";

const appsRoot = fileURLToPath(new URL("..", import.meta.url));
const bridgeRoot = join(appsRoot, "native-bridge");
const environmentPath = join(bridgeRoot, ".env");
const environment = { ...readEnvironmentFile(environmentPath), ...process.env };
const defaultPython =
  process.platform === "win32"
    ? join(bridgeRoot, ".venv", "Scripts", "python.exe")
    : join(bridgeRoot, ".venv", "bin", "python");
const configuredPython = environment.PYTHON_BIN;
const python = configuredPython
  ? isAbsolute(configuredPython)
    ? configuredPython
    : resolve(bridgeRoot, configuredPython)
  : defaultPython;

if (!existsSync(environmentPath)) {
  console.error("Missing native-bridge/.env. Copy native-bridge/.env.example first.");
  process.exit(1);
}

if (!existsSync(python)) {
  console.error(`Python runtime not found: ${python}`);
  console.error("Run the setup command for your platform first.");
  process.exit(1);
}

const macJavaHomes = [
  "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
  "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
];
if (!environment.JAVA_HOME) {
  environment.JAVA_HOME = macJavaHomes.find((home) => existsSync(join(home, "bin", "java")));
}
if (environment.JAVA_HOME) {
  environment.PATH = `${join(environment.JAVA_HOME, "bin")}${delimiter}${environment.PATH ?? ""}`;
}
if (!environment.JAVA_TOOL_OPTIONS?.includes("java.base/java.nio")) {
  environment.JAVA_TOOL_OPTIONS = [
    environment.JAVA_TOOL_OPTIONS,
    "--add-opens=java.base/java.nio=ALL-UNNAMED",
  ]
    .filter(Boolean)
    .join(" ");
}

await runOrExit(python, ["python/seed_data.py"], {
  cwd: bridgeRoot,
  env: environment,
});
