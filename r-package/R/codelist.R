#' Codelist Class
#'
#' R6 class wrapping PhenEx Python Codelist functionality with automatic method forwarding
#'
#' @description
#' Codelist is a class that allows convenient work with medical codes used in RWD analyses.
#' A Codelist represents a specific medical concept, such as 'atrial fibrillation' or 
#' 'myocardial infarction'. A Codelist is associated with a set of medical codes from 
#' one or multiple source vocabularies (such as ICD10CM or CPT).
#'
#' This R6 class automatically forwards all public methods from the Python Codelist class.
#'
#' @export
Codelist <- R6::R6Class(
  "Codelist",
  
  public = list(
    #' @field py_object The underlying Python Codelist object
    py_object = NULL,
    
    #' @description
    #' Create a new Codelist
    #' @param codelist Named list of code types to codes, or unnamed vector of codes, or name string
    #' @param name Name of the codelist (when codelist is codes)
    #' @param py_object Existing Python Codelist object to wrap (internal use)
    #' @param ... Additional arguments
    initialize = function(codelist = NULL, name = NULL, py_object = NULL, ...) {
      if (is.null(phenex_env$codelists)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      # If py_object is provided, just wrap it (for internal use)
      if (!is.null(py_object)) {
        self$py_object <- py_object
        return()
      }
      
      # Handle R-style usage: Codelist$new("diabetes", c("E10", "E11"))
      # where first arg is name and second is codes
      if (is.character(codelist) && length(codelist) == 1 && !is.null(name) && is.character(name)) {
        temp_name <- codelist
        codelist <- name
        name <- temp_name
      }
      
      # Convert R list/vector to Python format
      if (is.null(codelist)) {
        py_codelist <- NULL
      } else if (is.list(codelist) && !is.null(names(codelist))) {
        # Named list: convert to Python dict
        py_codelist <- reticulate::dict(codelist)
      } else {
        # Unnamed vector: convert to Python list
        py_codelist <- reticulate::r_to_py(as.list(codelist))
      }
      
      self$py_object <- phenex_env$codelists$Codelist(
        codelist = py_codelist,
        name = name,
        ...
      )
    },
    
    #' @description
    #' Call a Python method on the underlying object
    #' @param method_name Name of the method to call
    #' @param ... Arguments to pass to the method
    call_method = function(method_name, ...) {
      if (is.null(self$py_object)) {
        stop("Python object not initialized")
      }
      
      if (!reticulate::py_has_attr(self$py_object, method_name)) {
        stop("Method '", method_name, "' not found on Python Codelist object")
      }
      
      result <- self$py_object[[method_name]](...)
      
      # If result is a Python Codelist, wrap it in an R Codelist
      if (inherits(result, "python.builtin.object") && 
          reticulate::py_has_attr(result, "__class__") &&
          reticulate::py_str(result$`__class__`$`__name__`) == "Codelist") {
        return(Codelist$new(py_object = result))
      }
      
      # Otherwise convert to R object
      reticulate::py_to_r(result)
    },
    
    #' @description
    #' Copy the codelist with optional modifications
    #' @param name New name for the copy (optional)
    #' @param use_code_type Whether to use code types (default TRUE)
    #' @param remove_punctuation Whether to remove punctuation (default FALSE)
    #' @param rename_code_type Dictionary for renaming code types (optional)
    #' @return New Codelist object
    copy = function(name = NULL, use_code_type = TRUE, remove_punctuation = FALSE, rename_code_type = NULL) {
      self$call_method("copy", name = name, use_code_type = use_code_type, 
                      remove_punctuation = remove_punctuation, rename_code_type = rename_code_type)
    },
    
    #' @description
    #' Convert to list of codes
    #' @return List of all codes
    to_list = function() {
      self$call_method("to_list")
    },
    
    #' @description
    #' Convert to dictionary format
    #' @return Named list representation
    to_dict = function() {
      self$call_method("to_dict")
    },
    
    #' @description
    #' Convert to pandas DataFrame
    #' @return data.frame with columns: code_type, code, codelist
    to_pandas = function() {
      self$call_method("to_pandas")
    },
    
    #' @description
    #' Convert to tuples format
    #' @return List of tuples (code_type, code)
    to_tuples = function() {
      self$call_method("to_tuples")
    },
    
    #' @description
    #' Print the codelist
    print = function() {
      if (is.null(self$py_object)) {
        cat("Codelist: <uninitialized>\n")
        return(invisible(self))
      }
      
      # Try to get a nice representation
      tryCatch({
        # Extract just the codes for a simple display
        all_codes <- c()
        codelist_dict <- reticulate::py_to_r(self$py_object$codelist)
        for (code_type in names(codelist_dict)) {
          all_codes <- c(all_codes, codelist_dict[[code_type]])
        }
        
        cat("Codelist:", paste(all_codes, collapse = " "), "\n")
        cat("Codes:", length(all_codes), "total\n")
        if (!is.null(self$py_object$name)) {
          cat("   :", self$py_object$name, "\n")
        }
      }, error = function(e) {
        # Fallback to Python repr
        cat(reticulate::py_str(self$py_object), "\n")
      })
      
      invisible(self)
    }
  ),
  
  active = list(
    #' @field name Name of the codelist
    name = function(value) {
      if (missing(value)) {
        if (is.null(self$py_object)) return(NULL)
        self$py_object$name
      } else {
        if (!is.null(self$py_object)) {
          self$py_object$name <- value
        }
        invisible(self)
      }
    },
    
    #' @field codes List of all codes in the codelist
    codes = function() {
      if (is.null(self$py_object)) return(NULL)
      tryCatch({
        reticulate::py_to_r(self$py_object$to_list())
      }, error = function(e) {
        NULL
      })
    },
    
    #' @field codelist Raw codelist dictionary
    codelist = function() {
      if (is.null(self$py_object)) return(NULL)
      reticulate::py_to_r(self$py_object$codelist)
    }
  )
)

# Operator overloading for Codelist objects
#' @export
`+.Codelist` <- function(e1, e2) {
  if (!inherits(e1, "Codelist") || !inherits(e2, "Codelist")) {
    stop("Both operands must be Codelist objects")
  }
  
  # Use Python's __add__ method
  result_py <- e1$py_object$`__add__`(e2$py_object)
  Codelist$new(py_object = result_py)
}

#' @export
`-.Codelist` <- function(e1, e2) {
  if (!inherits(e1, "Codelist") || !inherits(e2, "Codelist")) {
    stop("Both operands must be Codelist objects")
  }
  
  # Use Python's __sub__ method
  result_py <- e1$py_object$`__sub__`(e2$py_object)
  Codelist$new(py_object = result_py)
}

# Class methods - these need to be separate functions since R6 doesn't support class methods well

#' Create Codelist from Excel file
#'
#' @param path Path to Excel file
#' @param sheet_name Optional sheet name
#' @param codelist_name Optional codelist name
#' @param code_column Name of code column (default "code")
#' @param code_type_column Name of code type column (default "code_type")
#' @param codelist_column Name of codelist column (default "codelist")
#' @return Codelist object
#' @export
codelist_from_excel <- function(path, sheet_name = NULL, codelist_name = NULL, 
                                code_column = "code", code_type_column = "code_type", 
                                codelist_column = "codelist") {
  if (is.null(phenex_env$codelists)) {
    stop("PhenEx not initialized. Call phenex_initialize() first.")
  }
  
  result_py <- phenex_env$codelists$Codelist$from_excel(
    path = path,
    sheet_name = sheet_name,
    codelist_name = codelist_name,
    code_column = code_column,
    code_type_column = code_type_column,
    codelist_column = codelist_column
  )
  
}

#' Create Codelist from YAML file
#'
#' @param path Path to YAML file
#' @return Codelist object
#' @export
codelist_from_yaml <- function(path) {
  if (is.null(phenex_env$codelists)) {
    stop("PhenEx not initialized. Call phenex_initialize() first.")
  }
  
  result_py <- phenex_env$codelists$Codelist$from_yaml(path)
  
}

#' Create Codelist from CSV file
#'
#' @param path Path to CSV file
#' @param codelist_name Optional codelist name
#' @param code_column Name of code column (default "code")
#' @param code_type_column Name of code type column (default "code_type")
#' @param codelist_column Name of codelist column (default "codelist")
#' @return Codelist object
#' @export
codelist_from_csv <- function(path, codelist_name = NULL, code_column = "code", 
                              code_type_column = "code_type", codelist_column = "codelist") {
  if (is.null(phenex_env$codelists)) {
    stop("PhenEx not initialized. Call phenex_initialize() first.")
  }
  
  result_py <- phenex_env$codelists$Codelist$from_csv(
    path = path,
    codelist_name = codelist_name,
    code_column = code_column,
    code_type_column = code_type_column,
    codelist_column = codelist_column
  )
  
}