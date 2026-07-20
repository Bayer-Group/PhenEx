# Mappers

Mappers define how source database columns are mapped to PhenEx's internal representation. Each mapper class corresponds to a specific source table and declares which source columns map to PhenEx's standard fields (`PERSON_ID`, `EVENT_DATE`, `CODE`, `VALUE`, etc.).

PhenEx ships with a complete set of mappers for the [OMOP CDM](https://ohdsi.github.io/CommonDataModel/cdm54.html). These are bundled into the `OMOPDomains` dictionary, which is the main entry point for working with OMOP data.

## Using mappers

In most cases you interact with mappers through a `DomainsDictionary` rather than instantiating them directly.

### With a Snowflake database

```python
from phenex.mappers import OMOPDomains
from phenex.ibis_connect import SnowflakeConnector

con = SnowflakeConnector()  # requires configuration
mapped_tables = OMOPDomains.get_mapped_tables(con)
```

### With mock data for local testing

```python
from phenex.mappers import OMOPDomains
from phenex.sim import DomainsMocker

mocker = DomainsMocker(domains_dict=OMOPDomains, n_patients=1000)
mapped_tables = mocker.get_mapped_tables()
```

## Concept ID vs Source Value mappers

OMOP tables store codes in two ways:

- **Concept ID columns** (e.g. `CONDITION_CONCEPT_ID`) contain OMOP standard concept IDs.
- **Source value columns** (e.g. `CONDITION_SOURCE_VALUE`) contain the original vocabulary codes (ICD-10, CPT, NDC, etc.).

PhenEx provides a mapper for each. Use the concept ID mapper when your codelist contains OMOP concept IDs, and the source value mapper when your codelist contains native vocabulary codes.

| Domain     | Concept ID mapper              | Source value mapper                  |
| ---------- | ------------------------------ | ------------------------------------ |
| Conditions | `OMOPConditionOccurenceTable`  | `OMOPConditionOccurrenceSourceTable` |
| Procedures | `OMOPProcedureOccurrenceTable` | `OMOPProcedureOccurrenceSourceTable` |
| Drugs      | `OMOPDrugExposureTable`        | `OMOPDrugExposureSourceTable`        |
| Person     | `OMOPPersonTable`              | `OMOPPersonTableSource`              |

## OMOP mapper classes

::: phenex.mappers.OMOPPersonTable

::: phenex.mappers.OMOPConditionOccurenceTable

::: phenex.mappers.OMOPProcedureOccurrenceTable

::: phenex.mappers.OMOPDrugExposureTable

::: phenex.mappers.OMOPDeathTable

::: phenex.mappers.OMOPObservationTable

::: phenex.mappers.OMOPMeasurementTable

::: phenex.mappers.OMOPVisitOccurrenceTable

::: phenex.mappers.OMOPVisitDetailTable

::: phenex.mappers.OMOPObservationPeriodTable

::: phenex.mappers.OMOPConditionOccurrenceSourceTable

::: phenex.mappers.OMOPProcedureOccurrenceSourceTable

::: phenex.mappers.OMOPDrugExposureSourceTable

::: phenex.mappers.OMOPPersonTableSource
