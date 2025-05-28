from typing import Dict, Optional

import ibis
from ibis.expr.types.relations import Table

from phenex.phenotypes.phenotype import Phenotype
from phenex.filters.value import Value
from phenex.tables import PhenotypeTable, is_phenex_person_table
from phenex.filters import ValueFilter, DateFilter, RelativeTimeRangeFilter
from phenex.util import create_logger

logger = create_logger(__name__)


class AgePhenotype(Phenotype):
    """
    AgePhenotype computes and filters by the age of a person at a given reference date. AgePhenotype requires an anchor phenotype (to define the reference date), typically the entry criterion. The returned Phenotype has the following interpretation:

    DATE: Date of anchor phenotype (date at which the age is computed)
    VALUE: Age (in years) at the given date

    Parameters:
        name: Name of the phenotype, default is 'age'.
        value_filter: Restrict the returned persons based on age
        anchor_phenotype: An optional anchor phenotype to calculate relative age. If anchor_phenotype is not provided, will compute age at the index date.
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

    # FIXME this will become a problem when modern medicine allows people to live more
    # than 365*4 years (so they accumulate enough leap days to get an extra year)
    DAYS_IN_YEAR = 365

    def __init__(
        self,
        name: Optional[str] = "age",
        value_filter: Optional[ValueFilter] = None,
        anchor_phenotype: Optional[Phenotype] = None,
        domain: Optional[str] = "PERSON",
        **kwargs,
    ):
        super(AgePhenotype, self).__init__(value_filter=value_filter, **kwargs)
        self.name = name
        self.domain = domain

        # Set children to the dependent PHENOTYPES
        self.anchor_phenotype = anchor_phenotype
        if anchor_phenotype is not None:
            self.children = [anchor_phenotype]
        else:
            self.children = []

    def _get_date_of_birth(self, table):
        assert is_phenex_person_table(table)

        if "YEAR_OF_BIRTH" in table.columns:
            if "DATE_OF_BIRTH" in table.columns:
                logger.debug(
                    "Year of birth and date of birth is present, taking date of birth where possible otherwise setting date of birth to june 6th"
                )
                date_of_birth = ibis.coalesce(
                    ibis.date(table.DATE_OF_BIRTH),
                    ibis.date(table.YEAR_OF_BIRTH, 6, 1),
                )
            else:
                logger.debug(
                    "Only year of birth is present in person table, setting birth date to june 6th"
                )
                date_of_birth = ibis.date(table.YEAR_OF_BIRTH, 6, 1)
        else:
            logger.debug("Year of birth not present, taking date of birth")
            date_of_birth = ibis.date(table.DATE_OF_BIRTH)

        return date_of_birth

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:

        table = tables[self.domain]
        date_of_birth = self._get_date_of_birth(table)
        table = table.mutate(DATE_OF_BIRTH=date_of_birth)

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
            reference_column.delta(table.DATE_OF_BIRTH, "day") / self.DAYS_IN_YEAR
        ).floor()

        # Define VALUE and EVENT_DATE; Parent class handles final filtering
        # and processing
        table = table.mutate(VALUE=YEARS_FROM_ANCHOR)
        table = table.mutate(EVENT_DATE=reference_column)

        return table
