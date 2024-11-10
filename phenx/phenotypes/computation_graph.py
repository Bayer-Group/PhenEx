from typing import Dict, Union
from datetime import date
import ibis
from ibis.expr.types.relations import Table
from phenx.tables import PhenotypeTable, PHENOTYPE_TABLE_COLUMNS


class ComputationGraph:
    """
    ComputationGraph tracks arithmetic operations to be performed on two Phenotype objects.
    The actual execution of these operations is context-dependent and is handled by the
    responsible Phenotype class (ArithmeticPhenotype, ScorePhenotype, LogicPhenotype, etc.).
    """

    def __init__(
        self,
        left: Union["Phenotype", "ComputationGraph"],
        right: Union["Phenotype", "ComputationGraph", int, float],
        operator: str,
    ):
        self.table = None
        self.left = left
        self.right = right
        self.operator = operator
        self.children = [left] if isinstance(right, (int, float)) else [left, right]

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
