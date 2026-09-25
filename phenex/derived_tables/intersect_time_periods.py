from typing import Dict, List
from ibis.expr.types.relations import Table
import ibis

from phenex.node import DerivedTable, Node
from phenex.util import create_logger

from .combine_overlapping_periods import CombineOverlappingPeriods

logger = create_logger(__name__)


class IntersectTimePeriods(DerivedTable):
    """
    IntersectTimePeriods takes two or more time-range derived tables (each with columns
    PERSON_ID, START_DATE, END_DATE) and, for every patient, computes the periods during
    which all of the given time ranges overlap simultaneously.

    For example, given a table of hospitalization periods and a table of medication
    coverage periods for the same patients, IntersectTimePeriods returns only the
    sub-periods during which a patient was both hospitalized and covered by the
    medication. Patients (or periods) that do not overlap across all inputs are
    excluded from the result.

    Each input table is first normalized with CombineOverlappingPeriods so that periods
    within a single input are guaranteed to be non-overlapping before intersecting across
    inputs. The intersection is then computed pairwise, folding left to right over the
    list of inputs.

    Parameters:
        time_range_tables: A list of at least two Node's whose executed output tables
            each contain PERSON_ID, START_DATE, and END_DATE columns.

    Attributes:
        time_range_tables: The list of dependency Nodes providing the time ranges to intersect.
    """

    def __init__(self, time_range_tables: List[Node], **kwargs):
        if len(time_range_tables) < 2:
            raise ValueError(
                "IntersectTimePeriods requires at least two time_range_tables to intersect."
            )
        self.time_range_tables = time_range_tables
        super(IntersectTimePeriods, self).__init__(**kwargs)
        self.add_children(time_range_tables)

    def _execute(
        self,
        tables: Dict[str, Table],
    ) -> Table:
        periods = [self._normalize(node.table) for node in self.time_range_tables]

        intersection = periods[0]
        for period in periods[1:]:
            intersection = self._intersect_pair(intersection, period)

        return intersection.order_by(["PERSON_ID", "START_DATE"])

    @staticmethod
    def _normalize(table: Table) -> Table:
        """Collapse a source table to non-overlapping periods per patient."""
        table = table.select("PERSON_ID", "START_DATE", "END_DATE")
        combiner = CombineOverlappingPeriods(domain="_")
        return combiner.execute(tables={"_": table})

    @staticmethod
    def _intersect_pair(left: Table, right: Table) -> Table:
        """
        Self-join two non-overlapping period tables on matching patients whose periods
        overlap, deriving the overlapping sub-period (max of starts, min of ends).
        """
        right = right.view()  # alias to allow joining tables with identical columns

        joined = left.inner_join(
            right,
            [
                left.PERSON_ID == right.PERSON_ID,
                left.START_DATE <= right.END_DATE,
                right.START_DATE <= left.END_DATE,
            ],
        )

        return joined.select(
            PERSON_ID=left.PERSON_ID,
            START_DATE=ibis.greatest(left.START_DATE, right.START_DATE),
            END_DATE=ibis.least(left.END_DATE, right.END_DATE),
        ).distinct()
