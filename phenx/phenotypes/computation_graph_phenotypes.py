from typing import Dict, Union
from ibis.expr.types.relations import Table
import ibis
from phenx.tables import PhenotypeTable, PHENOTYPE_TABLE_COLUMNS
from phenx.phenotypes.phenotype import Phenotype, ComputationGraph
from phenx.phenotypes.functions import hstack
from datetime import date


class ComputationGraphPhenotype(Phenotype):
    """
    ComputationGraphPhenotypes are a type of CompositePhenotype that performs computations using phenotypes. The ComputationGraphPhenotype is a base class and must be subclassed.
    The subclasses of ComputationGraphPhenotype differ depending on which columns of the component phenotype tables are used as input and where the output is placed in the output phenotype table. The two options for both input and output are 'boolean' or 'value'.

    ## Comparison table of CompositePhenotype classes
    +---------------------+-------------+------------+
    |                     | Operates on | Populates  |
    +=====================+=============+============+
    | ArithmeticPhenotype | value       | value      |
    +---------------------+-------------+------------+
    | LogicPhenotype      | boolean     | boolean    |
    +---------------------+-------------+------------+
    | ScorePhenotype      | boolean     | value      |
    +---------------------+-------------+------------+

    Attributes:
        expression (ComputationGraph): The arithmetic expression to be evaluated composed of phenotypes combined by python arithmetic operations.
        return_date (Union[str, Phenotype]): The date to be returned for the phenotype. Can be "first", "last", or a Phenotype object.
        _operate_on (str): The column to operate on. Can be "boolean" or "value".
        _populate (str): The column to populate. Can be "boolean" or "value".
        _reduce (bool): Whether to reduce the phenotype table to only include rows where the boolean column is True. This is only relevant if _populate is "boolean".
    """

    def __init__(
        self,
        expression: ComputationGraph,
        return_date: Union[str, Phenotype],
        name: str = None,
        _operate_on: str = "boolean",
        _populate: str = "value",
        _reduce: bool = False,
    ):
        super(ComputationGraphPhenotype, self).__init__()
        self.computation_graph = expression
        self.return_date = return_date
        self._name = name
        self._operate_on = _operate_on
        self._populate = _populate
        self._reduce = _reduce
        self.children = self.computation_graph.get_leaf_phenotypes()

    @property
    def name(self):
        if self._name is None:
            self._name = str(self.computation_graph)
        return self._name

    @name.setter
    def name(self, name):
        self._name = name

    def _execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        """
        Executes the score phenotype processing logic.

        Args:
            tables (Dict[str, Table]): A dictionary where the keys are table names and the values are Table objects.

        Returns:
            PhenotypeTable: The resulting phenotype table containing the required columns.
        """
        joined_table = hstack(self.children)
        if self._populate == "value":
            _expression = self.computation_graph.get_value_expression(
                joined_table, operate_on=self._operate_on
            )
            joined_table = joined_table.mutate(VALUE=_expression).mutate(
                EVENT_DATE=ibis.null(date)
            )
        elif self._populate == "boolean":
            _expression = self.computation_graph.get_boolean_expression(
                joined_table, operate_on=self._operate_on
            )
            joined_table = joined_table.mutate(BOOLEAN=_expression).mutate(
                EVENT_DATE=ibis.null(date)
            )

        # Reduce the table to only include rows where the boolean column is True
        if self._reduce:
            joined_table = joined_table.filter(joined_table.BOOLEAN == 1)

        # Add a null value column if it doesn't exist, for example in the case of a LogicPhenotype
        schema = joined_table.schema()
        if "VALUE" not in schema.names:
            joined_table = joined_table.mutate(VALUE=ibis.null())

        return joined_table


class ScorePhenotype(ComputationGraphPhenotype):
    """
    ScorePhenotype is a CompositePhenotype that performs arithmetic operations using the **boolean** column of its component phenotypes and populations the **value** column. It should be used for calculating medical scores such as CHADSVASC, HASBLED, etc.

    --> See the comparison table of CompositePhenotype classes

    Attributes:
        expression (ComputationGraph): The arithmetic expression to be evaluated composed of phenotypes combined by python arithmetic operations.
        return_date (Union[str, Phenotype]): The date to be returned for the phenotype. Can be "first", "last", or a Phenotype object.

    # Create component phenotypes individually
    >> hypertension = Phenotype(Codelist('hypertension'))
    >> chf = Phenotype(Codelist('chf'))
    >> age_gt_45 = AgePhenotype(min_age=GreaterThan(45))
    # Create the ScorePhenotype that defines a score which is 2*age + 1 if hypertension or chf are present, respectively. Notice that the boolean column of the component phenotypes are used for calculation and the value column is populated of the ScorePhenotype table.
    >> pt = ScorePhenotype(
                expression = 2 * age_gt_45 + hypertension + chf,
            )

    """

    def __init__(
        self,
        expression: ComputationGraph,
        return_date: Union[str, Phenotype] = "first",
        name: str = None,
    ):
        super(ScorePhenotype, self).__init__(
            expression=expression,
            return_date=return_date,
            _operate_on="boolean",
            _populate="value",
        )


class ArithmeticPhenotype(ComputationGraphPhenotype):
    """
    ArithmeticPhenotype is a composite phenotype that performs arithmetic operations using the **value** column of its component phenotypes and populations the **value** column. It should be used for calculating values such as BMI, GFR or converting units.
    --> See the comparison table of CompositePhenotype classes

    Attributes:
        expression (ComputationGraph): The arithmetic expression to be evaluated composed of phenotypes combined by python arithmetic operations.
        return_date (Union[str, Phenotype]): The date to be returned for the phenotype. Can be "first", "last", or a Phenotype object.

        # Create component phenotypes individually
        >> height = MeasurementPhenotype(Codelist('height'))
        >> weight = MeasurementPhenotype(Codelist('weight'))
        # Create the ArithmeticPhenotype that defines a score which is 2*age +  1 if hypertension or chf are present, respectively. Notice that the boolean column of the component phenotypes are used for calculation and the value column is populated of the ScorePhenotype table.
        >> bmi = ArithmeticPhenotype(
                    expression = weight / height**2,
        )
    """

    def __init__(
        self,
        expression: ComputationGraph,
        return_date: Union[str, Phenotype] = "first",
        name: str = None,
    ):
        super(ArithmeticPhenotype, self).__init__(
            expression=expression,
            return_date=return_date,
            _operate_on="value",
            _populate="value",
        )


class LogicPhenotype(ComputationGraphPhenotype):
    """
    LogicPhenotype is a composite phenotype that performs boolean operations using the **boolean** column of its component phenotypes and populations the **boolean** column of the resulting phenotype table. It should be used in any instance where multiple phenotypes are logically combined, for example, does a patient have diabetes AND hypertension, etc.

    --> See the comparison table of CompositePhenotype classes

    # Create component phenotypes individually
    >> hypertension = Phenotype(Codelist('hypertension'))
    >> chf = Phenotype(Codelist('chf'))
    >> age_gt_45 = AgePhenotype(min_age=GreaterThan(45))
    # Create the LogicPhenotype that returns the patients who are agreater than 45 years old and have both hypertension and chf. Notice that the logical operation operates on the boolean columns of the component phenotypes and populations the boolean column of the LogicPhenotype table.
    >> pt = ScorePhenotype(
                expression = age_gt_45 | hypertension | chf,
            )

    Attributes:
        expression (ComputationGraph): The logical expression to be evaluated composed of phenotypes combined by python arithmetic operations.
        return_date (Union[str, Phenotype]): The date to be returned for the phenotype. Can be "first", "last", or a Phenotype object.
    """

    def __init__(
        self,
        expression: ComputationGraph,
        return_date: Union[str, Phenotype] = "first",
        name: str = None,
    ):
        super(LogicPhenotype, self).__init__(
            expression=expression,
            return_date=return_date,
            _operate_on="boolean",
            _populate="boolean",
            _reduce=True,
        )
