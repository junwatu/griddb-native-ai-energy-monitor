# GridDB Energy AI

This repository contains the native GridDB bridge, the dashboard prototype, and
the accompanying article. The bridge connects a Node.js application to **GridDB Cloud 3.2 from Azure
Marketplace** without using the GridDB Web API. Node keeps one Python worker
alive and exchanges newline-delimited JSON over standard input/output. The
Python client connects to GridDB using its native client interface.

## Repository layout

```text
apps/
  native-bridge/       Node.js -> Python/JPype -> GridDB Cloud client
  dashboard/           React, shadcn/ui, and Tailwind dashboard prototype
blogs/
  ai-energy-monitor/   Article draft, publication assets, and diagram sources
```

Run all native-bridge commands below from `apps/native-bridge`.

## Quick start

Enter the runnable workspace and install its JavaScript dependencies:

```bash
cd apps
npm install
```

To run the dashboard with real GridDB rows, initialize the containers and start
the live native bridge:

```bash
npm run init
npm run dev:live
```

Open <http://localhost:3000>. The browser calls a local Node endpoint on port
3001. Node keeps the Python worker alive, and the worker connects to GridDB
using the native protocol. GridDB credentials remain on the server and are
never sent to the browser.

If physical meter data is not available yet, this optional command inserts one
day of deterministic demo readings into the real GridDB containers:

```bash
npm run seed
npm run dev:live
```

The seed is only a demonstration input. The dashboard itself always reads the
result from GridDB; it has no hard-coded device or chart data.

The `apps/` workspace commands are cross-platform:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start only the dashboard UI (the live adapter must be running separately) |
| `npm run api` | Start only the local native GridDB adapter |
| `npm run dev:live` | Start the dashboard and local native GridDB adapter together |
| `npm run init` | Create or validate the native GridDB containers |
| `npm run seed` | Insert optional deterministic demo readings into GridDB |
| `npm run build` | Create the dashboard production build |
| `npm run check` | Check the native bridge and build the dashboard |
| `npm run doctor` | Check Java, Maven, Python, GridDB JARs, and `.env` |
| `npm run dev:griddb` | Validate, load `native-bridge/.env`, and run the native GridDB query example |
| `npm run setup:mac` | Install the native dependencies on macOS |
| `npm run setup:linux` | Reserved Linux native setup entry point |
| `npm run setup:windows` | Reserved Windows native setup entry point |

The Linux and Windows setup commands intentionally report that native setup is
not automated yet. They provide a stable command surface while those installers
are implemented; the mock dashboard works anywhere supported by Node.js.

## Architecture

```text
Node.js -> NDJSON over stdio -> Python/JPype -> GridDB native protocol -> GridDB Cloud
```

The current GridDB Python client is backed by the GridDB Java API. You do not
write Java, but a Java runtime and the GridDB Cloud Enterprise JARs are runtime
dependencies.

## Current macOS status

The public dependencies have been installed and locally verified on this Apple
Silicon Mac:

- Node.js 26.3.0
- Python 3.12.10 in `.venv/`
- OpenJDK 21 and Maven from Homebrew
- GridDB Python 5.9.0, JPype, and PyArrow
- `gridstore.jar`, `gridstore-arrow.jar`, and `arrow-memory-netty.jar`

The licensed `gridstore-advanced.jar` has been extracted from the GridDB Cloud
Enterprise Java 5.9.0 RPM and installed locally. It is exclusive to the Cloud
download and cannot be fetched from Maven or the public GridDB repository.

For public native access, generate the Notification Provider URL first and then
allowlist this application's stable public outbound IP in GridDB Cloud.

## Repeat the public dependency installation

The setup script is idempotent and performs the complete public installation:

```bash
cd apps/native-bridge
npm run setup:mac
```

It installs Java 21 and Maven, creates `.venv`, builds and installs the official
GridDB Python client, installs the public JARs, and runs `npm install`. There are
currently no third-party Node packages; Node talks to the Python worker using
built-in process streams.

## Install the licensed Cloud JAR

1. Sign in to the GridDB Cloud service purchased through Azure Marketplace.
2. Open the Cloud dashboard's **Help / Downloads / Support** area.
3. Download **GridDB Cloud Library and Plugin** (the Java EE library RPM).
4. Give the downloaded RPM to the helper:

```bash
scripts/install-cloud-jar.sh ~/Downloads/griddb-ee-java-lib-5.9.0-linux.x86_64.rpm
```

For the library bundle stored in this repository workspace, the tested command
is:

```bash
scripts/install-cloud-jar.sh \
  GridDB_Cloud_doc_lib/griddb-ee-java-lib-5.9.0-linux.x86_64.rpm
```

The JAR itself is portable Java bytecode, so extracting it from a Linux RPM and
using it on macOS is valid. The whole app is not “JAR-only,” though: JPype and
PyArrow include native macOS/CPU-specific components. The setup script installs
the correct Python wheels for this Mac. All JARs are ignored by Git.

Verify the local stack at any time:

```bash
npm run doctor
```

## Configure and run

Copy `.env.example` to `.env`, fill in the values, and export it in your shell.
Keep the Notification Provider URL quoted because it can contain shell-special
characters such as `&`. This project deliberately does not include an
environment-file dependency.

```bash
cp .env.example .env
# Edit .env with the values from your GridDB Cloud dashboard.
set -a
source .env
set +a
npm run check
npm start
```

The example executes `GRIDDB_TQL` against `GRIDDB_CONTAINER` and prints the
returned rows as JSON.

## Use from application code

```js
import { GridDBClient } from "./src/griddb-client.js";

const client = new GridDBClient();

try {
  const rows = await client.query(
    "sensor_readings",
    "SELECT * WHERE timestamp > TIMESTAMPADD(HOUR, NOW(), -1)",
  );
  console.log(rows);
} finally {
  await client.close();
}
```

The bridge also exposes `get(container, key)` and `put(container, row)`.

## VNet route

For the GridDB Cloud public native route, keep:

```bash
GRIDDB_CONNECTION_ROUTE=PUBLIC
```

For private native access through Azure VNet peering, leave the value empty so
the Python client uses its normal/private route:

```bash
GRIDDB_CONNECTION_ROUTE=
```

Neither configuration uses the GridDB Web API. However, the public route still
uses the HTTPS Notification Provider URL for cluster discovery; actual database
operations use GridDB's native protocol over a TLS-protected TCP connection.

If your rule prohibits the **GridDB Web API**, this design meets it. If your rule
prohibits **all HTTPS traffic**, the public route does not meet it because of the
discovery request. In that stricter case, deploy the Node application inside an
Azure VNet peered to GridDB Cloud and use the Cloud-supported private discovery
configuration rather than `connectionRoute=PUBLIC`.
