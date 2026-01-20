from typing import Any, Union, Dict
import pandas as pd
from pathlib import Path


class Reporter:
    """
    Base class for all PhenEx reporters.

    A reporter creates an analysis of a cohort. It receives a cohort, executes the reporting analysis, and returns the results. Results can be exported to various formats.

    Subclasses must implement:
        - execute(cohort): Perform the reporting analysis and return results

    Subclasses may implement custom export / formatting methods as appropriate for their output type:

        - to_excel(filename): Export to Excel format
        - to_csv(filename): Export to CSV format
        - to_html(filename): Export to HTML format
        - to_markdown(filename): Export to Markdown format
        - to_word(filename): Export to Word document format
        - get_pretty_display(): Format results for display (returns formatted copy of self.df)

    Default implementations for each of these methods are defined if execute() returns self.df as a pandas DataFrame.

    Parameters:
        decimal_places: Number of decimal places to round to. Default: 1
        pretty_display: If True, format output for display (rounded decimals, display names, empty strings instead of NaNs). Default: True
    """

    def __init__(
        self,
        decimal_places: int = 1,
        pretty_display: bool = True,
    ):
        self.decimal_places = decimal_places
        self.pretty_display = pretty_display

    def execute(self, cohort) -> Union[pd.DataFrame, Dict[str, Any]]:
        """
        Execute the reporter analysis on a cohort.

        This is the main entry point for all reporters. Subclasses should:
        1. Store the cohort: `self.cohort = cohort`
        2. Perform analysis and store results in `self.df` (or `self.report` for Dict-based reporters)
        3. Return the primary result (DataFrame or Dict)

        Note: self.df should always contain the raw, unformatted data. Use get_pretty_display()
        to get a formatted version for display or export.

        Args:
            cohort: The cohort to analyze

        Returns:
            Analysis results: self.df or self.report if not returning a DataFrame.

        Raises:
            NotImplementedError: Must be implemented by subclass
        """
        raise NotImplementedError("Subclasses must implement execute()")

    def get_pretty_display(self) -> pd.DataFrame:
        """
        Return a formatted version of the reporter's results for display.

        Default implementation returns a copy of self.df with:
        - Numeric values rounded to decimal_places
        - NaN values replaced with empty strings for cleaner display

        Subclasses can override this method for custom formatting (e.g., phenotype display names).

        Returns:
            pd.DataFrame: Formatted copy of the results

        Raises:
            AttributeError: If self.df is not defined
        """
        if not hasattr(self, "df"):
            raise AttributeError(
                f"{self.__class__.__name__} does not have a 'df' attribute. "
                "Call execute() first or implement a custom get_pretty_display() method."
            )

        # Create a copy to avoid modifying the original
        pretty_df = self.df.copy()

        # Round numeric columns to decimal_places
        numeric_columns = pretty_df.select_dtypes(include=["number"]).columns
        pretty_df[numeric_columns] = pretty_df[numeric_columns].round(
            self.decimal_places
        )

        # Replace NaN with empty strings for cleaner display
        pretty_df = pretty_df.fillna("")

        return pretty_df

    def to_excel(self, filename: str) -> str:
        """
        Export reporter results to Excel format.

        Default implementation exports self.df if it exists. Subclasses can override for custom behavior.
        If pretty_display=True, formats the DataFrame before export using get_pretty_display().

        Args:
            filename: Path to the output file (relative or absolute, with or without .xlsx extension)

        Returns:
            str: Full path to the created file

        Raises:
            AttributeError: If self.df is not defined (call execute() first)
            ImportError: If openpyxl is not installed
        """
        if not hasattr(self, "df"):
            raise AttributeError(
                f"{self.__class__.__name__} does not have a 'df' attribute. "
                "Call execute() first or implement a custom to_excel() method."
            )

        # Convert to Path object and ensure .xlsx extension
        filepath = Path(filename)
        if filepath.suffix != ".xlsx":
            filepath = filepath.with_suffix(".xlsx")

        # Create parent directories if needed
        filepath.parent.mkdir(parents=True, exist_ok=True)

        # Apply pretty display if requested
        df_to_export = self.get_pretty_display() if self.pretty_display else self.df

        # Export to Excel
        df_to_export.to_excel(filepath, index=False)

        return str(filepath.absolute())

    def to_csv(self, filename: str) -> str:
        """
        Export reporter results to CSV format.

        Default implementation exports self.df if it exists. Subclasses can override for custom behavior. If pretty_display=True, formats the DataFrame before export.

        Args:
            filename: Path to the output file (relative or absolute, with or without .csv extension)

        Returns:
            str: Full path to the created file

        Raises:
            AttributeError: If self.df is not defined (call execute() first)
        """
        if not hasattr(self, "df"):
            raise AttributeError(
                f"{self.__class__.__name__} does not have a 'df' attribute. "
                "Call execute() first or implement a custom to_csv() method."
            )

        # Convert to Path object and ensure .csv extension
        filepath = Path(filename)
        if filepath.suffix != ".csv":
            filepath = filepath.with_suffix(".csv")

        # Create parent directories if needed
        filepath.parent.mkdir(parents=True, exist_ok=True)

        # Apply pretty display if requested
        df_to_export = self.get_pretty_display() if self.pretty_display else self.df

        # Export to CSV
        df_to_export.to_csv(filepath, index=False)

        return str(filepath.absolute())

    def to_html(self, filename: str) -> str:
        """
        Export reporter results to HTML format.

        Default implementation exports self.df if it exists. Subclasses can override for custom behavior. If pretty_display=True, formats the DataFrame before export.

        Args:
            filename: Path to the output file (relative or absolute, with or without .html extension)

        Returns:
            str: Full path to the created file

        Raises:
            AttributeError: If self.df is not defined (call execute() first)
        """
        if not hasattr(self, "df"):
            raise AttributeError(
                f"{self.__class__.__name__} does not have a 'df' attribute. "
                "Call execute() first or implement a custom to_html() method."
            )

        # Convert to Path object and ensure .html extension
        filepath = Path(filename)
        if filepath.suffix != ".html":
            filepath = filepath.with_suffix(".html")

        # Create parent directories if needed
        filepath.parent.mkdir(parents=True, exist_ok=True)

        # Apply pretty display if requested
        df_to_export = self.get_pretty_display() if self.pretty_display else self.df

        # Export to HTML
        df_to_export.to_html(filepath, index=False)

        return str(filepath.absolute())

    def to_markdown(self, filename: str) -> str:
        """
        Export reporter results to Markdown format.

        Default implementation exports self.df if it exists. Subclasses can override for custom behavior. If pretty_display=True, formats the DataFrame before export.

        Args:
            filename: Path to the output file (relative or absolute, with or without .md extension)

        Returns:
            str: Full path to the created file

        Raises:
            AttributeError: If self.df is not defined (call execute() first)
            ImportError: If tabulate is not installed (required for df.to_markdown())
        """
        if not hasattr(self, "df"):
            raise AttributeError(
                f"{self.__class__.__name__} does not have a 'df' attribute. "
                "Call execute() first or implement a custom to_markdown() method."
            )

        # Convert to Path object and ensure .md extension
        filepath = Path(filename)
        if filepath.suffix != ".md":
            filepath = filepath.with_suffix(".md")

        # Create parent directories if needed
        filepath.parent.mkdir(parents=True, exist_ok=True)

        # Apply pretty display if requested
        df_to_export = self.get_pretty_display() if self.pretty_display else self.df

        # Export to Markdown (requires tabulate package)
        try:
            markdown_content = df_to_export.to_markdown(index=False)
            filepath.write_text(markdown_content)
        except ImportError:
            raise ImportError(
                "tabulate is required for Markdown export. Install with: pip install tabulate"
            )

        return str(filepath.absolute())

    def to_word(self, filename: str) -> str:
        """
        Export reporter results to Microsoft Word format.

        Default implementation exports self.df as a simple table if it exists.
        Subclasses can override for custom formatting (headers, styling, etc).
        If pretty_display=True, formats the DataFrame before export using get_pretty_display().

        Args:
            filename: Path to the output file (relative or absolute, with or without .docx extension)

        Returns:
            str: Full path to the created file

        Raises:
            AttributeError: If self.df is not defined (call execute() first)
            ImportError: If python-docx is not installed
        """
        if not hasattr(self, "df"):
            raise AttributeError(
                f"{self.__class__.__name__} does not have a 'df' attribute. "
                "Call execute() first or implement a custom to_word() method."
            )

        try:
            from docx import Document
        except ImportError:
            raise ImportError(
                "python-docx is required for Word export. Install with: pip install python-docx"
            )

        # Convert to Path object and ensure .docx extension
        filepath = Path(filename)
        if filepath.suffix != ".docx":
            filepath = filepath.with_suffix(".docx")

        # Create parent directories if needed
        filepath.parent.mkdir(parents=True, exist_ok=True)

        # Apply pretty display if requested
        df_to_export = self.get_pretty_display() if self.pretty_display else self.df

        # Create Word document with table
        doc = Document()

        # Add table (rows + 1 for header)
        table = doc.add_table(
            rows=len(df_to_export) + 1, cols=len(df_to_export.columns)
        )
        table.style = "Light Grid Accent 1"

        # Add header row
        for col_idx, column_name in enumerate(df_to_export.columns):
            table.rows[0].cells[col_idx].text = str(column_name)

        # Add data rows
        for row_idx, (_, row_data) in enumerate(df_to_export.iterrows(), start=1):
            for col_idx, value in enumerate(row_data):
                table.rows[row_idx].cells[col_idx].text = str(value)

        # Save document
        doc.save(str(filepath))

        return str(filepath.absolute())
