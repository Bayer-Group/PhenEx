from typing import Dict, Union
from ibis.expr.types.relations import Table
from deepdiff import DeepDiff
from phenex.tables import (
    PhenotypeTable,
    PHENOTYPE_TABLE_COLUMNS,
    is_phenex_phenotype_table,
)
from phenex.util import create_logger
from phenex.util.serialization.to_dict import to_dict

logger = create_logger(__name__)


class Phenotype:
    """
    A phenotype is a description of the state of a person at a specific time.

    In Phenex, phenotypes are implemented using the Phenotype class. The Phenotype class is designed so that there is clear separation between the "what" from the "how". The "what" is expressed in the Phenotype init function: what codelists to use, what time range to include, constraints relative to other Phenotype's, visit detail information to include, etc. The "what" is meant to mirror how we normally talk about real-world data studies.

    The translation of this description in actual executable code (the "how") is handled via the `Phenotype.execute()` method. The execute method returns a PhenotypeTable - the realization of the defined Phenotype in a particular database. See `execute()` for details.

    All Phenotype's in Phenex derive from the Phenotype class.

    To subclass:
        1. Define the parameters required to compute the Phenotype in the `__init__()` interface.
        2. Within `__init__()`, define `self.children` - a list of Phenotype's which must be executed before the current Phenotype, allowing Phenotype's to be chained and executed recursively.
        3. Define `self._execute()`. The `self._execute()` method is reponsible for interpreting the input parameters to the Phenotype and returning the appropriate PhenotypeTable.
        4. Define tests in `phenex.test.phenotypes`! We demand a high level of test coverage for our code. High test coverage gives us confidence that our answers are correct and makes it easier to make changes to the code later on.
    """

    def __init__(self):
        self.table = (
            None  # self.table is populated ONLY AFTER self.execute() is called!
        )
        self._namespaced_table = None
        self.children = []  # List[Phenotype]
        self._check_for_children()

    def execute(self, tables: Dict[str, Table]) -> PhenotypeTable:
        """
        Executes the phenotype computation for the current object and its children. This method recursively iterates over the children of the current object and calls their execute method if their table attribute is None.

        Args:
            tables (Dict[str, PhenexTable]): A dictionary mapping table names to PhenexTable objects. See phenex.mappers.DomainsDictionary.get_mapped_tables().

        Returns:
            table (PhenotypeTable): The resulting phenotype table containing the required columns. The PhenotypeTable will contain the columns: PERSON_ID, EVENT_DATE, VALUE. DATE is determined by the return_date parameter. VALUE is different for each phenotype. For example, AgePhenotype will return the age in the VALUE column. A MeasurementPhenotype will return the observed value for the measurement. See the specific phenotype of interest to understand more.
        """
        logger.info(f"Phenotype '{self.name}': executing...")
        for child in self.children:
            if child.table is None:
                logger.debug(
                    f"Phenotype {self.name}: executing child phenotype '{child.name}'..."
                )
                child.execute(tables)
            else:
                logger.debug(
                    f"Phenotype {self.name}: skipping already computed child phenotype '{child.name}'."
                )

        table = self._execute(tables).mutate(BOOLEAN=True)

        if not set(PHENOTYPE_TABLE_COLUMNS) <= set(table.columns):
            raise ValueError(
                f"Phenotype {self.name} must return columns {PHENOTYPE_TABLE_COLUMNS}. Found {table.columns}."
            )

        self.table = table.select(PHENOTYPE_TABLE_COLUMNS)
        # for some reason, having NULL datatype screws up writing the table to disk; here we make explicit cast
        if type(self.table.schema()["VALUE"]) == ibis.expr.datatypes.core.Null:
            self.table = self.table.cast({"VALUE": "float64"})

        assert is_phenex_phenotype_table(self.table)
        logger.info(f"Phenotype '{self.name}': execution completed.")
        return self.table

    @property
    def namespaced_table(self) -> Table:
        """
        A PhenotypeTable has generic column names 'person_id', 'boolean', 'event_date', and 'value'. The namespaced_table appends the phenotype name to all of these columns. This is useful when joining multiple phenotype tables together.

        Returns:
            table (Table): The namespaced table for the current phenotype.
        """
        if self._namespaced_table is None:
            if self.table is None:
                raise ValueError("Phenotype has not been executed yet.")
            new_column_names = {
                "PERSON_ID": "PERSON_ID",
                f"{self.name}_BOOLEAN": "BOOLEAN",
                f"{self.name}_EVENT_DATE": "EVENT_DATE",
                f"{self.name}_VALUE": "VALUE",
            }
            self._namespaced_table = self.table.rename(new_column_names)
        return self._namespaced_table

    def _execute(self, tables: Dict[str, Table]):
        """
        Executes the phenotype processing logic.

        Args:
            tables (Dict[str, Table]): A dictionary where the keys are table names and the values are Table objects.

        Raises:
            NotImplementedError: This method should be implemented by subclasses.
        """
        raise NotImplementedError()

    def _check_for_children(self):
        for phenotype in self.children:
            if not isinstance(phenotype, Phenotype):
                raise ValueError("Dependent children must be of type Phenotype!")

    def __add__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "+")

    def __radd__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "+")

    def __sub__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "-")

    def __mul__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "*")

    def __rmul__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "*")

    def __truediv__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "/")

    def __and__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "&")

    def __or__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "|")

    def __invert__(self) -> "ComputationGraph":
        return ComputationGraph(self, None, "~")

    def __eq__(self, other) -> bool:
        diff = DeepDiff(self.to_dict(), other.to_dict(), ignore_order=True)
        if diff:
            logger.info(f"{self.__class__.__name__}s NOT equal")
            logger.info(diff)
            return False
        else:
            logger.debug(f"{self.__class__.__name__}s are equal")
            return True

    def get_codelists(self, to_pandas=False):
        codelists = []
        for child in self.children:
            codelists.extend(child.get_codelists())

        if to_pandas:
            import pandas as pd

            return pd.concat([x.to_pandas() for x in codelists]).drop_duplicates()
        return codelists

    def to_dict(self):
        return to_dict(self)


from typing import Dict, Union
from datetime import date
import ibis
from ibis.expr.types.relations import Table
from phenex.tables import PhenotypeTable, PHENOTYPE_TABLE_COLUMNS


class ComputationGraph:
    """
    ComputationGraph tracks arithmetic operations to be performed on two Phenotype objects.
    The actual execution of these operations is context-dependent and is handled by the
    responsible Phenotype class (ArithmeticPhenotype, ScorePhenotype, LogicPhenotype, etc.).
    """

    def __init__(
        self,
        left: Union["Phenotype", "ComputationGraph"],
        right: Union["Phenotype", "ComputationGraph", int, float, None],
        operator: str,
    ):
        self.table = None
        self.left = left
        self.right = right
        self.operator = operator
        self.children = (
            [left]
            if right is None or isinstance(right, (int, float))
            else [left, right]
        )

    def __add__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "+")

    def __radd__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "+")

    def __sub__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "-")

    def __mul__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "*")

    def __rmul__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "*")

    def __truediv__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "/")

    def __and__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "&")

    def __or__(
        self, other: Union["Phenotype", "ComputationGraph"]
    ) -> "ComputationGraph":
        return ComputationGraph(self, other, "|")

    def __invert__(self) -> "ComputationGraph":
        return ComputationGraph(self, None, "~")

    def get_leaf_phenotypes(self):
        """
        A recursive function to extract all the leaf phenotypes from a computation graph.
        """

        def manage_node(node):
            if isinstance(node, ComputationGraph):
                return node.get_leaf_phenotypes()
            elif isinstance(node, Phenotype):
                return [node]
            return []

        phenotypes = []
        phenotypes.extend(manage_node(self.left))
        phenotypes.extend(manage_node(self.right))
        return phenotypes

    def get_value_expression(self, table, operate_on="boolean"):
        """
        A recursive function to build the full expression defined by a computation graph. A computation graph is a tree like structure with parents and children. The children can be either Phenotype objects, other ComputationGraph objects, or numerical values (int/float). The parents are the arithmetic operators that define the relationship between the children. This function recursively builds the expression by calling itself on the children and then applying the operator to the results.

        Args:
            table (Table): The table on which the value_expression is to be executed on. This must be the joined table that contains all the phenotypes contained within the computation graph.
            operate_on (str): Either 'boolean' or 'value', depending on whether the expression is to be evaluated using the phenotype boolean columns or value columns. See the comparison of composite phenotypes for more information.
        """

        def manage_node(node):
            if isinstance(node, ComputationGraph):
                return node.get_value_expression(table, operate_on)
            elif isinstance(node, Phenotype):
                if operate_on == "boolean":
                    return table[f"{node.name}_BOOLEAN"]
                return table[f"{node.name}_VALUE"]
            return node

        left = manage_node(self.left)
        right = manage_node(self.right)
        if self.operator == "+":
            return left + right
        elif self.operator == "-":
            return left - right
        elif self.operator == "*":
            return left * right
        elif self.operator == "/":
            return left / right
        else:
            raise ValueError(f"Operator {self.operator} not supported.")

    def get_boolean_expression(self, table, operate_on="boolean"):
        def manage_node(node):
            if isinstance(node, ComputationGraph):
                return node.get_boolean_expression(table, operate_on)
            elif isinstance(node, Phenotype):
                if operate_on == "boolean":
                    return table[f"{node.name}_BOOLEAN"]
                return table[f"{node.name}_VALUE"]
            return node

        left = manage_node(self.left)
        right = manage_node(self.right)

        if self.operator == "|":
            return left | right
        elif self.operator == "&":
            return left & right
        elif self.operator == "~":
            return ~(left)
        else:
            raise ValueError(f"Operator {self.operator} not supported.")

    def get_str(self):
        def manage_node(node):
            if isinstance(node, ComputationGraph):
                return node.get_str()
            elif isinstance(node, Phenotype):
                return node.name
            return str(node)

        left = manage_node(self.left)
        right = manage_node(self.right)
        return f"({left} {self.operator} {right})"

    def __str__(self):
        return self.get_str()

    def to_dict(self):
        return to_dict(self)
