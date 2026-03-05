"""
Excel Output Concatenator for Study Reports

Concatenates cohort reports horizontally into a single multi-sheet Excel file.
"""

import re
import zipfile
from pathlib import Path
from typing import Dict, List, Optional

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from phenex.util import create_logger

logger = create_logger(__name__)


# ---------------------------------------------------------------------------
# Shared sheet-writing utilities
# ---------------------------------------------------------------------------


class _BaseSheetWriter:
    """Mixin providing low-level cell and sheet helpers shared by all writers."""

    def _copy_cell(self, source_cell, target_cell) -> None:
        target_cell.value = source_cell.value
        if source_cell.has_style:
            target_cell.font = source_cell.font.copy()
            target_cell.border = source_cell.border.copy()
            target_cell.fill = source_cell.fill.copy()
            target_cell.number_format = source_cell.number_format
            target_cell.protection = source_cell.protection.copy()
            target_cell.alignment = source_cell.alignment.copy()

    def _copy_column_widths(
        self,
        source_sheet,
        target_sheet,
        source_col_start: int,
        target_col_start: int,
        num_cols: int,
    ) -> None:
        for i in range(num_cols):
            src_letter = get_column_letter(source_col_start + i)
            tgt_letter = get_column_letter(target_col_start + i)
            if src_letter in source_sheet.column_dimensions:
                width = source_sheet.column_dimensions[src_letter].width
                if width:
                    target_sheet.column_dimensions[tgt_letter].width = width

    def _add_cohort_header(
        self, sheet, cohort_name: str, start_col: int, num_cols: int
    ) -> None:
        """Write a grey cohort-name banner in row 1 spanning *num_cols* columns."""
        cell = sheet.cell(row=1, column=start_col)
        cell.value = cohort_name
        cell.font = Font(bold=False, italic=True, size=18)
        cell.fill = PatternFill(
            start_color="D3D3D3", end_color="D3D3D3", fill_type="solid"
        )
        cell.alignment = Alignment(horizontal="left", vertical="center", indent=2)
        cell.border = Border()
        if num_cols > 1:
            sheet.merge_cells(
                start_row=1,
                start_column=start_col,
                end_row=1,
                end_column=start_col + num_cols - 1,
            )

    def _apply_right_border_to_column(
        self, sheet, col: int, max_row: int, skip_row1: bool = True
    ) -> None:
        """Apply a thin right border from row 2 (or 1) to *max_row*."""
        right_side = Side(style="thin")
        start_row = 2 if skip_row1 else 1
        for row in range(start_row, max_row + 1):
            cell = sheet.cell(row=row, column=col)
            existing = cell.border
            cell.border = Border(
                left=existing.left,
                right=right_side,
                top=existing.top,
                bottom=existing.bottom,
            )

    def _apply_bottom_border_to_row(self, sheet, row: int, max_col: int) -> None:
        """Apply a thin bottom border across all columns in *row*."""
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


# ---------------------------------------------------------------------------
# Horizontal (generic) sheet writer
# ---------------------------------------------------------------------------


class HorizontalSheetWriter(_BaseSheetWriter):
    """Writes multiple Excel files side-by-side into a single worksheet."""

    def write(self, output_sheet, report_files: List[Path]) -> None:
        current_col = 1
        border_cols: List[int] = []

        for report_file in report_files:
            try:
                source_wb = openpyxl.load_workbook(report_file, data_only=False)
                source_sheet = source_wb.active
                max_row = source_sheet.max_row
                max_col = source_sheet.max_column

                self._add_cohort_header(
                    output_sheet, report_file.parent.name, current_col, max_col
                )
                for row in range(1, max_row + 1):
                    for col in range(1, max_col + 1):
                        self._copy_cell(
                            source_sheet.cell(row=row, column=col),
                            output_sheet.cell(
                                row=row + 1, column=current_col + col - 1
                            ),
                        )
                self._copy_column_widths(
                    source_sheet, output_sheet, 1, current_col, max_col
                )
                for row_idx in range(1, max_row + 1):
                    if row_idx in source_sheet.row_dimensions:
                        height = source_sheet.row_dimensions[row_idx].height
                        if height:
                            output_sheet.row_dimensions[row_idx + 1].height = height

                source_wb.close()
                border_cols.append(current_col + max_col - 1)
                current_col += max_col

            except Exception as e:
                logger.warning(f"Failed to process {report_file}: {e}")

        sheet_max_row = output_sheet.max_row
        sheet_max_col = output_sheet.max_column
        for col in border_cols:
            self._apply_right_border_to_column(output_sheet, col, sheet_max_row)
        self._apply_bottom_border_to_row(output_sheet, sheet_max_row, sheet_max_col)


# ---------------------------------------------------------------------------
# Table1 sheet writer
# ---------------------------------------------------------------------------


class Table1SheetWriter(_BaseSheetWriter):
    """Writes Table1 files into a single aligned worksheet.

    Layout::

        Row 1 : grey italic cohort-name banner per cohort block (merged)
        Row 2 : "Name" in col A  +  column labels (N, Pct, Mean…) per cohort block
        Row 3+: characteristic name in col A  +  values per cohort;
                blank where a cohort does not have that row
    """

    def write(self, output_sheet, report_files: List[Path]) -> None:
        master_names = self._build_master_name_list(report_files)
        if not master_names:
            return

        self._write_name_column(output_sheet, master_names)

        current_col = 2  # col A is the frozen Name column
        border_cols: List[int] = []

        for report_file in report_files:
            try:
                source_wb = openpyxl.load_workbook(report_file, data_only=False)
                source_sheet = source_wb.active
                num_value_cols = source_sheet.max_column - 1  # col 1 is "Name"

                self._add_cohort_header(
                    output_sheet, report_file.parent.name, current_col, num_value_cols
                )
                pct_offset = self._write_column_labels(
                    output_sheet, source_sheet, current_col, num_value_cols
                )
                self._write_data_rows(
                    output_sheet,
                    source_sheet,
                    master_names,
                    current_col,
                    num_value_cols,
                    pct_offset,
                )
                self._copy_column_widths(
                    source_sheet, output_sheet, 2, current_col, num_value_cols
                )

                source_wb.close()
                border_cols.append(current_col + num_value_cols - 1)
                current_col += num_value_cols

            except Exception as e:
                logger.warning(f"Failed to process {report_file}: {e}")

        sheet_max_row = output_sheet.max_row
        sheet_max_col = output_sheet.max_column
        self._apply_right_border_to_column(output_sheet, 1, sheet_max_row)
        for col in border_cols:
            self._apply_right_border_to_column(output_sheet, col, sheet_max_row)
        self._apply_bottom_border_to_row(output_sheet, sheet_max_row, sheet_max_col)

    def _build_master_name_list(self, report_files: List[Path]) -> List[str]:
        """Ordered, deduplicated union of all Name-column values across files."""
        seen: Dict[str, None] = {}
        for report_file in report_files:
            try:
                wb = openpyxl.load_workbook(report_file, data_only=True, read_only=True)
                ws = wb.active
                for row in ws.iter_rows(min_row=2, max_col=1, values_only=True):
                    val = row[0]
                    if val is not None:
                        seen[str(val)] = None
                wb.close()
            except Exception as e:
                logger.warning(f"Could not read name list from {report_file}: {e}")
        return list(seen.keys())

    def _build_name_to_row(self, source_sheet) -> Dict[str, int]:
        """Map name-column value → 1-based row index for rows 2+ of a sheet."""
        mapping: Dict[str, int] = {}
        for row_idx in range(2, source_sheet.max_row + 1):
            val = source_sheet.cell(row=row_idx, column=1).value
            if val is not None:
                mapping[str(val)] = row_idx
        return mapping

    def _write_name_column(self, sheet, master_names: List[str]) -> None:
        """Write the frozen Name column (col A)."""
        header = sheet.cell(row=2, column=1)
        header.value = "Name"
        header.font = Font(bold=True, size=11)
        header.alignment = Alignment(horizontal="right", vertical="center", indent=4)

        for i, name in enumerate(master_names):
            cell = sheet.cell(row=3 + i, column=1)
            cell.value = name
            cell.alignment = Alignment(horizontal="right", vertical="center", indent=4)
            if name == "Cohort":
                cell.font = Font(bold=True, size=11)
                cell.fill = PatternFill(
                    start_color="D3D3D3", end_color="D3D3D3", fill_type="solid"
                )
            else:
                cell.font = Font(size=11)

        max_name_len = max((len(n) for n in master_names), default=10)
        sheet.column_dimensions[get_column_letter(1)].width = max(
            max_name_len * 1.2, 14
        )
        sheet.freeze_panes = sheet.cell(row=4, column=2)

    def _write_column_labels(
        self,
        output_sheet,
        source_sheet,
        current_col: int,
        num_value_cols: int,
    ) -> Optional[int]:
        """Write row-2 column labels; return the offset of the Pct column (or None)."""
        pct_offset = None
        for offset in range(num_value_cols):
            src_cell = source_sheet.cell(row=1, column=2 + offset)
            tgt_cell = output_sheet.cell(row=2, column=current_col + offset)
            self._copy_cell(src_cell, tgt_cell)
            is_pct = str(src_cell.value or "").strip().lower() == "pct"
            if is_pct:
                pct_offset = offset
            tgt_cell.font = Font(bold=is_pct, size=11)
            tgt_cell.alignment = Alignment(horizontal="center", vertical="center")
            tgt_cell.border = Border()
        return pct_offset

    def _write_data_rows(
        self,
        output_sheet,
        source_sheet,
        master_names: List[str],
        current_col: int,
        num_value_cols: int,
        pct_offset: Optional[int],
    ) -> None:
        """Write aligned data rows (row 3+) for one cohort block."""
        name_to_row = self._build_name_to_row(source_sheet)
        for i, name in enumerate(master_names):
            src_row = name_to_row.get(name)
            out_row = 3 + i
            for offset in range(num_value_cols):
                tgt_cell = output_sheet.cell(row=out_row, column=current_col + offset)
                if src_row is not None:
                    self._copy_cell(
                        source_sheet.cell(row=src_row, column=2 + offset),
                        tgt_cell,
                    )
                is_pct_col = offset == pct_offset
                tgt_cell.font = Font(
                    bold=is_pct_col,
                    size=tgt_cell.font.size if tgt_cell.font else 11,
                )
                tgt_cell.alignment = Alignment(horizontal="center", vertical="center")


# ---------------------------------------------------------------------------
# Top-level orchestrator
# ---------------------------------------------------------------------------


class OutputConcatenator:
    """Concatenates per-cohort Excel reports into a single multi-sheet study file.

    Creates ``study_results.xlsx`` in the study execution directory with one sheet per
    report type (Waterfall, Table1, custom reporters).  Within each sheet the per-cohort
    versions are placed side-by-side.
    """

    _SHEET_ORDER_PREFIX = ["Waterfall", "WaterfallDetailed", "Table1"]
    _CANONICAL_NAMES = {"waterfall": "Waterfall", "waterfall_detailed": "WaterfallDetailed", "table1": "Table1"}

    def __init__(self, study_execution_path: str) -> None:
        self.study_path = Path(study_execution_path)
        self.output_file = self.study_path / "study_results.xlsx"
        self._horizontal_writer = HorizontalSheetWriter()
        self._table1_writer = Table1SheetWriter()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def concatenate_all_reports(self) -> None:
        """Discover per-cohort reports and merge them into a single workbook."""
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
            logger.info(f"Concatenating {report_type} reports…")
            sheet = output_wb.create_sheet(title=report_type)
            sheet.sheet_view.showGridLines = False
            self._write_sheet(sheet, report_type, reports_by_type[report_type])

        output_wb.save(self.output_file)
        self._suppress_number_as_text_warnings(self.output_file)
        logger.info(f"✓ Successfully created: {self.output_file}")

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _sheet_order(self, reports_by_type: Dict[str, List[Path]]) -> List[str]:
        prefix = [n for n in self._SHEET_ORDER_PREFIX if n in reports_by_type]
        rest = sorted(k for k in reports_by_type if k not in self._SHEET_ORDER_PREFIX)
        return prefix + rest

    def _write_sheet(
        self, sheet, report_type: str, report_files: List[Path]
    ) -> None:
        if report_type == "Table1":
            self._table1_writer.write(sheet, report_files)
        else:
            self._horizontal_writer.write(sheet, report_files)

    def _get_cohort_directories(self) -> List[Path]:
        dirs = [
            d for d in self.study_path.iterdir()
            if d.is_dir() and not d.name.startswith(".")
        ]
        return sorted(dirs, key=lambda x: x.name)

    def _group_reports_by_type(
        self, cohort_dirs: List[Path]
    ) -> Dict[str, List[Path]]:
        reports_by_type: Dict[str, List[Path]] = {}
        for cohort_dir in cohort_dirs:
            for excel_file in cohort_dir.glob("*.xlsx"):
                if excel_file.name.startswith("~$"):
                    continue
                report_type = self._CANONICAL_NAMES.get(
                    excel_file.stem.lower(), excel_file.stem
                )
                reports_by_type.setdefault(report_type, []).append(excel_file)
        for report_type in reports_by_type:
            reports_by_type[report_type].sort(key=lambda x: x.parent.name)
        return reports_by_type

    def _suppress_number_as_text_warnings(self, xlsx_path: Path) -> None:
        """Inject <ignoredErrors> into each sheet's XML to suppress green triangles."""
        tmp_path = xlsx_path.with_suffix(".tmp.xlsx")
        try:
            with zipfile.ZipFile(xlsx_path, "r") as zin:
                with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zout:
                    for item in zin.infolist():
                        data = zin.read(item.filename)
                        if (
                            item.filename.startswith("xl/worksheets/sheet")
                            and item.filename.endswith(".xml")
                        ):
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

