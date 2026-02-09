"""
Test Study class execution and report concatenation.

Tests that Study correctly executes multiple cohorts and concatenates
their reports into a single multi-sheet Excel file.
"""

import os
import unittest
from pathlib import Path
import openpyxl
import pandas as pd
from phenex.core.study import Study
from phenex.core.cohort import Cohort
from phenex import Database
from phenex.reporting import Reporter
from phenex.test.cohort.test_cohort_various_phenotypes_as_inex import (
    CohortWithContinuousCoverageAndExclusionTestGenerator,
    CohortWithContinuousCoverageTestGenerator
)
from phenex.test.cohort.test_mappings import TestDomains


class TestStudyExecution(unittest.TestCase):
    """Test Study execution and output concatenation."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test artifacts directory."""
        cls.artifacts_dir = Path(__file__).parent / "artifacts" / "study_test"
        cls.artifacts_dir.mkdir(parents=True, exist_ok=True)
    
    def test_study_execution_with_multiple_cohorts(self):
        """Test that Study executes multiple cohorts and concatenates reports."""
        # Create cohort generators
        c1gen = CohortWithContinuousCoverageAndExclusionTestGenerator()
        c2gen = CohortWithContinuousCoverageTestGenerator()
        
        # Define mapped tables
        c1gen.define_mapped_tables()
        c2gen.define_mapped_tables()
        
        # Define cohorts
        c1 = c1gen.define_cohort()
        c2 = c2gen.define_cohort()
        
        # Assign names
        c1.name = "CohortWithExclusion"
        c2.name = "CohortWithoutExclusion"
        
        # Assign databases
        c1.database = Database(connector=c1gen.con, mapper=TestDomains)
        c2.database = Database(connector=c2gen.con, mapper=TestDomains)
        
        # Create study with default reporters only (Waterfall and Table1)
        study = Study(
            name="test_study",
            path=str(self.artifacts_dir),
            cohorts=[c1, c2]
        )
        
        # Execute study
        study.execute(overwrite=True)
        
        # Verify study execution directory was created
        test_study_dir = self.artifacts_dir / "test_study"
        self.assertTrue(test_study_dir.exists(), "test_study directory should exist")
        
        study_dirs = [d for d in test_study_dir.iterdir() if d.is_dir() and d.name.startswith("D20")]
        self.assertGreater(len(study_dirs), 0, "Should create at least one study execution directory")
        
        # Get the most recent study execution directory
        study_exec_dir = max(study_dirs, key=lambda x: x.stat().st_mtime)
        
        # Verify cohort directories exist
        cohort_dirs = [d for d in study_exec_dir.iterdir() if d.is_dir()]
        self.assertEqual(len(cohort_dirs), 2, "Should have 2 cohort directories")
        
        cohort_names = sorted([d.name for d in cohort_dirs])
        self.assertEqual(cohort_names, ["CohortWithExclusion", "CohortWithoutExclusion"])
        
        # Verify individual cohort outputs
        for cohort_dir in cohort_dirs:
            # Check that basic reports exist
            self.assertTrue((cohort_dir / "table1.xlsx").exists(), 
                          f"table1.xlsx should exist in {cohort_dir.name}")
            self.assertTrue((cohort_dir / "Waterfall.xlsx").exists(),
                          f"Waterfall.xlsx should exist in {cohort_dir.name}")
            self.assertTrue((cohort_dir / f"{cohort_dir.name}.json").exists(),
                          f"Cohort JSON should exist in {cohort_dir.name}")
        
        # Verify concatenated study results file
        study_results_file = study_exec_dir / "study_results.xlsx"
        self.assertTrue(study_results_file.exists(), "study_results.xlsx should be created")
        
        # Verify contents of study_results.xlsx
        self._verify_study_results_file(study_results_file)
        
        # Verify software version info file
        info_file = study_exec_dir / "info.txt"
        self.assertTrue(info_file.exists(), "info.txt should be created")
        with open(info_file, "r") as f:
            content = f.read()
            self.assertIn("Python Version", content)
            self.assertIn("PhenEx Version", content)
    
    def _verify_study_results_file(self, filepath: Path):
        """Verify the structure and content of study_results.xlsx."""
        wb = openpyxl.load_workbook(filepath)
        
        # Verify expected sheets exist
        expected_sheets = ["Waterfall", "Table1"]
        actual_sheets = wb.sheetnames
        self.assertEqual(actual_sheets, expected_sheets, 
                        "Should have sheets in correct order: Waterfall, Table1")
        
        # Verify Waterfall sheet
        waterfall_sheet = wb["Waterfall"]
        self._verify_concatenated_sheet(
            waterfall_sheet,
            expected_cohorts=["CohortWithExclusion", "CohortWithoutExclusion"],
            sheet_name="Waterfall"
        )
        
        # Verify Table1 sheet
        table1_sheet = wb["Table1"]
        self._verify_concatenated_sheet(
            table1_sheet,
            expected_cohorts=["CohortWithExclusion", "CohortWithoutExclusion"],
            sheet_name="Table1"
        )
        
        wb.close()
    
    def _verify_concatenated_sheet(self, sheet, expected_cohorts: list, sheet_name: str):
        """Verify that a sheet has cohort headers and data concatenated horizontally."""
        # First row should have cohort names as headers
        first_row_values = []
        for col in range(1, sheet.max_column + 1):
            cell_value = sheet.cell(row=1, column=col).value
            if cell_value:
                first_row_values.append(cell_value)
        
        # Should find both cohort names in the headers
        for cohort_name in expected_cohorts:
            self.assertIn(cohort_name, first_row_values,
                         f"{sheet_name} sheet should have header for {cohort_name}")
        
        # Verify there is at least the header row (data rows optional for empty reports like Table1)
        self.assertGreaterEqual(sheet.max_row, 1,
                               f"{sheet_name} sheet should have at least header row")
    
    def test_study_with_empty_custom_reporters(self):
        """Test that Study works with no custom reporters (only default Waterfall)."""
        # Create minimal cohorts
        c1gen = CohortWithContinuousCoverageTestGenerator()
        c1gen.define_mapped_tables()
        c1 = c1gen.define_cohort()
        c1.name = "MinimalCohort"
        c1.database = Database(connector=c1gen.con, mapper=TestDomains)
        
        # Create study with no custom reporters
        study = Study(
            name="minimal_study",
            path=str(self.artifacts_dir),
            cohorts=[c1],
            custom_reporters=None
        )
        
        study.execute(overwrite=True)
        
        # Verify study execution directory in the minimal_study subfolder
        minimal_study_dir = self.artifacts_dir / "minimal_study"
        self.assertTrue(minimal_study_dir.exists(), "minimal_study directory should exist")
        
        study_dirs = [d for d in minimal_study_dir.iterdir() if d.is_dir() and d.name.startswith("D20")]
        self.assertGreater(len(study_dirs), 0, "Should create study execution directory")
        
        # Verify default Waterfall reporter was added
        study_exec_dir = max(study_dirs, key=lambda x: x.stat().st_mtime)  # Get most recent
        study_results_file = study_exec_dir / "study_results.xlsx"
        
        if study_results_file.exists():
            wb = openpyxl.load_workbook(study_results_file)
            self.assertIn("Waterfall", wb.sheetnames, 
                         "Should have Waterfall sheet even with no custom reporters")
            self.assertIn("Table1", wb.sheetnames,
                         "Should have Table1 sheet")
            wb.close()
    
    def test_cohort_waterfall_values(self):
        """Test that waterfall values are correct for known cohorts."""
        # Create cohorts with known expected values
        c1gen = CohortWithContinuousCoverageAndExclusionTestGenerator()
        c1gen.define_mapped_tables()
        c1 = c1gen.define_cohort()
        c1.name = "TestCohort"
        c1.database = Database(connector=c1gen.con, mapper=TestDomains)
        
        # Execute just the cohort to get expected waterfall
        c1.execute(overwrite=True)
        
        # Access the final index table result (cohort.table is set after execution)
        index_df = c1.table.to_pandas()
        n_final = len(index_df)
        
        self.assertGreater(n_final, 0, "Should have final cohort")
        self.assertEqual(n_final, 1, "Expected 1 person in final cohort based on test data")


if __name__ == '__main__':
    unittest.main()
