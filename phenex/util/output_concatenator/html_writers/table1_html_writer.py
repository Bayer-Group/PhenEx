import json
from pathlib import Path
from typing import List, Optional

from phenex.util import create_logger
from .base_html_writer import _BaseHtmlWriter
from ._cohort_selector_js import _COHORT_SELECTOR_JS
from ._table1_visualization_js import _TABLE1_VIZ_JS

logger = create_logger(__name__)


class Table1HtmlWriter(_BaseHtmlWriter):
    """Generates interactive Table1 characteristic visualizations as HTML."""

    _EXTRA_CSS = (
        ".chart-section{margin-bottom:32px}\n"
        ".chart-section h2{font-size:15px;font-weight:bold;color:#333;"
        "margin:0 0 8px 0;border-bottom:1px solid #eee;padding-bottom:4px}\n"
        ".summary-table{border-collapse:collapse;font-size:12px;margin-top:4px}\n"
        ".summary-table th,.summary-table td{padding:3px 10px;text-align:right;"
        "border-bottom:1px solid #eee}\n"
        ".summary-table th{color:#999;font-weight:normal}\n"
    )

    def write(
        self,
        report_type: str,
        report_files: List[Optional[Path]],
        cohort_dirs: List[Path],
        output_file: Path,
        version: str = "unknown",
    ) -> None:
        all_cohort_data = []
        for cohort_dir, json_file in zip(cohort_dirs, report_files):
            if json_file is None:
                continue
            try:
                with json_file.open() as f:
                    data = json.load(f)
                rows = data.get("rows", [])
                if rows:
                    entry = {"cohort_name": cohort_dir.name, "rows": rows}
                    if "value_distributions" in data:
                        entry["value_distributions"] = data["value_distributions"]
                    if "sections" in data:
                        entry["sections"] = data["sections"]
                    all_cohort_data.append(entry)
            except Exception as e:
                logger.warning(f"Could not read Table1 data from {json_file}: {e}")

        if not all_cohort_data:
            logger.warning(
                f"No Table1 data found for {report_type}; skipping HTML generation."
            )
            return

        html = self._build_html(all_cohort_data, version=version)
        html_path = output_file.with_name(
            output_file.stem + f"_{report_type}_visualization.html"
        )
        html_path.write_text(html, encoding="utf-8")
        logger.info(f"Generated Table1 visualization HTML: {html_path}")

    def _build_html(
        self, all_cohort_data: List[dict], version: str = "unknown"
    ) -> str:
        icon_data_uri = self._get_icon_data_uri()
        footer_html = self._build_footer_html(version, icon_data_uri)
        data_json = json.dumps(all_cohort_data, default=str)

        return (
            '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8">\n'
            "<title>Baseline Characteristics</title>\n"
            "<style>\n"
            + self._SHARED_CSS
            + self._EXTRA_CSS
            + "</style>\n"
            "</head>\n<body>\n"
            '<h1 style="margin-bottom:8px">Baseline Characteristics</h1>\n'
            '<div class="controls" id="controls">'
            "<label>Cohorts:</label></div>\n"
            '<div id="charts"></div>\n'
            + footer_html
            + "\n<script>\nvar DATA = "
            + data_json
            + ";\n"
            + _COHORT_SELECTOR_JS
            + "\n"
            + _TABLE1_VIZ_JS
            + "\n</script>\n</body>\n</html>"
        )
