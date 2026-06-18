#!/usr/bin/env python3
"""Build a self-contained static HTML report from combined JSON files.

Usage:
    python scripts/build_static_report.py <study_dir> [--shell <path>]

Reads the combined JSON files produced by ``report_concatenator.py`` from
``<study_dir>`` and injects them into the pre-built React shell HTML
(produced by ``vite build --config vite.config.static.ts`` in ``app/ui``).

The output is a single HTML file that contains all data and code — it can
be opened directly in a browser with no server required.

Output:
    <study_dir>/index.html
"""

import argparse
import json

from phenex.core.study_manifest import execution_info_dict
import math
import sys
from pathlib import Path


_SCRIPT_DIR = Path(__file__).resolve().parent
_DEFAULT_SHELL = (
    _SCRIPT_DIR.parent / "app" / "ui" / "dist-static" / "static-report.html"
)

# Files to read from the study directory  →  key in __REPORT_DATA__
_DATA_FILES = [
    ("combined_table1.json", "table1"),
    ("combined_table1_outcomes.json", "table1_outcomes"),
    ("table1_value_distributions.json", "kdes"),
    ("table1_outcomes_value_distributions.json", "kdes_outcomes"),
    ("combined_waterfall.json", "waterfall"),
    ("combined_Table2.json", "table2"),
    ("combined_TimeToEvent.json", "timeToEvent"),
    ("study_registry.json", "studyRegistry"),
    ("cohort_descriptions.json", "cohortDescriptions"),
    ("reports.json", "reports"),
]


def _nan_safe_json(obj):
    """JSON encoder that converts NaN/Inf to None."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
    raise TypeError


def build_report(study_dir: Path, shell_path: Path) -> Path:
    """Inject data into the shell HTML and write the final report."""
    if not shell_path.is_file():
        print(
            f"Error: Shell HTML not found at {shell_path}\n"
            "Run the Vite static build first:\n"
            "  cd app/ui && npx vite build --config vite.config.static.ts",
            file=sys.stderr,
        )
        sys.exit(1)

    # Collect all data files
    report_data: dict = {}
    for filename, key in _DATA_FILES:
        filepath = study_dir / filename
        if filepath.is_file():
            with filepath.open() as f:
                report_data[key] = json.load(f)
            print(f"  Loaded {filename} ({filepath.stat().st_size / 1024:.0f} KB)")

    if "table1" not in report_data:
        print(f"Error: combined_table1.json not found in {study_dir}", file=sys.stderr)
        sys.exit(1)

    # Add info and run ID
    report_data["info"] = execution_info_dict(study_dir)
    report_data["runId"] = study_dir.name

    # Serialize data
    data_json = json.dumps(report_data, default=_nan_safe_json, separators=(",", ":"))
    data_script = f"<script>window.__REPORT_DATA__={data_json}</script>"

    # Read shell and inject data
    shell_html = shell_path.read_text(encoding="utf-8")

    # Replace <title> with study name
    study_name = report_data.get("info", {}).get("Study Name", "PhenEx Report")
    shell_html = shell_html.replace(
        "<title>PhenEx Report</title>", f"<title>{study_name}</title>"
    )

    if "<!--REPORT_DATA_PLACEHOLDER-->" in shell_html:
        final_html = shell_html.replace("<!--REPORT_DATA_PLACEHOLDER-->", data_script)
    else:
        # Fallback: inject before closing </body>
        final_html = shell_html.replace("</body>", f"{data_script}\n</body>")

    # Write output
    output_path = study_dir / "index.html"
    output_path.write_text(final_html, encoding="utf-8")
    size_kb = output_path.stat().st_size / 1024
    print(f"  Written: {output_path} ({size_kb:.0f} KB)")
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a self-contained static HTML report."
    )
    parser.add_argument(
        "study_dir",
        type=Path,
        help="Path to the study output directory containing combined JSON files.",
    )
    parser.add_argument(
        "--shell",
        type=Path,
        default=_DEFAULT_SHELL,
        help="Path to the pre-built shell HTML (default: app/ui/dist-static/static-report.html)",
    )
    args = parser.parse_args()

    study_dir = args.study_dir.resolve()
    if not study_dir.is_dir():
        print(f"Error: {study_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    print(f"Building static report from {study_dir}")
    build_report(study_dir, args.shell.resolve())


if __name__ == "__main__":
    main()
