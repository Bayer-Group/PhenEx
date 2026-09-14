import copy
from datetime import date
from typing import Optional, List, Dict, Any

from phenex.phenotypes.factory.stackable_regimen import StackableRegimen
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.filters.value import GreaterThanOrEqualTo, LessThanOrEqualTo, LessThan
from phenex.filters.date_filter import DateFilter, AfterOrOn

from phenex.phenotypes.time_shift_phenotype import TimeShiftPhenotype
from phenex.phenotypes.further_value_filter_phenotype import FurtherValueFilterPhenotype
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
        initial_phenotypes: Optional phenotypes for a baseline "period 0", combined combinatorically like the other periods. Their relative_time_range is configured externally (not shifted per period).

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
        end_of_study_period: Optional[date] = None,
        n_periods: int = 4,
        initial_phenotypes: Optional[List[Any]] = None,
    ):
        self.input_phenotypes = phenotypes
        self.regimen_keys = regimen_keys
        self.name = name
        self.days_between_periods = days_between_periods
        self.end_of_study_period = end_of_study_period
        self.n_periods = n_periods
        self.initial_phenotypes = initial_phenotypes

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

    def _create_time_shifted_phenotypes(self, idx_period):
        period_filter = RelativeTimeRangeFilter(
            when="after",
            min_days=GreaterThanOrEqualTo((idx_period) * self.days_between_periods),
            max_days=LessThan((idx_period + 1) * self.days_between_periods),
        )

        pts_in_period = []
        for phenotype in self.input_phenotypes:
            pt = copy.deepcopy(phenotype)
            pt.name = f"{self.name}{phenotype.name}{idx_period + 1}"
            pt.table = None
            pt.relative_time_range = [period_filter]
            pts_in_period.append(pt)
        return pts_in_period

    def _create_censored_phenotype(self, idx_period):
        """Override to add a standalone, mutually exclusive 'censored' bin per period."""
        return None

    def _create_initial_phenotypes(self):
        """Baseline (period 0) phenotypes; relative_time_range is set externally, so no shifting is applied here."""
        # Shared memo: initial_phenotypes commonly cross-reference each other as
        # anchor_phenotypes, so they must be deep-copied together to preserve a
        # single shared clone of each anchor (deep-copying independently would
        # produce duplicate, unexecuted clones under the same node name).
        memo = {}
        pts = []
        for phenotype in self.initial_phenotypes:
            pt = copy.deepcopy(phenotype, memo)
            pt.name = f"{self.name}{phenotype.name}0"
            pt.table = None
            pts.append(pt)
        return pts

    def _finalize_period(self, period_num, period_key, regimen):
        self._output_phenotypes_dict[period_key] = regimen.output_phenotypes
        self._output_phenotypes.extend(regimen.output_phenotypes)

        # Annotate each output phenotype with TPA metadata for reporters
        period_label = period_key.replace("_", " ")
        for pt in regimen.output_phenotypes:
            pt._tpa_name = self.name
            pt._tpa_period_num = period_num
            pt._tpa_period_label = period_label

    def _generate(self):

        self._output_phenotypes_dict = {}
        self._output_phenotypes = []

        if self.initial_phenotypes is not None:
            regimen = StackableRegimen(
                name=f"{self.name}0",
                phenotypes=self._create_initial_phenotypes(),
                regimen_keys=self.regimen_keys,
            )
            self._finalize_period(
                period_num=0,
                period_key="distribution_of_patients_per_stacked_regimen_at_baseline",
                regimen=regimen,
            )

        for idx_period in range(self.n_periods):

            pts_in_period = self._create_time_shifted_phenotypes(idx_period)
            pt_censored = self._create_censored_phenotype(idx_period)

            regimen = StackableRegimen(
                name=f"{self.name}{idx_period + 1}",
                phenotypes=pts_in_period,
                regimen_keys=self.regimen_keys,
                censored_phenotype=pt_censored,
            )

            period_key = (
                f"distribution_of_patients_per_stacked_regimen_from_day_{idx_period * self.days_between_periods}"
                f"_to_{(idx_period + 1) * self.days_between_periods}"
            )
            self._finalize_period(idx_period + 1, period_key, regimen)


class TreatmentPatternAnalysisOnTreatment(TreatmentPatternAnalysis):
    """
    TreatmentPatternAnalysisOnTreatment receives TimeRangePhenotypes as inputs (not CodelistPhenotypes)
    """

    def _create_time_shifted_phenotypes(self, idx_period):
        pt_anchor_shifted = None
        if idx_period != 0:
            pt_anchor_shifted = TimeShiftPhenotype(
                name=f"{self.name}_index_shifted_{idx_period + 1}",
                domain="PERSON",
                days=(idx_period) * self.days_between_periods,
            )
        # cached so _create_censored_phenotype reuses the same node instead of
        # constructing a second phenotype with the same name
        self._pt_anchor_shifted = pt_anchor_shifted

        # Relative time range phenotype uses relativerangerangefilter to filter number of days to start/end date. We don't set any min/max values
        period_filter = RelativeTimeRangeFilter(
            when="before",
            anchor_phenotype=pt_anchor_shifted,
        )

        pts_in_period = []
        for phenotype in self.input_phenotypes:
            pt = copy.deepcopy(phenotype)
            pt.name = f"{self.name}{phenotype.name}{idx_period + 1}"
            pt.table = None
            pt.relative_time_range = period_filter
            # relative_time_range was assigned post-construction, so the anchor dependency normally registered in __init__ must be added manually.
            if idx_period != 0:
                pt.add_children(pt_anchor_shifted)
            pts_in_period.append(pt)
        return pts_in_period

    def _create_censored_phenotype(self, idx_period):
        if self.end_of_study_period is None:
            return None
        # censored: the period's anchor date (INDEX_DATE for period 0) is on/after end_of_study_period
        anchor_for_censoring = self._pt_anchor_shifted or TimeShiftPhenotype(
            name=f"{self.name}_index_shifted_{idx_period + 1}",
            domain="PERSON",
            days=0,
        )
        return FurtherValueFilterPhenotype(
            name=f"{self.name}censored{idx_period + 1}",
            phenotype=anchor_for_censoring,
            date_range=DateFilter(min_date=AfterOrOn(self.end_of_study_period)),
        )
