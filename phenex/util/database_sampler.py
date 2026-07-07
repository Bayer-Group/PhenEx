from __future__ import annotations

from typing import Any

import ibis.expr.types as ir


class DatabaseSampler:
    """Filter every domain table to a reproducible subset of patients.

    Each patient is assigned to a reproducible group by hashing their PERSON_ID
    together with the seed. The fraction controls how large that group is; the
    seed controls which specific patients end up in it. The same fraction and
    seed always return the same patients.

    Args:
        fraction: Proportion of patients to include, in [0.0, 1.0].
                  fraction=0.0 always returns an empty sample.
        seed:     Any integer. Controls which patients are selected. Default 42.
                  Different seeds produce different cohorts of the same size.

    Attributes:
        person_ids: Sorted list of sampled PERSON_IDs. Set after fetch_person_ids().
        person_id_count: Number of sampled patients. Set after fetch_person_ids().

    Example:
        sampler = DatabaseSampler(fraction=0.1, seed=42)
        sampled = sampler.sample(mapped_tables)   # lazy, no data moved

        print(sampler.describe())

        ids = sampler.fetch_person_ids()          # one database round-trip
        print(sampler.person_id_count)

        # Different cohort, same size
        sampler2 = DatabaseSampler(fraction=0.1, seed=99)
    """

    def __init__(self, fraction: float | None = None, seed: int = 42) -> None:
        if fraction is None:
            raise ValueError("fraction is required.")
        if isinstance(fraction, bool) or not isinstance(fraction, (int, float)):
            raise ValueError(
                f"fraction must be a number, got {type(fraction).__name__}."
            )
        if not (0.0 <= fraction <= 1.0):
            raise ValueError(f"fraction must be in [0.0, 1.0], got {fraction}.")
        if isinstance(seed, bool) or not isinstance(seed, int):
            raise ValueError(f"seed must be an integer, got {type(seed).__name__}.")

        self.fraction: float = fraction
        self.seed: int = seed
        self.denom: int = 0 if fraction == 0.0 else max(1, round(1.0 / fraction))

        self._person_ids_expr: ir.Table | None = None
        self.person_ids: list[Any] | None = None
        self.person_id_count: int | None = None

    def sample(self, mapped_tables: dict[str, Any]) -> dict[str, Any]:
        """Return a new mapped_tables dict filtered to the sampled patients.

        Builds SQL expressions only, nothing runs in the database yet.
        Domains that are None or have no PERSON_ID column are passed through
        unchanged.

        Args:
            mapped_tables: Dict[str, PhenexTable | None] from
                DomainsDictionary.get_mapped_tables().

        Returns:
            Dict[str, PhenexTable | None] with the same keys.

        Raises:
            KeyError: if mapped_tables does not contain a non-None "PERSON" entry.
            ValueError: if the PERSON table has no "PERSON_ID" column.
        """
        if "PERSON" not in mapped_tables or mapped_tables["PERSON"] is None:
            raise KeyError(
                "mapped_tables must contain a non-None 'PERSON' entry. "
                "Ensure mapped_tables includes PERSON."
            )

        person_table = mapped_tables["PERSON"].table
        if "PERSON_ID" not in person_table.columns:
            raise ValueError(
                "The PERSON table must have a 'PERSON_ID' column, but none was found. "
                f"Columns present: {list(person_table.columns)}"
            )
        self._person_ids_expr = self._sampled_person_ids(person_table)
        self.person_ids = None
        self.person_id_count = None

        if self.fraction == 1.0:
            # No-op: keep every patient â€” identical to having no sampler.
            # Skip the JOIN so orphan records in domain tables are preserved.
            return dict(mapped_tables)

        result: dict[str, Any] = {}
        for domain_name, domain in mapped_tables.items():
            if domain is None:
                result[domain_name] = None
                continue
            if "PERSON_ID" not in domain.table.columns:
                result[domain_name] = domain
                continue

            filtered_ibis = domain.table.join(
                self._person_ids_expr, "PERSON_ID"
            ).select(domain.table.columns)
            result[domain_name] = type(domain)(
                filtered_ibis,
                name=domain.NAME_TABLE,
                column_mapping=domain.column_mapping,
            )

        return result

    def to_dict(self) -> dict:
        """Serialize to a JSON-safe dict for cohort snapshot storage."""
        return {
            "class_name": self.__class__.__name__,
            "fraction": self.fraction,
            "seed": self.seed,
        }

    def fetch_person_ids(self) -> list[Any]:
        """Fetch sampled PERSON_IDs from the database into a sorted Python list.

        This is the only method that moves data to Python. Call it when you
        need the ID list for inspection, logging, or an external handoff.

        Populates self.person_ids and self.person_id_count.
        Can be called multiple times, re-fetches each time.

        Returns:
            list of PERSON_ID values, sorted ascending.

        Raises:
            RuntimeError: if called before .sample().
        """
        if self._person_ids_expr is None:
            raise RuntimeError("Call .sample(mapped_tables) before fetch_person_ids().")
        df = self._person_ids_expr.order_by("PERSON_ID").execute()
        self.person_ids = df["PERSON_ID"].tolist()
        self.person_id_count = len(self.person_ids)
        return self.person_ids

    def describe(self) -> str:
        """Return a plain-text summary of this sampler's configuration.

        Safe to call at any lifecycle stage. Patient count appears only after
        fetch_person_ids() has been called.

        Returns:
            str: Human-readable configuration summary.
        """
        if self.fraction == 0.0:
            denom_filter = [
                "  denom      : 0  (fraction=0.0, no patients selected)",
                "  filter     : fraction=0.0 -> always empty",
            ]
        else:
            denom_filter = [
                f"  denom      : {self.denom}  ({self.denom} equal groups)",
                f"  filter     : abs(hash(str(PERSON_ID) || '{self.seed}')) % {self.denom} = 0",
            ]

        lines = [
            "DatabaseSampler",
            f"  fraction   : {self.fraction}",
            f"  seed       : {self.seed}",
            *denom_filter,
            f"  sampled    : {'yes -- call fetch_person_ids() to inspect' if self._person_ids_expr is not None else 'no -- call .sample() first'}",
        ]
        if self.person_id_count is not None:
            lines.append(f"  patients   : {self.person_id_count:,}")
            lines.append(f"  first 10   : {self.person_ids[:10]}")
        else:
            lines.append("  patients   : (call .fetch_person_ids() to load)")

        return "\n".join(lines)

    def _sampled_person_ids(self, person_table: ir.Table) -> ir.Table:
        """Return a lazy expression of sampled PERSON_IDs via hash filter.

        The filter is:
            abs(hash(str(PERSON_ID) || str(seed))) % denom == 0

        Casting PERSON_ID to string before concatenating the seed makes the
        algorithm type-agnostic: integer IDs, UUID strings, and any VARCHAR
        type all work without branching. Every seed produces a completely
        independent scrambling of patients; different seeds always select
        different cohorts of the same size.

        Returns:
            ir.Table: Lazy expression of distinct sampled PERSON_IDs.
        """
        if self.fraction == 0.0:
            return person_table.limit(0).select("PERSON_ID").distinct()

        if self.fraction == 1.0:
            return person_table.select("PERSON_ID").distinct()

        return (
            person_table.filter(
                person_table["PERSON_ID"]
                .cast("string")
                .concat(str(self.seed))
                .hash()
                .abs()
                % self.denom
                == 0
            )
            .select("PERSON_ID")
            .distinct()
        )
