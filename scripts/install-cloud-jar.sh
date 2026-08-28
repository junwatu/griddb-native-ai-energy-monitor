#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/gridstore-advanced.jar-or-GridDB-Cloud-RPM" >&2
  exit 1
fi

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
input_file="$(cd -- "$(dirname -- "$1")" && pwd)/$(basename -- "$1")"
destination="${project_dir}/lib/gridstore-advanced.jar"

if [[ ! -f "${input_file}" ]]; then
  echo "File not found: ${input_file}" >&2
  exit 1
fi

mkdir -p "${project_dir}/lib"

case "${input_file}" in
  *.jar)
    cp "${input_file}" "${destination}"
    ;;
  *.rpm)
    extract_dir="$(mktemp -d "${TMPDIR:-/tmp}/griddb-cloud.XXXXXX")"
    trap 'rm -rf "${extract_dir}"' EXIT
    tar -xf "${input_file}" -C "${extract_dir}"
    # The RPM contains the real versioned JAR under usr/griddb-ee-X.Y.Z/lib/.
    # usr/share/java/gridstore-advanced.jar is an absolute symlink and is broken
    # when the RPM is extracted into a temporary directory on macOS.
    cloud_jar="$(find "${extract_dir}" -type f \
      \( -name gridstore-advanced.jar -o -name 'gridstore-advanced-*.jar' \) \
      -print -quit)"
    if [[ -z "${cloud_jar}" ]]; then
      echo "gridstore-advanced.jar was not found inside ${input_file}" >&2
      exit 1
    fi
    cp "${cloud_jar}" "${destination}"
    ;;
  *)
    echo "Expected a .jar or .rpm file: ${input_file}" >&2
    exit 1
    ;;
esac

echo "Installed ${destination}"
cd "${project_dir}"
npm run doctor
