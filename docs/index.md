<div id="main_title" class="my-class">
PhenEx
</div>

![Alt text](assets/phenex_feather_horizontal.png)

Implementing observational studies using real-world data (RWD) is challenging, requiring expertise in epidemiology, medical practice, statistics and data engineering. Observational studies are often implemented as bespoke software packages by individual data analysts or small teams. While tools exist, such as open-source tools from the OHDSI program in the R language and proprietary tools, they are typically bound to a specific data model (e.g. OMOP) and limited in their ability to express and implement complicated medical definitions.

PhenEx (Automated Phenotype Extraction) fills this gap. PhenEx is a Python-based software package that provides reusuable and end-to-end tested implementations of commonly performed operations in the implementation of observational studies. PhenEx allows for the calculation of arbitrarily complex phenotypes by combining these reusable components. PhenEx is data-model-agnostic. PhenEx is designed with a focus on ease of writing and reading cohort definitions. Medical domain knowledge should be clear and simple, without requiring an understandmkdocsing of complex data schemas. Ideally, a cohort definition should read like free text.

## Basics of PhenEx design

### Working with phenotypes

The most basic concept in PhenEx is the (electronic) [phenotype](https://rethinkingclinicaltrials.org/chapters/conduct/electronic-health-records-based-phenotyping/electronic-health-records-based-phenotyping-introduction/). A phenotype defines a set of patients that share some physiological state. In a clinical setting, a phenotype is usually identified by the phrase "patient presents with ...". For example, a phenotype could be "patient presents with diabetes". In the observational setting, we would cacluate the phenotype "patient presents with diabetes" by looking for patients who have a diagnosis of diabetes in their medical record in certain time frame.

A phenotype can reference other phenotypes. For instance, the phenotype "untreated diabetic patients" might translate to real-world data as "having a diagnosis of diabetes but not having a prescription for insulin or metformin". In this case, the prescription phenotype refers to the diabetes phenotype to build the overall phenotype. In PhenEx, your job is to simply specify these criteria. PhenEx will take care of the rest.

All studies are built through the calculation of various phenotypes:

- entry criterion phenotype
- inclusion phenotypes
- exclusion phenotypes
- baseline characteristic phenotypes, and
- outcome phenotypes.

After defining the parameters of all these phenotypes in the study definition file, PhenEx will compute the phenotypes and return a cohort table, which contains the set of patients which satisfied all the inclusion / exclusion / entry criteria for the specified study. Additionally, a baseline characteristics table will be computed and reports generated, including a waterfall chart, the distributions of baseline characteristics.

## Phenotype classes

In PhenEx, the concept on an electronic phenotype is encapsulated by Phenotype classes that expose all relevant parameters to express an electronic phenotype. These classes are designed to be reusable and composable, allowing complex phenotypes to be built from simpler ones. The foundational Phenotype classes include:

| Phenotype Class             | Identify patients using ...                               | Example                                                                            |
| --------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| CodelistPhenotype           | Medical code lists (e.g. ICD10CM, SNOMED, NDC, RxNorm)    | All patients with a diagnosis code for atrial fibrillation one year prior to index |
| MeasurementPhenotype        | Numerical values such as lab tests or observation results | All patients with systolic blood pressure greater than 160                         |
| ContinuousCoveragePhenotype | Observation coverage data                                 | One year continuous insurance coverage prior to index                              |
| AgePhenotype                | Date of birth data                                        | Age at date of first atrial fibrillation diagnosis                                 |
| DeathPhenotype              | Date of death data                                        | Date of death after atrial fibrillation diagnosis                                  |

These foundational Phenotype's allow you to express complex constraints with just keyword arguments. For example, in CodelistPhenotype, you can specify that the diagnosis must have occurred in the inpatient setting or in the primary position in the outpatient setting. Phenotype's can refer to other Phenotype's in specifying their constraints. For example, "one year preindex" refers to another Phenotype which defines the index date.

Furthermore, they can be combined using the following derived Phenotypes:

| Phenotype Class     | Identify patients using ...                       | Example                                                      |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| LogicPhenotype      | Logical combinations of any other phenotypes      | high blood pressure observation OR blood pressure medication |
| ArithmeticPhenotype | Mathematical combinations of any other phenotypes | BMI                                                          |
| ScorePhenotype      | Logical combinations of any other phenotypes      | CHADSVASc, CCI, HASBLED                                      |

Each phenotype class provides methods for defining the criteria and for evaluating the phenotype against a dataset. By using these classes, researchers can define complex phenotypes in a clear and concise manner, without needing to write custom code for each study.

### Architecture

Below is an illustration of the basic design of the PhenEx in the evidence generation ecosystem.

![Architecture](assets/architecture.png)

## Getting started

To get started, please head over to our [tutorials](tutorials.md).
