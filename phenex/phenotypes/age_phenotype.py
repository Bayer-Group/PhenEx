from typing import Dict, Optional

import ibis
from ibis.expr.types.relations import Table

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.value import Value
from phenex.tables import PhenotypeTable, is_phenex_person_table
from phenex.filters.relative_time_range_filter import RelativeTimeRangeFilter
from phenex.util import create_logger

logger = create_logger(__name__)

class AgePhenotype(Phenotype):
    """
    AgePhenotype is a class that represents an age-based phenotype. It calculates the age of individuals
    based on their date of birth and an optional anchor phenotype. The age is computed in years and can
    be filtered within a specified range.

    Parameters:
        name: Name of the phenotype, default is 'age'.
        min_age: Minimum age for filtering, in years.
        max_age: Maximum age for filtering, in years.
        domain: Domain of the phenotype, default is 'PERSON'.
        anchor_phenotype: An optional anchor phenotype to calculate relative age.

    Attributes:
        table (PhenotypeTable): The resulting phenotype table after filtering (None until execute is called)

    Methods:
        execute(tables: Dict[str, Table]) -> PhenotypeTable:
            Executes the phenotype calculation and returns a table with the computed age.

    Example:
        ```
        >>> age_phenotype = AgePhenotype(
            min_age=18,
            max_age=65,
            anchor_phenotype=some_anchor_phenotype
            )
        >>> result_table = age_phenotype.execute(tables)
        >>> display(result_table)
        ```
    """

    # FIXME this will become a problem when modern medicine allows people to live more
    # than 365*4 years (so they accumulate enough leap days to get an extra year)
    DAYS_IN_YEAR = 365

    def __init__(
        self,
        name: str = "age",
        min_age: Optional[Value] = None,
        max_age: Optional[Value] = None,
        anchor_phenotype: Optional[Phenotype] = None,
        domain: str = "PERSON",
    ):
        self.name = name
        self.min_age = min_age
        self.max_age = max_age
        self.domain = domain
        self.anchor_phenotype = anchor_phenotype
        if self.min_age is not None:
            min_days = Value(
                self.min_age.operator, self.min_age.value * self.DAYS_IN_YEAR
            )
        else:
            min_days = None
        if self.max_age is not None:
            max_days = Value(
                self.max_age.operator, self.max_age.value * self.DAYS_IN_YEAR
            )
        else:
            max_days = None

        self.time_range_filter = RelativeTimeRangeFilter(
            anchor_phenotype=anchor_phenotype
        )

        # Set children to the dependent PHENOTYPES
        if anchor_phenotype is not None:
            self.children = [anchor_phenotype]
        else:
            self.children = []

        super(AgePhenotype, self).__init__()

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        person_table = tables[self.domain]
        assert is_phenex_person_table(person_table)

        if "YEAR_OF_BIRTH" in person_table.columns:
            if "DATE_OF_BIRTH" in person_table.columns:
                logger.debug("Year of birth and date of birth is present, taking date of birth where possible otherwise setting date of birth to june 6th")
                date_of_birth = ibis.coalesce(
                    ibis.date(person_table.DATE_OF_BIRTH),
                    ibis.date(person_table.YEAR_OF_BIRTH, 6, 1),
                )
            else:
                logger.debug("Only year of birth is present in person table, setting birth date to june 6th")
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

        YEARS_FROM_ANCHOR = (
            reference_column.delta(table.EVENT_DATE, "day") / self.DAYS_IN_YEAR
        ).floor()
        table = table.mutate(YEARS_FROM_ANCHOR=YEARS_FROM_ANCHOR)

        conditions = []
        # Fix this, this logic needs to be abstracted to a ValueFilter
        if self.min_age is not None:
            if self.min_age.operator == ">":
                conditions.append(table.YEARS_FROM_ANCHOR > self.min_age.value)
            elif self.min_age.operator == ">=":
                conditions.append(table.YEARS_FROM_ANCHOR >= self.min_age.value)
            else:
                raise ValueError("Operator for min days be > or >=")
        if self.max_age is not None:
            if self.max_age.operator == "<":
                conditions.append(table.YEARS_FROM_ANCHOR < self.max_age.value)
            elif self.max_age.operator == "<=":
                conditions.append(table.YEARS_FROM_ANCHOR <= self.max_age.value)
            else:
                raise ValueError("Operator for max days be < or <=")
        if conditions:
            table = table.filter(conditions)
        person_table = table

        person_table = person_table.mutate(VALUE=person_table.YEARS_FROM_ANCHOR)

        return person_table
