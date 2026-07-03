"""Build a self-contained static HTML report from combined JSON files.

Reads the combined JSON files produced by ``OutputConcatenator`` and injects
them into the bundled React shell HTML, producing a single ``index.html`` that
can be opened directly in a browser with no server required.
"""

import importlib.resources
import json
import math
from pathlib import Path

from phenex.util import create_logger

logger = create_logger(__name__)

# Files to read from the study directory  →  key in window.__REPORT_DATA__
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


def _get_shell_html() -> str | None:
    """Return the bundled React shell HTML as a string, or None if not found."""
    try:
        ref = importlib.resources.files("phenex.reporting").joinpath(
            "static_report_shell.html"
        )
        return ref.read_text(encoding="utf-8")
    except (FileNotFoundError, TypeError):
        return None


def _parse_info_txt(study_dir: Path) -> dict:
    info_file = study_dir / "info.txt"
    if not info_file.is_file():
        return {}
    result = {}
    for line in info_file.read_text().splitlines():
        if ":" in line and not line.startswith("="):
            key, _, value = line.partition(":")
            key, value = key.strip(), value.strip()
            if key and value:
                result[key] = value
    return result


def _nan_safe_json(obj):
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    raise TypeError


def build_static_report(study_dir: str | Path) -> Path | None:
    """Inject combined JSON data into the shell HTML and write ``index.html``.

    Parameters
    ----------
    study_dir:
        Path to the study execution directory containing the combined JSON
        files produced by ``OutputConcatenator``.

    Returns
    -------
    Path to the written ``index.html``, or ``None`` if the shell HTML is not
    available (e.g. a development install without the bundled resource).
    """
    study_dir = Path(study_dir)

    shell_html = _get_shell_html()
    if shell_html is None:
        logger.warning(
            "Static report shell HTML not found in package resources. "
            "index.html will not be generated."
        )
        return None

    report_data: dict = {}
    for filename, key in _DATA_FILES:
        filepath = study_dir / filename
        if filepath.is_file():
            with filepath.open() as f:
                report_data[key] = json.load(f)
            logger.info(f"Loaded {filename} ({filepath.stat().st_size / 1024:.0f} KB)")

    if "table1" not in report_data:
        logger.warning(
            f"combined_table1.json not found in {study_dir}. "
            "index.html will not be generated."
        )
        return None

    report_data["info"] = _parse_info_txt(study_dir)
    report_data["runId"] = study_dir.name

    data_json = json.dumps(report_data, default=_nan_safe_json, separators=(",", ":"))
    data_script = f"<script>window.__REPORT_DATA__={data_json}</script>"

    study_name = report_data.get("info", {}).get("Study Name", "PhenEx Report")
    shell_html = shell_html.replace(
        "<title>PhenEx Report</title>", f"<title>{study_name}</title>"
    )

    if "<!--REPORT_DATA_PLACEHOLDER-->" in shell_html:
        final_html = shell_html.replace("<!--REPORT_DATA_PLACEHOLDER-->", data_script)
    else:
        final_html = shell_html.replace("</body>", f"{data_script}\n</body>")

    output_path = study_dir / "index.html"
    output_path.write_text(final_html, encoding="utf-8")
    logger.info(
        f"Static report written to {output_path} ({output_path.stat().st_size / 1024:.0f} KB)"
    )
    return output_path
