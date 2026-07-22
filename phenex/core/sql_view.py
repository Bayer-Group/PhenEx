import os
import re
from collections.abc import Mapping

from phenex.ibis_connect import read_sql_file
from phenex.util import create_logger

logger = create_logger(__name__)

# A compiled query names each codelist it needs as an `ibis_pandas_memtable_<hash>`
# table, whose `VALUES` contents are saved beside it as `<that name>.sql`.
_MEMTABLE_REF = re.compile(r"ibis_pandas_memtable\w*")


def referenced_sidecars(sql):
    """Codelist sidecar names a compiled query references, so the caller can check they
    are on disk. Empty for a query that uses no codelists."""
    return set(_MEMTABLE_REF.findall(sql or ""))


# Emitted both when writing a folder (cohort) and when reading it back (below), kept in one
# place so the two messages never drift.
REUSED_CODELIST_NOTE = (
    "some codelist files referenced here were reused from a previous execution and are "
    "not stored in this folder. Copy them in only if you need this folder on its own."
)


def announce_sql_source(label, sql_dir, partial_detail):
    """Log where a `to_sql()` view reads from — a saved folder, a bad path, or the cache — so a
    short or surprising list is traceable to its source. `partial_detail` names what a
    no-folder list is limited to (it differs for a cohort vs a subcohort)."""
    if sql_dir is not None and os.path.isdir(sql_dir):
        logger.info(f"{label}: reading saved SQL from '{sql_dir}'.")
    elif sql_dir is not None:
        # A path was given but is not a folder, a typo, so the read failed and we fell back.
        logger.error(
            f"{label}: sql_dir '{sql_dir}' is not a folder, reading from the phenex.db "
            f"cache instead and this list may be partial. Check the path."
        )
    else:
        logger.warning(
            f"{label}: no sql_dir given, reading from the phenex.db cache and this list "
            f"is partial ({partial_detail}). Pass sql_dir='.../sql' for every saved artifact."
        )


class SQLView(Mapping):
    """A lazy, dict-like view of `{key: sql}`.

    Example:
    ```python
        sql = cohort.to_sql()
        sql.keys()                 # names, nothing compiled
        sql["MY_COHORT__INDEX"]    # resolve just this one, now
        for name, query in sql.items():
            ...
        dict(sql)                  # materialize everything, only if you ask
    ```
    """

    def __init__(self, items: dict, resolve, noun: str = "entry"):
        """Store the key to item map and the resolve function, compiling nothing."""
        self._items = dict(items)  # key to item (node or cohort), order preserving
        self._resolve = resolve  # item to sql string (or sub view), called on access
        self._noun = noun

    def __getitem__(self, key):
        """Resolve and return the SQL for one key, computed on access."""
        return self._resolve(self._items[key])

    def __iter__(self):
        """Iterate the keys in insertion order."""
        return iter(self._items)

    def __len__(self) -> int:
        """Return the number of entries."""
        return len(self._items)

    def __contains__(self, key) -> bool:
        """Return True if the key is present, tested against keys only so nothing resolves."""
        return key in self._items

    def keys(self):
        """The keys in this view, as a list (no SQL compiled)."""
        return list(self._items)

    def __repr__(self) -> str:
        """Short summary showing the count and the first few keys."""
        names = list(self._items)
        head = ", ".join(names[:3]) + (", …" if len(names) > 3 else "")
        return f"<SQLView: {len(names)} {self._noun}(s): {head}>"


def resolve_sql_file(path):
    """Read one saved `.sql` file, returning `None` with a warning instead of raising
    if it cannot be read, so iterating a view never crashes on a single bad file."""
    try:
        return read_sql_file(path)
    except Exception as e:
        logger.warning(
            f"'{os.path.basename(path)}': could not read the saved file, "
            f"returning None. ({e})"
        )
        return None


def resolve_node_sql(node, sql_dir, connector):
    """Resolve one node's SQL, returning `None` with a warning instead of raising if
    it is not in memory, `sql_dir`, or `phenex.db`, so iterating a view never
    crashes on a single unresolvable node."""
    try:
        return node.to_sql(sql_dir=sql_dir, connector=connector)
    except Exception as e:
        logger.warning(
            f"'{node.get_table_name()}': not in memory, sql_dir, or phenex.db, "
            f"returning None. Re-run execute(), or pass sql_dir='.../sql' pointing "
            f"at the run's folder. ({e})"
        )
        return None


def warn_if_folder_incomplete(sql_dir, present):
    """Warn if any saved `.sql` in `present` references a codelist file absent from it,
    so reading an incomplete folder is not silent (the same gap execute() warns about at
    write time). Stops at the first missing reference, one warning is enough."""
    for f in present:
        if f.startswith("ibis_pandas_memtable"):
            continue  # a sidecar, not a query that references one
        sql = resolve_sql_file(os.path.join(sql_dir, f)) or ""
        if any(f"{m}.sql" not in present for m in referenced_sidecars(sql)):
            logger.info(f"'{sql_dir}': {REUSED_CODELIST_NOTE}")
            return


def build_sql_view(nodes, sql_dir, connector):
    """Lazy view of `{table name: sql}` for these nodes, plus every `.sql` in `sql_dir`
    no node claims, so a saved run lists every file it holds. Files with no node behind
    them (subset and reporter nodes exist only after `execute()`, codelist sidecars
    never do) are keyed by filename and read straight off disk."""
    items = {n.get_table_name(): n for n in nodes if n is not None}
    if sql_dir and os.path.isdir(sql_dir):
        present = {f for f in os.listdir(sql_dir) if f.endswith(".sql")}
        claimed = {n.get_sql_filename() for n in items.values()}
        for filename in sorted(present):
            if filename not in claimed:
                items.setdefault(filename[:-4], os.path.join(sql_dir, filename))
        warn_if_folder_incomplete(sql_dir, present)

    def resolve(item):
        if isinstance(item, str):  # a saved file with no node behind it
            return resolve_sql_file(item)
        return resolve_node_sql(item, sql_dir, connector)

    return SQLView(items, resolve, noun="node")
