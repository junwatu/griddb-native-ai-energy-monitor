#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
java_prefix="$(brew --prefix openjdk@21)"
export JAVA_HOME="${java_prefix}/libexec/openjdk.jdk/Contents/Home"
export PATH="${JAVA_HOME}/bin:${PATH}"
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:-} --add-opens=java.base/java.nio=ALL-UNNAMED"

exec "${project_dir}/.venv/bin/python" "${project_dir}/scripts/doctor.py"
