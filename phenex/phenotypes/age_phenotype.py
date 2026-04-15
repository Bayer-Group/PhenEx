from typing import Dict, Optional

import ibis
from ibis.expr.types.relations import Table

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters import ValueFilter, Value
from phenex.tables import PhenotypeTable, is_phenex_person_table
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.util import create_logger

logger = create_logger(__name__)


class AgePhenotype(Phenotype):
    """
    Use AgePhenotype to compute patient age (in years) at a given reference date or to include/exclude patients based on age criteria (e.g. "patients aged 18-65 at index date"). Age is calculated from date of birth to the index date (or a custom anchor phenotype if supplied).

    For patients passing all filters, this phenotype returns:
        DATE: The patient's date of birth.
        VALUE: Age in years at the anchor date (index date if not anchor not explicitly supplied).

    Parameters:
        name: Name of the phenotype, default is 'age'.
        value_filter: Filter the returned patients based on their age (in years)
        anchor_phenotype: An optional anchor phenotype to calculate relative age.
        domain: Domain of the phenotype, default is 'PERSON'.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Example: Age at First Atrial Fibrillation Diagnosis
        ```python
        from phenex.phenotypes import CodelistPhenotype
        from phenex.codelists import Codelist

        af_codelist = Codelist([313217])
        af_phenotype = CodelistPhenotype(
            name="af",
            domain='CONDITION_OCCURRENCE',
            codelist=af_codelist,
            return_date='first',
        )

        age_phenotype = AgePhenotype(
            value_filter=ValueFilter(
                min_value=GreaterThan(18),
                max_value=LessThan(65)
                ),
            anchor_phenotype=af_phenotype
        )

        result_table = age_phenotype.execute(tables)
        display(result_table)
        ```
    """

    output_display_type = "value"

    # FIXME this will become a problem when modern medicine allows people to live more
    # than 365*4 years (so they accumulate enough leap days to get an extra year)
    DAYS_IN_YEAR = 365

    def __init__(
        self,
        name: Optional[str] = None,
        value_filter: Optional[ValueFilter] = None,
        anchor_phenotype: Optional[Phenotype] = None,
        domain: str = "PERSON",
        **kwargs,
    ):
        # Generate default name from value_filter if not provided
        if name is None:
            name = self._generate_name_from_filter(value_filter)

        super(AgePhenotype, self).__init__(name=name)
        self.value_filter = value_filter
        self.domain = domain
        self.anchor_phenotype = anchor_phenotype

        self.time_range_filter = RelativeTimeRangeFilter(
            anchor_phenotype=anchor_phenotype
        )

        # Set children to the dependent PHENOTYPES
        if anchor_phenotype is not None:
            self.add_children(anchor_phenotype)

    def _generate_name_from_filter(self, value_filter: Optional[ValueFilter]) -> str:
        """Generate a name like 'age_g18_le65' from the value filter."""
        if value_filter is None:
            return "AGE"

        filter_string = value_filter.to_short_string()
        if filter_string:
            return f"age_{filter_string}"
        else:
            return "age"

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        person_table = tables[self.domain]
        assert is_phenex_person_table(person_table)

        if "YEAR_OF_BIRTH" in person_table.columns:
            if "DATE_OF_BIRTH" in person_table.columns:
                logger.debug(
                    "Year of birth and date of birth is present, taking date of birth where possible otherwise setting date of birth to june 6th"
                )
                date_of_birth = ibis.coalesce(
                    ibis.date(person_table.DATE_OF_BIRTH),
                    ibis.date(person_table.YEAR_OF_BIRTH, 6, 1),
                )
            else:
                logger.debug(
                    "Only year of birth is present in person table, setting birth date to june 6th"
                )
                date_of_birth = ibis.date(person_table.YEAR_OF_BIRTH, 6, 1)
        else:
            logger.debug("Year of birth not present, taking date of birth")
            date_of_birth = ibis.date(person_table.DATE_OF_BIRTH)
        person_table = person_table.mutate(EVENT_DATE=date_of_birth)

        # Apply the time range filter
        table = person_table
        if self.anchor_phenotype is not None:
            if self.anchor_phenotype.table is None:
                raise ValueError(
                    f"Dependent Phenotype {self.anchor_phenotype.name} must be executed before this node can run!"
                )
            else:
                anchor_table = self.anchor_phenotype.table
                reference_column = anchor_table.EVENT_DATE
                # Note that joins can change column names if the tables have name collisions!
                table = table.join(anchor_table, "PERSON_ID")
        else:
            assert (
                "INDEX_DATE" in table.columns
            ), f"INDEX_DATE column not found in table {table}"
            reference_column = table.INDEX_DATE

        # Ensure both columns are timestamps for delta calculation
        # Cast to timestamp if needed, but output will remain as datetime
        ref_col_type = reference_column.type()
        event_col_type = table.EVENT_DATE.type()

        # Cast to timestamp if either is a date type
        if str(ref_col_type).startswith("date") and not str(ref_col_type).startswith(
            "timestamp"
        ):
            reference_column = reference_column.cast("timestamp")
        if str(event_col_type).startswith("date") and not str(
            event_col_type
        ).startswith("timestamp"):
            event_date_col = table.EVENT_DATE.cast("timestamp")
        else:
            event_date_col = table.EVENT_DATE

        YEARS_FROM_ANCHOR = (
            reference_column.delta(event_date_col, "day") / self.DAYS_IN_YEAR
        ).floor()
        table = table.mutate(VALUE=YEARS_FROM_ANCHOR)
        table = self._perform_value_filtering(table)
        return self._perform_final_processing(table)

    def _perform_value_filtering(self, table: Table) -> Table:
        if self.value_filter is not None:
            table = self.value_filter.filter(table)
        return table
