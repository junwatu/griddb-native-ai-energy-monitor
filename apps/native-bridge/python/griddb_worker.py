#!/usr/bin/env python3
"""Persistent native GridDB worker controlled by Node.js over NDJSON stdio."""

from __future__ import annotations

import base64
import datetime as dt
import json
import os
import sys
import traceback
from pathlib import Path
from typing import Any


REQUIRED_ENV = (
    "GRIDDB_NOTIFICATION_PROVIDER",
    "GRIDDB_CLUSTER_NAME",
    "GRIDDB_DATABASE",
    "GRIDDB_USERNAME",
    "GRIDDB_PASSWORD",
)


def require_environment() -> None:
    missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")


def start_gridstore():
    require_environment()

    import jpype

    if not jpype.isJVMStarted():
        lib_dir = Path(__file__).resolve().parents[1] / "lib"
        required_jars = (
            lib_dir / "gridstore.jar",
            lib_dir / "gridstore-arrow.jar",
            lib_dir / "gridstore-advanced.jar",
        )
        missing = [path.name for path in required_jars if not path.is_file()]
        if missing:
            raise RuntimeError(
                f"Missing GridDB runtime JAR(s) in {lib_dir}: {', '.join(missing)}"
            )

        # The locally built Arrow adapter is an assembly JAR and contains its
        # Java dependencies, so every JAR in lib/ is sufficient here.
        jpype.startJVM(classpath=[str(path) for path in sorted(lib_dir.glob("*.jar"))])

    import griddb_python as griddb

    factory = griddb.StoreFactory.get_instance()
    options = {
        "notification_provider": os.environ["GRIDDB_NOTIFICATION_PROVIDER"],
        "cluster_name": os.environ["GRIDDB_CLUSTER_NAME"],
        "database": os.environ["GRIDDB_DATABASE"],
        "username": os.environ["GRIDDB_USERNAME"],
        "password": os.environ["GRIDDB_PASSWORD"],
        "ssl_mode": os.environ.get("GRIDDB_SSL_MODE", "PREFERRED"),
    }

    route = os.environ.get("GRIDDB_CONNECTION_ROUTE", "PUBLIC").strip()
    if route:
        options["connection_route"] = route

    return factory.get_store(**options)


def json_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return value.isoformat()
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"$binary": base64.b64encode(bytes(value)).decode("ascii")}
    if isinstance(value, dict):
        return {str(key): json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]
    if hasattr(value, "tolist"):
        return json_value(value.tolist())
    return str(value)


def require_container(store, name: str):
    container = store.get_container(name)
    if container is None:
        raise LookupError(f"GridDB container not found: {name}")
    return container


def handle(store, request: dict[str, Any]) -> tuple[Any, bool]:
    operation = request.get("operation")

    if operation == "ready":
        # Store creation is lazy. A real connection is made by get/query/put.
        return {"status": "ready", "connection": "lazy"}, False

    if operation == "query":
        container = require_container(store, request["container"])
        row_set = container.query(request["tql"]).fetch()
        rows = []
        while row_set.has_next():
            rows.append(json_value(row_set.next()))
        return rows, False

    if operation == "get":
        container = require_container(store, request["container"])
        return json_value(container.get(request["key"])), False

    if operation == "put":
        container = require_container(store, request["container"])
        result = container.put(request["row"])
        return {"updated": bool(result)}, False

    if operation == "close":
        store.close()
        return {"status": "closed"}, True

    raise ValueError(f"Unsupported operation: {operation}")


def emit(message: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(message, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def main() -> int:
    try:
        store = start_gridstore()
    except Exception as error:
        print(f"GridDB worker failed during startup: {error}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return 1

    for line in sys.stdin:
        request_id = None
        try:
            request = json.loads(line)
            request_id = request.get("id")
            result, should_close = handle(store, request)
            emit({"id": request_id, "ok": True, "result": result})
            if should_close:
                return 0
        except Exception as error:
            emit(
                {
                    "id": request_id,
                    "ok": False,
                    "error": {
                        "type": type(error).__name__,
                        "message": str(error),
                        "traceback": traceback.format_exc(),
                    },
                }
            )

    store.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
