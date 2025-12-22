"""
Unit tests for Reporter base class default implementations.
"""

import pytest
import pandas as pd
import tempfile
import os
from pathlib import Path

from phenex.reporting.reporter import Reporter


class SimpleReporter(Reporter):
    """Minimal reporter implementation for testing default methods."""

    def execute(self, cohort=None):
        """Create a simple DataFrame for testing."""
        self.df = pd.DataFrame(
            {
                "ID": [1, 2, 3, 4, 5],
                "Value": [1.234, 2.567, 3.891, 4.123, 5.456],
                "Category": ["A", "B", "A", "C", "B"],
                "Score": [10.5, 20.3, 30.7, 40.1, 50.9],
            }
        )
        if self.pretty_display:
            self.create_pretty_display()
        return self.df


class TestReporterDefaultMethods:
    """Test the default implementations in Reporter base class."""

    def test_create_pretty_display_rounds_numeric_columns(self):
        """Test that create_pretty_display rounds numeric columns to decimal_places."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=False)
        reporter.execute()

        # Apply pretty display manually
        reporter.create_pretty_display()

        # Check that numeric columns are rounded
        assert reporter.df["Value"].iloc[0] == 1.2
        assert reporter.df["Value"].iloc[1] == 2.6
        assert reporter.df["Score"].iloc[0] == 10.5
        assert reporter.df["Score"].iloc[1] == 20.3

    def test_create_pretty_display_replaces_nan_with_empty_string(self):
        """Test that create_pretty_display replaces NaN with empty strings."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=False)
        reporter.execute()

        # Add some NaN values
        reporter.df.loc[0, "Value"] = pd.NA
        reporter.df.loc[1, "Category"] = pd.NA

        # Apply pretty display
        reporter.create_pretty_display()

        # Check that NaN values are replaced with empty strings
        assert reporter.df["Value"].iloc[0] == ""
        assert reporter.df["Category"].iloc[1] == ""

    def test_create_pretty_display_without_df_raises_error(self):
        """Test that create_pretty_display raises AttributeError if df is not set."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=False)
        # Don't call execute()

        with pytest.raises(AttributeError, match="does not have a 'df' attribute"):
            reporter.create_pretty_display()

    def test_execute_with_pretty_display_applies_formatting(self):
        """Test that execute() with pretty_display=True applies formatting."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        df = reporter.execute()

        # Check that values are rounded
        assert df["Value"].iloc[0] == 1.2
        assert df["Score"].iloc[0] == 10.5

    def test_to_excel_creates_file(self):
        """Test that to_excel creates an Excel file."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = reporter.to_excel(os.path.join(tmpdir, "test.xlsx"))

            assert os.path.exists(filepath)
            assert filepath.endswith(".xlsx")

            # Verify we can read it back
            df_read = pd.read_excel(filepath)
            assert len(df_read) == 5
            assert list(df_read.columns) == ["ID", "Value", "Category", "Score"]

    def test_to_excel_adds_extension_if_missing(self):
        """Test that to_excel adds .xlsx extension if not provided."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = reporter.to_excel(os.path.join(tmpdir, "test"))

            assert filepath.endswith(".xlsx")
            assert os.path.exists(filepath)

    def test_to_excel_creates_parent_directories(self):
        """Test that to_excel creates parent directories if needed."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            nested_path = os.path.join(tmpdir, "sub1", "sub2", "test.xlsx")
            filepath = reporter.to_excel(nested_path)

            assert os.path.exists(filepath)
            assert os.path.exists(os.path.dirname(filepath))

    def test_to_excel_without_df_raises_error(self):
        """Test that to_excel raises AttributeError if df is not set."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        # Don't call execute()

        with pytest.raises(AttributeError, match="does not have a 'df' attribute"):
            reporter.to_excel("test.xlsx")

    def test_to_csv_creates_file(self):
        """Test that to_csv creates a CSV file."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = reporter.to_csv(os.path.join(tmpdir, "test.csv"))

            assert os.path.exists(filepath)
            assert filepath.endswith(".csv")

            # Verify we can read it back
            df_read = pd.read_csv(filepath)
            assert len(df_read) == 5
            assert list(df_read.columns) == ["ID", "Value", "Category", "Score"]

    def test_to_csv_adds_extension_if_missing(self):
        """Test that to_csv adds .csv extension if not provided."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = reporter.to_csv(os.path.join(tmpdir, "test"))

            assert filepath.endswith(".csv")
            assert os.path.exists(filepath)

    def test_to_html_creates_file(self):
        """Test that to_html creates an HTML file."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = reporter.to_html(os.path.join(tmpdir, "test.html"))

            assert os.path.exists(filepath)
            assert filepath.endswith(".html")

            # Verify it contains table elements
            with open(filepath) as f:
                content = f.read()
                assert "<table" in content
                assert "<tr>" in content

    def test_to_html_adds_extension_if_missing(self):
        """Test that to_html adds .html extension if not provided."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = reporter.to_html(os.path.join(tmpdir, "test"))

            assert filepath.endswith(".html")
            assert os.path.exists(filepath)

    def test_to_markdown_creates_file(self):
        """Test that to_markdown creates a Markdown file."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = reporter.to_markdown(os.path.join(tmpdir, "test.md"))

            assert os.path.exists(filepath)
            assert filepath.endswith(".md")

            # Verify it contains markdown table elements
            with open(filepath) as f:
                content = f.read()
                assert "|" in content  # Markdown table separator

    def test_to_markdown_adds_extension_if_missing(self):
        """Test that to_markdown adds .md extension if not provided."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = reporter.to_markdown(os.path.join(tmpdir, "test"))

            assert filepath.endswith(".md")
            assert os.path.exists(filepath)

    def test_to_word_creates_file(self):
        """Test that to_word creates a Word document."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = reporter.to_word(os.path.join(tmpdir, "test.docx"))

            assert os.path.exists(filepath)
            assert filepath.endswith(".docx")

            # Verify it's a valid docx file (at least check the file size > 0)
            assert os.path.getsize(filepath) > 0

    def test_to_word_adds_extension_if_missing(self):
        """Test that to_word adds .docx extension if not provided."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = reporter.to_word(os.path.join(tmpdir, "test"))

            assert filepath.endswith(".docx")
            assert os.path.exists(filepath)

    def test_export_methods_respect_pretty_display_true(self):
        """Test that export methods apply formatting when pretty_display=True."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            # Export to CSV and check formatting
            csv_path = reporter.to_csv(os.path.join(tmpdir, "test.csv"))
            df_read = pd.read_csv(csv_path)

            # Values should be rounded to 1 decimal place
            assert df_read["Value"].iloc[0] == 1.2
            assert df_read["Score"].iloc[0] == 10.5

    def test_export_methods_respect_pretty_display_false(self):
        """Test that export methods preserve original values when pretty_display=False."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=False)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            # Export to CSV without pretty display
            csv_path = reporter.to_csv(os.path.join(tmpdir, "test.csv"))
            df_read = pd.read_csv(csv_path)

            # Values should NOT be rounded
            assert abs(df_read["Value"].iloc[0] - 1.234) < 0.001
            assert abs(df_read["Score"].iloc[0] - 10.5) < 0.001

    def test_export_methods_do_not_modify_original_df(self):
        """Test that export methods don't modify the original DataFrame."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        # Store original values
        original_value = reporter.df["Value"].iloc[0]

        with tempfile.TemporaryDirectory() as tmpdir:
            # Export multiple times
            reporter.to_csv(os.path.join(tmpdir, "test1.csv"))
            reporter.to_excel(os.path.join(tmpdir, "test2.xlsx"))
            reporter.to_html(os.path.join(tmpdir, "test3.html"))

            # Original df should still have rounded values (from execute())
            assert reporter.df["Value"].iloc[0] == original_value

    def test_different_decimal_places(self):
        """Test that different decimal_places settings work correctly."""
        # Test with 0 decimal places
        reporter = SimpleReporter(decimal_places=0, pretty_display=True)
        df = reporter.execute()
        assert df["Value"].iloc[0] == 1.0
        assert df["Score"].iloc[0] == 10.0

        # Test with 2 decimal places
        reporter = SimpleReporter(decimal_places=2, pretty_display=True)
        df = reporter.execute()
        assert df["Value"].iloc[0] == 1.23
        assert df["Score"].iloc[0] == 10.5

    def test_returns_absolute_path(self):
        """Test that export methods return absolute paths."""
        reporter = SimpleReporter(decimal_places=1, pretty_display=True)
        reporter.execute()

        with tempfile.TemporaryDirectory() as tmpdir:
            # Use relative path
            relative_path = "test.csv"
            full_path = os.path.join(tmpdir, relative_path)

            os.chdir(tmpdir)
            filepath = reporter.to_csv(relative_path)

            # Should return absolute path
            assert os.path.isabs(filepath)
            assert os.path.exists(filepath)


class TestReporterSubclassMustImplementExecute:
    """Test that Reporter subclasses must implement execute()."""

    def test_execute_not_implemented_raises_error(self):
        """Test that calling execute on base Reporter raises NotImplementedError."""

        class IncompleteReporter(Reporter):
            pass

        reporter = IncompleteReporter()

        with pytest.raises(
            NotImplementedError, match="Subclasses must implement execute"
        ):
            reporter.execute(cohort=None)
