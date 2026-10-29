# Cohort

## Naming rules

- Top-level phenotypes need different names **within their section** (entry, inclusions, exclusions, characteristics, outcomes). The same name in two sections is fine, for example "bleeding" as a characteristic and as an outcome.
- A phenotype's children only need different names **from their siblings**. Two different parents can each have a child called `child_1`, so a helper like `ISTHMajorBleedPhenotype` can be used more than once.
- Names are compared ignoring upper and lower case.

PhenEx names each phenotype's table in the database by where it sits, like a folder path:

```
MY_COHORT__CHARACTERISTICS__BLEEDING
MY_COHORT__OUTCOMES__BLEEDING
MY_COHORT__OUTCOMES__BLEEDING__CHILD_1
```

Reports still show the phenotype's own name.

More examples, the errors you might see, and notes on upgrading: [Naming phenotypes](../../tutorials/naming_phenotypes.md).

::: phenex.core.cohort.Cohort
