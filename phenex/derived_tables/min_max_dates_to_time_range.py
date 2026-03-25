from typing import Dict
from ibis.expr.types.relations import Table
import ibis

from phenex.node import Node
from phenex.util import create_logger

logger = create_logger(__name__)


class MinMaxDatesToTimeRange(Node):
    """
    MinMaxDatesToTimeRange identifies a global start and end date for each patient.
    The start date is the first EVENT_DATE associated with a patient, and the end date is 
    the last EVENT_DATE associated with a patient. It will go through the mapped tables 
    dictionary and look for any table that has an EVENT_DATE column defined, select the 
    DATE column, union them, and then identify the min/max dates.
    """

    def __init__(self, **kwargs):
        super(MinMaxDatesToTimeRange, self).__init__(**kwargs)

    def _execute(
        self,
        tables: Dict[str, Table],
    ) -> Table:
        combined_table = None

        for domain, table in tables.items():
            columns = table.columns
            if "EVENT_DATE" in columns and "PERSON_ID" in columns:
                # Select only the required columns to unify schemas
                selected = table.select("PERSON_ID", "EVENT_DATE")
                
                if combined_table is None:
                    combined_table = selected
                else:
                    combined_table = combined_table.union(selected)

        if combined_table is None:
            raise ValueError("No tables with EVENT_DATE and PERSON_ID were found.")

        # Group by patient to find the global min and max event dates
        result = combined_table.group_by("PERSON_ID").aggregate(
            start_date=combined_table["EVENT_DATE"].min(),
            end_date=combined_table["EVENT_DATE"].max()
        )

        return result
