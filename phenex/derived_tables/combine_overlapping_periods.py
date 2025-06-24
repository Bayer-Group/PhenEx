from typing import Dict, Optional
from ibis.expr.types.relations import Table
import ibis
import pandas as pd

from phenex.derived_tables.derived_table import DerivedTable
from phenex.util import create_logger
from phenex.tables import PhenexTable

logger = create_logger(__name__)


class CombineOverlappingPeriods(DerivedTable):
    """
    CombineOverlappingPeriods takes overlapping and consecutive time periods the source table and combines them into a single time period with a single start and end date on a per patient level. For example, if a patient has two visits with the same start and end date, they will be combined into one visit. If a patient has two visits with overlapping dates, they will be combined into one visit with the earliest start date and the latest end date. If a patient has two visits with consecutive dates, they will be combined into one visit with the earliest start date and the latest end date.
    This is useful for creating a single time period for a patient, e.g. admission discharge periods, vaccination periods, etc. It is also useful for creating a single time period for a patient when there are multiple visits with the same start and end date, or overlapping dates.
    """

    def __init__(
        self, categorical_filter: Optional["CategoricalFilter"] = None, **kwargs
    ):
        self.categorical_filter = categorical_filter
        super(CombineOverlappingPeriods, self).__init__(**kwargs)

    def derive(
        self,
        tables: Dict[str, Table],
    ) -> "PhenexTable":
        # get the appropriate table
        table = tables[self.source_domain]

        if self.categorical_filter is not None:
            # apply the categorical filter to the table
            table = self.categorical_filter.autojoin_filter(table, tables)

        # subset to only the relevant columns
        df = table.select("PERSON_ID", "START_DATE", "END_DATE").to_pandas()

        # perform time period merging
        df = df.sort_values(["PERSON_ID", "START_DATE", "END_DATE"])
        result = []
        for pid, group in df.groupby("PERSON_ID"):
            intervals = group[["START_DATE", "END_DATE"]].values
            merged = []
            for start, end in intervals:
                if not merged or start > merged[-1][1] + pd.Timedelta(days=1):
                    merged.append([start, end])
                else:
                    merged[-1][1] = max(merged[-1][1], end)
            for start, end in merged:
                result.append({"PERSON_ID": pid, "START_DATE": start, "END_DATE": end})
        df_result = pd.DataFrame(result)
        # create a new table with the merged results
        table = ibis.memtable(df_result)
        return PhenexTable(table, name=self.dest_domain)
