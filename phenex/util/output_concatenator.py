"""
Excel Output Concatenator for Study Reports

Concatenates cohort reports horizontally into a single multi-sheet Excel file.
"""

import os
from pathlib import Path
from typing import List, Dict
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from phenex.util import create_logger

logger = create_logger(__name__)


class OutputConcatenator:
    """
    Concatenates cohort reports horizontally into a single multi-sheet Excel file.

    Creates a study_results.xlsx file with separate sheets for each report type
    (Waterfall, Table1, and custom reporters), where each cohort's version of the
    report is placed side-by-side.
    """

    def __init__(
        self, study_execution_path: str
    ):
        """
        Initialize the OutputConcatenator.

        Args:
            study_execution_path: Path to study execution directory containing cohort subdirectories
        """
        self.study_path = Path(study_execution_path)
        self.output_file = self.study_path / "study_results.xlsx"

    def concatenate_all_reports(self):
        """Main method to concatenate all report types into a single Excel file."""
        # Get all cohort directories
        cohort_dirs = self._get_cohort_directories()

        if not cohort_dirs:
            logger.warning(f"No cohort directories found in {self.study_path}")
            return

        # Group reports by type
        reports_by_type = self._group_reports_by_type(cohort_dirs)

        if not reports_by_type:
            logger.warning(f"No report files found in cohort directories")
            return

        # Create output workbook
        output_wb = openpyxl.Workbook()
        output_wb.remove(output_wb.active)  # Remove default sheet

        # Define sheet order (Waterfall first, Table1 second, then custom reporters)
        sheet_order = ["Waterfall", "Table1"] + sorted(
            [k for k in reports_by_type.keys() if k not in ["Waterfall", "Table1"]]
        )

        # Create a sheet for each report type
        for report_type in sheet_order:
            if report_type not in reports_by_type:
                continue

            logger.info(f"Concatenating {report_type} reports...")
            report_files = reports_by_type[report_type]

            # Create sheet for this report type
            sheet = output_wb.create_sheet(title=report_type)
            sheet.sheet_view.showGridLines = False
            if report_type == "Table1":
                self._concatenate_table1_aligned(sheet, report_files)
            else:
                self._concatenate_reports_horizontally(sheet, report_files)

        # Save output file
        output_wb.save(self.output_file)
        logger.info(f"✓ Successfully created: {self.output_file}")

    def _get_cohort_directories(self) -> List[Path]:
        """Get all cohort subdirectories in the study execution path."""
        cohort_dirs = [
            d
            for d in self.study_path.iterdir()
            if d.is_dir() and not d.name.startswith(".")
        ]
        return sorted(cohort_dirs, key=lambda x: x.name)

    def _group_reports_by_type(self, cohort_dirs: List[Path]) -> Dict[str, List[Path]]:
        """
        Group report files by their type across all cohorts.

        Args:
            cohort_dirs: List of cohort directory paths

        Returns:
            Dictionary mapping report type to list of file paths (one per cohort)
        """
        reports_by_type = {}

        for cohort_dir in cohort_dirs:
            excel_files = list(cohort_dir.glob("*.xlsx"))

            for excel_file in excel_files:
                # Skip temporary files
                if excel_file.name.startswith("~$"):
                    continue

                # Extract report type from filename (remove .xlsx extension)
                report_type = excel_file.stem

                # Capitalize for consistency (waterfall -> Waterfall, table1 -> Table1)
                if report_type.lower() == "waterfall":
                    report_type = "Waterfall"
                elif report_type.lower() == "table1":
                    report_type = "Table1"

                if report_type not in reports_by_type:
                    reports_by_type[report_type] = []

                reports_by_type[report_type].append(excel_file)

        # Sort files within each report type to maintain cohort order
        for report_type in reports_by_type:
            reports_by_type[report_type] = sorted(
                reports_by_type[report_type], key=lambda x: x.parent.name
            )

        return reports_by_type

    def _concatenate_reports_horizontally(self, output_sheet, report_files: List[Path]):
        """
        Concatenate multiple Excel files horizontally into a single sheet.

        Args:
            output_sheet: Output worksheet to write to
            report_files: List of Excel file paths to concatenate
        """
        current_col = 1
        border_cols = []  # collect divider columns; borders applied after full height is known

        for report_file in report_files:
            try:
                # Load source workbook
                source_wb = openpyxl.load_workbook(report_file, data_only=False)
                source_sheet = source_wb.active

                # Get dimensions
                max_row = source_sheet.max_row
                max_col = source_sheet.max_column

                # Add cohort name as header
                cohort_name = report_file.parent.name
                self._add_header(output_sheet, cohort_name, current_col, max_col)

                # Copy cells with formatting (starting from row 2 for header)
                for row in range(1, max_row + 1):
                    for col in range(1, max_col + 1):
                        source_cell = source_sheet.cell(row=row, column=col)
                        target_cell = output_sheet.cell(
                            row=row + 1, column=current_col + col - 1
                        )
                        self._copy_cell(source_cell, target_cell)

                # Copy column widths
                self._copy_column_widths(
                    source_sheet, output_sheet, 1, current_col, max_col
                )

                # Copy row heights
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
                continue

        # Apply right borders and a bottom border using the full sheet dimensions
        sheet_max_row = output_sheet.max_row
        sheet_max_col = output_sheet.max_column
        for col in border_cols:
            self._apply_right_border_to_column(output_sheet, col, sheet_max_row)
        self._apply_bottom_border_to_row(output_sheet, sheet_max_row, sheet_max_col)

    def _build_master_name_list(self, report_files: List[Path]) -> List[str]:
        """Return an ordered, deduplicated list of all Name-column values across files.

        Reads column A from each Table1 source file (rows 2+, skipping the header),
        collecting names in first-seen order.  This captures display names and
        categorical sub-rows (e.g. ``"Diagnosis=yes"``) exactly as Table1 renders them.
        """
        seen: Dict[str, None] = {}  # ordered-dict trick for deduplication
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

    def _build_name_to_source_row(self, source_sheet) -> Dict[str, int]:
        """Return ``{name_value: 1-based row index}`` for data rows (row 2+) of a sheet."""
        mapping: Dict[str, int] = {}
        for row_idx in range(2, source_sheet.max_row + 1):
            val = source_sheet.cell(row=row_idx, column=1).value
            if val is not None:
                mapping[str(val)] = row_idx
        return mapping

    def _write_table1_name_column(self, output_sheet, master_names: List[str]):
        """Write the frozen Name column (col A) for the aligned Table1 sheet.

        Row 1 is left blank (cohort-name headers occupy it for the value columns).
        Row 2 holds the ``"Name"`` column label.
        Rows 3+ hold each entry from *master_names*; the ``"Cohort"`` row is bold/grey.
        Column width is set to fit the longest name.
        """
        header_cell = output_sheet.cell(row=2, column=1)
        header_cell.value = "Name"
        header_cell.font = Font(bold=True, size=11)
        header_cell.alignment = Alignment(horizontal="left", vertical="center")

        for i, name in enumerate(master_names):
            cell = output_sheet.cell(row=3 + i, column=1)
            cell.value = name
            cell.alignment = Alignment(horizontal="left", vertical="center")
            if name == "Cohort":
                cell.font = Font(bold=True, size=11)
                cell.fill = PatternFill(
                    start_color="D3D3D3", end_color="D3D3D3", fill_type="solid"
                )
            else:
                cell.font = Font(size=11)

        max_name_len = max((len(n) for n in master_names), default=10)
        output_sheet.column_dimensions[get_column_letter(1)].width = max(
            max_name_len * 1.2, 14
        )
        # Freeze column A and rows 1-2 so both remain visible while scrolling
        output_sheet.freeze_panes = output_sheet.cell(row=3, column=2)

    def _concatenate_table1_aligned(self, output_sheet, report_files: List[Path]):
        """Concatenate Table1 files into a single sheet with a shared frozen Name column.

        Layout::

            Row 1 : merged, grey cohort-name header per cohort block
            Row 2 : "Name" in col A  +  column labels (N, Pct, Mean…) per cohort block
            Row 3+: characteristic / category name in col A  +  values per cohort;
                    cells are blank where a cohort does not have that row

        The master Name list is derived from the source files themselves (not from
        ``baseline_characteristics``), so display names and categorical sub-rows
        such as ``"Diagnosis=yes"`` are matched exactly.
        """
        master_names = self._build_master_name_list(report_files)
        if not master_names:
            return

        self._write_table1_name_column(output_sheet, master_names)

        current_col = 2  # col B onwards; col A is the frozen Name column
        border_cols = []  # collect divider columns; borders applied after full height is known

        for report_file in report_files:
            try:
                source_wb = openpyxl.load_workbook(report_file, data_only=False)
                source_sheet = source_wb.active

                max_col = source_sheet.max_column
                # Source col 1 = "Name"; cols 2..max_col are the value columns
                num_value_cols = max_col - 1

                # Row 1: cohort-name header merged across the value columns
                self._add_header(
                    output_sheet, report_file.parent.name, current_col, num_value_cols
                )

                # Row 2: column labels (N, Pct, Mean, …) — source row 1, skip col 1
                for offset in range(num_value_cols):
                    src_cell = source_sheet.cell(row=1, column=2 + offset)
                    tgt_cell = output_sheet.cell(row=2, column=current_col + offset)
                    self._copy_cell(src_cell, tgt_cell)
                    tgt_cell.font = Font(bold=True, size=11)

                # Rows 3+: values aligned to master_names; blank if name absent
                name_to_row = self._build_name_to_source_row(source_sheet)
                for i, name in enumerate(master_names):
                    src_row = name_to_row.get(name)
                    out_row = 3 + i
                    for offset in range(num_value_cols):
                        tgt_cell = output_sheet.cell(
                            row=out_row, column=current_col + offset
                        )
                        if src_row is not None:
                            self._copy_cell(
                                source_sheet.cell(row=src_row, column=2 + offset),
                                tgt_cell,
                            )

                # Preserve value column widths
                self._copy_column_widths(
                    source_sheet, output_sheet, 2, current_col, num_value_cols
                )

                source_wb.close()
                border_cols.append(current_col + num_value_cols - 1)
                current_col += num_value_cols  # no blank separator; right border is the divider

            except Exception as e:
                logger.warning(f"Failed to process {report_file}: {e}")
                continue

        # Apply right borders (including the Name column) and a bottom border
        sheet_max_row = output_sheet.max_row
        sheet_max_col = output_sheet.max_column
        self._apply_right_border_to_column(output_sheet, 1, sheet_max_row)
        for col in border_cols:
            self._apply_right_border_to_column(output_sheet, col, sheet_max_row)
        self._apply_bottom_border_to_row(output_sheet, sheet_max_row, sheet_max_col)

    def _apply_right_border_to_column(self, sheet, col: int, max_row: int):
        """Apply a thin right border to every cell in *col* from row 1 to *max_row*.

        Preserves any existing left/top/bottom border on each cell.
        """
        right_side = Side(style="thin")
        for row in range(1, max_row + 1):
            cell = sheet.cell(row=row, column=col)
            existing = cell.border
            cell.border = Border(
                left=existing.left,
                right=right_side,
                top=existing.top,
                bottom=existing.bottom,
            )

    def _apply_bottom_border_to_row(self, sheet, row: int, max_col: int):
        """Apply a thin bottom border to every cell in *row* from col 1 to *max_col*.

        Preserves any existing left/right/top border on each cell.
        """
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

    def _add_header(self, sheet, text: str, start_col: int, num_cols: int):
        """
        Add a formatted header spanning multiple columns.

        Args:
            sheet: Target worksheet
            text: Header text (cohort name)
            start_col: Starting column index (1-based)
            num_cols: Number of columns to span
        """
        cell = sheet.cell(row=1, column=start_col)
        cell.value = text

        # Style the header
        cell.font = Font(bold=True, size=12)
        cell.fill = PatternFill(
            start_color="D3D3D3", end_color="D3D3D3", fill_type="solid"
        )
        cell.alignment = Alignment(horizontal="center", vertical="center")

        # Merge cells if spanning multiple columns
        if num_cols > 1:
            end_col = start_col + num_cols - 1
            sheet.merge_cells(
                start_row=1, start_column=start_col, end_row=1, end_column=end_col
            )

    def _copy_cell(self, source_cell, target_cell):
        """
        Copy a cell's value and formatting.

        Args:
            source_cell: Source openpyxl cell
            target_cell: Target openpyxl cell
        """
        # Copy value
        target_cell.value = source_cell.value

        # Copy formatting if present
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
    ):
        """
        Copy column widths from source to target sheet.

        Args:
            source_sheet: Source worksheet
            target_sheet: Target worksheet
            source_col_start: Starting column index in source (1-based)
            target_col_start: Starting column index in target (1-based)
            num_cols: Number of columns to copy
        """
        for i in range(num_cols):
            source_col_letter = get_column_letter(source_col_start + i)
            target_col_letter = get_column_letter(target_col_start + i)

            if source_col_letter in source_sheet.column_dimensions:
                width = source_sheet.column_dimensions[source_col_letter].width
                if width:
                    target_sheet.column_dimensions[target_col_letter].width = width
