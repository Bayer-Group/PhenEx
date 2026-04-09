import copy
from typing import Optional, List, Dict, Any

from phenex.phenotypes.factory.stackable_regimen import StackableRegimen
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.value import GreaterThanOrEqualTo, LessThan

from phenex.util import create_logger

logger = create_logger(__name__)


class TreatmentPatternAnalysis:
    """
    TreatmentPatternAnalysis creates treatment pattern regimens over multiple time periods.

    Given a list of input phenotypes, it divides the follow-up time into equal periods and
    generates StackableRegimen combinations for each period. This allows analysis of how
    treatment patterns change over time (e.g., 0-90 days, 90-180 days, etc.).

    Parameters:
        phenotypes: List of phenotypes to analyze treatment patterns for.
        regimen_keys: List of short keys corresponding to phenotypes for naming.
        name: Prefix added to generated phenotype names.
        days_between_periods: Number of days in each period. Default is 90.
        n_periods: Number of periods to generate. Default is 4.

    Attributes:
        output_phenotypes_dict: Dictionary mapping period labels to lists of StackableRegimen phenotypes.
        output_phenotypes: Flat list of all generated phenotypes across all periods.

    Example:
        ```python
        from phenex.phenotypes import CodelistPhenotype
        from phenex.phenotypes.factory import TreatmentPatternAnalysis
        from phenex.codelists import Codelist

        pt_a = CodelistPhenotype(
            name='DrugA',
            domain='MEDICATIONDISPENSE',
            codelist=Codelist(['drugA']),
        )
        pt_b = CodelistPhenotype(
            name='DrugB',
            domain='MEDICATIONDISPENSE',
            codelist=Codelist(['drugB']),
        )

        tpa = TreatmentPatternAnalysis(
            phenotypes=[pt_a, pt_b],
            regimen_keys=['A', 'B'],
            name="TP",
            days_between_periods=90,
            n_periods=4,
        )

        # Dictionary keyed by period label
        d = tpa.output_phenotypes_dict

        # Flat list of all phenotypes
        all_pts = tpa.output_phenotypes
        ```
    """

    def __init__(
        self,
        phenotypes: List[Any],
        regimen_keys: Optional[List[str]] = None,
        name: str = "tp",
        days_between_periods: int = 90,
        n_periods: int = 4,
    ):
        self.input_phenotypes = phenotypes
        self.regimen_keys = regimen_keys
        self.name = name
        self.days_between_periods = days_between_periods
        self.n_periods = n_periods

        self._output_phenotypes = None
        self._output_phenotypes_dict = None

    @property
    def output_phenotypes(self):
        if self._output_phenotypes is None:
            self._generate()
        return self._output_phenotypes

    @property
    def output_phenotypes_dict(self):
        if self._output_phenotypes_dict is None:
            self._generate()
        return self._output_phenotypes_dict

    def _generate(self):
        start_days = GreaterThanOrEqualTo(0)

        self._output_phenotypes_dict = {}
        self._output_phenotypes = []

        for idx_period in range(self.n_periods):
            end_day = LessThan((idx_period + 1) * self.days_between_periods)

            period_filter = RelativeTimeRangeFilter(
                when="after",
                min_days=start_days,
                max_days=end_day,
            )

            pts_in_period = []
            for phenotype in self.input_phenotypes:
                pt = copy.deepcopy(phenotype)
                pt.name = f"{phenotype.name}{idx_period + 1}"
                pt.table = None
                pt.relative_time_range = [period_filter]
                pts_in_period.append(pt)

            regimen = StackableRegimen(
                name=f"{self.name}{idx_period + 1}",
                phenotypes=pts_in_period,
                regimen_keys=self.regimen_keys,
            )

            period_key = (
                f"distribution_of_patients_per_stacked_regimen_from_day_{idx_period * self.days_between_periods}"
                f"_to_{(idx_period + 1) * self.days_between_periods}"
            )
            self._output_phenotypes_dict[period_key] = regimen.output_phenotypes
            self._output_phenotypes.extend(regimen.output_phenotypes)

            # Annotate each output phenotype with TPA metadata for reporters
            period_label = period_key.replace("_", " ")
            for pt in regimen.output_phenotypes:
                pt._tpa_name = self.name
                pt._tpa_period_num = idx_period + 1
                pt._tpa_period_label = period_label
