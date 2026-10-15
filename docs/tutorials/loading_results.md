# Loading saved results

`execute()` computes a study and writes its tables to your database. `load()`
points a study back at those tables in a later session, without computing
anything.

Use it when you want yesterday's results back: reports, the index table,
characteristics, outcomes.

## Use it

In a fresh session, re-run the cells that define your study, skip `execute()`,
and call `load()`:

```python
study.load()      # a whole study
cohort.load()     # a single cohort
```

That is the whole interface. No arguments needed.

## The one rule

A result table's name comes from your cohort's name (and its sampler settings,
if it has one). Same definition, same names, so re-running your definition cells
is enough to find the tables again.

Rename a cohort or change the sampler and `load()` looks for names that were
never written, and tells you:

```
found 0 of 249 result tables; check that this study was executed against this
destination, with the same cohort name and sampler settings
```

## What you get back

Everything `execute()` gives you:

```python
study.load()

cohort.table1          # the reports
cohort.waterfall
cohort.index_table     # the cohort itself
cohort.characteristics_table
```

Each table is fetched the first time you read it, so `load()` itself is quick
whatever the size of the study. Keep what you read:

```python
t1 = cohort.table1     # one query
t1.head()              # free
cohort.table1.head()   # queries again
```

A report that was never saved reads as `None`, and says why.

## Subset tables

If you executed with `write_subset_tables_entry` or `write_subset_tables_index`
set to `True`, `load()` reads those tables straight back.

If you executed with them off, nothing was saved to read. The first time you
access `cohort.subset_tables_entry` they are rebuilt from your source data
instead, which needs the source database reachable. You will see:

```
entry subset tables were not written to the destination; rebuilding them from
the source
```

## What it does not do

`load()` writes nothing: no results folder, no log file, no tables. It computes
nothing. If you need a report that was never saved, run `execute()`.

## API reference

- [`Cohort.load`](../api/core/cohort.md)
- [`Study.load`](../api/core/study.md)
