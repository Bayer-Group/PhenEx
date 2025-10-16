#' Cohort Class
#'
#' R6 class wrapping PhenEx Python Cohort functionality
#'
#' @description
#' A cohort represents a group of patients defined by inclusion and exclusion criteria.
#' Cohorts are built using phenotypes and can generate various analytical outputs.
#'
#' @export
Cohort <- R6::R6Class(
  "Cohort",
  
  public = list(
    #' @field py_object The underlying Python Cohort object
    py_object = NULL,
    
    #' @description
    #' Create a new Cohort
    #' @param name Name of the cohort
    #' @param inclusions List of inclusion phenotypes
    #' @param exclusions List of exclusion phenotypes (optional)
    #' @param index_phenotype Index phenotype for the cohort (optional)
    #' @param description Description of the cohort
    #' @param ... Additional arguments
    initialize = function(name, inclusions = list(), exclusions = list(),
                         index_phenotype = NULL, description = NULL, ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      # Convert R lists of phenotypes to Python lists
      py_inclusions <- lapply(inclusions, function(x) {
        if (inherits(x, "Phenotype")) x$py_object else x
      })
      py_exclusions <- lapply(exclusions, function(x) {
        if (inherits(x, "Phenotype")) x$py_object else x
      })
      
      # Convert index phenotype if provided
      py_index <- if (is.null(index_phenotype)) NULL else {
        if (inherits(index_phenotype, "Phenotype")) index_phenotype$py_object else index_phenotype
      }
      
      self$py_object <- phenex_env$phenotypes$Cohort(
        name = name,
        inclusions = py_inclusions,
        exclusions = py_exclusions,
        index_phenotype = py_index,
        description = description,
        ...
      )
    },
    
    #' @description
    #' Execute the cohort definition against provided tables
    #' @param tables Named list of tables
    #' @return CohortResult object
    execute = function(tables) {
      if (is.list(tables)) {
        # Convert R list to Python dict, handling PhenexTable objects
        py_tables <- list()
        for (name in names(tables)) {
          if (inherits(tables[[name]], "PhenexTable")) {
            py_tables[[name]] <- tables[[name]]$py_object
          } else {
            py_tables[[name]] <- tables[[name]]
          }
        }
        py_tables <- reticulate::dict(py_tables)
      } else {
        py_tables <- tables
      }
      
      result_py <- self$py_object$execute(py_tables)
      
      # Wrap result in R CohortResult class
      result <- CohortResult$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Get the name of the cohort
    #' @return Character string
    get_name = function() {
      self$py_object$name
    },
    
    #' @description
    #' Get the description of the cohort
    #' @return Character string
    get_description = function() {
      self$py_object$description
    },
    
    #' @description
    #' Get all inclusion phenotypes
    #' @return List of Phenotype objects
    get_inclusions = function() {
      py_inclusions <- self$py_object$inclusions
      r_inclusions <- list()
      
      for (i in seq_along(reticulate::py_to_r(py_inclusions))) {
        phenotype <- Phenotype$new()
        phenotype$py_object <- py_inclusions[[i-1]]  # Python 0-indexed
        r_inclusions[[i]] <- phenotype
      }
      
      r_inclusions
    },
    
    #' @description
    #' Get all exclusion phenotypes
    #' @return List of Phenotype objects
    get_exclusions = function() {
      py_exclusions <- self$py_object$exclusions
      r_exclusions <- list()
      
      for (i in seq_along(reticulate::py_to_r(py_exclusions))) {
        phenotype <- Phenotype$new()
        phenotype$py_object <- py_exclusions[[i-1]]  # Python 0-indexed
        r_exclusions[[i]] <- phenotype
      }
      
      r_exclusions
    },
    
    #' @description
    #' Add an inclusion phenotype
    #' @param phenotype Phenotype object to add
    add_inclusion = function(phenotype) {
      if (!inherits(phenotype, "Phenotype")) {
        stop("phenotype must be a Phenotype object")
      }
      
      self$py_object$add_inclusion(phenotype$py_object)
      invisible(self)
    },
    
    #' @description
    #' Add an exclusion phenotype
    #' @param phenotype Phenotype object to add
    add_exclusion = function(phenotype) {
      if (!inherits(phenotype, "Phenotype")) {
        stop("phenotype must be a Phenotype object")
      }
      
      self$py_object$add_exclusion(phenotype$py_object)
      invisible(self)
    },
    
    #' @description
    #' Get all codelists used in the cohort
    #' @param to_data_frame Whether to return as data.frame
    #' @return List of Codelist objects or data.frame
    get_codelists = function(to_data_frame = FALSE) {
      py_codelists <- self$py_object$get_codelists(to_pandas = to_data_frame)
      
      if (to_data_frame) {
        return(reticulate::py_to_r(py_codelists))
      } else {
        # Convert Python list to R list of Codelist objects
        r_codelists <- list()
        py_list <- reticulate::py_to_r(py_codelists)
        for (i in seq_along(py_list)) {
          codelist <- Codelist$new()
          codelist$py_object <- py_list[[i]]
          r_codelists[[i]] <- codelist
        }
        return(r_codelists)
      }
    },
    
    #' @description
    #' Print the cohort
    print = function() {
      cat("Cohort:", self$get_name(), "\n")
      if (!is.null(self$get_description())) {
        cat("Description:", self$get_description(), "\n")
      }
      cat("Inclusions:", length(self$get_inclusions()), "\n")
      cat("Exclusions:", length(self$get_exclusions()), "\n")
      invisible(self)
    }
  )
)

#' CohortResult Class
#'
#' R6 class representing the result of executing a cohort
#'
#' @export
CohortResult <- R6::R6Class(
  "CohortResult",
  
  public = list(
    #' @field py_object The underlying Python cohort result object
    py_object = NULL,
    
    #' @description
    #' Initialize CohortResult (usually created by Cohort$execute())
    initialize = function() {
      # Usually instantiated with py_object set externally
    },
    
    #' @description
    #' Get the final cohort table
    #' @return PhenotypeTable object
    get_cohort = function() {
      result_py <- self$py_object$get_cohort()
      result <- PhenotypeTable$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Convert cohort to data.frame
    #' @param limit Maximum number of rows
    #' @return data.frame
    to_data_frame = function(limit = NULL) {
      cohort <- self$get_cohort()
      cohort$to_data_frame(limit = limit)
    },
    
    #' @description
    #' Get first few rows of cohort
    #' @param n Number of rows
    #' @return data.frame
    head = function(n = 6) {
      cohort <- self$get_cohort()
      cohort$head(n = n)
    },
    
    #' @description
    #' Count patients in final cohort
    #' @return Integer
    count = function() {
      cohort <- self$get_cohort()
      cohort$count()
    },
    
    #' @description
    #' Get inclusions/exclusions table
    #' @return data.frame showing how many patients were included/excluded at each step
    get_exclusions_table = function() {
      if (reticulate::py_hasattr(self$py_object, "get_exclusions_table")) {
        result_py <- self$py_object$get_exclusions_table()
        return(reticulate::py_to_r(result_py$to_pandas()))
      } else {
        warning("Exclusions table not available for this cohort result")
        return(NULL)
      }
    },
    
    #' @description
    #' Print cohort result summary
    print = function() {
      cat("CohortResult\n")
      cat("Patients in final cohort:", self$count(), "\n")
      
      # Try to show exclusions table if available
      tryCatch({
        exclusions <- self$get_exclusions_table()
        if (!is.null(exclusions)) {
          cat("\nInclusions/Exclusions:\n")
          print(exclusions)
        }
      }, error = function(e) {
        # Silently continue if exclusions table not available
      })
      
      invisible(self)
    }
  )
)

#' Subcohort Class
#'
#' R6 class wrapping PhenEx Python Subcohort functionality
#'
#' @export
Subcohort <- R6::R6Class(
  "Subcohort",
  inherit = Cohort,
  
  public = list(
    #' @description
    #' Create a new Subcohort
    #' @param parent_cohort The parent cohort to create subcohort from
    #' @param name Name of the subcohort
    #' @param additional_inclusions Additional inclusion criteria
    #' @param additional_exclusions Additional exclusion criteria
    #' @param ... Additional arguments
    initialize = function(parent_cohort, name, additional_inclusions = list(),
                         additional_exclusions = list(), ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      if (!inherits(parent_cohort, "Cohort")) {
        stop("parent_cohort must be a Cohort object")
      }
      
      # Convert additional criteria to Python objects
      py_add_inclusions <- lapply(additional_inclusions, function(x) {
        if (inherits(x, "Phenotype")) x$py_object else x
      })
      py_add_exclusions <- lapply(additional_exclusions, function(x) {
        if (inherits(x, "Phenotype")) x$py_object else x
      })
      
      self$py_object <- phenex_env$phenotypes$Subcohort(
        parent_cohort = parent_cohort$py_object,
        name = name,
        additional_inclusions = py_add_inclusions,
        additional_exclusions = py_add_exclusions,
        ...
      )
    }
  )
)

#' Create a simple cohort
#'
#' Convenience function to create a cohort with basic inclusion/exclusion criteria
#'
#' @param name Cohort name
#' @param inclusions List of inclusion phenotypes
#' @param exclusions List of exclusion phenotypes
#' @param description Optional description
#' @return Cohort object
#' @export
create_cohort <- function(name, inclusions = list(), exclusions = list(), description = NULL) {
  Cohort$new(
    name = name,
    inclusions = inclusions,
    exclusions = exclusions,
    description = description
  )
}