"""
Excel Output Concatenator for Study Reports

Concatenates cohort reports horizontally into a single multi-sheet Excel file.
"""

import os
from pathlib import Path
from typing import List, Dict
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
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

    def __init__(self, study_execution_path: str):
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

                # Move to next position (add 1 for empty column separator)
                current_col += max_col + 1

            except Exception as e:
                logger.warning(f"Failed to process {report_file}: {e}")
                continue

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
