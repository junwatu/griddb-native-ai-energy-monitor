#!/usr/bin/env python3
"""Check the local Node-to-GridDB Python/Java runtime without connecting."""

from __future__ import annotations

import platform
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LIB_DIR = ROOT / "lib"


def main() -> int:
    import jpype
    import pyarrow

    jars = sorted(LIB_DIR.glob("*.jar"))
    required = ("gridstore.jar", "gridstore-arrow.jar")
    missing = [name for name in required if not (LIB_DIR / name).is_file()]
    if missing:
        print(f"Missing public JAR(s): {', '.join(missing)}", file=sys.stderr)
        return 1

    if not jpype.isJVMStarted():
        jpype.startJVM(classpath=[str(path) for path in jars])

    import griddb_python

    print(f"macOS: {platform.mac_ver()[0]} ({platform.machine()})")
    print(f"Python: {platform.python_version()}")
    print(f"JPype: {jpype.__version__}")
    print(f"PyArrow: {pyarrow.__version__}")
    print(f"JVM: {jpype.getJVMVersion()}")
    print(f"GridDB Python: {getattr(griddb_python, '__version__', '5.9.0')}")
    print(f"Public JARs: OK ({len(jars)} found)")

    advanced = LIB_DIR / "gridstore-advanced.jar"
    if not advanced.is_file():
        print(
            "Cloud JAR: MISSING (copy gridstore-advanced.jar into lib/)",
            file=sys.stderr,
        )
        return 2

    print("Cloud JAR: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
