import { createServer } from "node:http";

import { GridDBClient } from "./griddb-client.js";

const host = process.env.GRIDDB_API_HOST || "127.0.0.1";
const port = Number(process.env.GRIDDB_API_PORT || 3001);
const client = new GridDBClient();

function sendJson(response, status, body, origin) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  });
  response.end(JSON.stringify(body));
}

function allowedOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return undefined;
  if (origin === process.env.DASHBOARD_ORIGIN) return origin;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : undefined;
}

function deviceFromRow(row) {
  return {
    id: row[0],
    container: row[1],
    name: row[2],
    type: row[3],
    ratedWatts: Number(row[4]),
    pricePerKwh: Number(row[5]),
    active: Boolean(row[6]),
    installedAt: row[7],
  };
}

function sampleReadings(rows, maximum = 48) {
  if (rows.length <= maximum) return rows;
  const step = Math.ceil(rows.length / maximum);
  const sampled = rows.filter((_, index) => index % step === 0);
  const last = rows.at(-1);
  if (last && sampled.at(-1) !== last) sampled.push(last);
  return sampled;
}

function summarize(device, rows, includeUsage) {
  const latest = rows.at(-1);
  const watts = rows.map((row) => Number(row[1])).filter(Number.isFinite);
  const mean = watts.length ? watts.reduce((sum, value) => sum + value, 0) / watts.length : 0;
  const variance = watts.length
    ? watts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / watts.length
    : 0;
  const deviation = Math.sqrt(variance);
  const latestWatts = latest ? Number(latest[1]) : 0;
  const anomaly =
    watts.length >= 12 && deviation > 0 ? latestWatts > mean + 2.5 * deviation : false;
  const energyKwh = rows.reduce((sum, row) => sum + (Number(row[5]) || 0), 0) / 1000;

  return {
    ...device,
    loadKw: latestWatts / 1000,
    energyKwh,
    cost: energyKwh * device.pricePerKwh,
    status: anomaly ? "Watch" : "Normal",
    anomaly,
    latestAt: latest?.[0] ?? null,
    quality: latest ? Number(latest[8]) : null,
    usage: includeUsage
      ? sampleReadings(rows).map((row) => ({
          timestamp: row[0],
          loadKw: Number(row[1]) / 1000,
        }))
      : undefined,
  };
}

async function dashboardData(selectedId) {
  const registryRows = await client.query("devices", "SELECT *");
  const devices = registryRows.map(deviceFromRow).filter((device) => device.active);

  if (devices.length === 0) {
    return { source: "griddb", generatedAt: new Date().toISOString(), devices: [] };
  }

  const selected = devices.find((device) => device.id === selectedId) ?? devices[0];
  const summaries = await Promise.all(
    devices.map(async (device) => {
      const rows = await client.query(
        device.container,
        "SELECT * WHERE timestamp > TIMESTAMPADD(HOUR, NOW(), -24) ORDER BY timestamp ASC",
      );
      return summarize(device, rows, device.id === selected.id);
    }),
  );

  return {
    source: "griddb",
    generatedAt: new Date().toISOString(),
    devices: summaries,
    selectedId: selected.id,
  };
}

const server = createServer(async (request, response) => {
  const origin = allowedOrigin(request);

  if (request.method === "OPTIONS" && origin) {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    });
    response.end();
    return;
  }

  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (request.method === "GET" && url.pathname === "/api/health") {
      const result = await client.ready();
      sendJson(response, 200, result, origin);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/dashboard") {
      const device = url.searchParams.get("device") || undefined;
      if (device && !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(device)) {
        sendJson(response, 400, { error: "Invalid device id" }, origin);
        return;
      }
      sendJson(response, 200, await dashboardData(device), origin);
      return;
    }

    sendJson(response, 404, { error: "Not found" }, origin);
  } catch (error) {
    console.error(error);
    sendJson(
      response,
      500,
      { error: error instanceof Error ? error.message : "GridDB request failed" },
      origin,
    );
  }
});

async function shutdown() {
  server.close();
  await client.close().catch(() => {});
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

server.listen(port, host, () => {
  console.log(`GridDB dashboard API listening on http://${host}:${port}`);
});
