# DatabaseSampler

Working with a full patient database during development slows feedback cycles. `DatabaseSampler` solves this by filtering every domain table down
to a reproducible subset of patients — defined by `fraction` and `seed` — before
any PhenEx phenotypes are evaluated. All filtering is expressed as SQL and runs inside the database.

## How it works

Each patient is assigned to a stable group using:

```
abs(hash(str(PERSON_ID) || str(seed))) % denom == 0
```

where `denom = round(1 / fraction)`. The `fraction` controls how large the group is; the `seed` controls which specific patients end up in it.

**Reproducible.** The same `fraction` and `seed` always return exactly the same patients — across runs, across machines, and across team members. There is no random state: the result is fully determined by the two parameters.

**Stable.** Because selection is based on a hash of the ID, adding new patients to the database does not change which existing patients are selected. Your development sample stays consistent as the underlying data grows.

**Type-agnostic.** `PERSON_ID` can be an integer, a UUID, or any string — the algorithm works identically for all types, with no special-casing.

**Runs inside the database.** The filter is evaluated as a SQL expression. No data is transferred to Python until you explicitly request it.

## Quick start

```python
from phenex.util import DatabaseSampler

# 10 % of patients, default seed
sampler = DatabaseSampler(fraction=0.1)
sampled_tables = sampler.sample(mapped_tables)   # lazy — no data moves yet

# sampled_tables is a dict with the same keys as mapped_tables;
# pass it to a Cohort or use it directly.
print(sampler.describe())
```

`sample()` returns a new `mapped_tables` dict. The original dict is not modified.
Every domain that has a `PERSON_ID` column is filtered to the sampled patients;
domains without `PERSON_ID` are passed through unchanged.

## Using the sampler in a Study

Calling `sample()` by hand is useful for exploration, but the usual pattern is to
attach the sampler to the `Study`'s `Database`.

```python
from phenex import Cohort, Database, Study
from phenex.util import DatabaseSampler
from phenex.mappers import OMOPDomains

study_db = Database(
    mapper=OMOPDomains,
    connector=con,                                   # con: your connector
    sampler=DatabaseSampler(fraction=0.1, seed=42),  # 10% reproducible sample
)

cohort_a = Cohort(name="cohort_a", entry_criterion=entry_a, inclusions=inclusions, exclusions=exclusions)
cohort_b = Cohort(name="cohort_b", entry_criterion=entry_b, inclusions=inclusions, exclusions=exclusions)

study = Study(path="./results", name="my_study_sampled", cohorts=[cohort_a, cohort_b], database=study_db)
study.execute(overwrite=True, lazy_execution=True)
```

## Inspecting the sample

`fetch_person_ids()` executes one database round-trip and loads the sampled IDs
into Python:

```python
sampler = DatabaseSampler(fraction=0.1, seed=42)
sampler.sample(mapped_tables)

ids = sampler.fetch_person_ids()   # sorted list
print(sampler.person_id_count)     # e.g. 1 042
print(sampler.person_ids[:5])      # first five IDs
```

`describe()` prints a human-readable configuration summary and is safe to call
at any point:

```
DatabaseSampler
  fraction   : 0.1
  seed       : 42
  denom      : 10  (10 equal groups)
  filter     : abs(hash(str(PERSON_ID) || '42')) % 10 = 0
  sampled    : yes -- call fetch_person_ids() to inspect
  patients   : 1,042
  first 10   : [3, 17, 28, ...]
```

## API reference

::: phenex.util.database_sampler.DatabaseSampler
