import pandas as pd

from .waterfall import Waterfall
from phenex.util import create_logger

logger = create_logger(__name__)


class WaterfallColorful(Waterfall):
    """
    A colorful version of Waterfall that ensures color styling is always applied.
    
    This class extends Waterfall with guaranteed color-coded rows to distinguish between
    different types of criteria (entry, inclusion, exclusion, component) and their nesting levels.
    """

    def __init__(
        self,
        decimal_places: int = 1,
        pretty_display: bool = True,
        include_component_phenotypes_level=None,
    ):
        """
        Initialize WaterfallColorful with pretty_display enabled by default.
        
        Args:
            decimal_places: Number of decimal places for rounding (default: 1)
            pretty_display: Enable formatted display with colors (default: True)
            include_component_phenotypes_level: Maximum depth for component phenotypes
        """
        super().__init__(
            decimal_places=decimal_places,
            pretty_display=pretty_display,
            include_component_phenotypes_level=include_component_phenotypes_level,
        )

    def execute(self, cohort: "Cohort") -> pd.DataFrame:
        """
        Execute the WaterfallColorful report and return styled dataframe.
        
        Args:
            cohort: The cohort to generate the waterfall for
            
        Returns:
            pd.DataFrame or Styler: The waterfall data with color styling applied
        """
        # Call parent execute which already handles styling
        result = super().execute(cohort)
        
        # If pretty_display is off but we still want colors, add them
        if not self.pretty_display and "_color" not in self.df.columns:
            self._add_row_colors()
            return self._apply_styling()
        
        return result

    def get_pretty_display(self):
        """
        Return a formatted and styled version of the waterfall results with colors rendered.

        Formatting includes:
        - Adding row colors based on type and level
        - Formatting numeric columns as strings with thousand separators
        - Replacing NAs with empty strings
        - Creating sparse type column
        - Applying background colors (returns styled DataFrame)

        Returns:
            pd.io.formats.style.Styler: Styled dataframe with rendered colors
        """
        # Create a copy to avoid modifying the original
        pretty_df = self.df.copy()

        # Temporarily swap self.df so helper methods work
        original_df = self.df
        self.df = pretty_df

        try:
            # Add colors before any transformations
            self._add_row_colors()

            # Format numeric columns as strings
            self._format_numeric_columns()

            # Replace NAs and None values with empty strings
            self.df = self.df.replace("<NA>", "")

            # Create sparse type column (show type only once per section)
            self._create_sparse_type_column()

            # Apply styling to render colors
            result = self._apply_styling()
        finally:
            # Restore original df
            self.df = original_df

        return result
