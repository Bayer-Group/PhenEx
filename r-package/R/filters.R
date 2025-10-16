#' DateFilter Class
#'
#' R6 class wrapping PhenEx Python DateFilter functionality
#'
#' @export
DateFilter <- R6::R6Class(
  "DateFilter",
  
  public = list(
    #' @field py_object The underlying Python DateFilter object
    py_object = NULL,
    
    #' @description
    #' Create a new DateFilter
    #' @param min_date Minimum date (character, Date, or Value object)
    #' @param max_date Maximum date (character, Date, or Value object)
    #' @param ... Additional arguments
    initialize = function(min_date = NULL, max_date = NULL, ...) {
      if (is.null(phenex_env$filters)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      # Convert R dates to appropriate format
      if (inherits(min_date, "Date")) {
        min_date <- as.character(min_date)
      }
      if (inherits(max_date, "Date")) {
        max_date <- as.character(max_date)
      }
      
      self$py_object <- phenex_env$filters$DateFilter(
        min_date = min_date,
        max_date = max_date,
        ...
      )
    }
  )
)

#' RelativeTimeRangeFilter Class
#'
#' R6 class wrapping PhenEx Python RelativeTimeRangeFilter functionality
#'
#' @export
RelativeTimeRangeFilter <- R6::R6Class(
  "RelativeTimeRangeFilter",
  
  public = list(
    #' @field py_object The underlying Python RelativeTimeRangeFilter object
    py_object = NULL,
    
    #' @description
    #' Create a new RelativeTimeRangeFilter
    #' @param min_days Minimum days (Value object or numeric)
    #' @param max_days Maximum days (Value object or numeric)
    #' @param anchor_phenotype Phenotype to use as anchor/reference
    #' @param ... Additional arguments
    initialize = function(min_days = NULL, max_days = NULL, anchor_phenotype = NULL, ...) {
      if (is.null(phenex_env$filters)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      # Convert anchor_phenotype to Python object if needed
      py_anchor <- if (is.null(anchor_phenotype)) NULL else anchor_phenotype$py_object
      
      self$py_object <- phenex_env$filters$RelativeTimeRangeFilter(
        min_days = min_days,
        max_days = max_days,
        anchor_phenotype = py_anchor,
        ...
      )
    }
  )
)

#' CategoricalFilter Class
#'
#' R6 class wrapping PhenEx Python CategoricalFilter functionality
#'
#' @export
CategoricalFilter <- R6::R6Class(
  "CategoricalFilter",
  
  public = list(
    #' @field py_object The underlying Python CategoricalFilter object
    py_object = NULL,
    
    #' @description
    #' Create a new CategoricalFilter
    #' @param column_name Name of the column to filter on
    #' @param allowed_values Vector of allowed values
    #' @param domain Domain table to apply filter to
    #' @param ... Additional arguments
    initialize = function(column_name, allowed_values, domain, ...) {
      if (is.null(phenex_env$filters)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      # Convert R vector to Python list
      py_values <- reticulate::r_to_py(allowed_values)
      
      self$py_object <- phenex_env$filters$CategoricalFilter(
        column_name = column_name,
        allowed_values = py_values,
        domain = domain,
        ...
      )
    }
  )
)

#' ValueFilter Class
#'
#' R6 class wrapping PhenEx Python ValueFilter functionality
#'
#' @export
ValueFilter <- R6::R6Class(
  "ValueFilter",
  
  public = list(
    #' @field py_object The underlying Python ValueFilter object
    py_object = NULL,
    
    #' @description
    #' Create a new ValueFilter
    #' @param column_name Name of the column to filter on
    #' @param operator Comparison operator ('>', '<', '>=', '<=', '==', '!=')
    #' @param value Value to compare against
    #' @param ... Additional arguments
    initialize = function(column_name, operator, value, ...) {
      if (is.null(phenex_env$filters)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      self$py_object <- phenex_env$filters$ValueFilter(
        column_name = column_name,
        operator = operator,
        value = value,
        ...
      )
    }
  )
)

#' Value Class
#'
#' Helper class for creating value comparisons
#'
#' @export
Value <- R6::R6Class(
  "Value",
  
  public = list(
    #' @field py_object The underlying Python Value object
    py_object = NULL,
    
    #' @description
    #' Create a new Value comparison
    #' @param operator Comparison operator
    #' @param value Value to compare against
    initialize = function(operator, value) {
      if (is.null(phenex_env$filters)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      self$py_object <- phenex_env$filters$Value(operator, value)
    }
  )
)

#' Create Value comparison objects
#'
#' @param operator Comparison operator
#' @param value Value to compare
#' @return Value object
#' @export
value <- function(operator, value) {
  Value$new(operator, value)
}

#' Create "greater than" Value
#' @param value Value to compare
#' @return Value object
#' @export
gt <- function(value) {
  Value$new(">", value)
}

#' Create "less than" Value
#' @param value Value to compare
#' @return Value object
#' @export
lt <- function(value) {
  Value$new("<", value)
}

#' Create "greater than or equal" Value
#' @param value Value to compare
#' @return Value object
#' @export
gte <- function(value) {
  Value$new(">=", value)
}

#' Create "less than or equal" Value
#' @param value Value to compare
#' @return Value object
#' @export
lte <- function(value) {
  Value$new("<=", value)
}

#' Create "equal to" Value
#' @param value Value to compare
#' @return Value object
#' @export
eq <- function(value) {
  Value$new("==", value)
}

#' Create "not equal to" Value
#' @param value Value to compare
#' @return Value object
#' @export
neq <- function(value) {
  Value$new("!=", value)
}

#' Before (date helper)
#'
#' Create a "before" date filter
#' @param date Date string or Date object
#' @return Character with appropriate prefix
#' @export
Before <- function(date) {
  if (inherits(date, "Date")) {
    date <- as.character(date)
  }
  paste0("Before(", date, ")")
}

#' After (date helper)
#'
#' Create an "after" date filter
#' @param date Date string or Date object
#' @return Character with appropriate prefix
#' @export
After <- function(date) {
  if (inherits(date, "Date")) {
    date <- as.character(date)
  }
  paste0("After(", date, ")")
}