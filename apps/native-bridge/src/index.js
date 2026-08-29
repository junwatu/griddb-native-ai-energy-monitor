import { GridDBClient } from "./griddb-client.js";

const container = process.env.GRIDDB_CONTAINER;
const tql = process.env.GRIDDB_TQL || "SELECT * LIMIT 10";

if (!container) {
  console.error("GRIDDB_CONTAINER is required");
  process.exitCode = 1;
} else {
  const client = new GridDBClient();

  const shutdown = async () => {
    await client.close().catch(() => {});
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  try {
    const status = await client.ready();
    console.log("Worker ready:", status);

    const rows = await client.query(container, tql);
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error(`${error.name}: ${error.message}`);
    if (error.details?.traceback) console.error(error.details.traceback);
    process.exitCode = 1;
  } finally {
    await shutdown();
  }
}
