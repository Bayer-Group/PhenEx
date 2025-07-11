from typing import List, Optional, Union
from phenex.phenotypes.categorical_phenotype import CategoricalPhenotype


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
        allowed_values: Optional[List[Union[str, int, float]]] = None,
        domain: str = "PERSON",
        column_name="SEX",
        **kwargs
    ):
        super(SexPhenotype, self).__init__(
            name=name,
            allowed_values=allowed_values,
            domain=domain,
            column_name=column_name,
            **kwargs
        )
