<div id="main_title" class="my-class">
PhenEx
</div>

![Alt text](assets/phenex_feather_horizontal.png)

Implementing observational studies using real-world data (RWD) is challenging, requiring expertise in epidemiology, medical practice, and data engineering. Currently, observational studies are often implemented as bespoke software packages by individual data analysts or small teams. While tools exist, such as open-source tools from the OHDSI program in the R language and proprietary tools from vendors like Aetion or Panalgo, there are no open-source tools for Python-based implementation of observational studies using RWD.

PhenEx (Automated Phenotype Extraction) aims to fill this gap. PhenEx is a Python-based software package that aims to provide reusuable and end-to-end tested implementations of commonly performed operations in the implementation of observational studies. PhenEx is designed with a focus on ease of writing and reading cohort definitions. Medical domain knowledge should be clear and simple, without requiring an understanding of complex data schemas. Ideally, a cohort definition should read like free text.

## Basics of PhenEx design

### The Phenotype class

The most basic concept in PhenEx is the phenotype. A Phenotype is a set of criteria that define a cohort of patients. In a clinical setting, a Phenotype is usually identified by the phrase "patient presents with ...". For example, a phenotype could be "patient presents with diabetes". In the observational setting, we would cacluate the phenotype "patient presents with diabetes" by looking for patients who have a diagnosis of diabetes in their medical record in certain time frame.

A phenotype can reference other phenotypes. For instance, the phenotype "untreated diabetic patients" might translate to real-world data as "having a diagnosis of diabetes but not having a prescription for insulin or metformin". In this case, the prescription phenotype refers to the diabetes phenotype to build the overall phenotype. In PhenEx, your job is to simply specify these criteria. PhenEx will take care of the rest.

All studies are built through the calculation of various phenotypes:

- entry criterion phenotype
- inclusion phenotypes
- exclusion phenotypes
- baseline characteristic phenotypes, and
- outcome phenotypes.

After defining the parameters of all these phenotypes in the study definition file, PhenEx will compute the phenotypes and return a cohort table, which contains the set of patients which satisfied all the inclusion / exclusion / entry criteria for the specified study. Additionally, a baseline characteristics table will be computed and reports generated, including a waterfall chart, the distributions of baseline characteristics.

### Architecture

Below is an illustration of the basic design of the PhenEx in the evidence generation ecosystem.

![Architecture](assets/architecture.png)

# Getting started

To get started, please head over to our [tutorials](tutorials.md).
