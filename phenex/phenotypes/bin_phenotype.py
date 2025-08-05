import ibis
from ibis import _

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters import DateFilter, ValueFilter
from phenex.tables import is_phenex_code_table, PHENOTYPE_TABLE_COLUMNS, PhenotypeTable
from phenex.aggregators import First, Last

from phenex.util import create_logger

logger = create_logger(__name__)


class BinPhenotype(Phenotype):
    """
    BinPhenotype converts numeric values into categorical bin labels. To use, pass it a numeric valued phenotype such as AgePhenotype, MeasurementPhenotype, ArithmeticPhenotype, or ScorePhenotype.

    Takes a phenotype that returns numeric values (like age, measurements, etc.)
    and converts the VALUE column into bin labels like "[10-20)", "[20-30)", etc.

    DATE: The event date selected from the input phenotype
    VALUE: A categorical variable representing the bin label that the numeric value falls into

    Parameters:
        name: The name of the phenotype.
        phenotype: The phenotype that returns numeric values of interest (AgePhenotype, MeasurementPhenotype, etc.)
        bins: List of bin edges. Default is [0, 10, 20, ..., 100] for age ranges.

    Example:
        ```python
        # Create an age phenotype
        age = AgePhenotype()

        # Create bins for age groups: [0-10), [10-20), [20-30), etc.
        binned_age = BinPhenotype(
            name="age_groups",
            phenotype=age,
            bins=[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
        )

        tables = {"PERSON": example_person_table}
        result_table = binned_age.execute(tables)

        # Result will have VALUE column with labels like "[20-30)", "[30-40)", etc.
        display(result_table)
        ```
    """

    def __init__(
        self,
        phenotype: Phenotype,
        bins=list(range(0, 101, 10)),
        **kwargs,
    ):
        super(BinPhenotype, self).__init__(**kwargs)
        self.bins = bins
        self.phenotype = phenotype
        if self.phenotype.__class__.__name__ not in [
            "AgePhenotype",
            "MeasurementPhenotype",
            "ArithmeticPhenotype",
            "ScorePhenotype",
        ]:
            raise ValueError(
                f"Invalid phenotype type: {self.phenotype.__class__.__name__}"
            )
        self.add_children(phenotype)

    def _execute(self, tables) -> PhenotypeTable:
        # Execute the child phenotype to get the initial table to filter
        table = self.phenotype.table

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
