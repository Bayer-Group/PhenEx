from typing import Dict, Optional
from ibis.expr.types.relations import Table
import ibis
import pandas as pd

from phenex.derived_tables.derived_table import DerivedTable
from phenex.util import create_logger

logger = create_logger(__name__)


class CombineOverlappingPeriods(DerivedTable):
    def derive(
        self,
        tables: Dict[str, Table],
    ) -> "PhenexTable":
        # get the appropriate table
        table = tables[self.source_domain]

        df = table.select("PERSON_ID", "START_DATE", "END_DATE").to_pandas()

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
        table = ibis.memtable(df_result)
        return table
