import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const workerPath = fileURLToPath(
  new URL("../python/griddb_worker.py", import.meta.url),
);
const projectPython = join(projectRoot, ".venv", "bin", "python");

function workerEnvironment() {
  const env = { ...process.env };

  if (process.platform === "darwin" && !env.JAVA_HOME) {
    const prefixes = process.arch === "arm64"
      ? ["/opt/homebrew"]
      : ["/usr/local", "/opt/homebrew"];
    const javaHome = prefixes
      .map((prefix) => join(
        prefix,
        "opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
      ))
      .find(existsSync);
    if (javaHome) env.JAVA_HOME = javaHome;
  }

  const arrowOpen = "--add-opens=java.base/java.nio=ALL-UNNAMED";
  if (!env.JAVA_TOOL_OPTIONS?.includes("java.base/java.nio")) {
    env.JAVA_TOOL_OPTIONS = [env.JAVA_TOOL_OPTIONS, arrowOpen]
      .filter(Boolean)
      .join(" ");
  }

  return env;
}

export class GridDBClient {
  #child;
  #nextId = 1;
  #pending = new Map();
  #closed = false;
  #timeoutMs;

  constructor({
    python = process.env.PYTHON_BIN
      || (existsSync(projectPython) ? projectPython : "python3"),
    timeoutMs = Number(process.env.GRIDDB_REQUEST_TIMEOUT_MS || 30_000),
  } = {}) {
    this.#timeoutMs = timeoutMs;
    this.#child = spawn(python, [workerPath], {
      env: workerEnvironment(),
      stdio: ["pipe", "pipe", "inherit"],
    });

    const lines = createInterface({ input: this.#child.stdout });
    lines.on("line", (line) => this.#handleLine(line));

    this.#child.once("error", (error) => this.#failAll(error));
    this.#child.once("exit", (code, signal) => {
      if (!this.#closed) {
        this.#failAll(
          new Error(
            `GridDB worker exited unexpectedly (code=${code}, signal=${signal})`,
          ),
        );
      }
    });
  }

  async ready() {
    return this.request("ready");
  }

  async query(container, tql) {
    return this.request("query", { container, tql });
  }

  async get(container, key) {
    return this.request("get", { container, key });
  }

  async put(container, row) {
    return this.request("put", { container, row });
  }

  request(operation, payload = {}) {
    if (this.#closed) {
      return Promise.reject(new Error("GridDB client is closed"));
    }

    const id = this.#nextId++;
    const message = JSON.stringify({ id, operation, ...payload });

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`GridDB request ${id} timed out`));
      }, this.#timeoutMs);

      this.#pending.set(id, { resolve, reject, timer });
      this.#child.stdin.write(`${message}\n`, (error) => {
        if (!error) return;
        const pending = this.#pending.get(id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.#pending.delete(id);
        pending.reject(error);
      });
    });
  }

  async close() {
    if (this.#closed) return;

    try {
      await this.request("close");
    } finally {
      this.#closed = true;
      this.#child.stdin.end();
    }
  }

  #handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      this.#failAll(new Error(`Invalid response from GridDB worker: ${line}`));
      return;
    }

    const pending = this.#pending.get(message.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.#pending.delete(message.id);

    if (message.ok) {
      pending.resolve(message.result);
    } else {
      const error = new Error(message.error?.message || "GridDB request failed");
      error.name = message.error?.type || "GridDBError";
      error.details = message.error;
      pending.reject(error);
    }
  }

  #failAll(error) {
    for (const { reject, timer } of this.#pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.#pending.clear();
  }
}
