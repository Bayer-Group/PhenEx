import math
import re
from pathlib import Path
from typing import Dict, List, Optional

from openpyxl.styles import Alignment, Border, Side

from .base_sheet_writer import _BaseSheetWriter
from ..cohort_group import CohortGroup


class InfoSheetWriter(_BaseSheetWriter):
    """Writes the Info sheet: PhenEx version, cohort sizes, and study description.

    Layout::

        Row 1  : "Executed with PhenEx v<version>"
        Row 2  : blank
        Row 3  : column headers  Cohort | Final N
        Row 4+ : one row per cohort
        blank row
        description lines starting in col B, one row per line;
        Markdown # / ## / ### headers are rendered with larger font.
    """

    _HEADER_SIZES: Dict[int, int] = {1: 20, 2: 16, 3: 14}

    _SHEET_INFO_TABLE = [
        ("Sheet", "Description"),
        (
            "INCLUSION EXCLUSION",
            "Shows how the study entry criterion, inclusion and exclusion criteria result in the final cohort sizes.",
        ),
        ("CHARACTERISTICS", "Characterizes populations at study entry date."),
        ("OUTCOMES", "Characterizes populations after study entry date."),
        (
            "\u2026 all",
            "Displays all boolean, numeric and categorical study elements within a single table.",
        ),
        (
            "\u2026 boolean",
            "Displays only boolean study elements \u2014 the number of patients that have or do not have a given element. "
            "For numeric values, this identifies missingness.",
        ),
        (
            "\u2026 numeric",
            "Displays numeric and categorical study elements horizontally \u2014 summary statistics for numeric values, N and % for each category.",
        ),
        (
            "\u2026 (detailed)",
            "Displays subcomponents of study elements (e.g. if Diabetes is composed of Type 1 and Type 2, counts for "
            "each component are shown). Identical to the non-detailed version when no subcomponents are present.",
        ),
    ]

    def write(
        self,
        sheet,
        cohort_dirs: List[Path],
        study_path: Path,
        description: Optional[str],
        cohort_groups: Optional[List[CohortGroup]] = None,
    ) -> None:
        self._set_default_row_height(sheet)
        sheet.column_dimensions["A"].width = self._SPACING_SIZE
        sheet.column_dimensions["B"].width = 34
        sheet.column_dimensions["C"].width = 14
        sheet.column_dimensions["D"].width = 80

        current_row = 1

        # Description at the top
        if description:
            for line in description.splitlines():
                text, font_size, bold = self._parse_markdown_line(line)
                if text is not None:
                    self._write_cell(
                        sheet, current_row, 2, text, bold=bold, size=font_size
                    )
                current_row += 1
            current_row += 1  # blank row after description

        # Cohort table header
        self._write_cell(sheet, current_row, 2, "Cohort", bold=True, size=14)
        self._write_cell(
            sheet, current_row, 3, "Final N", bold=True, size=14, horizontal="right"
        )
        current_row += 1

        # Build lookup from dir -> (display_name, color, is_sub)
        dir_to_display: Dict[Path, tuple] = {}
        if cohort_groups:
            for gi, group in enumerate(cohort_groups):
                color = self._COHORT_COLORS[gi % len(self._COHORT_COLORS)]
                for cohort_dir in group.all_dirs:
                    display = group.display_name(cohort_dir)
                    is_sub = cohort_dir != group.main_dir
                    dir_to_display[cohort_dir] = (display, color, is_sub)

        for cohort_dir in cohort_dirs:
            final_n = self._read_final_n(cohort_dir)
            display, color, is_sub = dir_to_display.get(
                cohort_dir, (cohort_dir.name, None, False)
            )
            # Spacer col: no fill
            self._write_cell(
                sheet,
                current_row,
                2,
                display,
                size=14,
                indent=4 if is_sub else 2,
                fill_color=color,
            )
            self._write_cell(
                sheet,
                current_row,
                3,
                final_n,
                size=14,
                horizontal="right",
                fill_color=color,
                number_format="#,##0" if isinstance(final_n, int) else None,
            )
            current_row += 1

        current_row += 1  # blank row

        # Info section
        self._write_cell(
            sheet,
            current_row,
            2,
            "The following sheets allow comparison of all cohorts, subcohorts and stratifications within this study. "
            "Cohorts are arranged side by side for easy comparison.",
            size=14,
        )
        sheet.row_dimensions[current_row].height = 36
        current_row += 2  # blank row

        # Sheet description table — header row
        sheet_col, desc_col = 2, 4
        thin = Side(style="thin")
        header_bottom = Border(bottom=thin)
        row_border = Border(bottom=Side(style="hair"))

        self._write_cell(
            sheet, current_row, sheet_col, "Sheet name", bold=True, size=14
        )
        self._write_cell(
            sheet, current_row, desc_col, "Description", bold=True, size=14
        )
        for col in (sheet_col, sheet_col + 1, desc_col):
            sheet.cell(row=current_row, column=col).border = header_bottom
        current_row += 1

        # col D width in chars ≈ 80 / 1.27 (ratio of 14pt to default 11pt)
        chars_per_line = 63
        line_height_pt = 20  # 14pt font line height

        for sheet_name, sheet_desc in self._SHEET_INFO_TABLE[1:]:
            name_cell = self._write_cell(
                sheet,
                current_row,
                sheet_col,
                sheet_name,
                size=14,
                bold=(not sheet_name.startswith("\u2026")),
            )
            desc_cell = self._write_cell(
                sheet, current_row, desc_col, sheet_desc, size=14
            )
            desc_cell.alignment = Alignment(wrap_text=True, vertical="top")
            name_cell.alignment = Alignment(vertical="top")
            for col in (sheet_col, sheet_col + 1, desc_col):
                sheet.cell(row=current_row, column=col).border = row_border
            lines = max(1, math.ceil(len(sheet_desc) / chars_per_line))
            sheet.row_dimensions[current_row].height = max(24, lines * line_height_pt)
            current_row += 1

        current_row += 1  # blank row

        # PhenEx version at the bottom
        phenex_version = self._read_phenex_version(study_path)
        self._write_cell(
            sheet,
            current_row,
            2,
            f"Executed with PhenEx v{phenex_version}",
            bold=False,
            size=11,
            font_color=self._GRAY_TEXT,
        )

    # ------------------------------------------------------------------

    def _read_phenex_version(self, study_path: Path) -> str:
        info_file = study_path / "info.txt"
        if info_file.exists():
            for line in info_file.read_text().splitlines():
                if line.startswith("PhenEx Version:"):
                    return line.split(":", 1)[1].strip()
        return "unknown"

    def _read_final_n(self, cohort_dir: Path):
        """Return the final cohort size from Waterfall.json ('Remaining' of last row)."""
        json_file = cohort_dir / "Waterfall.json"
        if json_file.exists():
            try:
                data = self._load_json(json_file)
                rows = data.get("rows", [])
                if rows:
                    return rows[-1].get("Remaining", "-")
            except Exception:
                pass
        return "-"

    def _parse_markdown_line(self, line: str):
        """Return (text, font_size, bold) for a single markdown line.

        Returns (None, ...) for blank lines to signal an empty row.
        """
        # ATX headers: up to three levels
        for level in (3, 2, 1):
            prefix = "#" * level + " "
            if line.startswith(prefix):
                return line[len(prefix) :], self._HEADER_SIZES.get(level, 11), True

        # Unordered list
        if line.startswith("- ") or line.startswith("* "):
            return "\u2022 " + line[2:], 14, False

        # Ordered list
        m = re.match(r"^\d+\.\s+(.*)", line)
        if m:
            return line, 14, False

        # Blank line
        if not line.strip():
            return None, 14, False

        # Plain text
        return line, 14, False
