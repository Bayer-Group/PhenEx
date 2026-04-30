import json
from pathlib import Path
from typing import List, Optional

from phenex.util import create_logger
from .base_html_writer import _BaseHtmlWriter
from ._cohort_selector_js import _COHORT_SELECTOR_JS
from ._tte_js import _TTE_JS

logger = create_logger(__name__)


class TimeToEventWriter(_BaseHtmlWriter):
    """Generates interactive KM survival curve HTML from per-cohort TTE JSON files."""

    def __init__(self, risk_table_times: Optional[List[int]] = None):
        self.risk_table_times = risk_table_times

    def write(
        self,
        report_type: str,
        report_files: List[Optional[Path]],
        cohort_dirs: List[Path],
        output_file: Path,
        version: str = "unknown",
    ) -> None:
        """Generate a combined time-to-event KM curves HTML for all cohorts."""
        all_cohort_data = []
        for cohort_dir, json_file in zip(cohort_dirs, report_files):
            if json_file is None:
                continue
            try:
                with json_file.open() as f:
                    data = json.load(f)
                rows = data.get("rows", [])
                if rows:
                    all_cohort_data.append(
                        {"cohort_name": cohort_dir.name, "rows": rows}
                    )
            except Exception as e:
                logger.warning(f"Could not read TTE data from {json_file}: {e}")

        if not all_cohort_data:
            logger.warning(
                f"No time-to-event data found for {report_type}; skipping HTML generation."
            )
            return

        html = self._build_html(
            all_cohort_data, version=version, risk_table_times=self.risk_table_times
        )

        html_path = output_file.with_name(output_file.stem + f"_{report_type}.html")
        html_path.write_text(html, encoding="utf-8")
        logger.info(f"Generated time-to-event HTML: {html_path}")

    _EXTRA_CSS = (
        ".outcome-section{margin-bottom:40px}\n"
        ".outcome-title{font-size:16px;font-weight:bold;color:#333;"
        "margin:0 0 8px 0}\n"
        ".risk-table{border-collapse:collapse;font-size:11px;margin-top:2px}\n"
        ".risk-table td{padding:1px 0;text-align:center;min-width:50px}\n"
        ".risk-table .label-cell{text-align:right;padding-right:8px;"
        "font-weight:bold;white-space:nowrap}\n"
    )

    def _build_html(
        self,
        all_cohort_data: List[dict],
        version: str = "unknown",
        risk_table_times: Optional[List[int]] = None,
    ) -> str:
        """Build interactive HTML with multi-select cohort dropdown and KM curves."""
        icon_data_uri = self._get_icon_data_uri()
        footer_html = self._build_footer_html(version, icon_data_uri)
        data_json = json.dumps(all_cohort_data, default=str)
        risk_times_json = json.dumps(risk_table_times) if risk_table_times else "null"

        return (
            '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8">\n'
            "<title>Time to Event \u2014 Kaplan-Meier Curves</title>\n"
            "<style>\n" + self._SHARED_CSS + self._EXTRA_CSS + "</style>\n"
            "</head>\n<body>\n"
            '<h1 style="margin-bottom:8px">Kaplan-Meier Survival Curves</h1>\n'
            '<div class="controls" id="controls">'
            "<label>Cohorts:</label></div>\n"
            '<div class="controls" id="risk-times-control">'
            "<label>Risk times (days):</label>"
            '<input id="risk-times-input" type="text"'
            ' style="width:240px;margin-left:8px;font-size:12px"'
            ' placeholder="auto (6 evenly-spaced)">'
            "</div>\n"
            '<div id="charts"></div>\n'
            + footer_html
            + "\n<script>\nvar DATA = "
            + data_json
            + ";\nvar RISK_TIMES = "
            + risk_times_json
            + ";\n"
            + _COHORT_SELECTOR_JS
            + "\n"
            + _TTE_JS
            + "\n</script>\n</body>\n</html>"
        )
