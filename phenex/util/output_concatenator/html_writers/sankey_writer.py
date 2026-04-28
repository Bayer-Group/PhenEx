import json
from pathlib import Path
from typing import List, Optional

from phenex.util import create_logger
from .base_html_writer import _BaseHtmlWriter

logger = create_logger(__name__)


class SankeyWriter(_BaseHtmlWriter):
    """Generates a combined Sankey diagram HTML from per-cohort TPA JSON files."""

    def write(
        self,
        report_type: str,
        report_files: List[Optional[Path]],
        cohort_dirs: List[Path],
        output_file: Path,
        version: str = "unknown",
    ) -> None:
        from phenex.reporting.treatment_pattern_analysis_sankey import (
            _build_sankey_html,
        )

        all_entries = []
        for cohort_dir, json_file in zip(cohort_dirs, report_files):
            if json_file is None:
                continue
            try:
                with json_file.open() as f:
                    data = json.load(f)
                for entry in data.get("sankey_data", []):
                    labeled = dict(entry)
                    labeled["tpa_name"] = (
                        f"{cohort_dir.name} — {entry.get('tpa_name', '')}"
                    )
                    all_entries.append(labeled)
            except Exception as e:
                logger.warning(f"Could not read sankey data from {json_file}: {e}")

        if not all_entries:
            logger.warning(
                f"No sankey data found for {report_type}; skipping HTML generation."
            )
            return

        html_path = output_file.with_name(output_file.stem + f"_{report_type}.html")
        html_path.write_text(
            _build_sankey_html(all_entries, version=version), encoding="utf-8"
        )
        logger.info(f"Generated sankey HTML: {html_path}")
