#!/usr/bin/env python3
"""Create and validate the GridDB containers required by the sample app."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from griddb_worker import start_gridstore


@dataclass(frozen=True)
class Schema:
    name: str
    container_type: str
    columns: tuple[tuple[str, str], ...]


DEVICE_COLUMNS = (
    ("device_id", "STRING"),
    ("container_name", "STRING"),
    ("display_name", "STRING"),
    ("device_type", "STRING"),
    ("rated_watts", "DOUBLE"),
    ("price_per_kwh", "DOUBLE"),
    ("active", "BOOL"),
    ("installed_at", "TIMESTAMP"),
)

ENERGY_COLUMNS = (
    ("timestamp", "TIMESTAMP"),
    ("watts", "DOUBLE"),
    ("voltage", "DOUBLE"),
    ("current_amps", "DOUBLE"),
    ("power_factor", "DOUBLE"),
    ("interval_energy_wh", "DOUBLE"),
    ("temperature_c", "DOUBLE"),
    ("operating", "BOOL"),
    ("quality", "INTEGER"),
)

FORECAST_COLUMNS = (
    ("target_timestamp", "TIMESTAMP"),
    ("predicted_energy_wh", "DOUBLE"),
    ("lower_bound_wh", "DOUBLE"),
    ("upper_bound_wh", "DOUBLE"),
    ("model_version", "STRING"),
    ("generated_at", "TIMESTAMP"),
)


def safe_name(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]*", value):
        raise ValueError(f"Unsafe GridDB container name: {value!r}")
    return value


def configured_schemas() -> tuple[Schema, ...]:
    configured_container = os.environ.get("GRIDDB_CONTAINER", "").strip()
    configured_devices = [
        item.strip()
        for item in os.environ.get("GRIDDB_DEVICE_IDS", "").split(",")
        if item.strip()
    ]

    if configured_devices:
        raw_names = [f"energy_{safe_name(device_id)}" for device_id in configured_devices]
    elif configured_container:
        raw_names = [safe_name(configured_container)]
    else:
        raw_names = ["energy_ac_office_01"]

    schemas = [Schema("devices", "COLLECTION", DEVICE_COLUMNS)]
    for raw_name in raw_names:
        forecast_name = (
            f"forecast_{raw_name.removeprefix('energy_')}"
            if raw_name.startswith("energy_")
            else f"forecast_{raw_name}"
        )
        schemas.append(Schema(raw_name, "TIME_SERIES", ENERGY_COLUMNS))
        schemas.append(Schema(safe_name(forecast_name), "TIME_SERIES", FORECAST_COLUMNS))
    return tuple(schemas)


def build_info(griddb, schema: Schema):
    column_types = [[name, getattr(griddb.Type, type_name)] for name, type_name in schema.columns]
    container_type = getattr(griddb.ContainerType, schema.container_type)
    return griddb.ContainerInfo(
        schema.name,
        column_types,
        type=container_type,
        row_key=True,
    )


def schema_signature(info) -> tuple[str, bool, tuple[tuple[str, str], ...]]:
    columns = tuple((column[0], column[1].name) for column in info.column_info_list)
    return info.type.name, info.row_key, columns


def ensure_schema(store, griddb, schema: Schema) -> str:
    existing = store.get_container(schema.name)
    if existing is None:
        created = store.put_container(build_info(griddb, schema), modifiable=False)
        created.close()
        return "created"

    existing.close()
    actual = schema_signature(store.get_container_info(schema.name))
    expected = (schema.container_type, True, schema.columns)
    if actual != expected:
        raise RuntimeError(
            f"Container {schema.name!r} exists with an incompatible schema. "
            "Existing data was not modified."
        )
    return "unchanged"


def main() -> int:
    store = start_gridstore()
    try:
        import griddb_python as griddb

        for schema in configured_schemas():
            result = ensure_schema(store, griddb, schema)
            print(f"{result.capitalize()}: {schema.container_type} {schema.name}")
        print("Schema initialization complete; connection closed.")
        return 0
    finally:
        store.close()


if __name__ == "__main__":
    raise SystemExit(main())
