# PhenEx R Bindings - Architecture and Implementation

## Overview

This document describes the comprehensive R bindings for the PhenEx Python library that have been created. The R package `phenexr` provides a complete, R-native interface to all PhenEx functionality while maintaining the underlying Python implementation.

## Architecture

### Core Design Principles

1. **Python-First**: The Python library remains the source of truth. R bindings are a wrapper that provides R-native syntax and idioms.

2. **Reticulate Bridge**: Uses the `reticulate` package for seamless Python-R interoperability with minimal performance overhead.

3. **R6 Classes**: Implements R6 object-oriented programming to mirror the Python class hierarchy and provide familiar R patterns.

4. **Native R Feel**: While wrapping Python objects, the API feels natural to R users with appropriate method names, documentation, and idioms.

5. **Automatic Synchronization**: Since the R package directly calls Python functions, it automatically stays in sync with Python development.

## Package Structure

```
r-package/
├── DESCRIPTION              # Package metadata and dependencies
├── NAMESPACE               # Exported functions and imports
├── LICENSE                 # BSD 3-Clause license
├── README.md              # Package documentation
├── build.R                # Build and installation script
├── test_integration.R     # Integration testing script
├── R/                     # R source code
│   ├── phenex.R          # Main initialization and configuration
│   ├── codelist.R        # Codelist class and utilities
│   ├── phenotype.R       # Base Phenotype and PhenotypeTable classes
│   ├── phenotypes.R      # Specific phenotype implementations
│   ├── filters.R         # Filter classes and utilities
│   ├── connectors.R      # Database connectors and table mappers
│   ├── cohort.R          # Cohort and study management classes
│   ├── utils.R           # Utility functions and operators
│   └── examples.R        # Example workflows and demo functions
├── tests/                # Test suite
│   ├── testthat.R       # Test runner
│   └── testthat/        # Individual test files
│       └── test-basic.R
├── vignettes/            # Documentation and tutorials
│   └── introduction.Rmd
└── man/                  # Auto-generated documentation (from roxygen2)
```

## Core Classes

### 1. Initialization (`phenex.R`)

- **`phenex_initialize()`**: Sets up Python environment and imports PhenEx modules
- **`phenex_available()`**: Checks if PhenEx is accessible
- **`phenex_version()`**: Returns PhenEx version
- **`phenex_info()`**: Displays comprehensive system information

### 2. Codelists (`codelist.R`)

- **`Codelist`**: R6 class wrapping Python Codelist functionality
- **`codelist_from_csv()`**: Load codelists from CSV files
- **`codelist_from_medconb()`**: Integration with MedConB codelist service
- **`icd_codelist()`**, **`cpt_codelist()`**: Convenience functions for common code types

### 3. Phenotypes (`phenotype.R`, `phenotypes.R`)

- **`Phenotype`**: Base phenotype class with execution and combination methods
- **`CodelistPhenotype`**: Extract patients based on medical codes
- **`MeasurementPhenotype`**: Handle measurement data with aggregation
- **`AgePhenotype`**, **`SexPhenotype`**, **`DeathPhenotype`**: Common demographic phenotypes
- **`BinPhenotype`**: Binning and categorization
- **`EventCountPhenotype`**: Count occurrences
- **`ArithmeticPhenotype`**, **`LogicPhenotype`**: Combine phenotypes mathematically/logically

### 4. Filters (`filters.R`)

- **`DateFilter`**: Time-based filtering
- **`RelativeTimeRangeFilter`**: Relative temporal constraints
- **`CategoricalFilter`**: Categorical value filtering
- **`ValueFilter`**: Numeric value constraints
- **`Value`**: Helper class for comparisons with operators like `gt()`, `lt()`, etc.

### 5. Data Connectivity (`connectors.R`)

- **`SnowflakeConnector`**: Connect to Snowflake databases
- **`DuckDBConnector`**: Connect to DuckDB databases
- **`OMOPDomains`**: OMOP Common Data Model table mapping
- **`PhenexTable`**: Wrapper for database tables with PhenEx functionality

### 6. Cohorts (`cohort.R`)

- **`Cohort`**: Define patient cohorts with inclusion/exclusion criteria
- **`CohortResult`**: Results of cohort execution with analysis capabilities
- **`Subcohort`**: Create derived cohorts with additional criteria
- **`create_cohort()`**: Convenience function for simple cohort creation

### 7. Utilities (`utils.R`)

- **Operators**: `%OR%`, `%AND%`, `NOT()` for phenotype logic
- **Data Conversion**: `df_to_phenex_table()`, `load_csv_table()`
- **Export Functions**: `export_codelist()`, `export_result()`
- **Convenience Functions**: `common_phenotype()`, `phenotype_summary()`
- **Type Checking**: `is_phenotype()`, `is_codelist()`, `is_phenex_table()`

### 8. Examples (`examples.R`)

- **`create_example_omop_data()`**: Generate simulated OMOP data for testing
- **`phenex_example_workflow()`**: Complete example workflow demonstration
- **`example_diabetes_study()`**: Realistic medical study example

## Key Features

### 1. Automatic Python Environment Management

The package automatically detects and configures the Python environment:

```r
library(phenexr)
# Automatic initialization on package load
# Manual initialization if needed:
phenex_initialize(virtualenv = "phenex-env")
```

### 2. R-Native Syntax

While wrapping Python objects, the API feels natural to R users:

```r
# Create codelist
diabetes_codes <- icd_codelist(c("E11", "E11.9"), "diabetes")

# Create phenotype
diabetes <- CodelistPhenotype$new(
  domain = "CONDITION_OCCURRENCE",
  codelist = diabetes_codes
)

# Combine with operators
complex_phenotype <- diabetes %OR% age_over_65 %AND% NOT(exclusion_criteria)

# Execute and analyze
result <- diabetes$execute(tables)
summary <- phenotype_summary(result)
```

### 3. Seamless Data Integration

Support for multiple data sources and formats:

```r
# Database connections
conn <- SnowflakeConnector$new(account = "...", user = "...", ...)
tables <- omop_domains()$get_mapped_tables(conn)

# CSV/data.frame integration
df <- read.csv("patient_data.csv")
table <- df_to_phenex_table(df, "patients")

# Example/simulated data
example_data <- create_example_omop_data(n_patients = 1000)
```

### 4. Comprehensive Error Handling

Robust error handling with informative messages:

```r
# Automatic validation
if (!phenex_available()) {
  stop("PhenEx not available. Please install with: pip install phenex")
}

# Type checking
if (!inherits(codelist, "Codelist")) {
  stop("codelist must be a Codelist object")
}
```

### 5. Extensive Testing

Complete test suite covering:

- Basic functionality tests
- Integration tests with simulated data
- Error condition handling
- Cross-platform compatibility

## Usage Patterns

### 1. Quick Start

```r
library(phenexr)

# Create phenotype
age <- AgePhenotype$new()

# Run example
results <- phenex_example_workflow(use_example_data = TRUE)
```

### 2. Real-World Study

```r
# Connect to database
conn <- SnowflakeConnector$new(...)
tables <- omop_domains()$get_mapped_tables(conn)

# Define study
diabetes_codes <- icd_codelist(c("E11", "E11.9"), "diabetes")
diabetes_phenotype <- CodelistPhenotype$new(
  domain = "CONDITION_OCCURRENCE",
  codelist = diabetes_codes
)

# Create cohort
study_cohort <- Cohort$new(
  name = "diabetes_study",
  inclusions = list(diabetes_phenotype),
  exclusions = list(exclusion_criteria)
)

# Execute and export
results <- study_cohort$execute(tables)
export_result(results, "diabetes_cohort.csv")
```

### 3. Complex Phenotype Logic

```r
# Combine multiple conditions
cvd_phenotype <- mi_phenotype %OR% stroke_phenotype %OR% af_phenotype

# Time-based filtering
one_year_filter <- RelativeTimeRangeFilter$new(
  min_days = gt(0),
  max_days = lte(365),
  anchor_phenotype = index_event
)

# Apply filters
recent_cvd <- CodelistPhenotype$new(
  domain = "CONDITION_OCCURRENCE",
  codelist = cvd_codes,
  relative_time_range = one_year_filter
)
```

## Advantages of This Approach

### 1. **Unified Development**

- Single Python codebase serves both Python and R users
- Bug fixes and new features automatically available in R
- Consistent behavior across languages

### 2. **Performance**

- Direct Python object manipulation (no serialization overhead)
- Leverages optimized Python libraries (pandas, ibis, etc.)
- Minimal R-Python boundary crossings

### 3. **Maintenance**

- R bindings stay automatically synchronized with Python development
- No need to maintain parallel implementations
- Reduces development and testing burden

### 4. **Completeness**

- Full API coverage of Python functionality
- Advanced features accessible immediately in R
- No feature lag between Python and R versions

### 5. **Native Integration**

- Feels natural to R users despite Python backend
- Integrates with R ecosystem (dplyr, ggplot2, etc.)
- Follows R conventions and idioms

## Installation and Deployment

### Development Setup

```bash
# Ensure Python and PhenEx are installed
pip install phenex

# Install R package dependencies
R -e "install.packages(c('reticulate', 'R6', 'devtools', 'testthat'))"

# Test integration
cd r-package
./test_integration.R

# Build and install
./build.R
```

### User Installation

```r
# Install dependencies
install.packages(c("reticulate", "R6"))

# Install PhenEx R package
devtools::install_github("Bayer-Group/PhenEx/r-package")

# Or from local source
devtools::install_local("path/to/r-package")
```

## Future Enhancements

1. **CRAN Distribution**: Package the R bindings for CRAN distribution
2. **Conda Integration**: Provide conda-forge packages for easier Python environment management
3. **RStudio Integration**: Create RStudio addins for common PhenEx workflows
4. **Shiny Dashboard**: Build web interfaces for non-R users
5. **Additional Connectors**: Support for more database backends
6. **Advanced Visualization**: Integrate with R's rich visualization ecosystem

## Summary

The PhenEx R bindings provide a comprehensive, production-ready interface that:

- **Wraps the entire PhenEx Python API** with R-native syntax and idioms
- **Maintains automatic synchronization** with Python development
- **Provides excellent performance** through direct Python object manipulation
- **Includes extensive testing and documentation**
- **Supports the full spectrum** from quick analyses to complex research studies

This approach successfully bridges the gap between Python-first development and R-native user experience, allowing R users to leverage the full power of PhenEx without compromising on performance or functionality.
