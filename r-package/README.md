# PhenEx R Package

R bindings for the PhenEx Python library - Automatic Electronic Phenotype Execution.

## Installation

### Step 1: Install R Dependencies

```r
# Install required R packages
install.packages(c("devtools", "reticulate", "R6", "jsonlite"))
```

### Step 2: Install PhenEx R Package

**Option A: Install from GitHub (Recommended)**

```r
# Install directly from GitHub
devtools::install_github("Bayer-Group/PhenEx", subdir = "r-package", ref = "feat/rbindings")
```

**Option B: Install from local directory**

```r
# From the main PhenEx directory (where you cloned the repo):
devtools::install_local("r-package", force = TRUE)
```

### Step 3: Set up Python Environment

**CRITICAL:** The Python architecture must match your R installation (ARM64 for Apple Silicon, x86_64 for Intel).

**Recommended for Apple Silicon (ARM64):**

```bash
# Use Homebrew Python (ARM64 native) - recommended path
/opt/homebrew/bin/python3.12 -m venv .venv
# Or use system python3 if available
# python3 -m venv .venv

source .venv/bin/activate
pip install phenex
```

**Alternative options:**

```bash
# Option A: Using conda with ARM64
conda create -n phenex-r python=3.12
conda activate phenex-r
pip install phenex

# Option B: Using system Python (if ARM64)
python3 -m venv phenex-venv
source phenex-venv/bin/activate
pip install phenex
```

**Verify your setup:**

```bash
# Check Python architecture (should be 'arm64' on Apple Silicon)
python -c "import platform; print(platform.machine())"

# Verify PhenEx installation
python -c "import phenex; print('PhenEx installed successfully')"
```

## Loading Phenex

You must always run the following commands whenever you wish to use Phenex within R:

```r
# Set the path to your python environment
python_env <- './.venv'  # Adjust this path as needed

# Configure reticulate to use your Python environment
reticulate::use_virtualenv(python_env, required = TRUE)
# If using condas / miniconda:
# reticulate::use_condaenv('name_of_conda_env', required = TRUE)

# Configure reticulate to use your Python environment
reticulate::py_config()

# Optional: Verify Python configuration
reticulate::py_available()  # Should be TRUE
reticulate::py_module_available("phenex")  # Should be TRUE

# Load PhenEx + reticulate
library(phenexr)
library(reticulate)
```

You should now be able to import Phenex modules and use the R interface. For example, the following script will generate fake patient data with the OMOP data structure:

```
sim <- import("phenex.sim")
mappers <- import("phenex.mappers")

# Create DomainsMocker with OMOPDomains (1000 patients)
domains_mocker <- sim$DomainsMocker(
  domains_dict = mappers$OMOPDomains,
  n_patients = 1000L,
  random_seed = 42L
)

tables <- domains_mocker$get_mapped_tables()
cat("   ✅ Generated", length(tables), "OMOP tables\n")
cat("   📊 Available tables:", paste(names(tables), collapse = ", "), "\n\n")
```

## Running the Examples

The `r-package/examples/` directory contains complete cohort analysis workflows and tutorials.

### Available Examples:

- **`cohort_example.R`** - Interactive cohort analysis workflow using mock OMOP data
- **`PhenEx_Study_Tutorial.qmd`** - Comprehensive Quarto tutorial with real Snowflake database connection

### Interactive R Example:

To run the interactive cohort example, first set up your environment as in the previous section. Then run:

```r
source("r-package/examples/cohort_example.R")
```

This will walk you through the PhenEx workflow step-by-step with prompts and explanations.

### Quarto Tutorial:

The `PhenEx_Study_Tutorial.qmd` file provides a comprehensive tutorial that demonstrates:

- **Database Connection**: Connecting to Snowflake with credentials
- **OMOP Data Integration**: Working with real OMOP Common Data Model
- **Medical Codelists**: Loading and using medical concept codes
- **Complex Study Design**: Entry criteria, inclusions, exclusions, and characteristics
- **Advanced Reporting**: Attrition tables, baseline characteristics, survival analysis
- **Interactive Dashboards**: Using PhenEx's reporting capabilities

To use the Quarto tutorial:

1. Open the file in RStudio or any Quarto-compatible editor
2. Configure your Snowflake credentials (see tutorial for methods)
3. Run code chunks interactively or render the entire document

```r
# To render the Quarto document:
quarto::quarto_render("r-package/examples/PhenEx_Study_Tutorial.qmd")
```

The Quarto tutorial is ideal for:

- Learning PhenEx with real-world data
- Creating reproducible research workflows
- Generating publication-ready reports
- Understanding advanced PhenEx features

## Automatic Method Porting

🎉 **Key Feature**: You don't need to manually define every Python method! The R bindings automatically provide access to all Python functionality:

### Core Methods (Optimized)

```r
# These methods are explicitly defined for best performance:
codes_list <- codelist$to_list()          # Convert to R list
codes_df <- codelist$to_pandas()          # Convert to data.frame
codes_tuples <- codelist$to_tuples()      # Convert to tuples
codelist_copy <- codelist$copy("new_name") # Copy with modifications
codes_dict <- codelist$to_dict()          # Convert to named list
```

### Any Python Method (Generic Access)

```r
# Access ANY Python method using call_method():
result <- codelist$call_method("method_name", arg1, arg2, ...)

# Examples:
union_result <- codelist1$call_method("union", codelist2)
intersection <- codelist1$call_method("intersection", codelist2)
```

### Automatic Result Wrapping

```r
# Python Codelist results are automatically wrapped into R Codelist objects:
new_codelist <- codelist$copy("copy_name")  # Returns R Codelist, not Python object
combined <- codelist1 + codelist2          # Returns R Codelist
```

## Main Classes

- **Codelist**: Medical code lists for defining concepts (with automatic method porting)
- **Phenotype**: Base class for all phenotypes
- **CodelistPhenotype**: Extract patients based on medical codes
- **MeasurementPhenotype**: Extract and aggregate measurement values
- **Cohort**: Define patient cohorts with inclusion/exclusion criteria
- **AgePhenotype**, **SexPhenotype**: Common demographic phenotypes

## Database Connections

```r
# Snowflake connection
conn <- SnowflakeConnector$new(
  account = "your_account",
  user = "your_user",
  password = "your_password",
  warehouse = "your_warehouse",
  database = "your_database",
  schema = "your_schema"
)

# Get OMOP-mapped tables
omop <- omop_domains()
tables <- omop$get_mapped_tables(conn)
```

## Examples

### Simple Phenotype

```r
# Create age phenotype
age <- AgePhenotype$new()

# Create diagnosis phenotype
diabetes_codes <- icd_codelist(c("E11", "E11.9"), "type2_diabetes")
diabetes <- CodelistPhenotype$new(
  domain = "CONDITION_OCCURRENCE",
  codelist = diabetes_codes
)

# Execute against your data
diabetes_patients <- diabetes$execute(tables)
```

### Building Cohorts

```r
# Define inclusion criteria
inclusion_phenotypes <- list(
  diabetes,
  AgePhenotype$new()  # Will filter for adults
)

# Create cohort
study_cohort <- Cohort$new(
  name = "diabetes_study",
  inclusions = inclusion_phenotypes,
  description = "Type 2 diabetes patients for outcomes study"
)

# Execute cohort
cohort_result <- study_cohort$execute(tables)
print(cohort_result)
```

### Phenotype Operations

```r
# Combine phenotypes with logical operations
af_or_mi <- af_phenotype %OR% mi_phenotype

# Negate a phenotype
no_diabetes <- NOT(diabetes_phenotype)

# Combine with AND
elderly_diabetes <- diabetes_phenotype %AND% age_over_65
```

## Documentation

For complete documentation of the underlying Python library, see:
https://github.com/Bayer-Group/PhenEx

The R bindings provide the same functionality with R-native syntax and idioms.

## Development & Documentation Generation

### For Package Developers

If you're contributing to the PhenEx R package, you'll need to regenerate documentation after making changes to the R source files.

#### Prerequisites for Development

```r
# Install development dependencies
install.packages(c("roxygen2", "devtools", "pkgdown"))
```

#### Generating Function Documentation

The `man/` directory contains auto-generated documentation files (`.Rd` files) created from roxygen2 comments in the R source code. **These files should not be edited manually** and are excluded from version control.

```r
# Regenerate all documentation from roxygen2 comments
roxygen2::roxygenise("r-package")

# Or using devtools (equivalent)
devtools::document("r-package")
```

#### Building Package Website (Optional)

To generate a complete package website with all documentation:

```r
# Generate pkgdown website
pkgdown::build_site("r-package")
```

This creates a `docs/` directory with a complete website including:

- Function reference pages
- Vignettes and tutorials
- Package overview

#### Development Workflow

1. **Edit R source files** in `r-package/R/`
2. **Update roxygen2 comments** (`#'`) above functions/classes
3. **Regenerate documentation**: `roxygen2::roxygenise("r-package")`
4. **Test package**: `devtools::check("r-package")`
5. **Install locally**: `devtools::install("r-package")`

#### Documentation Standards

- Use `#'` comments above all exported functions and R6 classes
- Include `@param` for all function parameters
- Include `@return` to describe return values
- Add `@examples` for usage examples
- Use `@export` to make functions available to users

Example roxygen2 documentation:

```r
#' Create a Medical Codelist
#'
#' @description
#' Creates a new codelist for identifying patients with specific medical conditions
#'
#' @param codes Character vector of medical codes (ICD-10, CPT, etc.)
#' @param name Name for the codelist
#' @param code_type Type of codes ("ICD10CM", "CPT", etc.)
#' @return A Codelist object
#' @export
#' @examples
#' diabetes_codes <- create_codelist(c("E11", "E11.9"), "diabetes", "ICD10CM")
```

## Troubleshooting

### Architecture Issues (Apple Silicon)

The most common issue is Python architecture mismatch. **reticulate requires the Python architecture to match your R installation.**

**Step 1: Create ARM64 Python environment**

```bash
# Remove any existing x86_64 Python environment
rm -rf .venv

# Create ARM64 virtual environment using Homebrew Python (recommended)
/opt/homebrew/bin/python3.12 -m venv .venv
# Or use system Python if it's ARM64:
# python3 -m venv .venv

source .venv/bin/activate
pip install phenex
```

**Step 2: Test in R**

```r
library(reticulate)

# Force reticulate to use your specific virtual environment
python_env <- "/absolute/path/to/your/.venv"  # Adjust this path as needed
use_virtualenv(python_env, required = TRUE)

# Check configuration
py_config()
py_available()  # Should be TRUE
py_module_available("phenex")  # Should be TRUE
```

### Common Error Messages

**"Python is not available"** - Even after installing Python:

```r
# Debug what reticulate sees:
library(reticulate)
py_config()  # Check if Python path is correct
py_available()  # Should be TRUE

# If FALSE, explicitly set Python environment:
use_virtualenv("/path/to/your/venv", required = TRUE)
# OR
use_python("/opt/homebrew/bin/python3.12", required = TRUE)
```

**"could not find function 'phenex_initialize'"**

```r
# Package not properly installed or loaded
install.packages("r-package", repos = NULL, type = "source")  # Reinstall
library(phenexr)  # Reload
```

**Architecture mismatch errors:**

```bash
# Check your Python architecture
python3 -c "import platform; print(platform.machine())"
# Should show 'arm64' on Apple Silicon

# If showing 'x86_64', you need ARM64 Python:
brew install python@3.12  # This installs ARM64 version on Apple Silicon
/opt/homebrew/bin/python3.12 -m venv new_venv
```

### Installation Checklist

1. ✅ Install R dependencies: `install.packages(c("reticulate", "R6", "jsonlite"))`
2. ✅ Install phenexr package: `install.packages("r-package", repos = NULL, type = "source")`
3. ✅ Create ARM64 Python environment with PhenEx
4. ✅ Configure reticulate BEFORE calling phenex_initialize()
5. ✅ Verify all components work with test script

### Verified Working Setup (Apple Silicon)

This configuration has been tested and works:

- **R**: 4.5+ on aarch64-apple-darwin20 (ARM64)
- **Python**: 3.12+ ARM64 via Homebrew or system Python
- **PhenEx**: Latest version via pip
- **reticulate**: Configured with `use_virtualenv()` before initialization

## License

BSD 3-Clause License
