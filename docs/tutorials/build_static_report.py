#!/usr/bin/env python3
"""Build a self-contained static HTML report from combined JSON files.

Usage:
    python build_static_report.py <study_dir>

This is a thin CLI wrapper around ``phenex.reporting.build_static_report``.
The ``index.html`` is now also generated automatically when ``Study.execute()``
runs, so you only need this script to regenerate the report from an existing
study execution directory.
"""

import argparse
import sys
from pathlib import Path

from phenex.reporting import build_static_report


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a self-contained static HTML report."
    )
    parser.add_argument(
        "study_dir",
        type=Path,
        help="Path to the study execution directory containing combined JSON files.",
    )
    args = parser.parse_args()

    study_dir = args.study_dir.resolve()
    if not study_dir.is_dir():
        print(f"Error: {study_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    print(f"Building static report from {study_dir}")
    output = build_static_report(study_dir)
    if output is None:
        sys.exit(1)


if __name__ == "__main__":
    main()
