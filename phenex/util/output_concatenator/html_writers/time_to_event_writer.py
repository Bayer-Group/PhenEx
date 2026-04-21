import json
from pathlib import Path
from typing import List, Optional

from phenex.util import create_logger
from .base_html_writer import _BaseHtmlWriter
from ._tte_js import _TTE_JS

logger = create_logger(__name__)


class TimeToEventWriter(_BaseHtmlWriter):
    """Generates interactive KM survival curve HTML from per-cohort TTE JSON files."""

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

        html = self._build_html(all_cohort_data, version=version)

        html_path = output_file.with_name(output_file.stem + f"_{report_type}.html")
        html_path.write_text(html, encoding="utf-8")
        logger.info(f"Generated time-to-event HTML: {html_path}")

    def _build_html(self, all_cohort_data: List[dict], version: str = "unknown") -> str:
        """Build interactive HTML with multi-select cohort dropdown and KM curves."""
        icon_data_uri = self._get_icon_data_uri()
        footer_html = self._build_footer_html(version, icon_data_uri)
        data_json = json.dumps(all_cohort_data, default=str)

        return (
            '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8">\n'
            "<title>Time to Event \u2014 Kaplan-Meier Curves</title>\n"
            "<style>\n"
            "body{font-family:Arial,sans-serif;background:#fff;margin:0;"
            "padding:20px 20px 60px 20px}\n"
            ".controls{margin-bottom:24px;display:flex;flex-wrap:wrap;gap:8px;"
            "align-items:center}\n"
            ".controls label{font-size:13px;font-weight:bold;color:#555;"
            "margin-right:4px}\n"
            ".cohort-btn{padding:5px 14px;border-radius:16px;border:2px solid #ccc;"
            "background:#fff;font-size:12px;cursor:pointer;transition:all .15s}\n"
            ".cohort-btn.active{color:#fff}\n"
            ".outcome-section{margin-bottom:40px}\n"
            ".outcome-title{font-size:16px;font-weight:bold;color:#333;"
            "margin:0 0 8px 0}\n"
            ".risk-table{border-collapse:collapse;font-size:11px;margin-top:2px}\n"
            ".risk-table td{padding:1px 0;text-align:center;min-width:50px}\n"
            ".risk-table .label-cell{text-align:right;padding-right:8px;"
            "font-weight:bold;white-space:nowrap}\n"
            ".phenex-footer{position:fixed;bottom:0;left:0;padding:10px 16px;"
            "display:flex;align-items:center;gap:8px;"
            "background:rgba(255,255,255,0.9);z-index:9999}\n"
            ".phenex-footer img{height:24px;width:auto}\n"
            ".phenex-footer span{font-size:11px;color:#999}\n"
            "</style>\n"
            "</head>\n<body>\n"
            '<h1 style="margin-bottom:8px">Kaplan-Meier Survival Curves</h1>\n'
            '<div class="controls" id="controls">'
            "<label>Cohorts:</label></div>\n"
            '<div id="charts"></div>\n' + footer_html + "\n<script>\n"
            "var DATA = "
            + data_json
            + ";\n"
            + _TTE_JS
            + "\n</script>\n</body>\n</html>"
        )
