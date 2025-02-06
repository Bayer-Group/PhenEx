# PhenEx Data Model
PhenEx consumes input data of various formats, and outputs tables of a specified format. The internal and output representations of data are documented here.

## Phenotype table

The phenotype table is the output of all PhenEx phenotype classes. Each row in a phenotype table is a single patient. Every phenotype of a cohort (entry, inclusion/exclusion criteria, baseline characteristic, outcome) outputs a phenotype table. It is by manipulating these phenotype tables that PhenEx calculates the full cohort.

A boolean value is associated with each patient, for whether the patient on that row fulfills the parameters of the phenotype. Phenotypes generally return only the persons that fulfill the phenotype criteria, thus the boolean value is generally all true; it is only when joining phenotype tables together (a very common operation) that this column becomes relevant.

If a date can be assigned to the phenotype, then an event_date is associated with the person. In order to assign a date, parameters such as ‘return_date = ‘first’ must be set. If return_date = ‘all’, there will potentially be many rows per patient (i.e. person_id is not unique), and the event_dates will be present. 

Similarly, a value column is present on a phenotype table. If a value can be assigned to a phenotype that is generally null unless specified by phenotype parameters. As for date, if return_value = ‘all’, there will be multiple rows per patient; only if an aggregation is performed will person_id be unique.

| Column name | Datatype | Description |
| --- | --- | --- |
| PERSON_ID | str |  |
| index_date |  | # TODO |
| BOOLEAN | boolean | True if patient on that row fulfills the parameters of the phenotype |
| EVENT_DATE | date, null | Date assigned to the phenotype. Generally null, unless parameters to phenotype allow for assignment of a single date |
| VALUE | optional, float, int or str | Value assigned to the phenotype. Generally null, unless parameters to phenotype allow for assignment of a date. For example, measurement phenotypes are often associated with values. |

## Multi-phenotype tables

PhenEx operates by manipulating phenotype tables. We very often join the output of phenotypes on person_id to create ‘multi-phenotype tables’. These tables generally all have the same structure; each row is a unique person_id, and there are multiple columns, with each column representing a unique phenotype’s output (boolean, event_date, or value). The phenotype output columns are prefixed with the name of the phenotype followed by an underscore followed by what parameter (boolean, event_date, or value). 

Listed below are the tables that share this format; they are the inclusion, exclusion, baseline_characteristic and outcome tables. An additional boolean column is added to the inclusion/exclusion column that determines if the patient fulfills all inclusion criteria or doesn’t fulfill any exclusion criteria, respectively.

### Inclusion table

A multi-phenotype table that reports the output of all inclusion criteria.

The inclusion table includes all persons that have a **possible** index date i.e. all persons that are fulfill the entry_criterion phenotype. Rows are person_ids. Columns are individual inclusion phenotypes with a true of false value for whether or not the patient on that row fulfills the column inclusion phenotype. 

A final boolean column is the logical AND of all inclusion phenotypes; persons with a False in the include table boolean column will be removed from the cohort.

| Column name | Datatype | Description |
| --- | --- | --- |
| person_id | str | unique identifier |
| index_date |  | # TODO |
| {name inclusion 1}_BOOLEAN | boolean | boolean value from executed phenotype 1. 1 means include, 0 means exclude |
| {name inclusion N}_BOOLEAN | boolean | … |
| **include** | boolean | The logical ‘AND’ of all inclusion phenotypes |

### Exclusion table

A multi-phenotype table that reports the output of all exclusion criteria.

The exclusion table includes all persons that have a **possible** index date i.e. all persons that are fulfill the entry_criterion phenotype. Rows are person_ids. Columns are individual exclusion phenotypes with a true of false value for whether or not the patient on that row fulfills the column inclusion phenotype. 

A final boolean column is the logical OR of all exclusion phenotypes; persons with a True in the exclude table boolean column will be removed from the cohort.

| Column name | Datatype | Description |
| --- | --- | --- |
| person_id | str | unique identifier |
| index_date |  | # TODO |
| {name exclusion 1}_BOOLEAN | boolean | boolean value from executed phenotype 1. 1 means include, 0 means exclude |
| {name exclusion N}_BOOLEAN | boolean | … |
| **exclude** | boolean | the logical ‘OR’ of all exclusion phenotypes |

### Characteristics table

A multi-phenotype table that reports the output of all baseline characteristics.

The characteristic table contains unique person_ids. Only person that fulfill the cohort criteria (entry, inclusion, exclusion) are contained. Currently implemented as a wide format, though a long format planned. All phenotype output (boolean, event_date, value) for every characteristic is included.

This table is used to characterize the cohort. See the Table1 Reporting below for more information.

| Column name | Datatype | Description |
| --- | --- | --- |
| person_id | str | unique identifier |
| {name phenotype N}_BOOLEAN | boolean | Boolean value from executed phenotype 1.  |
| {name phenotype N}_EVENT_DATE | null, date | The event date, if any, associated with a phenotype (see PhenotypeTable) |
| {name phenotype N}_VALUE | null, int, str, float  | The value, if any, associated with a phenotype (see PhenotypeTable) |

### Outcomes table

A multi-phenotype table that reports the output of all outcomes.

The outcomes table contains unique person_ids. Only person that fulfill the cohort criteria (entry, inclusion, exclusion) are contained.

| Column name | Datatype | Description |
| --- | --- | --- |
| person_id | str | unique identifier |
| {name phenotype N}_BOOLEAN | boolean | Boolean value from executed phenotype 1.  |
| {name phenotype N}_EVENT_DATE | null, date | The event date, if any, associated with a phenotype (see PhenotypeTable) |
| {name phenotype N}_VALUE | null, int, str, float  | The value, if any, associated with a phenotype (see PhenotypeTable) |

## Index Date Tables

### Entry table

The entry_criterion table contains all persons that fulfill the entry_criterion phenotype. For each patient, a ***possible*** index date is provided. Inclusion and exclusion criteria have not yet been applied.

| Column name | Datatype | Description |
| --- | --- | --- |
| person_id | str | For now, unique patient ids. #TODO allow multiple index dates per patient |
| index_date | date | The date on which the entry criterion was fulfilled for that given patient. Note that this is only a **possible** index_date, as the inclusion/exclusion criteria have not been executed. |

### Index table

The index table is the final output of a cohort. It contains a unique person_id and index date. All persons included fulfill all cohort criteria (entry, inclusion, exclusion)

| Column name | Datatype | Description |
| --- | --- | --- |
| person_id | str | For now, unique patient ids. #TODO allow multiple index dates per patient |
| index_date | date | The dates on which all inclusion/exclusion criteria are fulfilled |

## Subset Tables

Subset tables contain all tables and columns found in the **source data**, for a subset of the source data persons. 
There are two types of subset tables : 

- subset **entry** and 
- subset **index**. 
  
These two have an identical schema, namely, the schema of the input data plus one additional column on each table : the index_date column. These tables differ only by which persons they contain: 

- subset **entry** contains persons who fulfill the entry criterion prior to application of inclusion criteria, while 
- subset **index** tables contain the final set of persons that fulfill all cohort In/ex criteria. 
  
SubsetTables are created during the execution of a cohort. However, we find it very useful to use the subset_index table for further analyses; this data represents all source data for the persons that fulfill the cohort definition.

The subset tables will contain, for each input table, a schema with 

| Column name | Datatype | Description |
| --- | --- | --- |
| person_id | str | For now, unique patient ids.  |
| index_date | date | The date on which the entry criterion was fulfilled for that given patient. Note that this is only a possible index_date for subset_entry, as the inclusion/exclusion criteria have not been executed. |
| …. |  | all original columns |

### Subset Entry

Subset_entry contains the mapped tables with only persons that have a *possible* index date, as defined by the entry criterion phenotype. Note that no time filtering by study period occurs; the study period is defined as the time range in which index dates may occur. 

### Subset Index

Subset of the source data including only persons that fulfill the inclusion and exclusion criteria. Subset_entry contains the mapped tables with only persons that have an assigned index date. It is very useful to use the subset_index table for further analyses; this data represents all source data for the persons that fulfill the cohort definition.

## Report tables

### Table 1 i.e. Baseline Characteristics Table

Table1 is a common term used in epidemiology to describe a table that shows an overview of the baseline characteristics of a cohort. It contains the counts and percentages of the cohort that have each characteristic, for both boolean and value characteristics. In addition, summary statistics are provided for value characteristics (mean, std, median, min, max).

| Column name | Description |
| --- | --- |
| phenotype | The name of the baseline characteristic the current row pertains to |
| N | The number of persons that fulfill the baseline characteristic criteria. For binary features, this is the only information provided e.g. the number of person with ‘atrial fibrillation’ in our cohort. |
| % | Calculated as N / size cohort. This is the percentage of our cohort that fulfill the phenotype criteria |
| mean | mean of the phenotype value column (if present) |
| median | median of the phenotype value column (if present) |
| min | min of the phenotype value column (if present) |
| max | max of the phenotype value column (if present) |

### Inclusion/Exclusion Count Tables

The inclusion/exclusion count tables are created by the InExCounts reporter class. They are generally used for internal testing purposes, but may be helpful to users. They provide the number of persons that fulfill every inclusion and exclusion criteria.

| Column name | Description |
| --- | --- |
| phenotype | The name of the inclusion/exclusion criteria the current row pertains to |
| N | The number of persons that fulfill that criteria |
| Category | either ‘inclusion’ or ‘exclusion’, depending on which the phenotype in that row is |

## Additional Outcome tables

### Time to first event (TTFE) long table (# todo)

There are two basic analyses we do at the end of pipeline stage: ITT and on treatment. Both cases can be handled with a single data model. We propose the following long format for the time to first event *time to first event table*:

Intercurrent events (censoring and competing events) are treated as outcomes, at this stage on equal footing with study endpoints. In the transformation to the wide format, information about how to handle intercurrent events will be incorporated. The TTFE table is an aggregation of the concept set events table and is defined only with respect to a particular index date. 

| patient_id | STRING | Unique patient identifier |  |
| --- | --- | --- | --- |
| index_date | DATE | Beginning of followup time for patient |  |
| population | STRING | Treatment assignment of patient on index date |  |
| outcome | STRING | Descriptive name of outcome. The outcome can be either a study endpoint (e.g. major_bleed) or a censoring outcome (e.g. lost_to_followup). |  |
| time_to_first_event | FLOAT | Time in days between first_event_date and index_date. By definition, is equal to DATEDIFF(first_event_date, index_date). |  |
| first_event_date | DATE  | Optional. Date of first event for given outcome on or after index date. Can be useful for debugging but is generally not needed for outcome estimation. |  |

### Time to first event (TTFE) wide table (# todo)

The above TTFE table is an intermediate processing artifact and usually not directly useful. Many time-to-first-event analyses require simultaneous information about several outcomes for each patient (e.g. censoring and competing events for a patient in addition to the endpoint events). Thus, the following wide format for the time to first event table should also be derived:

Intercurrent events are defined on a per-outcome per-arm basis; the considered Intercurrent events can be different for different outcomes and different treatment arms (e.g. if you have a treated and untreated arm, and are doing an on-treatment analysis, then in the treated arm discontinuation is an intercurrent event, but this event does not apply to the untreated arm). Thus, this table can be arbitrarily wide, and each outcome with have its own table. 

| patient_id | STRING | Unique patient identifier |
| --- | --- | --- |
| index_date | DATE | Beginning of followup time for patient |
| population | STRING | Treatment assignment of patient on index date |
| outcome | STRING | Descriptive name of outcome. Here, the outcome should be only study endpoint (e.g. major_bleed). |
| first_event_date | DATE | Date of first event among all events (endpoint + intercurrent events) for given outcome on or after index date. Cannot be NULL. |
| time_to_first_event | FLOAT | Time in days between first_event_date and index_date. By definition, is equal to DATEDIFF(first_event_date, index_date). |
| first_event_type | STRING | Name of event which is represented by the time_to_first_event column (i.e. name of event which occurred first). |
| is_censored | BOOLEAN | True if first event is a censoring event and false otherwise. A competing event is not considered censoring. Only loss to followup is a censoring event. |
| time_to_first_event_{event_type} | FLOAT | For each event type, the time to the first occurrence of the event. NULL if event not observed. |
| first_event_date_{event_type} | DATE | Optional; for each event type, the date of first occurrence of censoring event. This column is useful for debugging but not part of the spec. |