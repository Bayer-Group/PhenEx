from typing import List, Optional, Union
from phenex.phenotypes.categorical_phenotype import CategoricalPhenotype
from phenex.filters import CategoricalFilter


class SexPhenotype(CategoricalPhenotype):
    """
    SexPhenotype represents a sex-based phenotype. It returns the sex of individuals in the VALUE column and optionally filters based on identified sex. DATE is not defined for SexPhenotype.

    Parameters:
        name: Name of the phenotype, default is 'SEX'.
        domain: Domain of the phenotype, default is 'PERSON'.
        categorical_filter: A CategoricalFilter instance for filtering based on sex values.
                          If None, a default filter with column_name='SEX' is created.
        **kwargs: Additional keyword arguments passed to the parent CategoricalPhenotype class.

    Examples:

    Example: Return the recorded sex of all patients.
    ```python
    from phenex.phenotypes import SexPhenotype
    sex = SexPhenotype()
    ```

    Example: Extract patients with specific sex values using a custom filter.
    ```python
    from phenex.phenotypes import SexPhenotype
    from phenex.filters import CategoricalFilter

    male_filter = CategoricalFilter(
        column_name='GENDER_SOURCE_VALUE',
        allowed_values=['M']
    )
    sex = SexPhenotype(categorical_filter=male_filter)
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
