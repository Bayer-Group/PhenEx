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
        "html,body{height:100%;overflow:hidden}\n"
        ".header{position:sticky;top:0;background:#fff;z-index:10;"
        "padding:20px 20px 0 20px;flex-shrink:0}\n"
        ".content{flex:1;overflow-y:auto;padding:16px 20px 60px 20px}\n"
        ".chart-section{margin-bottom:32px}\n"
        ".chart-section h2{font-size:15px;font-weight:bold;color:#333;"
        "margin:0 0 8px 0;border-bottom:1px solid #eee;padding-bottom:4px}\n"
        ".summary-table{border-collapse:collapse;font-size:12px;margin-top:4px}\n"
        ".summary-table th,.summary-table td{padding:3px 10px;text-align:right;"
        "border-bottom:1px solid #eee}\n"
        ".summary-table th{color:#999;font-weight:normal}\n"
        ".tab-bar{display:flex;gap:0;margin:8px 0 0 0;border-bottom:2px solid #ddd}\n"
        ".tab-btn{padding:8px 24px;font-size:13px;font-weight:bold;cursor:pointer;"
        "border:none;background:none;color:#999;border-bottom:2px solid transparent;"
        "margin-bottom:-2px;transition:color .15s,border-color .15s}\n"
        ".tab-btn.active{color:#333;border-bottom-color:#4e79a7}\n"
        ".tab-btn.disabled{color:#ccc;cursor:default}\n"
        ".tab-panel{display:none}\n"
        ".tab-panel.active{display:block}\n"
        ".section-header{font-size:14px;font-weight:bold;color:#4e79a7;"
        "margin:24px 0 12px 0;padding:6px 12px;background:#f0f4f8;"
        "border-left:3px solid #4e79a7;border-radius:0 4px 4px 0}\n"
        ".section-header:first-child{margin-top:0}\n"
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
            '</head>\n<body style="display:flex;flex-direction:column;'
            'padding:0;margin:0">\n'
            '<div class="header">\n'
            '<h1 style="margin:0 0 8px 0">Baseline Characteristics</h1>\n'
            '<div class="controls" id="controls">'
            "<label>Cohorts:</label></div>\n"
            '<div class="tab-bar" id="tab-bar">'
            '<button class="tab-btn active" data-tab="boolean">Boolean</button>'
            '<button class="tab-btn" data-tab="categorical">Categorical</button>'
            '<button class="tab-btn" data-tab="numeric">Numeric</button>'
            "</div>\n</div>\n"
            '<div class="content">\n'
            '<div class="tab-panel active" id="panel-boolean"></div>\n'
            '<div class="tab-panel" id="panel-categorical"></div>\n'
            '<div class="tab-panel" id="panel-numeric"></div>\n'
            "</div>\n"
            + footer_html
            + "\n<script>\nvar DATA = "
            + data_json
            + ";\n"
            + _COHORT_SELECTOR_JS
            + "\n"
            + _TABLE1_VIZ_JS
            + "\n</script>\n</body>\n</html>"
        )
