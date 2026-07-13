from typing import Dict, Optional, TYPE_CHECKING
from phenex.node import Node
from phenex.util.database_sampler import DatabaseSampler
from phenex.util import create_logger

if TYPE_CHECKING:
    from phenex.tables import PhenexTable

logger = create_logger(__name__)


class DatabaseSamplerNode(Node):
    """
    A compute node that filters one domain table to a reproducible patient subset.

    One node is created per domain. All nodes in the sampler_stage share the same
    DatabaseSampler (same fraction and seed), so they select the same patient subset
    across all domain tables.

    Including fraction and seed in to_dict() ensures that changing either value
    invalidates downstream node hashes, forcing re-execution when lazy_execution=True.

    Parameters:
        name: Unique node identifier (e.g. 'COHORTNAME__SAMPLER_PERSON').
        domain: Domain table to filter (e.g. 'PERSON', 'CONDITION_OCCURRENCE').
        sampler: DatabaseSampler defining fraction and seed.
    """

    def __init__(self, name: str, domain: str, sampler: DatabaseSampler):
        super().__init__(name=name)
        self.domain = domain
        self.sampler = sampler

    def to_dict(self) -> dict:
        """Return node identity including fraction and seed so hash changes when sampler config changes."""
        return {
            "class_name": self.__class__.__name__,
            "name": self.name,
            "domain": self.domain,
            "fraction": self.sampler.fraction,
            "seed": self.sampler.seed,
        }

    @property
    def _skip_cache(self) -> bool:
        """True for fraction=1.0 which returns None and never writes a dest table."""
        return self.sampler.fraction == 1.0

    def _execute(self, tables: Dict[str, "PhenexTable"]) -> Optional["PhenexTable"]:
        """Filter self.domain table to the sampled patient subset. Returns None if either table is missing."""
        domain_table = tables.get(self.domain)
        person_table = tables.get("PERSON")
        if domain_table is None or person_table is None:
            logger.info(
                f"DatabaseSamplerNode '{self.name}': skipping domain '{self.domain}' (table missing)"
            )
            return None
        if self.sampler.fraction == 1.0:
            logger.info(
                f"DatabaseSamplerNode '{self.name}': fraction=1.0 no-op for domain '{self.domain}'"
            )
            return None
        logger.info(
            f"DatabaseSamplerNode '{self.name}': sampling domain '{self.domain}' (fraction={self.sampler.fraction}, seed={self.sampler.seed})"
        )
        result = self.sampler.sample(
            {"PERSON": person_table, self.domain: domain_table}
        )
        sampled = result.get(self.domain)
        return sampled
