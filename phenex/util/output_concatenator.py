"""
Excel Output Concatenator for Study Reports

Reads per-cohort JSON reporter outputs and assembles them into a single
multi-sheet Excel file for cross-cohort comparison.
"""

import json
import re
import zipfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from phenex.util import create_logger

logger = create_logger(__name__)


# ---------------------------------------------------------------------------
# Shared sheet-writing utilities
# ---------------------------------------------------------------------------


class _BaseSheetWriter:
    """Low-level cell and sheet helpers shared by all writers."""

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
        size: int = 11,
        horizontal: str = "left",
        indent: int = 0,
        fill_color: Optional[str] = None,
        number_format: Optional[str] = None,
    ):
        cell = sheet.cell(row=row, column=col, value=value)
        cell.font = Font(bold=bold, italic=italic, size=size)
        cell.alignment = Alignment(
            horizontal=horizontal, vertical="center", indent=indent
        )
        if fill_color:
            cell.fill = PatternFill(
                start_color=fill_color, end_color=fill_color, fill_type="solid"
            )
        if number_format:
            cell.number_format = number_format
        return cell

    def _add_cohort_header(
        self, sheet, cohort_name: str, start_col: int, num_cols: int
    ):
        """Grey italic banner in row 1 spanning num_cols columns."""
        cell = self._write_cell(
            sheet,
            1,
            start_col,
            cohort_name,
            italic=True,
            size=18,
            horizontal="left",
            indent=2,
            fill_color="D3D3D3",
        )
        cell.border = Border()
        if num_cols > 1:
            sheet.merge_cells(
                start_row=1,
                start_column=start_col,
                end_row=1,
                end_column=start_col + num_cols - 1,
            )

    def _apply_right_border_to_column(
        self, sheet, col: int, max_row: int, start_row: int = 2
    ):
        right_side = Side(style="thin")
        for row in range(start_row, max_row + 1):
            cell = sheet.cell(row=row, column=col)
            existing = cell.border
            cell.border = Border(
                left=existing.left,
                right=right_side,
                top=existing.top,
                bottom=existing.bottom,
            )

    def _apply_bottom_border_to_row(self, sheet, row: int, max_col: int):
        bottom_side = Side(style="thin")
        for col in range(1, max_col + 1):
            cell = sheet.cell(row=row, column=col)
            existing = cell.border
            cell.border = Border(
                left=existing.left,
                right=existing.right,
                top=existing.top,
                bottom=bottom_side,
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

    def write(self, sheet, report_files: List[Optional[Path]], cohort_dirs: List[Path]):
        columns = self._get_column_order(report_files)
        if not columns:
            return

        current_col = 1
        border_cols: List[int] = []

        for cohort_dir, report_file in zip(cohort_dirs, report_files):
            if report_file is None:
                continue
            cohort_name = cohort_dir.name
            num_cols = len(columns)
            try:
                data = self._load_json(report_file)
                rows = data.get("rows", [])

                self._add_cohort_header(sheet, cohort_name, current_col, num_cols)
                self._write_column_headers(sheet, columns, current_col)
                self._write_data_rows(sheet, rows, columns, current_col)
                self._set_column_widths(sheet, rows, columns, current_col)

                border_cols.append(current_col + num_cols - 1)
                current_col += num_cols
            except Exception as e:
                logger.warning(f"Failed to process {report_file}: {e}")

        max_row = sheet.max_row
        max_col = sheet.max_column
        for col in border_cols:
            self._apply_right_border_to_column(sheet, col, max_row)
        self._apply_bottom_border_to_row(sheet, max_row, max_col)

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
                2,
                col,
                col_name,
                bold=True,
                size=11,
                horizontal="center",
                fill_color="366092",
            )
            cell.font = Font(bold=True, size=11, color="FFFFFF")

    def _write_data_rows(self, sheet, rows, columns, start_col: int):
        for row_idx, row_data in enumerate(rows, start=3):
            row_type = str(row_data.get("Type", "")).lower()
            fill_color = self._WATERFALL_COLORS.get(row_type)
            for offset, col_name in enumerate(columns):
                value = row_data.get(col_name)
                fmt = self._number_format_for_value(value)
                self._write_cell(
                    sheet,
                    row_idx,
                    start_col + offset,
                    value,
                    size=11,
                    horizontal="center",
                    fill_color=fill_color,
                    number_format=fmt,
                )

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

        Row 1  : grey italic cohort-name banner per block (merged)
        Row 2  : "Name" label in col A  +  column labels per cohort block
        Row 3+ : characteristic rows; section-header rows interleaved

    Section headers appear as full-width blue-grey rows when the first cohort
    JSON contains a ``sections`` dict mapping section names to characteristic
    display names.
    """

    def write(self, sheet, report_files: List[Optional[Path]], cohort_dirs: List[Path]):
        master_names, sections, name_to_level = self._build_master_names_and_sections(report_files)
        if not master_names:
            return

        expanded = self._build_expanded_rows(master_names, sections)
        self._write_name_column(sheet, expanded, name_to_level)

        current_col = 2
        border_cols: List[int] = []

        for cohort_dir, report_file in zip(cohort_dirs, report_files):
            if report_file is None:
                continue
            cohort_name = cohort_dir.name
            try:
                data = self._load_json(report_file)
                rows = data.get("rows", [])
                columns = [c for c in (rows[0].keys() if rows else []) if c not in ("Name", "_level")]
                if not columns:
                    continue
                num_value_cols = len(columns)

                self._add_cohort_header(sheet, cohort_name, current_col, num_value_cols)
                pct_offset = self._write_column_labels(sheet, columns, current_col)
                self._write_value_rows(
                    sheet, rows, columns, expanded, current_col, pct_offset, name_to_level
                )
                self._set_value_column_widths(sheet, rows, columns, current_col)

                border_cols.append(current_col + num_value_cols - 1)
                current_col += num_value_cols

            except Exception as e:
                logger.warning(f"Failed to process {report_file}: {e}")

        # Apply section-header spans now that we know the full sheet width
        self._apply_section_header_spans(sheet, expanded, sheet.max_column)

        max_row = sheet.max_row
        max_col = sheet.max_column
        self._apply_right_border_to_column(sheet, 1, max_row)
        for col in border_cols:
            self._apply_right_border_to_column(sheet, col, max_row)
        self._apply_bottom_border_to_row(sheet, max_row, max_col)

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
        self, master_names: List[str], sections: Optional[Dict]
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
        for idx, name in enumerate(master_names):
            if idx in insert_at:
                result.append(("section", insert_at[idx]))
            result.append(("row", name))
        return result

    @staticmethod
    def _name_belongs_to_chars(name: str, char_names: List[str]) -> bool:
        for char in char_names:
            if name == char or name.startswith(char + "="):
                return True
        return False

    def _write_name_column(self, sheet, expanded: List[Tuple[str, str]], name_to_level: Dict[str, int] = None):
        """Populate col A: row-2 label, then data and section rows."""
        name_to_level = name_to_level or {}
        self._write_cell(
            sheet,
            2,
            1,
            "Name",
            bold=True,
            size=11,
            horizontal="right",
            indent=4,
        )
        for i, (row_type, value) in enumerate(expanded):
            out_row = 3 + i
            if row_type == "section":
                self._write_cell(
                    sheet,
                    out_row,
                    1,
                    value,
                    bold=True,
                    size=11,
                    horizontal="left",
                    indent=2,
                    fill_color="B8CCE4",
                )
            else:
                is_cohort = value == "Cohort"
                level = name_to_level.get(value, 0)
                gray = self._level_to_gray_hex(level)
                fill = gray if gray else ("D3D3D3" if is_cohort else None)
                self._write_cell(
                    sheet,
                    out_row,
                    1,
                    value,
                    bold=is_cohort,
                    size=11,
                    horizontal="right",
                    indent=4,
                    fill_color=fill,
                )

        max_name_len = max((len(t[1]) for t in expanded if t[0] == "row"), default=10)
        sheet.column_dimensions["A"].width = max(max_name_len * 1.2, 14)
        sheet.freeze_panes = sheet.cell(row=4, column=2)

    def _write_column_labels(
        self, sheet, columns: List[str], start_col: int
    ) -> Optional[int]:
        """Write row-2 column labels; return 0-based offset of the Pct column."""
        pct_offset = None
        for offset, col_name in enumerate(columns):
            is_pct = col_name.strip().lower() == "pct"
            if is_pct:
                pct_offset = offset
            cell = self._write_cell(
                sheet,
                2,
                start_col + offset,
                col_name,
                bold=is_pct,
                size=11,
                horizontal="center",
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
    ):
        name_to_level = name_to_level or {}
        name_to_row = {str(r["Name"]): r for r in rows if "Name" in r}
        for i, (row_type, value) in enumerate(expanded):
            out_row = 3 + i
            if row_type == "section":
                for offset in range(len(columns)):
                    self._write_cell(
                        sheet,
                        out_row,
                        start_col + offset,
                        None,
                        fill_color="B8CCE4",
                    )
                continue

            row_data = name_to_row.get(value)
            is_cohort = value == "Cohort"
            level = name_to_level.get(value, 0)
            gray = self._level_to_gray_hex(level)
            row_fill = gray if gray else ("D3D3D3" if is_cohort else None)
            for offset, col_name in enumerate(columns):
                raw_value = row_data.get(col_name) if row_data else None
                is_pct_col = offset == pct_offset
                fmt = self._number_format_for_value(raw_value)
                self._write_cell(
                    sheet,
                    out_row,
                    start_col + offset,
                    raw_value,
                    bold=is_pct_col,
                    size=11,
                    horizontal="center",
                    fill_color=row_fill,
                    number_format=fmt,
                )

    def _apply_section_header_spans(
        self, sheet, expanded: List[Tuple[str, str]], max_col: int
    ):
        """Merge section-header cells from col A to max_col."""
        if max_col < 2:
            return
        for i, (row_type, _) in enumerate(expanded):
            if row_type == "section":
                out_row = 3 + i
                sheet.merge_cells(
                    start_row=out_row,
                    start_column=1,
                    end_row=out_row,
                    end_column=max_col,
                )

    def _set_value_column_widths(self, sheet, rows, columns: List[str], start_col: int):
        for offset in range(len(columns)):
            sheet.column_dimensions[get_column_letter(start_col + offset)].width = 8


# ---------------------------------------------------------------------------
# Top-level orchestrator
# ---------------------------------------------------------------------------


class OutputConcatenator:
    """Concatenates per-cohort JSON reports into a single multi-sheet study file.

    Reads ``<cohort_dir>/<reporter_type>.json`` files produced by
    ``Cohort.write_reports_to_json()`` and assembles them into
    ``study_results.xlsx``.
    """

    _SHEET_ORDER_PREFIX = ["Waterfall", "WaterfallDetailed", "Table1", "Table1Detailed", "Table1Outcomes", "Table1OutcomesDetailed"]
    _CANONICAL_NAMES = {
        "waterfall": "Waterfall",
        "waterfall_detailed": "WaterfallDetailed",
        "table1": "Table1",
        "table1_detailed": "Table1Detailed",
        "table1_outcomes": "Table1Outcomes",
        "table1_outcomes_detailed": "Table1OutcomesDetailed",
    }

    def __init__(self, study_execution_path: str, study_name: str = "study") -> None:
        self.study_path = Path(study_execution_path)
        timestamp = self.study_path.name
        self.output_file = self.study_path / f"results_{study_name}_{timestamp}.xlsx"
        self._generic_writer = GenericSheetWriter()
        self._table1_writer = Table1SheetWriter()

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

        output_wb = openpyxl.Workbook()
        output_wb.remove(output_wb.active)

        for report_type in self._sheet_order(reports_by_type):
            logger.info(f"Concatenating {report_type} reports...")
            sheet = output_wb.create_sheet(title=report_type)
            sheet.sheet_view.showGridLines = False
            self._write_sheet(sheet, report_type, reports_by_type[report_type], cohort_dirs)

        output_wb.save(self.output_file)
        self._suppress_number_as_text_warnings(self.output_file)
        logger.info(f"Successfully created: {self.output_file}")

    # ------------------------------------------------------------------

    def _sheet_order(self, reports_by_type: Dict[str, List[Path]]) -> List[str]:
        prefix = [n for n in self._SHEET_ORDER_PREFIX if n in reports_by_type]
        rest = sorted(k for k in reports_by_type if k not in self._SHEET_ORDER_PREFIX)
        return prefix + rest

    def _write_sheet(self, sheet, report_type: str, report_files: List[Optional[Path]], cohort_dirs: List[Path]) -> None:
        if report_type in ("Table1", "Table1Detailed", "Table1Outcomes", "Table1OutcomesDetailed"):
            self._table1_writer.write(sheet, report_files, cohort_dirs)
        else:
            self._generic_writer.write(sheet, report_files, cohort_dirs)

    def _get_cohort_directories(self) -> List[Path]:
        dirs = [
            d
            for d in self.study_path.iterdir()
            if d.is_dir() and not d.name.startswith(".")
        ]
        return sorted(dirs, key=lambda x: x.name)

    def _group_reports_by_type(self, cohort_dirs: List[Path]) -> Dict[str, List[Optional[Path]]]:
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
