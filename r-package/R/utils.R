#' Utility Functions and Operators for PhenEx R
#'
#' This file contains utility functions and operator overloads to make
#' PhenEx feel more natural in R

#' Pipe operator for PhenEx objects
#'
#' @param lhs Left-hand side object
#' @param rhs Right-hand side function
#' @export
`%>%` <- function(lhs, rhs) {
  # Simple pipe implementation for PhenEx objects
  rhs(lhs)
}

#' OR operator for phenotypes
#'
#' @param left Left phenotype
#' @param right Right phenotype
#' @export
`%OR%` <- function(left, right) {
  if (!inherits(left, "Phenotype") || !inherits(right, "Phenotype")) {
    stop("Both operands must be Phenotype objects")
  }
  left$or(right)
}

#' AND operator for phenotypes
#'
#' @param left Left phenotype
#' @param right Right phenotype
#' @export
`%AND%` <- function(left, right) {
  if (!inherits(left, "Phenotype") || !inherits(right, "Phenotype")) {
    stop("Both operands must be Phenotype objects")
  }
  
  # Create LogicPhenotype with AND operation
  LogicPhenotype$new(left, right, "&")
}

#' NOT operator for phenotypes
#'
#' @param phenotype Phenotype to negate
#' @export
`NOT` <- function(phenotype) {
  if (!inherits(phenotype, "Phenotype")) {
    stop("Operand must be a Phenotype object")
  }
  phenotype$not()
}

#' Convert R data.frame to PhenEx table format
#'
#' @param df data.frame to convert
#' @param name Table name
#' @return PhenexTable object
#' @export
df_to_phenex_table <- function(df, name = "table") {
  if (is.null(phenex_env$tables)) {
    stop("PhenEx not initialized. Call phenex_initialize() first.")
  }
  
  # Convert to pandas DataFrame first
  pd <- reticulate::import("pandas")
  py_df <- reticulate::r_to_py(df)
  
  # Create PhenexTable
  py_table <- phenex_env$tables$PhenexTable(py_df, name = name)
  
  result <- PhenexTable$new()
  result$py_object <- py_table
  result
}

#' Load data from CSV into PhenEx table
#'
#' @param file_path Path to CSV file
#' @param name Table name
#' @param ... Additional arguments passed to read.csv
#' @return PhenexTable object
#' @export
load_csv_table <- function(file_path, name = basename(file_path), ...) {
  df <- read.csv(file_path, ...)
  df_to_phenex_table(df, name)
}

#' Create a simple measurement from numeric data
#'
#' @param values Numeric vector of values
#' @param person_ids Vector of person IDs (same length as values)
#' @param event_dates Vector of dates (same length as values)
#' @param name Measurement name
#' @return data.frame in PhenEx measurement format
#' @export
create_measurement_data <- function(values, person_ids, event_dates, name = "measurement") {
  if (length(values) != length(person_ids) || length(values) != length(event_dates)) {
    stop("All vectors must have the same length")
  }
  
  # Convert dates to character if they're Date objects
  if (inherits(event_dates, "Date")) {
    event_dates <- as.character(event_dates)
  }
  
  data.frame(
    PERSON_ID = person_ids,
    EVENT_DATE = event_dates,
    VALUE = values,
    CODE = name,
    CODE_TYPE = "custom",
    stringsAsFactors = FALSE
  )
}

#' Print PhenEx system information
#'
#' @export
phenex_info <- function() {
  cat("PhenEx R Package Information\n")
  cat("============================\n")
  
  # R package version
  cat("R Package Version:", as.character(utils::packageVersion("phenexr")), "\n")
  
  # Python availability
  if (reticulate::py_available()) {
    cat("Python Available: Yes\n")
    cat("Python Version:", reticulate::py_config()$version, "\n")
    cat("Python Path:", reticulate::py_config()$python, "\n")
    
    # PhenEx availability and version
    if (phenex_available()) {
      cat("PhenEx Available: Yes\n")
      cat("PhenEx Version:", phenex_version(), "\n")
    } else {
      cat("PhenEx Available: No\n")
    }
  } else {
    cat("Python Available: No\n")
  }
  
  # Reticulate configuration
  cat("\nReticulate Configuration:\n")
  print(reticulate::py_config())
  
  invisible(NULL)
}

#' Check if object is a PhenEx phenotype
#'
#' @param x Object to check
#' @return Logical
#' @export
is_phenotype <- function(x) {
  inherits(x, "Phenotype")
}

#' Check if object is a PhenEx codelist
#'
#' @param x Object to check
#' @return Logical
#' @export
is_codelist <- function(x) {
  inherits(x, "Codelist")
}

#' Check if object is a PhenEx table
#'
#' @param x Object to check
#' @return Logical
#' @export
is_phenex_table <- function(x) {
  inherits(x, "PhenexTable") || inherits(x, "PhenotypeTable")
}

#' Summary statistics for a phenotype result
#'
#' @param phenotype_table PhenotypeTable object
#' @return Named list with summary statistics
#' @export
phenotype_summary <- function(phenotype_table) {
  if (!inherits(phenotype_table, "PhenotypeTable")) {
    stop("Input must be a PhenotypeTable object")
  }
  
  df <- phenotype_table$to_data_frame()
  
  list(
    total_patients = length(unique(df$PERSON_ID)),
    total_events = nrow(df),
    date_range = if ("EVENT_DATE" %in% names(df)) {
      range(as.Date(df$EVENT_DATE), na.rm = TRUE)
    } else {
      NULL
    },
    value_summary = if ("VALUE" %in% names(df) && !all(is.na(df$VALUE))) {
      summary(df$VALUE)
    } else {
      NULL
    }
  )
}

#' Export codelist to CSV
#'
#' @param codelist Codelist object
#' @param file_path Output file path
#' @export
export_codelist <- function(codelist, file_path) {
  if (!inherits(codelist, "Codelist")) {
    stop("codelist must be a Codelist object")
  }
  
  df <- codelist$to_data_frame()
  write.csv(df, file_path, row.names = FALSE)
  message("Codelist exported to: ", file_path)
}

#' Export phenotype result to CSV
#'
#' @param phenotype_result PhenotypeTable or CohortResult object
#' @param file_path Output file path
#' @param limit Maximum number of rows to export
#' @export
export_result <- function(phenotype_result, file_path, limit = NULL) {
  if (inherits(phenotype_result, "CohortResult")) {
    df <- phenotype_result$to_data_frame(limit = limit)
  } else if (inherits(phenotype_result, "PhenotypeTable")) {
    df <- phenotype_result$to_data_frame(limit = limit)
  } else {
    stop("phenotype_result must be a PhenotypeTable or CohortResult object")
  }
  
  write.csv(df, file_path, row.names = FALSE)
  message("Result exported to: ", file_path)
}

#' Convenience function to create commonly used phenotypes
#'
#' @param type Type of phenotype ("age", "sex", "death")
#' @param name Optional name override
#' @return Phenotype object
#' @export
common_phenotype <- function(type, name = NULL) {
  type <- tolower(type)
  
  switch(type,
    "age" = AgePhenotype$new(name = name %||% "age"),
    "sex" = SexPhenotype$new(name = name %||% "sex"),
    "death" = DeathPhenotype$new(name = name %||% "death"),
    stop("Unknown phenotype type: ", type, ". Supported types: age, sex, death")
  )
}

#' Create a quick diagnostic codelist from ICD codes
#'
#' @param icd_codes Vector of ICD codes
#' @param name Codelist name
#' @param code_type Code type (default "ICD10CM")
#' @return Codelist object
#' @export
icd_codelist <- function(icd_codes, name, code_type = "ICD10CM") {
  code_dict <- list()
  code_dict[[code_type]] <- icd_codes
  
  Codelist$new(codelist = code_dict, name = name)
}

#' Create a quick procedure codelist from CPT codes
#'
#' @param cpt_codes Vector of CPT codes
#' @param name Codelist name
#' @return Codelist object
#' @export
cpt_codelist <- function(cpt_codes, name) {
  code_dict <- list("CPT" = cpt_codes)
  Codelist$new(codelist = code_dict, name = name)
}