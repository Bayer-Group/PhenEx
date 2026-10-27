# Naming phenotypes

Every phenotype has a `name`. PhenEx uses it to check your cohort for mistakes and to name the phenotype's table in the database. There are only two rules.

## Rule 1: different names within a section

A cohort has five sections: entry, inclusions, exclusions, characteristics and outcomes. Top-level phenotypes need different names **within one section**. The same name in two different sections is fine.

```python
# ✅ fine: "bleeding" before index and "bleeding" after index
cohort = Cohort(
    name="my_cohort",
    entry_criterion=entry,
    characteristics=[bleeding_before],  # name="bleeding"
    outcomes=[bleeding_after],          # name="bleeding"
)

# ❌ error: two inclusions with the same name
cohort = Cohort(
    name="my_cohort",
    entry_criterion=entry,
    inclusions=[age_over_18, age_under_65],  # both name="age"
)
```

## Rule 2: children only need different names from their siblings

Some phenotypes are built from smaller ones, their children, for example a `LogicPhenotype`. Children only need different names from the **other children of the same parent**. Two different parents can each have a child called `child_1`.

This means a helper like `ISTHMajorBleedPhenotype` can be used more than once in a cohort, even though it always names its children the same way.

```python
# ✅ fine: each parent has its own "child_1"
bleed = LogicPhenotype(name="bleed", expression=child_1_a | child_2_a)
bleed_v2 = LogicPhenotype(name="bleed_v2", expression=child_1_b | child_2_b)

# ❌ error: one parent with two different children called "child_1"
bleed = LogicPhenotype(name="bleed", expression=child_1_a | child_1_b)
```

Names are compared ignoring upper and lower case, so `age` and `AGE` count as the same name.

## Errors you might see

| Error | What to do |
|---|---|
| `Two inclusions are called "AGE". Please rename one.` | Give one of the two inclusions a different name. |
| `"BLEED" has two different children called "CHILD_1". Please rename one.` | Rename one of the two children of `BLEED`. |
| `"X" is listed twice in outcomes.` | The same phenotype is in the list twice. Remove one. |

## Where your results are stored

Each phenotype's table is named by where it sits in the cohort, like a folder path:

```
MY_COHORT__CHARACTERISTICS__BLEEDING
MY_COHORT__OUTCOMES__BLEEDING
MY_COHORT__OUTCOMES__BLEEDING__CHILD_1
```

To find the table of any phenotype, ask it:

```python
bleeding_after.get_table_name()  # 'MY_COHORT__OUTCOMES__BLEEDING'
```

Reports such as Table 1 still show the phenotype's own name.

## Upgrading from an older version

Older versions named tables after the phenotype only, e.g. `MY_COHORT__BLEEDING`. After upgrading:

- The first run of an existing study computes its phenotypes once more, under the new table names. The old tables stay in the database until you delete them.
- `cohort.load()` and `study.load()` still find results saved before the upgrade.
- SQL or scripts of your own that read phenotype tables by name need the new names.
