from typing import List, Optional, Union
from phenex.phenotypes.categorical_phenotype import CategoricalPhenotype
from phenex.filters import CategoricalFilter


class SexPhenotype(CategoricalPhenotype):
    """
    SexPhenotype represents a sex-based phenotype. It returns the sex of individuals in the VALUE column and optionally filters based on identified sex. DATE is not defined for SexPhenotype.

    Parameters:
        name: Name of the phenotype, default is 'sex'.
        domain: Domain of the phenotype, default is 'PERSON'.
        allowed_values: List of allowed values for the categorical variable.
        column_name: Name of the column containing the required categorical variable. Default is 'SEX'.

    Examples:

    Example: Return the recorded sex of all patients.
    ```python
    from phenex.phenotypes import SexPhenotype
    sex = SexPhenotype()
    ```

    Example: Extract all male patients from the database.
    ```python
    from phenex.phenotypes import SexPhenotype
    sex = SexPhenotype(
        allowed_values=['M'],
        column_name='GENDER_SOURCE_VALUE'
        )
    ```
    """

    def __init__(
        self,
        name: str = "SEX",
        domain: str = "PERSON",
        categorical_filter: "CategoricalFilter" = None,
        **kwargs
    ):
        if categorical_filter is None:
            categorical_filter = CategoricalFilter(column_name="SEX")
        else:
            if categorical_filter.column_name is None:
                categorical_filter.column_name = "SEX"

        super(SexPhenotype, self).__init__(
            name=name, domain=domain, categorical_filter=categorical_filter, **kwargs
        )
