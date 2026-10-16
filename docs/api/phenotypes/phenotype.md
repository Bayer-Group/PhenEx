# Phenotype

## Report labels

Reports such as Table 1 and the waterfall show a label for each phenotype. By default the label is made from `name`, so `ISTH_major_bleed` shows as "Isth major bleed".

To choose the label yourself, set `display_name`. It is shown exactly as written:

```python
bleed = CodelistPhenotype(
    name="isth_major_bleed",
    display_name="ISTH Major Bleeding",
    codelist=bleed_codes,
    domain="CONDITION_OCCURRENCE",
)
```

Changing only `display_name` does not re-run the phenotype. The reports are rebuilt with the new label next time the cohort runs.

::: phenex.phenotypes.phenotype.Phenotype
