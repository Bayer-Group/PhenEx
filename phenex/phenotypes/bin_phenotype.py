import ibis
from ibis import _
from typing import Dict, List, Union, Optional

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters import DateFilter, ValueFilter
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.aggregators import First, Last

from phenex.util import create_logger

logger = create_logger(__name__)


class BinPhenotype(Phenotype):
    """
    BinPhenotype converts values into categorical bin labels. Supports both continuous numeric binning and discrete value mapping.

    For continuous values: Takes a phenotype that returns numeric values (like age, measurements, etc.)
    and converts the VALUE column into bin labels like "[10-20)", "[20-30)", etc.

    For discrete values: Takes a phenotype that returns discrete values (like codes from CodelistPhenotype)
    and maps them to categorical labels using a bin mapping dictionary.

    DATE: The event date selected from the input phenotype
    VALUE: A categorical variable representing the bin label

    Parameters:
        name: The name of the phenotype.
        phenotype: The phenotype that returns values of interest (AgePhenotype, MeasurementPhenotype, CodelistPhenotype, etc.)
        bins: List of bin edges for continuous binning. Default is [0, 10, 20, ..., 100] for age ranges.
        value_mapping: Dictionary mapping bin names to lists of values (e.g., {"Heart Disease": ["I21", "I22", "I23"]})

    Examples:
        ```python
        # Continuous binning example
        age = AgePhenotype()
        binned_age = BinPhenotype(
            name="age_groups",
            phenotype=age,
            bins=[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        )

        # Discrete mapping example
        diagnosis_codes = CodelistPhenotype(
            name="diagnosis",
            codelist=["I21", "I22", "I23", "I24", "I25"],
            return_value="all"
        )
        diagnosis_categories = BinPhenotype(
            name="diagnosis_categories",
            phenotype=diagnosis_codes,
            value_mapping={
                "Acute MI": ["I21", "I22"],
                "MI Complications": ["I23", "I24"],
                "Chronic Heart Disease": ["I25"]
            }
        )

        tables = {"PERSON": example_person_table}
        result_table = binned_age.execute(tables)
        # Result will have VALUE column with labels like "[20-30)", "[30-40)", etc.

        result_table = diagnosis_categories.execute(tables)
        # Result will have VALUE column with labels like "Acute MI", "MI Complications", etc.
        ```
    """

    def __init__(
        self,
        phenotype: Phenotype,
        bins: Optional[List[Union[int, float]]] = None,
        value_mapping: Optional[Dict[str, List[str]]] = None,
        **kwargs,
    ):
        """
        Create bins from a phenotype's VALUE column.

        Supports two modes:
        1. Continuous binning: Use 'bins' parameter for numeric ranges
        2. Discrete mapping: Use 'value_mapping' parameter for bin-to-values mapping

        Args:
            phenotype: The phenotype to bin values from
            bins: List of bin edges for continuous values (e.g., [0, 10, 20, 30])
                 Default is [0, 10, 20, ..., 100] for backward compatibility
            value_mapping: Dictionary mapping bin names to lists of values
                          (e.g., {"Heart Disease": ["I21", "I22", "I23"], "Diabetes": ["E10", "E11"]})
        """
        super(BinPhenotype, self).__init__(**kwargs)

        # Set default bins for backward compatibility if neither parameter is provided
        if bins is None and value_mapping is None:
            bins = list(range(0, 101, 10))

        # Validate that only one binning method is specified
        if bins is not None and value_mapping is not None:
            raise ValueError(
                "Cannot specify both 'bins' and 'value_mapping' - choose one"
            )

        self.bins = bins
        self.value_mapping = value_mapping
        self.phenotype = phenotype

        # Validate continuous binning
        if self.bins is not None:
            if len(self.bins) < 2:
                raise ValueError("bins must contain at least 2 values")
            if self.bins != sorted(self.bins):
                raise ValueError("bins must be sorted in ascending order")

        # Validate discrete mapping
        if self.value_mapping is not None:
            if not isinstance(self.value_mapping, dict):
                raise ValueError("value_mapping must be a dictionary")
            if len(self.value_mapping) == 0:
                raise ValueError("value_mapping cannot be empty")
            # Validate that all values are lists of strings
            for bin_name, values in self.value_mapping.items():
                if not isinstance(values, list):
                    raise ValueError(f"Values for bin '{bin_name}' must be a list")
                if not all(isinstance(v, str) for v in values):
                    raise ValueError(f"All values for bin '{bin_name}' must be strings")

        # Validate phenotype types for continuous binning
        if self.bins is not None and self.phenotype.__class__.__name__ not in [
            "AgePhenotype",
            "MeasurementPhenotype",
            "ArithmeticPhenotype",
            "ScorePhenotype",
        ]:
            raise ValueError(
                f"Invalid phenotype type for continuous binning: {self.phenotype.__class__.__name__}"
            )

        # For discrete mapping, allow CodelistPhenotype and other string-based phenotypes
        if (
            self.value_mapping is not None
            and self.phenotype.__class__.__name__
            not in [
                "CodelistPhenotype",
                "AgePhenotype",
                "MeasurementPhenotype",
                "ArithmeticPhenotype",
                "ScorePhenotype",
            ]
        ):
            raise ValueError(
                f"Invalid phenotype type for discrete mapping: {self.phenotype.__class__.__name__}"
            )

        self.add_children(phenotype)

    def _execute(self, tables) -> PhenotypeTable:
        # Execute the child phenotype to get the initial table to filter
        table = self.phenotype.table

        if self.bins is not None:
            # Continuous binning logic
            table = self._execute_continuous_binning(table)
        else:
            # Discrete mapping logic
            table = self._execute_discrete_mapping(table)

        return table

    def _execute_continuous_binning(self, table) -> PhenotypeTable:
        """Handle continuous value binning with numeric ranges."""
        # Create bin labels
        bin_labels = []

        # Add a bin for values < first bin edge
        bin_labels.append(f"<{self.bins[0]}")

        # Add bins for each range
        for i in range(len(self.bins) - 1):
            bin_labels.append(f"[{self.bins[i]}-{self.bins[i+1]})")

        # Add a final bin for values >= last bin edge
        bin_labels.append(f">={self.bins[-1]}")

        # Create binning logic using Ibis case statements
        value_col = table.VALUE

        # Start with the case expression
        case_expr = None

        # Handle values < first bin edge
        first_condition = value_col < self.bins[0]
        case_expr = ibis.case().when(first_condition, bin_labels[0])

        # Create conditions for each bin range
        for i in range(len(self.bins) - 1):
            condition = (value_col >= self.bins[i]) & (value_col < self.bins[i + 1])
            case_expr = case_expr.when(condition, bin_labels[i + 1])

        # Handle values >= last bin edge
        final_condition = value_col >= self.bins[-1]
        case_expr = case_expr.when(final_condition, bin_labels[-1])

        # Handle null values
        case_expr = case_expr.else_(None)

        # Replace the VALUE column with bin labels
        table = table.mutate(VALUE=case_expr.end())

        return table

    def _execute_discrete_mapping(self, table) -> PhenotypeTable:
        """Handle discrete value mapping with bin-to-values dictionary."""
        value_col = table.VALUE

        # Start with the case expression
        case_expr = ibis.case()

        # Add conditions for each bin and its associated values
        for bin_name, values in self.value_mapping.items():
            # Create condition that checks if value is in the list of values for this bin
            condition = value_col.isin(values)
            case_expr = case_expr.when(condition, bin_name)

        # Handle unmapped values as null
        case_expr = case_expr.else_(None)

        # Replace the VALUE column with mapped labels
        table = table.mutate(VALUE=case_expr.end())

        return table
