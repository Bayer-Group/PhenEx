#' Database Connection Classes
#'
#' R6 classes wrapping PhenEx Python database connector functionality

#' SnowflakeConnector Class
#'
#' @export
SnowflakeConnector <- R6::R6Class(
  "SnowflakeConnector",
  
  public = list(
    #' @field py_object The underlying Python SnowflakeConnector object
    py_object = NULL,
    
    #' @description
    #' Create a new SnowflakeConnector
    #' @param account Snowflake account name
    #' @param user Username
    #' @param password Password
    #' @param warehouse Warehouse name
    #' @param database Database name
    #' @param schema Schema name
    #' @param role Role name
    #' @param ... Additional connection parameters
    initialize = function(account = NULL, user = NULL, password = NULL,
                         warehouse = NULL, database = NULL, schema = NULL,
                         role = NULL, ...) {
      if (is.null(phenex_env$ibis_connect)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      self$py_object <- phenex_env$ibis_connect$SnowflakeConnector(
        account = account,
        user = user,
        password = password,
        warehouse = warehouse,
        database = database,
        schema = schema,
        role = role,
        ...
      )
    },
    
    #' @description
    #' Connect to the database
    #' @return Connection object
    connect = function() {
      self$py_object$connect()
    },
    
    #' @description
    #' Get connection info
    #' @return List with connection details
    get_info = function() {
      reticulate::py_to_r(self$py_object$get_info())
    }
  )
)

#' DuckDBConnector Class
#'
#' @export
DuckDBConnector <- R6::R6Class(
  "DuckDBConnector",
  
  public = list(
    #' @field py_object The underlying Python DuckDBConnector object
    py_object = NULL,
    
    #' @description
    #' Create a new DuckDBConnector
    #' @param database Path to DuckDB database file (or ":memory:" for in-memory)
    #' @param ... Additional connection parameters
    initialize = function(database = ":memory:", ...) {
      if (is.null(phenex_env$ibis_connect)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      self$py_object <- phenex_env$ibis_connect$DuckDBConnector(
        database = database,
        ...
      )
    },
    
    #' @description
    #' Connect to the database
    #' @return Connection object
    connect = function() {
      self$py_object$connect()
    }
  )
)

#' TableMapper Classes
#'
#' R6 classes wrapping PhenEx Python mapper functionality

#' OMOPDomains Class
#'
#' @export
OMOPDomains <- R6::R6Class(
  "OMOPDomains",
  
  public = list(
    #' @description
    #' Get mapped tables for OMOP CDM
    #' @param connection Database connection object
    #' @param schema Schema name (optional)
    #' @return Named list of mapped tables
    get_mapped_tables = function(connection, schema = NULL) {
      if (is.null(phenex_env$mappers)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      # Handle R6 connection objects
      if (inherits(connection, "SnowflakeConnector") || inherits(connection, "DuckDBConnector")) {
        py_connection <- connection$py_object$connect()
      } else {
        py_connection <- connection
      }
      
      py_tables <- phenex_env$mappers$OMOPDomains$get_mapped_tables(
        con = py_connection,
        schema = schema
      )
      
      # Convert to R list but keep Python objects for actual table operations
      tables <- reticulate::py_to_r(py_tables)
      
      # Wrap each table in R class if needed
      result <- list()
      for (name in names(tables)) {
        table_wrapper <- PhenexTable$new()
        table_wrapper$py_object <- tables[[name]]
        result[[name]] <- table_wrapper
      }
      
      result
    }
  )
)

#' PhenexTable Class
#'
#' R6 class wrapping PhenEx Python table functionality
#'
#' @export
PhenexTable <- R6::R6Class(
  "PhenexTable",
  
  public = list(
    #' @field py_object The underlying Python table object
    py_object = NULL,
    
    #' @description
    #' Initialize PhenexTable
    initialize = function() {
      # Usually instantiated with py_object set externally
    },
    
    #' @description
    #' Convert to data.frame
    #' @param limit Maximum number of rows
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
    #' Get column names
    #' @return Character vector
    colnames = function() {
      reticulate::py_to_r(self$py_object$columns)
    },
    
    #' @description
    #' Get table schema
    #' @return Schema information
    schema = function() {
      reticulate::py_to_r(self$py_object$schema())
    },
    
    #' @description
    #' Count rows
    #' @return Integer
    count = function() {
      as.integer(self$py_object$count()$execute())
    },
    
    #' @description
    #' Filter the table
    #' @param expr Filter expression
    #' @return PhenexTable object
    filter = function(expr) {
      result_py <- self$py_object$filter(expr)
      result <- PhenexTable$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Select columns
    #' @param ... Column names or expressions
    #' @return PhenexTable object
    select = function(...) {
      result_py <- self$py_object$select(...)
      result <- PhenexTable$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Join with another table
    #' @param other Another table
    #' @param ... Join parameters
    #' @return PhenexTable object
    join = function(other, ...) {
      if (inherits(other, "PhenexTable")) {
        other_py <- other$py_object
      } else {
        other_py <- other
      }
      
      result_py <- self$py_object$join(other_py, ...)
      result <- PhenexTable$new()
      result$py_object <- result_py
      result
    },
    
    #' @description
    #' Print table info
    print = function() {
      cat("PhenexTable\n")
      cat("Columns:", paste(self$colnames(), collapse = ", "), "\n")
      tryCatch({
        cat("Rows:", self$count(), "\n")
      }, error = function(e) {
        cat("Rows: Unable to count (", e$message, ")\n")
      })
      cat("\nSchema:\n")
      print(self$schema())
      invisible(self)
    }
  )
)

#' Create OMOP Domain Mapper
#'
#' Convenience function to create OMOP domain mapper
#' @return OMOPDomains object
#' @export
omop_domains <- function() {
  OMOPDomains$new()
}