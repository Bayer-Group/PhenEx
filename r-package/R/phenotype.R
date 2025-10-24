#' Base Phenotype Class
#'
#' R6 class wrapping PhenEx Python Phenotype functionality
#'
#' @description
#' A phenotype is a description of the state of a person at a specific time.
#' In PhenEx, phenotypes are implemented using the Phenotype class with clear
#' separation between the "what" (phenotype definition) and the "how" (execution).
#'
#' @export
Phenotype <- R6::R6Class(
  "Phenotype",
  
  public = list(
    #' @field py_object The underlying Python Phenotype object
    py_object = NULL,
    
    #' @description
    #' Create a new Phenotype (base class)
    #' @param description Plain text description of the phenotype
    #' @param name Name of the phenotype
    #' @param ... Additional arguments
    initialize = function(description = NULL, name = NULL, ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      self$py_object <- phenex_env$phenotypes$Phenotype(
        description = description,
        name = name,
        ...
      )
    },
    
    #' @description
    #' Execute the phenotype against provided tables
    #' @param tables Named list of tables (or Python dict)
    #' @return PhenotypeTable object
    execute = function(tables) {
      if (is.list(tables)) {
        tables <- reticulate::dict(tables)
      }
      result_py <- self$py_object$execute(tables)
      
      # Wrap result in R PhenotypeTable class
      result <- PhenotypeTable$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Get the name of the phenotype
    #' @return Character string
    get_name = function() {
      self$py_object$name
    },
    
    #' @description
    #' Set the name of the phenotype
    #' @param name New name
    set_name = function(name) {
      self$py_object$name <- name
      invisible(self)
    },
    
    #' @description
    #' Get the description of the phenotype
    #' @return Character string
    get_description = function() {
      self$py_object$description
    },
    
    #' @description
    #' Get display name (formatted version of name)
    #' @return Character string
    get_display_name = function() {
      self$py_object$display_name
    },
    
    #' @description
    #' Get all codelists used in this phenotype
    #' @param to_data_frame Logical, whether to return as data.frame
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
    #' Convert phenotype to dictionary/list representation
    #' @return Named list
    to_list = function() {
      reticulate::py_to_r(self$py_object$to_dict())
    },
    
    #' @description
    #' Combine phenotypes with OR logic
    #' @param other Another Phenotype object
    #' @return ComputationGraph object
    or = function(other) {
      if (!inherits(other, "Phenotype")) {
        stop("other must be a Phenotype object")
      }
      result_py <- self$py_object$`__or__`(other$py_object)
      
      result <- ComputationGraph$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Negate the phenotype (NOT logic)
    #' @return ComputationGraph object
    not = function() {
      result_py <- self$py_object$`__invert__`()
      
      result <- ComputationGraph$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Add phenotypes (arithmetic combination)
    #' @param other Another Phenotype object
    #' @return ComputationGraph object
    add = function(other) {
      if (!inherits(other, "Phenotype")) {
        stop("other must be a Phenotype object")
      }
      result_py <- self$py_object$`__add__`(other$py_object)
      
      result <- ComputationGraph$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Subtract phenotypes (arithmetic combination)
    #' @param other Another Phenotype object
    #' @return ComputationGraph object
    subtract = function(other) {
      if (!inherits(other, "Phenotype")) {
        stop("other must be a Phenotype object")
      }
      result_py <- self$py_object$`__sub__`(other$py_object)
      
      result <- ComputationGraph$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Multiply phenotypes (arithmetic combination)
    #' @param other Another Phenotype object
    #' @return ComputationGraph object
    multiply = function(other) {
      if (!inherits(other, "Phenotype")) {
        stop("other must be a Phenotype object")
      }
      result_py <- self$py_object$`__mul__`(other$py_object)
      
      result <- ComputationGraph$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Print the phenotype
    print = function() {
      cat("Phenotype:", self$get_name() %||% "unnamed", "\n")
      if (!is.null(self$get_description())) {
        cat("Description:", self$get_description(), "\n")
      }
      cat("Class:", class(self$py_object)[1], "\n")
      invisible(self)
    }
  )
)

#' PhenotypeTable Class
#'
#' R6 class wrapping PhenEx Python PhenotypeTable functionality
#'
#' @export
PhenotypeTable <- R6::R6Class(
  "PhenotypeTable",
  
  public = list(
    #' @field py_object The underlying Python PhenotypeTable object
    py_object = NULL,
    
    #' @description
    #' Initialize PhenotypeTable (usually created by Phenotype$execute())
    initialize = function() {
      # Usually instantiated with py_object set externally
    },
    
    #' @description
    #' Convert to data.frame
    #' @param limit Maximum number of rows to return
    #' @return data.frame
    to_data_frame = function(limit = NULL) {
      if (is.null(limit)) {
        reticulate::py_to_r(self$py_object$to_pandas())
      } else {
        reticulate::py_to_r(self$py_object$limit(as.integer(limit))$to_pandas())
      }
    },
    
    #' @description
    #' Get first few rows
    #' @param n Number of rows
    #' @return data.frame
    head = function(n = 6) {
      reticulate::py_to_r(self$py_object$head(as.integer(n))$to_pandas())
    },
    
    #' @description
    #' Get number of rows
    #' @return Integer
    count = function() {
      as.integer(self$py_object$count()$execute())
    },
    
    #' @description
    #' Get column names
    #' @return Character vector
    colnames = function() {
      reticulate::py_to_r(self$py_object$columns)
    },
    
    #' @description
    #' Filter the table
    #' @param expr Filter expression (passed to Python)
    #' @return PhenotypeTable object
    filter = function(expr) {
      result_py <- self$py_object$filter(expr)
      result <- PhenotypeTable$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Join with another table
    #' @param other Another PhenotypeTable or table object
    #' @param ... Additional arguments passed to join
    #' @return PhenotypeTable object
    join = function(other, ...) {
      if (inherits(other, "PhenotypeTable")) {
        other_py <- other$py_object
      } else {
        other_py <- other
      }
      
      result_py <- self$py_object$join(other_py, ...)
      result <- PhenotypeTable$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Print the table
    print = function() {
      cat("PhenotypeTable\n")
      cat("Columns:", paste(self$colnames(), collapse = ", "), "\n")
      cat("Rows:", self$count(), "\n")
      cat("\nFirst few rows:\n")
      print(self$head())
      invisible(self)
    }
  )
)

#' ComputationGraph Class
#'
#' R6 class wrapping PhenEx Python ComputationGraph functionality
#'
#' @export
ComputationGraph <- R6::R6Class(
  "ComputationGraph",
  inherit = Phenotype,
  
  public = list(
    #' @description
    #' Initialize ComputationGraph (usually created by phenotype operations)
    initialize = function() {
      # Usually instantiated with py_object set externally
    }
  )
)