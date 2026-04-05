"""
Excel Output Concatenator for Study Reports

Reads per-cohort JSON reporter outputs and assembles them into a single
multi-sheet Excel file for cross-cohort comparison.
"""

import json
import math
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import openpyxl
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from phenex.util import create_logger

logger = create_logger(__name__)


# ---------------------------------------------------------------------------
# Cohort grouping
# ---------------------------------------------------------------------------


@dataclass
class CohortGroup:
    """A main cohort and its associated subcohorts."""

    name: str
    main_dir: Path
    subcohort_dirs: List[Path] = field(default_factory=list)

    @property
    def all_dirs(self) -> List[Path]:
        return [self.main_dir] + self.subcohort_dirs

    def display_name(self, cohort_dir: Path) -> str:
        if cohort_dir == self.main_dir:
            return self.name
        return cohort_dir.name.replace(f"{self.name}__", "")


# ---------------------------------------------------------------------------
# Shared sheet-writing utilities
# ---------------------------------------------------------------------------


class _BaseSheetWriter:
    """Low-level cell and sheet helpers shared by all writers."""

    # Row layout constants (1-indexed Excel rows)
    _SPACING_ROW = 1
    _TITLE_ROW = 2
    _SUBTITLE_ROW = 3
    _HEADER_ROW = 4
    _DATA_START_ROW = 5

    _SPACING_SIZE = 3
    _ROW_BACKGROUND_1 = "ededed"
    _SECTION_HEADER_COLOR = "FFFFFF"
    _GRAY_TEXT = "808080"
    _FONT = "Arial"
    _BOOLEAN_COLUMNS = {"N", "Pct"}
    _COLUMN_DISPLAY_NAMES = {"Pct": "%"}

    _COHORT_COLORS: List[str] = [
        "D6E4F0",  # light blue
        "D9EAD3",  # light green
        "FDE5CC",  # light orange
        "F4CCCC",  # light red
        "D9D2E9",  # light purple
        "D0E0E3",  # light teal
        "FFF2CC",  # light yellow
        "EAD1DC",  # light pink
        "CFE2F3",  # light sky
        "E6D8C3",  # light tan
    ]

    # Row type -> background fill colour (ARGB hex, no leading #)
    _WATERFALL_COLORS: Dict[str, str] = {
        "info": "DCDCDC",
        "entry": "9DC3E6",
        "inclusion": "C5E0B4",
        "exclusion": "F4B8A0",
        "component": "E2EFD9",
    }

    def _write_cell(
        self,
        sheet,
        row: int,
        col: int,
        value,
        bold: bool = False,
        italic: bool = False,
        size: int = 14,
        horizontal: str = "left",
        vertical: str = "center",
        indent: int = 0,
        fill_color: Optional[str] = None,
        number_format: Optional[str] = None,
        font_color: Optional[str] = None,
    ):
        cell = sheet.cell(row=row, column=col, value=value)
        cell.font = Font(name=self._FONT, bold=bold, italic=italic, size=size, color=font_color)
        cell.alignment = Alignment(
            horizontal=horizontal, vertical=vertical, indent=indent
        )
        if fill_color:
            cell.fill = PatternFill(
                start_color=fill_color, end_color=fill_color, fill_type="solid"
            )
        if number_format:
            cell.number_format = number_format
        return cell

    def _add_group_title(self, sheet, title: str, start_col: int, end_col: int, color: str = "D3D3D3"):
        """Write main cohort name in the title row, merged across group columns."""
        cell = self._write_cell(
            sheet,
            self._TITLE_ROW,
            start_col,
            title,
            italic=True,
            size=18,
            horizontal="left",
            indent=2,
            fill_color=color,
        )
        cell.border = Border()
        if end_col > start_col:
            sheet.merge_cells(
                start_row=self._TITLE_ROW,
                start_column=start_col,
                end_row=self._TITLE_ROW,
                end_column=end_col,
            )

    def _add_subcohort_header(
        self, sheet, name: str, start_col: int, num_cols: int, color: str = "E8E8E8"
    ):
        """Write individual cohort/subcohort name in the subtitle row."""
        self._write_cell(
            sheet,
            self._SUBTITLE_ROW,
            start_col,
            name,
            italic=True,
            size=14,
            horizontal="left",
            indent=2,
            fill_color=color,
        )
        if num_cols > 1:
            sheet.merge_cells(
                start_row=self._SUBTITLE_ROW,
                start_column=start_col,
                end_row=self._SUBTITLE_ROW,
                end_column=start_col + num_cols - 1,
            )

    def _apply_group_border(self, sheet, start_col: int, end_col: int, color: str = "000000"):
        """Draw a thin border around the cohort group from title row to last data row."""
        max_row = sheet.max_row
        top_row = self._TITLE_ROW
        side = Side(style="thin", color=color)
        for row in range(top_row, max_row + 1):
            for col in range(start_col, end_col + 1):
                cell = sheet.cell(row=row, column=col)
                existing = cell.border
                cell.border = Border(
                    left=side if col == start_col else existing.left,
                    right=side if col == end_col else existing.right,
                    top=side if row == top_row else existing.top,
                    bottom=side if row == max_row else existing.bottom,
                )

    def _apply_spacing(self, sheet, spacing_col: int):
        """Set spacing column width and spacing row height."""
        sheet.column_dimensions[get_column_letter(spacing_col)].width = (
            self._SPACING_SIZE
        )
        sheet.row_dimensions[self._SPACING_ROW].height = self._SPACING_SIZE * 5

    def _apply_left_border_to_column(self, sheet, col: int, color: str = "000000"):
        """Draw a thin left border on every cell in a column."""
        side = Side(style="thin", color=color)
        for row in range(self._TITLE_ROW, sheet.max_row + 1):
            cell = sheet.cell(row=row, column=col)
            existing = cell.border
            cell.border = Border(
                left=side,
                right=existing.right,
                top=existing.top,
                bottom=existing.bottom,
            )

    @staticmethod
    def _number_format_for_value(value) -> Optional[str]:
        """Return an Excel number format code suitable for value."""
        if value is None:
            return None
        if isinstance(value, int):
            return "#,##0"
        if isinstance(value, float):
            return "0.0"
        return None

    @staticmethod
    def _level_to_gray_hex(level) -> Optional[str]:
        """Return a 6-char ARGB hex fill colour for a component nesting level, or None."""
        try:
            lvl = int(level)
        except (TypeError, ValueError):
            return None
        if lvl <= 0:
            return None
        value = max(235 - 20 * (lvl - 1), 100)
        return f"{value:02X}{value:02X}{value:02X}"

    def _set_default_row_height(self, sheet, height: float = 24.0) -> None:
        sheet.sheet_format.defaultRowHeight = height
        sheet.sheet_format.customHeight = True
        sheet.row_dimensions[self._TITLE_ROW].height = 34
        sheet.row_dimensions[self._SUBTITLE_ROW].height = 28

    @staticmethod
    def _load_json(path: Path) -> Dict:
        with path.open() as f:
            return json.load(f)


# ---------------------------------------------------------------------------
# Generic side-by-side writer  (Waterfall and custom reporters)
# ---------------------------------------------------------------------------


class GenericSheetWriter(_BaseSheetWriter):
    """Writes multiple JSON report files side-by-side into a single worksheet.

    For Waterfall reports the ``Type`` column drives row background colours.
    """

    def write(
        self,
        sheet,
        report_files: List[Optional[Path]],
        cohort_dirs: List[Path],
        cohort_groups: List["CohortGroup"],
    ):
        self._set_default_row_height(sheet)
        columns = self._get_column_order(report_files)
        if not columns:
            return

        dir_to_report = dict(zip(cohort_dirs, report_files))
        num_cols = len(columns)
        current_col = 1

        for gi, group in enumerate(cohort_groups):
            group_color = self._COHORT_COLORS[gi % len(self._COHORT_COLORS)]
            self._apply_spacing(sheet, spacing_col=current_col)
            current_col += 1
            group_start_col = current_col

            for cohort_dir in group.all_dirs:
                report_file = dir_to_report.get(cohort_dir)
                if report_file is None:
                    continue
                is_subcohort = cohort_dir != group.main_dir
                try:
                    data = self._load_json(report_file)
                    rows = data.get("rows", [])

                    display_name = group.display_name(cohort_dir)
                    self._add_subcohort_header(
                        sheet, display_name, current_col, num_cols, color=group_color
                    )
                    self._write_column_headers(sheet, columns, current_col)
                    self._write_data_rows(sheet, rows, columns, current_col)
                    self._set_column_widths(sheet, rows, columns, current_col)

                    if is_subcohort:
                        self._apply_left_border_to_column(sheet, current_col, color=group_color)

                    current_col += num_cols
                except Exception as e:
                    logger.warning(f"Failed to process {report_file}: {e}")

            group_end_col = current_col - 1
            if group_end_col >= group_start_col:
                self._add_group_title(
                    sheet, group.name, group_start_col, group_end_col, color=group_color
                )
                self._apply_group_border(sheet, group_start_col, group_end_col, color=group_color)

    def _get_column_order(self, report_files: List[Optional[Path]]) -> List[str]:
        for f in report_files:
            if f is None:
                continue
            try:
                data = self._load_json(f)
                rows = data.get("rows", [])
                if rows:
                    return list(rows[0].keys())
            except Exception:
                pass
        return []

    def _write_column_headers(self, sheet, columns: List[str], start_col: int):
        for offset, col_name in enumerate(columns):
            col = start_col + offset
            cell = self._write_cell(
                sheet,
                self._HEADER_ROW,
                col,
                col_name,
                bold=True,
                size=14,
                horizontal="center",
                fill_color="366092",
            )
            cell.font = Font(name=self._FONT, bold=True, size=14, color="FFFFFF")

    def _write_data_rows(self, sheet, rows, columns, start_col: int):
        display_rows = self._sparsify_type(rows) if "Type" in columns else rows
        for row_idx, (orig_row, disp_row) in enumerate(zip(rows, display_rows), start=self._DATA_START_ROW):
            row_type = str(orig_row.get("Type", "")).lower()
            fill_color = self._WATERFALL_COLORS.get(row_type)
            for offset, col_name in enumerate(columns):
                value = disp_row.get(col_name)
                fmt = self._number_format_for_value(value)
                self._write_cell(
                    sheet,
                    row_idx,
                    start_col + offset,
                    value,
                    size=14,
                    horizontal="center",
                    fill_color=fill_color,
                    number_format=fmt,
                )

    @staticmethod
    def _sparsify_type(rows: list) -> list:
        """Return a copy of rows with Type showing only on the first row of each group."""
        previous_type = None
        result = []
        for row in rows:
            row_copy = dict(row)
            type_val = str(row_copy.get("Type", ""))
            if type_val and type_val != previous_type and type_val.lower() != "component":
                previous_type = type_val
            else:
                row_copy["Type"] = ""
            result.append(row_copy)
        return result

    def _set_column_widths(self, sheet, rows, columns, start_col: int):
        for offset, col_name in enumerate(columns):
            values = [str(r.get(col_name, "")) for r in rows] + [col_name]
            width = max((len(v) for v in values if v), default=8) + 2
            sheet.column_dimensions[get_column_letter(start_col + offset)].width = min(
                width, 40
            )


# ---------------------------------------------------------------------------
# Table1 aligned writer with section headers
# ---------------------------------------------------------------------------


class Table1SheetWriter(_BaseSheetWriter):
    """Writes Table1 JSON files into a single aligned worksheet.

    Layout::

        Row 1  : spacing row
        Row 2  : main cohort name banner per group (merged)
        Row 3  : individual cohort/subcohort name per block
        Row 4  : column labels per cohort block
        Row 5+ : characteristic rows; section-header rows interleaved

    Column A is a narrow spacer that mirrors row colours.
    Column B holds the characteristic names.

    Section headers appear as full-width blue-grey rows when the first cohort
    JSON contains a ``sections`` dict mapping section names to characteristic
    display names.
    """

    def write(
        self,
        sheet,
        report_files: List[Optional[Path]],
        cohort_dirs: List[Path],
        cohort_groups: List["CohortGroup"],
        boolean_only: bool = False,
    ):
        self._set_default_row_height(sheet)
        master_names, sections, name_to_level = self._build_master_names_and_sections(
            report_files
        )
        if not master_names:
            return

        expanded = self._build_expanded_rows(master_names, sections, name_to_level)
        alternate_fills = self._compute_alternate_fills(expanded, name_to_level)
        self._write_name_column(sheet, expanded, name_to_level, alternate_fills)

        dir_to_report = dict(zip(cohort_dirs, report_files))
        current_col = 3
        spacing_cols: List[int] = []

        for gi, group in enumerate(cohort_groups):
            group_color = self._COHORT_COLORS[gi % len(self._COHORT_COLORS)]
            spacing_cols.append(current_col)
            self._apply_spacing(sheet, spacing_col=current_col)
            current_col += 1
            group_start_col = current_col

            for cohort_dir in group.all_dirs:
                report_file = dir_to_report.get(cohort_dir)
                if report_file is None:
                    continue
                is_subcohort = cohort_dir != group.main_dir
                try:
                    data = self._load_json(report_file)
                    rows = data.get("rows", [])
                    columns = [
                        c
                        for c in (rows[0].keys() if rows else [])
                        if c not in ("Name", "_level")
                    ]
                    if boolean_only:
                        columns = [c for c in columns if c in self._BOOLEAN_COLUMNS]
                    if not columns:
                        continue
                    num_value_cols = len(columns)

                    display_name = group.display_name(cohort_dir)
                    self._add_subcohort_header(
                        sheet, display_name, current_col, num_value_cols, color=group_color
                    )
                    pct_offset = self._write_column_labels(
                        sheet, columns, current_col
                    )
                    self._write_value_rows(
                        sheet,
                        rows,
                        columns,
                        expanded,
                        current_col,
                        pct_offset,
                        name_to_level,
                        alternate_fills,
                    )
                    self._set_value_column_widths(sheet, rows, columns, current_col)

                    if is_subcohort:
                        self._apply_left_border_to_column(sheet, current_col, color=group_color)

                    current_col += num_value_cols

                except Exception as e:
                    logger.warning(f"Failed to process {report_file}: {e}")

            group_end_col = current_col - 1
            if group_end_col >= group_start_col:
                self._add_group_title(
                    sheet, group.name, group_start_col, group_end_col, color=group_color
                )
                self._apply_group_border(sheet, group_start_col, group_end_col, color=group_color)

        # Apply section-header spans, skipping spacer columns
        self._apply_section_header_spans(sheet, expanded, sheet.max_column, spacing_cols)

    # ------------------------------------------------------------------

    def _build_master_names_and_sections(
        self, report_files: List[Optional[Path]]
    ) -> Tuple[List[str], Optional[Dict], Dict[str, int]]:
        """Return (master_names, sections, name_to_level) aggregated across all JSON files."""
        seen: Dict[str, None] = {}  # insertion-ordered set
        sections = None
        name_to_level: Dict[str, int] = {}
        for report_file in report_files:
            if report_file is None:
                continue
            try:
                data = self._load_json(report_file)
                if sections is None:
                    sections = data.get("sections")
                for row in data.get("rows", []):
                    name = row.get("Name")
                    if name is not None:
                        name_str = str(name)
                        seen[name_str] = None
                        level = row.get("_level", 0)
                        if name_str not in name_to_level and level:
                            name_to_level[name_str] = int(level)
            except Exception as e:
                logger.warning(f"Could not read {report_file}: {e}")
        return list(seen.keys()), sections, name_to_level

    def _build_expanded_rows(
        self, master_names: List[str], sections: Optional[Dict],
        name_to_level: Dict[str, int] = None,
    ) -> List[Tuple[str, str]]:
        """Return list of (row_type, value) with section headers interleaved.

        ``row_type`` is ``"section"`` for section-header rows and ``"row"``
        for data rows.
        """
        if not sections:
            return [("row", n) for n in master_names]

        insert_at: Dict[int, str] = {}
        for section_name, char_names in sections.items():
            for idx, name in enumerate(master_names):
                if self._name_belongs_to_chars(name, char_names):
                    if idx not in insert_at:
                        insert_at[idx] = section_name
                    break

        result: List[Tuple[str, str]] = []
        section_start_indices = sorted(insert_at.keys())

        # Build a mapping: master_names index -> which section it belongs to
        current_section_idx = -1
        owner: List[int] = []
        for idx in range(len(master_names)):
            if idx in insert_at:
                current_section_idx = idx
            owner.append(current_section_idx)

        for idx, name in enumerate(master_names):
            if idx in insert_at:
                result.append(("section", insert_at[idx]))
            result.append(("row", name))
            # Add spacer after the last row of this section
            is_last = idx == len(master_names) - 1
            next_in_different_section = (
                not is_last and owner[idx + 1] != owner[idx]
            )
            if owner[idx] >= 0 and (is_last or next_in_different_section):
                result.append(("spacer", ""))
        return self._insert_binned_spacers(result, name_to_level or {})

    @staticmethod
    def _is_binned(name: str, name_to_level: Dict[str, int]) -> bool:
        """A row is binned if it contains '=' and is not a component (level 0)."""
        return "=" in name and name_to_level.get(name, 0) == 0

    @staticmethod
    def _insert_binned_spacers(
        expanded: List[Tuple[str, str]],
        name_to_level: Dict[str, int],
    ) -> List[Tuple[str, str]]:
        """Insert a spacer row before each group of binned rows.

        A spacer is not inserted if the binned group is the first data row
        or immediately follows a section header.
        """
        result: List[Tuple[str, str]] = []
        for i, (row_type, value) in enumerate(expanded):
            if row_type == "row" and "=" in value and name_to_level.get(value, 0) == 0:
                prev_type = result[-1][0] if result else None
                prev_is_binned = (
                    prev_type == "row"
                    and "=" in result[-1][1]
                    and name_to_level.get(result[-1][1], 0) == 0
                ) if result else False
                if not prev_is_binned and prev_type not in (None, "section"):
                    result.append(("spacer", ""))
            result.append((row_type, value))
        return result

    def _compute_alternate_fills(
        self,
        expanded: List[Tuple[str, str]],
        name_to_level: Dict[str, int],
    ) -> List[Optional[str]]:
        """Return per-row alternate background fill, or None.

        Resets at each section.  The first eligible row after a section
        header gets no fill; subsequent eligible rows alternate.
        Component rows (level > 0) and spacer rows are always None.
        """
        fills: List[Optional[str]] = []
        counter = 0
        for row_type, value in expanded:
            if row_type == "section":
                counter = 0
                fills.append(None)
            elif row_type == "spacer":
                fills.append(None)
            else:
                if name_to_level.get(value, 0) > 0:
                    fills.append(None)
                else:
                    fills.append(self._ROW_BACKGROUND_1 if counter % 2 == 1 else None)
                    counter += 1
        return fills

    @staticmethod
    def _name_belongs_to_chars(name: str, char_names: List[str]) -> bool:
        for char in char_names:
            if name == char or name.startswith(char + "="):
                return True
        return False

    _NAME_SPACER_COL = 1
    _NAME_COL = 2

    def _write_name_column(
        self,
        sheet,
        expanded: List[Tuple[str, str]],
        name_to_level: Dict[str, int] = None,
        alternate_fills: List[Optional[str]] = None,
    ):
        """Populate col B with characteristic names; col A is a narrow colour spacer."""
        name_to_level = name_to_level or {}
        sheet.column_dimensions[get_column_letter(self._NAME_SPACER_COL)].width = self._SPACING_SIZE

        for i, (row_type, value) in enumerate(expanded):
            out_row = self._DATA_START_ROW + i
            if row_type == "section":
                self._write_cell(
                    sheet, out_row, self._NAME_COL, value,
                    bold=True, size=14, horizontal="left", indent=2,
                    fill_color=self._SECTION_HEADER_COLOR,
                )
                self._write_cell(
                    sheet, out_row, self._NAME_SPACER_COL, None,
                    fill_color=self._SECTION_HEADER_COLOR,
                )
                sheet.row_dimensions[out_row].height = 36
            elif row_type == "spacer":
                sheet.cell(row=out_row, column=self._NAME_COL, value=None)
                sheet.cell(row=out_row, column=self._NAME_SPACER_COL, value=None)
            else:
                is_cohort = value == "Cohort"
                level = name_to_level.get(value, 0)
                gray = self._level_to_gray_hex(level)
                alt = alternate_fills[i] if alternate_fills else None
                fill = gray if gray else alt
                display = None if is_cohort else value
                if display and "=" in display and name_to_level.get(value, 0) == 0:
                    self._write_binned_name_cell(
                        sheet, out_row, self._NAME_COL, display, fill_color=fill,
                    )
                else:
                    self._write_cell(
                        sheet, out_row, self._NAME_COL, display,
                        bold=is_cohort, size=14, horizontal="right", indent=1,
                        fill_color=fill,
                    )
                self._write_cell(
                    sheet, out_row, self._NAME_SPACER_COL, None,
                    fill_color=fill,
                )

        max_name_len = max((len(t[1]) for t in expanded if t[0] == "row"), default=10)
        sheet.column_dimensions[get_column_letter(self._NAME_COL)].width = max(max_name_len * 2.4, 28)
        sheet.freeze_panes = sheet.cell(row=self._DATA_START_ROW + 1, column=self._NAME_COL + 1)

    def _write_binned_name_cell(
        self, sheet, row: int, col: int, value: str, fill_color: Optional[str] = None,
    ):
        """Write a binned phenotype name with the part after '=' in bold."""
        prefix, suffix = value.split("=", 1)
        rich = CellRichText(
            TextBlock(InlineFont(rFont=self._FONT, sz=14), prefix + "="),
            TextBlock(InlineFont(rFont=self._FONT, sz=14, b=True), suffix),
        )
        cell = sheet.cell(row=row, column=col, value=rich)
        cell.alignment = Alignment(horizontal="right", indent=1)
        if fill_color:
            cell.fill = PatternFill(
                start_color=fill_color, end_color=fill_color, fill_type="solid"
            )

    def _write_column_labels(
        self, sheet, columns: List[str], start_col: int
    ) -> Optional[int]:
        """Write column labels in the header row; return 0-based offset of the Pct column."""
        pct_offset = None
        for offset, col_name in enumerate(columns):
            is_pct = col_name.strip().lower() == "pct"
            is_n = col_name.strip().lower() == "n"
            if is_pct:
                pct_offset = offset
            display_name = self._COLUMN_DISPLAY_NAMES.get(col_name, col_name)
            horizontal = "right" if is_n else ("left" if is_pct else "center")
            cell = self._write_cell(
                sheet,
                self._HEADER_ROW,
                start_col + offset,
                display_name,
                bold=is_pct,
                size=14,
                horizontal=horizontal,
                font_color=self._GRAY_TEXT if is_n else None,
            )
            cell.border = Border()
        return pct_offset

    def _write_value_rows(
        self,
        sheet,
        rows,
        columns: List[str],
        expanded: List[Tuple[str, str]],
        start_col: int,
        pct_offset: Optional[int],
        name_to_level: Dict[str, int] = None,
        alternate_fills: List[Optional[str]] = None,
    ):
        name_to_level = name_to_level or {}
        name_to_row = {str(r["Name"]): r for r in rows if "Name" in r}
        for i, (row_type, value) in enumerate(expanded):
            out_row = self._DATA_START_ROW + i
            if row_type == "section":
                for offset in range(len(columns)):
                    self._write_cell(
                        sheet,
                        out_row,
                        start_col + offset,
                        None,
                        fill_color=self._SECTION_HEADER_COLOR,
                    )
                continue
            if row_type == "spacer":
                continue

            row_data = name_to_row.get(value)
            is_cohort = value == "Cohort"
            level = name_to_level.get(value, 0)
            gray = self._level_to_gray_hex(level)
            alt = alternate_fills[i] if alternate_fills else None
            row_fill = gray if gray else alt
            for offset, col_name in enumerate(columns):
                raw_value = row_data.get(col_name) if row_data else None
                is_pct_col = offset == pct_offset
                is_n_col = col_name.strip().lower() == "n"
                horizontal = "right" if is_n_col else ("left" if is_pct_col else "center")
                fmt = self._number_format_for_value(raw_value)
                self._write_cell(
                    sheet,
                    out_row,
                    start_col + offset,
                    raw_value,
                    bold=is_pct_col,
                    size=14,
                    horizontal=horizontal,
                    fill_color=row_fill,
                    number_format=fmt,
                    font_color=self._GRAY_TEXT if is_n_col else None,
                )

    def _apply_section_header_spans(
        self,
        sheet,
        expanded: List[Tuple[str, str]],
        max_col: int,
        spacing_cols: List[int] = None,
    ):
        """Apply fill colour across the full row width for section headers."""
        if max_col < 2:
            return
        skip = set(spacing_cols or [])
        fill = PatternFill(
            start_color=self._SECTION_HEADER_COLOR,
            end_color=self._SECTION_HEADER_COLOR,
            fill_type="solid",
        )
        for i, (row_type, _) in enumerate(expanded):
            if row_type == "section":
                out_row = self._DATA_START_ROW + i
                for col in range(1, max_col + 1):
                    if col in skip:
                        continue
                    cell = sheet.cell(row=out_row, column=col)
                    if not cell.fill or cell.fill.fgColor is None or cell.fill.fgColor.rgb == "00000000":
                        cell.fill = fill

    def _set_value_column_widths(self, sheet, rows, columns: List[str], start_col: int):
        font_scale = 14 / 11  # scale relative to Excel default font size 11
        for offset, col_name in enumerate(columns):
            is_n = col_name.strip().lower() == "n"
            values = [str(r.get(col_name, "")) for r in rows] + [col_name]
            max_len = max((len(v) for v in values if v), default=4)
            width = max(max_len * font_scale + 2, 12 if is_n else 6)
            sheet.column_dimensions[get_column_letter(start_col + offset)].width = width


# ---------------------------------------------------------------------------
# Table1 numeric vertical writer
# ---------------------------------------------------------------------------


class Table1NumericSheetWriter(_BaseSheetWriter):
    """Writes numeric characteristics vertically: one block per characteristic.

    Layout per block::

        [full-width characteristic name row  – SECTION_HEADER_COLOR]
        [column labels: blank | N | % | Mean | STD | Min | P10 | … | Max]
        [one row per cohort/subcohort]
        [spacer row]

    Column A : narrow colour spacer (group colour).
    Column B : cohort display name (group colour).
    Column C+: summary statistics.
    """

    _STAT_COLS = ["N", "Pct", "Mean", "STD", "Min", "P10", "P25", "Median", "P75", "P90", "Max"]
    _SPACER_COL = 1
    _NAME_COL = 2
    _DATA_START_COL = 3

    def write(
        self,
        sheet,
        report_files: List[Optional[Path]],
        cohort_dirs: List[Path],
        cohort_groups: List["CohortGroup"],
    ):
        self._set_default_row_height(sheet)
        dir_to_report = dict(zip(cohort_dirs, report_files))

        numeric_names = self._collect_numeric_names(report_files)
        if not numeric_names:
            return

        stat_cols = self._get_available_stat_cols(report_files)

        # Column widths
        sheet.column_dimensions[get_column_letter(self._SPACER_COL)].width = self._SPACING_SIZE
        sheet.column_dimensions[get_column_letter(self._NAME_COL)].width = 24
        for i, col_name in enumerate(stat_cols):
            w = 7 if col_name in ("P10", "P25", "P75", "P90") else 9
            sheet.column_dimensions[get_column_letter(self._DATA_START_COL + i)].width = w
        sheet.row_dimensions[self._SPACING_ROW].height = self._SPACING_SIZE * 5

        current_row = self._DATA_START_ROW
        for bi, char_name in enumerate(numeric_names):
            self._write_char_header(sheet, current_row, char_name, stat_cols)
            current_row += 1
            self._write_stat_col_labels(sheet, current_row, stat_cols)
            current_row += 1

            row_in_block = 0
            for gi, group in enumerate(cohort_groups):
                group_color = self._COHORT_COLORS[gi % len(self._COHORT_COLORS)]
                for cohort_dir in group.all_dirs:
                    report_file = dir_to_report.get(cohort_dir)
                    if report_file is None:
                        continue
                    try:
                        data = self._load_json(report_file)
                        row_data = self._find_char_row(data, char_name)
                        display_name = group.display_name(cohort_dir)
                        is_subcohort = cohort_dir != group.main_dir
                        alt_fill = self._ROW_BACKGROUND_1 if row_in_block % 2 == 1 else None
                        self._write_cohort_row(
                            sheet, current_row, display_name, row_data,
                            stat_cols, group_color, alt_fill, is_subcohort,
                        )
                    except Exception as e:
                        logger.warning(f"Failed to process {report_file}: {e}")
                    current_row += 1
                    row_in_block += 1

            # Spacer row after block
            sheet.row_dimensions[current_row].height = 8
            sheet.cell(row=current_row, column=self._SPACER_COL, value=None)
            current_row += 1

    # ------------------------------------------------------------------

    def _collect_numeric_names(self, report_files: List[Optional[Path]]) -> List[str]:
        """Return ordered list of characteristic names whose Mean is non-null."""
        seen: Dict[str, None] = {}
        for f in report_files:
            if f is None:
                continue
            try:
                data = self._load_json(f)
                for row in data.get("rows", []):
                    name = row.get("Name")
                    if name and row.get("Mean") is not None and name not in seen:
                        seen[name] = None
            except Exception:
                pass
        return list(seen.keys())

    def _get_available_stat_cols(self, report_files: List[Optional[Path]]) -> List[str]:
        """Return stat columns that have at least one non-null value."""
        available: set = set()
        for f in report_files:
            if f is None:
                continue
            try:
                data = self._load_json(f)
                for row in data.get("rows", []):
                    if row.get("Mean") is not None:
                        for col in self._STAT_COLS:
                            if row.get(col) is not None:
                                available.add(col)
            except Exception:
                pass
        return [c for c in self._STAT_COLS if c in available]

    @staticmethod
    def _find_char_row(data: Dict, char_name: str) -> Optional[Dict]:
        for row in data.get("rows", []):
            if row.get("Name") == char_name:
                return row
        return None

    def _write_char_header(self, sheet, row: int, char_name: str, stat_cols: List[str]):
        """Write characteristic name as a full-width section header."""
        max_col = self._DATA_START_COL + len(stat_cols) - 1
        fill = PatternFill(
            start_color=self._SECTION_HEADER_COLOR,
            end_color=self._SECTION_HEADER_COLOR,
            fill_type="solid",
        )
        for col in range(self._SPACER_COL, max_col + 1):
            sheet.cell(row=row, column=col).fill = fill
        self._write_cell(
            sheet, row, self._NAME_COL, char_name,
            bold=True, size=14, horizontal="left", indent=2,
            fill_color=self._SECTION_HEADER_COLOR,
        )
        sheet.row_dimensions[row].height = 36

    def _write_stat_col_labels(self, sheet, row: int, stat_cols: List[str]):
        """Write column header row: cohort name label + stat column names."""
        self._write_cell(sheet, row, self._NAME_COL, "Cohort", bold=True, size=14, horizontal="left")
        for i, col_name in enumerate(stat_cols):
            is_n = col_name == "N"
            is_pct = col_name == "Pct"
            display = self._COLUMN_DISPLAY_NAMES.get(col_name, col_name)
            horizontal = "right" if is_n else ("left" if is_pct else "center")
            self._write_cell(
                sheet, row, self._DATA_START_COL + i, display,
                bold=is_pct, size=14, horizontal=horizontal,
                font_color=self._GRAY_TEXT if is_n else None,
            )

    def _write_cohort_row(
        self, sheet, row: int, display_name: str, row_data: Optional[Dict],
        stat_cols: List[str], group_color: str, alt_fill: Optional[str], is_subcohort: bool,
    ):
        """Write a single cohort data row for the current characteristic."""
        self._write_cell(sheet, row, self._SPACER_COL, None, fill_color=group_color)
        self._write_cell(
            sheet, row, self._NAME_COL, display_name,
            size=14, horizontal="right", indent=6 if is_subcohort else 4,
            fill_color=group_color,
        )
        for i, col_name in enumerate(stat_cols):
            value = row_data.get(col_name) if row_data else None
            is_pct = col_name == "Pct"
            is_n = col_name == "N"
            horizontal = "right" if is_n else ("left" if is_pct else "center")
            fmt = self._number_format_for_value(value)
            self._write_cell(
                sheet, row, self._DATA_START_COL + i, value,
                bold=is_pct, size=14, horizontal=horizontal,
                fill_color=alt_fill, number_format=fmt,
                font_color=self._GRAY_TEXT if is_n else None,
            )


# ---------------------------------------------------------------------------
# Top-level orchestrator
# ---------------------------------------------------------------------------


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
        ("INCLUSION EXCLUSION",
         "Shows how the study entry criterion, inclusion and exclusion criteria result in the final cohort sizes."),
        ("CHARACTERISTICS",
         "Characterizes populations at study entry date."),
        ("OUTCOMES",
         "Characterizes populations after study entry date."),
        ("… all",
         "Displays all boolean, numeric and categorical study elements within a single table."),
        ("… boolean",
         "Displays only boolean study elements — the number of patients that have or do not have a given element. "
         "For numeric values, this identifies missingness."),
        ("… numeric",
         "Displays only numerically valued study elements with summary statistics such as mean, median, min and max."),
        ("… (detailed)",
         "Displays subcomponents of study elements (e.g. if Diabetes is composed of Type 1 and Type 2, counts for "
         "each component are shown). Identical to the non-detailed version when no subcomponents are present."),
    ]

    def write(
        self,
        sheet,
        cohort_dirs: List[Path],
        study_path: Path,
        description: Optional[str],
        cohort_groups: Optional[List["CohortGroup"]] = None,
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
                    self._write_cell(sheet, current_row, 2, text, bold=bold, size=font_size)
                current_row += 1
            current_row += 1  # blank row after description

        # Cohort table header
        self._write_cell(sheet, current_row, 2, "Cohort", bold=True, size=14)
        self._write_cell(sheet, current_row, 3, "Final N", bold=True, size=14, horizontal="right")
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
            self._write_cell(sheet, current_row, 2, display, size=14,
                             indent=4 if is_sub else 2, fill_color=color)
            self._write_cell(sheet, current_row, 3, final_n, size=14, horizontal="right",
                             fill_color=color,
                             number_format="#,##0" if isinstance(final_n, int) else None)
            current_row += 1

        current_row += 1  # blank row

        # Info section
        self._write_cell(sheet, current_row, 2,
                         "The following sheets allow comparison of all cohorts, subcohorts and stratificats within this study. "
                         "Cohorts are arranged side by side for easy comparison.",
                         size=14)
        sheet.row_dimensions[current_row].height = 36
        current_row += 2  # blank row

        # Sheet description table — header row
        sheet_col, desc_col = 2, 4
        thin = Side(style="thin")
        header_bottom = Border(bottom=thin)
        row_border = Border(bottom=Side(style="hair"))

        self._write_cell(sheet, current_row, sheet_col, "Sheet name", bold=True, size=14)
        self._write_cell(sheet, current_row, desc_col, "Description", bold=True, size=14)
        for col in (sheet_col, sheet_col + 1, desc_col):
            sheet.cell(row=current_row, column=col).border = header_bottom
        current_row += 1

        # col D width in chars ≈ 80 / 1.27 (ratio of 14pt to default 11pt)
        chars_per_line = 63
        line_height_pt = 20  # 14pt font line height

        for sheet_name, sheet_desc in self._SHEET_INFO_TABLE[1:]:
            name_cell = self._write_cell(sheet, current_row, sheet_col, sheet_name, size=14,
                                         bold=(not sheet_name.startswith("…")))
            desc_cell = self._write_cell(sheet, current_row, desc_col, sheet_desc, size=14)
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
        self._write_cell(sheet, current_row, 2,
                         f"Executed with PhenEx v{phenex_version}",
                         bold=False, size=11, font_color=self._GRAY_TEXT)

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


# ---------------------------------------------------------------------------
# Top-level orchestrator
# ---------------------------------------------------------------------------


class OutputConcatenator:
    """Concatenates per-cohort JSON reports into a single multi-sheet study file.

    Reads ``<cohort_dir>/<reporter_type>.json`` files produced by
    ``Cohort.write_reports_to_json()`` and assembles them into
    ``study_results.xlsx``.
    """

    _SHEET_ORDER_PREFIX = [
        "Info",
        "Waterfall",
        "WaterfallDetailed",
        "Table1",
        "Table1Detailed",
        "Table1Boolean",
        "Table1BooleanDetailed",
        "Table1Numeric",
        "Table1NumericDetailed",
        "Table1OutcomesAll",
        "Table1OutcomesAllDetailed",
        "Table1Outcomes",
        "Table1OutcomesDetailed",
        "Table1OutcomesNumeric",
    ]
    _CANONICAL_NAMES = {
        "waterfall": "Waterfall",
        "waterfall_detailed": "WaterfallDetailed",
        "table1": "Table1",
        "table1_detailed": "Table1Detailed",
        "table1_outcomes": "Table1Outcomes",
        "table1_outcomes_detailed": "Table1OutcomesDetailed",
    }
    _SHEET_DISPLAY_NAMES = {
        "Info":                       "OVERVIEW",
        "Waterfall":                  "INCLUSION EXCLUSION",
        "WaterfallDetailed":          "INCLUSION EXCLUSION (detailed)",
        "Table1":                     "CHARACTERISTICS all",
        "Table1Detailed":             "CHARACTERISTICS all (detailed)",
        "Table1Boolean":              "CHARACTERISTICS boolean",
        "Table1BooleanDetailed":      "CHARACTERISTICS bool (detailed)",
        "Table1Numeric":              "CHARACTERISTICS numeric",
        "Table1NumericDetailed":      "CHARACTERISTICS num (detailed)",
        "Table1OutcomesAll":          "OUTCOMES all",
        "Table1OutcomesAllDetailed":  "OUTCOMES all (detailed)",
        "Table1Outcomes":             "OUTCOMES boolean",
        "Table1OutcomesDetailed":     "OUTCOMES boolean (detailed)",
        "Table1OutcomesNumeric":      "OUTCOMES numeric",
    }

    def __init__(
        self,
        study_execution_path: str,
        study_name: str = "study",
        cohort_names: Optional[List[str]] = None,
        description: Optional[str] = None,
    ) -> None:
        self.study_path = Path(study_execution_path)
        self.cohort_names = cohort_names
        self.description = description
        timestamp = self.study_path.name
        self.output_file = self.study_path / f"results_{study_name}_{timestamp}.xlsx"
        self._info_writer = InfoSheetWriter()
        self._generic_writer = GenericSheetWriter()
        self._table1_writer = Table1SheetWriter()
        self._numeric_writer = Table1NumericSheetWriter()

    # ------------------------------------------------------------------

    def concatenate_all_reports(self) -> None:
        cohort_dirs = self._get_cohort_directories()
        if not cohort_dirs:
            logger.warning(f"No cohort directories found in {self.study_path}")
            return

        reports_by_type = self._group_reports_by_type(cohort_dirs)
        if not reports_by_type:
            logger.warning("No report files found in cohort directories")
            return

        # Add boolean views of Table1 data (same source files, N+Pct only)
        _BOOLEAN_SOURCES = {
            "Table1Boolean": "Table1",
            "Table1BooleanDetailed": "Table1Detailed",
        }
        for bool_type, source_type in _BOOLEAN_SOURCES.items():
            if source_type in reports_by_type:
                reports_by_type[bool_type] = reports_by_type[source_type]

        # Add all-columns outcome views (same source files as boolean outcomes)
        _ALL_SOURCES = {
            "Table1OutcomesAll": "Table1Outcomes",
            "Table1OutcomesAllDetailed": "Table1OutcomesDetailed",
        }
        for all_type, source_type in _ALL_SOURCES.items():
            if source_type in reports_by_type:
                reports_by_type[all_type] = reports_by_type[source_type]

        # Add numeric views of Table1 data (same source files, numeric rows only)
        _NUMERIC_SOURCES = {
            "Table1Numeric": "Table1",
            "Table1NumericDetailed": "Table1Detailed",
            "Table1OutcomesNumeric": "Table1Outcomes",
        }
        for num_type, source_type in _NUMERIC_SOURCES.items():
            if source_type in reports_by_type:
                reports_by_type[num_type] = reports_by_type[source_type]

        cohort_groups = self._group_cohorts(cohort_dirs)

        output_wb = openpyxl.Workbook()
        output_wb.remove(output_wb.active)

        # Info sheet is always first
        info_sheet = output_wb.create_sheet(title=self._SHEET_DISPLAY_NAMES.get("Info", "Info"))
        info_sheet.sheet_view.showGridLines = False
        self._info_writer.write(
            info_sheet, cohort_dirs, self.study_path, self.description, cohort_groups
        )

        for report_type in self._sheet_order(reports_by_type):
            display_name = self._SHEET_DISPLAY_NAMES.get(report_type, report_type)
            logger.info(f"Concatenating {report_type} reports...")
            sheet = output_wb.create_sheet(title=display_name)
            sheet.sheet_view.showGridLines = False
            self._write_sheet(
                sheet,
                report_type,
                reports_by_type[report_type],
                cohort_dirs,
                cohort_groups,
            )

        output_wb.save(self.output_file)
        self._suppress_number_as_text_warnings(self.output_file)
        logger.info(f"Successfully created: {self.output_file}")

    # ------------------------------------------------------------------

    def _sheet_order(self, reports_by_type: Dict[str, List[Path]]) -> List[str]:
        prefix = [n for n in self._SHEET_ORDER_PREFIX if n in reports_by_type]
        rest = sorted(k for k in reports_by_type if k not in self._SHEET_ORDER_PREFIX)
        return prefix + rest

    _TABLE1_TYPES = {
        "Table1",
        "Table1Detailed",
        "Table1OutcomesAll",
        "Table1OutcomesAllDetailed",
        "Table1Outcomes",
        "Table1OutcomesDetailed",
        "Table1Boolean",
        "Table1BooleanDetailed",
    }
    _TABLE1_BOOLEAN_TYPES = {
        "Table1Boolean",
        "Table1BooleanDetailed",
        "Table1Outcomes",
        "Table1OutcomesDetailed",
    }
    _TABLE1_NUMERIC_TYPES = {
        "Table1Numeric",
        "Table1NumericDetailed",
        "Table1OutcomesNumeric",
    }

    def _write_sheet(
        self,
        sheet,
        report_type: str,
        report_files: List[Optional[Path]],
        cohort_dirs: List[Path],
        cohort_groups: List[CohortGroup],
    ) -> None:
        if report_type in self._TABLE1_NUMERIC_TYPES:
            self._numeric_writer.write(sheet, report_files, cohort_dirs, cohort_groups)
        elif report_type in self._TABLE1_TYPES:
            boolean_only = report_type in self._TABLE1_BOOLEAN_TYPES
            self._table1_writer.write(
                sheet, report_files, cohort_dirs, cohort_groups,
                boolean_only=boolean_only,
            )
        else:
            self._generic_writer.write(
                sheet, report_files, cohort_dirs, cohort_groups
            )

    def _get_cohort_directories(self) -> List[Path]:
        dirs = {
            d.name: d
            for d in self.study_path.iterdir()
            if d.is_dir() and not d.name.startswith(".")
        }
        if self.cohort_names:
            return [dirs[name] for name in self.cohort_names if name in dirs]
        return sorted(dirs.values(), key=lambda x: x.name)

    def _group_cohorts(self, cohort_dirs: List[Path]) -> List[CohortGroup]:
        """Group cohort directories into main cohorts with their subcohorts.

        Main cohorts are those whose name does not start with
        ``<other_name>__``.  Subcohorts are matched to their parent by
        the ``parent__child`` naming convention.
        """
        names = [d.name for d in cohort_dirs]
        dir_by_name = {d.name: d for d in cohort_dirs}

        main_names = [
            name
            for name in names
            if not any(
                name.startswith(other + "__") for other in names if other != name
            )
        ]

        groups: List[CohortGroup] = []
        for main_name in main_names:
            subcohort_dirs = [
                dir_by_name[n] for n in names if n.startswith(main_name + "__")
            ]
            groups.append(
                CohortGroup(
                    name=main_name,
                    main_dir=dir_by_name[main_name],
                    subcohort_dirs=subcohort_dirs,
                )
            )
        return groups

    def _group_reports_by_type(
        self, cohort_dirs: List[Path]
    ) -> Dict[str, List[Optional[Path]]]:
        """Group report files by type, aligned to cohort_dirs.

        Returns a dict mapping report type name to a list of Optional[Path] with
        one entry per cohort dir (None when that cohort has no file of that type).
        """
        # {report_type: {cohort_dir: path}}
        type_to_cohort_path: Dict[str, Dict[Path, Path]] = {}
        for cohort_dir in cohort_dirs:
            for json_file in sorted(cohort_dir.glob("*.json")):
                if json_file.name.startswith("frozen_"):
                    continue
                report_type = self._CANONICAL_NAMES.get(
                    json_file.stem.lower(), json_file.stem
                )
                type_to_cohort_path.setdefault(report_type, {})[cohort_dir] = json_file
        # Build aligned lists; None where a cohort has no file for a given type
        return {
            report_type: [cohort_paths.get(d) for d in cohort_dirs]
            for report_type, cohort_paths in type_to_cohort_path.items()
        }

    def _suppress_number_as_text_warnings(self, xlsx_path: Path) -> None:
        """Inject <ignoredErrors> into each sheet XML to suppress green triangles."""
        tmp_path = xlsx_path.with_suffix(".tmp.xlsx")
        try:
            with zipfile.ZipFile(xlsx_path, "r") as zin:
                with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zout:
                    for item in zin.infolist():
                        data = zin.read(item.filename)
                        if item.filename.startswith(
                            "xl/worksheets/sheet"
                        ) and item.filename.endswith(".xml"):
                            data = self._inject_ignored_errors(data)
                        zout.writestr(item, data)
            tmp_path.replace(xlsx_path)
        except Exception as e:
            logger.warning(f"Could not suppress number-as-text warnings: {e}")
            if tmp_path.exists():
                tmp_path.unlink()

    @staticmethod
    def _inject_ignored_errors(xml_bytes: bytes) -> bytes:
        text = xml_bytes.decode("utf-8")
        if "<ignoredErrors>" in text:
            return xml_bytes
        m = re.search(r'<dimension ref="([^"]+)"', text)
        ref = m.group(1) if m else "A1:XFD1048576"
        snippet = (
            f"<ignoredErrors>"
            f'<ignoredError sqref="{ref}" numberStoredAsText="1"/>'
            f"</ignoredErrors>"
        )
        return text.replace("</worksheet>", snippet + "</worksheet>").encode("utf-8")


