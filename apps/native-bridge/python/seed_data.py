#!/usr/bin/env python3
"""Insert deterministic demo readings into the real GridDB containers."""

from __future__ import annotations

import datetime as dt
import math
import os

from griddb_worker import start_gridstore


DEVICE_DETAILS = {
    "ac_office_01": ("Office AC", "HVAC", 1800.0, 0.139),
    "cold_room_02": ("Cold room", "Refrigeration", 1200.0, 0.139),
    "water_pump_01": ("Water pump", "Motor", 2200.0, 0.139),
}


def configured_devices() -> list[tuple[str, str]]:
    values = [item.strip() for item in os.environ.get("GRIDDB_DEVICE_IDS", "").split(",")]
    devices = [item for item in values if item]
    if devices:
        return [(device_id, f"energy_{device_id}") for device_id in devices]
    container = os.environ.get("GRIDDB_CONTAINER", "energy_ac_office_01")
    return [(container.removeprefix("energy_"), container)]


def main() -> int:
    store = start_gridstore()
    try:
        registry = store.get_container("devices")
        if registry is None:
            raise RuntimeError("Missing devices container. Run npm run init first.")

        now = dt.datetime.now(dt.timezone.utc).replace(second=0, microsecond=0)
        now -= dt.timedelta(minutes=now.minute % 15)

        for device_index, (device_id, container_name) in enumerate(configured_devices()):
            name, device_type, rated_watts, price = DEVICE_DETAILS.get(
                device_id,
                (device_id.replace("_", " ").title(), "Meter", 2000.0, 0.139),
            )
            readings = store.get_container(container_name)
            if readings is None:
                raise RuntimeError(
                    f"Missing {container_name}. Add {device_id} to GRIDDB_DEVICE_IDS "
                    "and run npm run init first."
                )

            registry.put([
                device_id,
                container_name,
                name,
                device_type,
                rated_watts,
                price,
                True,
                now - dt.timedelta(days=30),
            ])

            for offset in range(96):
                timestamp = now - dt.timedelta(minutes=15 * (95 - offset))
                hour = timestamp.hour + timestamp.minute / 60
                occupied = 1.0 if 7 <= hour <= 20 else 0.35
                cycle = 0.14 * math.sin(offset * 0.62 + device_index)
                watts = rated_watts * max(0.12, 0.42 * occupied + cycle)
                voltage = 230.0
                current = watts / voltage
                readings.put([
                    timestamp,
                    float(watts),
                    voltage,
                    float(current),
                    0.94,
                    float(watts * 0.25),
                    24.0 + device_index,
                    watts > rated_watts * 0.2,
                    100,
                ])

            readings.close()
            print(f"Seeded 96 readings: {container_name}")

        registry.close()
        print("Demo data stored in GridDB; connection closed.")
        return 0
    finally:
        store.close()


if __name__ == "__main__":
    raise SystemExit(main())
