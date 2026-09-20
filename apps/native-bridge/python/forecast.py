#!/usr/bin/env python3
"""Train a small local model and store a 24-hour GridDB forecast."""

from __future__ import annotations

import datetime as dt
import math
import os

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor

from griddb_worker import start_gridstore


INTERVAL_MINUTES = 15
HORIZON = 24 * 60 // INTERVAL_MINUTES
MODEL_VERSION = "hist-gradient-v1"


def configured_containers() -> list[tuple[str, str]]:
    values = [item.strip() for item in os.environ.get("GRIDDB_DEVICE_IDS", "").split(",")]
    device_ids = [item for item in values if item]
    if device_ids:
        return [(f"energy_{item}", f"forecast_{item}") for item in device_ids]

    raw_name = os.environ.get("GRIDDB_CONTAINER", "energy_ac_office_01")
    forecast_name = (
        f"forecast_{raw_name.removeprefix('energy_')}"
        if raw_name.startswith("energy_")
        else f"forecast_{raw_name}"
    )
    return [(raw_name, forecast_name)]


def feature(timestamp: dt.datetime, history: list[float]) -> list[float]:
    hour = timestamp.hour + timestamp.minute / 60
    angle = 2 * math.pi * hour / 24
    return [
        math.sin(angle),
        math.cos(angle),
        history[-1],
        sum(history[-4:]) / min(4, len(history)),
    ]


def read_history(container) -> list[tuple[dt.datetime, float]]:
    row_set = container.query(
        "SELECT * WHERE timestamp > TIMESTAMPADD(HOUR, NOW(), -168) "
        "ORDER BY timestamp ASC"
    ).fetch()
    rows = []
    while row_set.has_next():
        row = row_set.next()
        rows.append((row[0], float(row[1])))
    return rows


def create_forecast(history_rows: list[tuple[dt.datetime, float]]):
    if len(history_rows) < 16:
        raise RuntimeError("At least 16 energy readings are required to forecast")

    timestamps = [row[0] for row in history_rows]
    watts = [row[1] for row in history_rows]
    features = [feature(timestamps[index], watts[:index]) for index in range(4, len(watts))]
    targets = watts[4:]

    model = HistGradientBoostingRegressor(
        learning_rate=0.08,
        max_iter=150,
        max_leaf_nodes=15,
        min_samples_leaf=4,
        l2_regularization=1.0,
        random_state=42,
    )
    model.fit(np.asarray(features), np.asarray(targets))

    fitted = model.predict(np.asarray(features))
    mae = float(np.mean(np.abs(np.asarray(targets) - fitted)))
    generated_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    last_timestamp = timestamps[-1]
    if last_timestamp.tzinfo is None:
        last_timestamp = last_timestamp.replace(tzinfo=dt.timezone.utc)
    start = max(last_timestamp, generated_at)
    start = start.replace(second=0, microsecond=0)
    start -= dt.timedelta(minutes=start.minute % INTERVAL_MINUTES)

    rolling = list(watts)
    predictions = []
    for step in range(1, HORIZON + 1):
        target_timestamp = start + dt.timedelta(minutes=INTERVAL_MINUTES * step)
        predicted_watts = max(0.0, float(model.predict([feature(target_timestamp, rolling)])[0]))
        error_band = max(mae * 1.64, predicted_watts * 0.1)
        predictions.append(
            (
                target_timestamp,
                predicted_watts * 0.25,
                max(0.0, predicted_watts - error_band) * 0.25,
                (predicted_watts + error_band) * 0.25,
                MODEL_VERSION,
                generated_at,
            )
        )
        rolling.append(predicted_watts)

    return predictions, mae


def main() -> int:
    store = start_gridstore()
    try:
        for raw_name, forecast_name in configured_containers():
            readings = store.get_container(raw_name)
            forecasts = store.get_container(forecast_name)
            if readings is None or forecasts is None:
                raise RuntimeError(
                    f"Missing {raw_name} or {forecast_name}. Run npm run init first."
                )

            predictions, mae = create_forecast(read_history(readings))
            for prediction in predictions:
                forecasts.put(list(prediction))

            total_kwh = sum(row[1] for row in predictions) / 1000
            readings.close()
            forecasts.close()
            print(
                f"Stored {len(predictions)} forecast intervals: {forecast_name} "
                f"({total_kwh:.2f} kWh, training MAE {mae:.1f} W)"
            )

        print("Forecast complete; connection closed.")
        return 0
    finally:
        store.close()


if __name__ == "__main__":
    raise SystemExit(main())
