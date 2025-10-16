#' Example Functions for PhenEx R
#'
#' This file contains example functions that demonstrate common PhenEx workflows

#' Create example OMOP data for testing
#'
#' @param n_patients Number of patients to simulate
#' @return Named list of data.frames representing OMOP tables
#' @export
create_example_omop_data <- function(n_patients = 100) {
  set.seed(42)  # For reproducible examples
  
  # Generate person table
  person <- data.frame(
    PERSON_ID = 1:n_patients,
    BIRTH_DATETIME = sample(
      seq(as.Date("1940-01-01"), as.Date("2000-01-01"), by = "day"),
      n_patients, replace = TRUE
    ),
    GENDER_CONCEPT_ID = sample(c(8507, 8532), n_patients, replace = TRUE),  # Male/Female
    stringsAsFactors = FALSE
  )
  
  # Generate condition occurrences (diagnoses)
  n_conditions <- n_patients * 3  # Average 3 conditions per patient
  condition_occurrence <- data.frame(
    PERSON_ID = sample(1:n_patients, n_conditions, replace = TRUE),
    CONDITION_CONCEPT_ID = sample(
      c(313217, 49601007, 4329847, 201820, 312327),  # AF, MI, Diabetes, etc.
      n_conditions, replace = TRUE
    ),
    CONDITION_START_DATE = sample(
      seq(as.Date("2015-01-01"), as.Date("2023-12-31"), by = "day"),
      n_conditions, replace = TRUE
    ),
    VISIT_DETAIL_CONCEPT_ID = sample(c(9201, 9202, 9203), n_conditions, replace = TRUE),
    stringsAsFactors = FALSE
  )
  
  # Generate measurements
  n_measurements <- n_patients * 5  # Average 5 measurements per patient
  measurement <- data.frame(
    PERSON_ID = sample(1:n_patients, n_measurements, replace = TRUE),
    MEASUREMENT_CONCEPT_ID = sample(
      c(3004249, 3013721, 3012888),  # HbA1c, cholesterol, BMI, etc.
      n_measurements, replace = TRUE
    ),
    MEASUREMENT_DATE = sample(
      seq(as.Date("2015-01-01"), as.Date("2023-12-31"), by = "day"),
      n_measurements, replace = TRUE
    ),
    VALUE_AS_NUMBER = runif(n_measurements, 5, 15),  # Random values
    stringsAsFactors = FALSE
  )
  
  # Convert dates to character (as expected by PhenEx)
  person$BIRTH_DATETIME <- as.character(person$BIRTH_DATETIME)
  condition_occurrence$CONDITION_START_DATE <- as.character(condition_occurrence$CONDITION_START_DATE)
  measurement$MEASUREMENT_DATE <- as.character(measurement$MEASUREMENT_DATE)
  
  list(
    PERSON = person,
    CONDITION_OCCURRENCE = condition_occurrence,
    MEASUREMENT = measurement
  )
}

#' Run a complete PhenEx example workflow
#'
#' @param use_example_data Whether to use simulated data (TRUE) or require real connection (FALSE)
#' @return List with example results
#' @export
phenex_example_workflow <- function(use_example_data = TRUE) {
  cat("Running PhenEx Example Workflow\n")
  cat("===============================\n\n")
  
  # Step 1: Initialize PhenEx
  cat("1. Initializing PhenEx...\n")
  if (!phenex_available()) {
    stop("PhenEx is not available. Please install and initialize PhenEx first.")
  }
  
  # Step 2: Create or connect to data
  if (use_example_data) {
    cat("2. Creating example OMOP data...\n")
    omop_data <- create_example_omop_data(n_patients = 50)
    
    # Convert to PhenEx tables (this would normally be done via database connection)
    tables <- list(
      PERSON = df_to_phenex_table(omop_data$PERSON, "PERSON"),
      CONDITION_OCCURRENCE = df_to_phenex_table(omop_data$CONDITION_OCCURRENCE, "CONDITION_OCCURRENCE"),
      MEASUREMENT = df_to_phenex_table(omop_data$MEASUREMENT, "MEASUREMENT")
    )
  } else {
    stop("Real database connection example not implemented in this demo")
  }
  
  # Step 3: Create codelists
  cat("3. Creating codelists...\n")
  
  # Atrial Fibrillation codelist
  af_codelist <- Codelist$new(
    codelist = list("SNOMED" = c("313217")),
    name = "atrial_fibrillation"
  )
  
  # Myocardial Infarction codelist
  mi_codelist <- Codelist$new(
    codelist = list("SNOMED" = c("49601007")),
    name = "myocardial_infarction"
  )
  
  # HbA1c measurement codelist
  hba1c_codelist <- Codelist$new(
    codelist = list("LOINC" = c("3004249")),
    name = "hba1c"
  )
  
  # Step 4: Create phenotypes
  cat("4. Creating phenotypes...\n")
  
  # Basic demographic phenotypes
  age_phenotype <- AgePhenotype$new(name = "age")
  sex_phenotype <- SexPhenotype$new(name = "sex")
  
  # Condition phenotypes
  af_phenotype <- CodelistPhenotype$new(
    domain = "CONDITION_OCCURRENCE",
    codelist = af_codelist,
    name = "atrial_fibrillation",
    return_date = "first"
  )
  
  mi_phenotype <- CodelistPhenotype$new(
    domain = "CONDITION_OCCURRENCE",
    codelist = mi_codelist,
    name = "myocardial_infarction",
    return_date = "first"
  )
  
  # Measurement phenotype
  hba1c_phenotype <- MeasurementPhenotype$new(
    domain = "MEASUREMENT",
    codelist = hba1c_codelist,
    aggregator = "mean",
    name = "hba1c_mean"
  )
  
  # Step 5: Create filters and derived phenotypes
  cat("5. Creating filtered phenotypes...\n")
  
  # Example: Patients with elevated HbA1c (diabetes indicator)
  diabetes_filter <- ValueFilter$new(
    column_name = "VALUE",
    operator = ">=",
    value = 6.5
  )
  
  # Create binned age groups
  age_bins <- BinPhenotype$new(
    phenotype = age_phenotype,
    bins = c(0, 30, 50, 70, 100),
    name = "age_groups"
  )
  
  # Step 6: Create a cohort
  cat("6. Creating cohort...\n")
  
  # Example cohort: Patients with AF or MI
  cardiovascular_cohort <- Cohort$new(
    name = "cardiovascular_patients",
    inclusions = list(af_phenotype, mi_phenotype),  # OR logic for inclusions
    description = "Patients with atrial fibrillation or myocardial infarction"
  )
  
  # Step 7: Execute phenotypes and cohorts
  cat("7. Executing phenotypes and cohorts...\n")
  
  results <- list()
  
  # Execute individual phenotypes
  tryCatch({
    results$age <- age_phenotype$execute(tables)
    cat("   - Age phenotype: ", results$age$count(), " patients\n")
  }, error = function(e) {
    cat("   - Age phenotype failed:", e$message, "\n")
  })
  
  tryCatch({
    results$af <- af_phenotype$execute(tables)
    cat("   - AF phenotype: ", results$af$count(), " patients\n")
  }, error = function(e) {
    cat("   - AF phenotype failed:", e$message, "\n")
  })
  
  tryCatch({
    results$mi <- mi_phenotype$execute(tables)
    cat("   - MI phenotype: ", results$mi$count(), " patients\n")
  }, error = function(e) {
    cat("   - MI phenotype failed:", e$message, "\n")
  })
  
  # Execute cohort
  tryCatch({
    results$cohort <- cardiovascular_cohort$execute(tables)
    cat("   - Cardiovascular cohort: ", results$cohort$count(), " patients\n")
  }, error = function(e) {
    cat("   - Cohort execution failed:", e$message, "\n")
  })
  
  # Step 8: Show results
  cat("\n8. Example Results:\n")
  
  if (!is.null(results$cohort)) {
    cat("\nCohort Summary:\n")
    print(results$cohort$head())
  }
  
  if (!is.null(results$af)) {
    cat("\nAF Patients (first 5):\n")
    print(results$af$head(5))
  }
  
  cat("\nWorkflow completed successfully!\n")
  invisible(results)
}

#' Create an example diabetes study
#'
#' @param tables Named list of OMOP tables
#' @return List with study results
#' @export
example_diabetes_study <- function(tables = NULL) {
  if (is.null(tables)) {
    # Create example data
    omop_data <- create_example_omop_data(n_patients = 200)
    tables <- list(
      PERSON = df_to_phenex_table(omop_data$PERSON, "PERSON"),
      CONDITION_OCCURRENCE = df_to_phenex_table(omop_data$CONDITION_OCCURRENCE, "CONDITION_OCCURRENCE"),
      MEASUREMENT = df_to_phenex_table(omop_data$MEASUREMENT, "MEASUREMENT")
    )
  }
  
  cat("Diabetes Outcomes Study Example\n")
  cat("==============================\n\n")
  
  # Define diabetes-related codelists
  diabetes_codelist <- icd_codelist(
    icd_codes = c("E11", "E11.9", "250.00"),
    name = "type2_diabetes"
  )
  
  hba1c_codelist <- Codelist$new(
    codelist = list("LOINC" = c("3004249")),
    name = "hba1c"
  )
  
  # Create phenotypes
  diabetes_phenotype <- CodelistPhenotype$new(
    domain = "CONDITION_OCCURRENCE", 
    codelist = diabetes_codelist,
    name = "diabetes_diagnosis"
  )
  
  hba1c_phenotype <- MeasurementPhenotype$new(
    domain = "MEASUREMENT",
    codelist = hba1c_codelist,
    aggregator = "mean",
    name = "average_hba1c"
  )
  
  age_phenotype <- AgePhenotype$new()
  sex_phenotype <- SexPhenotype$new()
  
  # Create age groups for stratification
  age_groups <- BinPhenotype$new(
    phenotype = age_phenotype,
    bins = c(0, 40, 60, 80, 100),
    name = "age_categories"
  )
  
  # Create diabetes cohort
  diabetes_cohort <- Cohort$new(
    name = "diabetes_study_cohort",
    inclusions = list(diabetes_phenotype),
    description = "Type 2 diabetes patients for outcomes study"
  )
  
  # Execute study
  cat("Executing study components...\n")
  
  study_results <- list()
  
  tryCatch({
    study_results$cohort <- diabetes_cohort$execute(tables)
    study_results$age_groups <- age_groups$execute(tables)
    study_results$hba1c <- hba1c_phenotype$execute(tables)
    
    cat("Study execution completed successfully!\n")
    cat("Diabetes cohort size:", study_results$cohort$count(), "patients\n")
    
    return(study_results)
    
  }, error = function(e) {
    cat("Study execution failed:", e$message, "\n")
    return(NULL)
  })
}