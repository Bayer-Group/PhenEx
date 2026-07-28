# Generating SQL

PhenEx runs a cohort by compiling it to SQL and executing that SQL on your database. The generated SQL is not hidden: you can save it, read it, and re-run it yourself. Every step of a cohort (the entry criterion, each inclusion and exclusion, baseline characteristics, outcomes, and the final index table) compiles to a single query.

## Your SQL is saved automatically

When you run a cohort, PhenEx writes each step's query into `sql_dir` as one `.sql` file:

```python
cohort.execute(sql_dir="./sql")
```

Inside a `Study`, every cohort gets its own SQL folder automatically, beside its reports, no arguments needed:

```
<study.path>/<study.name>/<run>/<cohort.name>/sql/
```

Each file is one node's query, a single `SELECT`, named after its table. To read any query, just open its file. That's the simplest way to get your SQL back.

## Read it back in code with `cohort.to_sql()`

`cohort.to_sql()` returns a lazy, dict-like view of the cohort's SQL, keyed by node table name:

```python
sql = cohort.to_sql()
sql.keys()                      # the node names, nothing compiled yet
sql["MY_COHORT__INDEX"]         # the final index query, as a string
for name, query in sql.items(): # resolve one at a time
    ...
dict(sql)                       # materialize everything, only if you ask
```

The view is lazy: constructing it compiles nothing, and each query is resolved only when you ask for it, so it stays light even for a study with hundreds of definitions.

### The reliable way: point at the saved files

The `.sql` files are written by **every** `execute()` (lazy or not), so reading them back always works, on any machine:

```python
sql = cohort.to_sql(sql_dir="<study.path>/<study.name>/<run>/<cohort.name>/sql")
sql["MY_COHORT__INDEX"]
```

This is a plain file read. It needs nothing but the folder: no live database, no re-run, no cache. Use it whenever you want a guarantee: a different machine, a colleague's run, or a session that skipped `execute()`.

### The convenience: zero-argument

`cohort.to_sql()` with no arguments fills in the connector and your last run's folder for you:

- **Same session** (right after `execute()`): reuses that run's folder, so the list is complete and resolves from memory.
- **Fresh session** (kernel restarted, `execute()` skipped) has no folder to list, so the list is **partial**: the phenotype, index, inclusion, and exclusion queries only, not the subset tables, reporters, or codelist sidecars. It resolves from the `phenex.db` cache (which needs `lazy_execution=True` and the same directory), and warns you to pass `sql_dir=` for the complete set.

Pass `sql_dir=` (above) whenever you want the complete list on any machine. A query that can't be found anywhere returns `None` with a warning rather than raising.

For a whole study, read each cohort back the same way, looping the cohort list you passed in:

```python
for c in study.cohorts:
    sql = c.to_sql(sql_dir=f"<study.path>/<study.name>/<run>/{c.name}/sql")
    sql["MY_COHORT__INDEX"]
```

### Subcohorts

`subcohort.to_sql()` returns **only the subcohort's own SQL**: its extra criteria and its index query. The inherited parent SQL stays in the parent's `to_sql()`, so read both to see everything:

```python
subcohort.to_sql(sql_dir=".../<parent>__<subcohort>/sql")   # its own queries
parent_cohort.to_sql(sql_dir=".../<parent>/sql")            # the inherited SQL
```

A subcohort builds its index only during `execute()`, so after a kernel restart pass `sql_dir=` to read it back, because zero-argument can't rebuild it.

### Coming back in a new session

After a kernel restart, re-run the cells that define the cohort (but **not**
`execute()`), then call `cohort.to_sql()` to read your saved SQL back.

### Seeing where a query came from

Each resolve logs its source at `INFO` (memory, a file, or the cache):

```
to_sql('MY_COHORT__INDEX') ← file: .../sql/MY_COHORT__INDEX.sql
```

Turn it on with `logging.getLogger("phenex").setLevel("INFO")`; set it to `"WARNING"` to silence it in a big loop.

## Where the files go and what they contain

Files are named after the node's table. A cohort named `diabetes_cohort` writes, for example:

```
diabetes_cohort/sql/
├── DIABETES_COHORT__TYPE_2_DIABETES.sql    # entry criterion
├── DIABETES_COHORT__AGE_GE_18.sql          # an inclusion criterion
├── DIABETES_COHORT__INDEX.sql              # the final index table
└── ibis_pandas_memtable_<hash>.sql         # an inlined codelist (sidecar)
```

- One `.sql` file per node, a single `SELECT` that reads only source data and other nodes' tables.
- Codelists are inlined as small, self-contained sidecar files, so a saved query carries its own codes and runs without extra setup.

When several cohorts in one study share a codelist, a later cohort may reuse the earlier one's cached codelist instead of rewriting it. Its folder then references a sidecar it doesn't contain, and both `execute()` and `to_sql()` warn that the folder is **not self-contained**. Read the missing sidecars from the first cohort's folder, or re-run with `lazy_execution=False` to write every file fresh.

## Dialect

The SQL is compiled for **the database you connected to**, not inferred from the query. A Snowflake connection produces Snowflake SQL, DuckDB produces DuckDB SQL, Postgres produces Postgres SQL, with no database-specific code on your part.

Every saved file records its dialect on the first line:

```sql
-- phenex-dialect: snowflake
SELECT
  ...
```

The stamp is a leading comment, so the file still runs as-is. Because the dialect comes from the connection, saved SQL always matches the database that produced it.

!!! note
    If a saved `.sql` file is deleted and nothing is cached, re-run `cohort.execute(lazy_execution=False)` to regenerate every file from scratch.

## API reference

- [`Cohort.to_sql`](../api/core/cohort.md): read a cohort's SQL back as a lazy view
- [`Cohort`](../api/core/cohort.md) / [`Study`](../api/core/study.md): `execute(sql_dir=...)` writes the files
