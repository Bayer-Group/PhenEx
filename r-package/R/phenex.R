#' @title R Interface to PhenEx
#' @description This package provides R bindings for the PhenEx Python library
#' @name phenexr
#' @docType package
#' @importFrom reticulate import py_config py_available py_module_available
#' @importFrom R6 R6Class
#' @importFrom jsonlite fromJSON toJSON
NULL

# Package environment to store Python modules
phenex_env <- new.env(parent = emptyenv())

#' Initialize PhenEx Python Environment
#'
#' Sets up the Python environment and imports required PhenEx modules.
#' This function is called automatically when the package is loaded.
#'
#' @param python_path Optional path to Python executable
#' @param virtualenv Optional name or path to virtual environment
#' @param conda Optional name of conda environment
#' @export
phenex_initialize <- function(python_path = NULL, virtualenv = NULL, conda = NULL) {
  
  # Configure Python environment
  if (!is.null(virtualenv)) {
    reticulate::use_virtualenv(virtualenv, required = TRUE)
  } else if (!is.null(conda)) {
    reticulate::use_condaenv(conda, required = TRUE)
  } else if (!is.null(python_path)) {
    reticulate::use_python(python_path, required = TRUE)
  }
  
  # Check if Python is available
  if (!reticulate::py_available()) {
    stop("Python is not available. Please install Python >= 3.12 and the phenex package.")
  }
  
  # Check if phenex is available
  if (!reticulate::py_module_available("phenex")) {
    stop("PhenEx Python package is not available. Please install it using: pip install phenex")
  }
  
  # Import main PhenEx modules
  tryCatch({
    phenex_env$phenex <- reticulate::import("phenex", delay_load = TRUE)
    phenex_env$phenotypes <- reticulate::import("phenex.phenotypes", delay_load = TRUE)
    phenex_env$codelists <- reticulate::import("phenex.codelists", delay_load = TRUE)
    phenex_env$filters <- reticulate::import("phenex.filters", delay_load = TRUE)
    phenex_env$mappers <- reticulate::import("phenex.mappers", delay_load = TRUE)
    phenex_env$tables <- reticulate::import("phenex.tables", delay_load = TRUE)
    phenex_env$ibis_connect <- reticulate::import("phenex.ibis_connect", delay_load = TRUE)
    phenex_env$aggregators <- reticulate::import("phenex.aggregators", delay_load = TRUE)
    
    message("PhenEx Python environment initialized successfully")
    return(invisible(TRUE))
  }, error = function(e) {
    stop(paste("Failed to import PhenEx modules:", e$message))
  })
}

#' Check PhenEx Installation
#'
#' Verifies that PhenEx is properly installed and accessible
#'
#' @return Logical indicating if PhenEx is available
#' @export
phenex_available <- function() {
  reticulate::py_module_available("phenex")
}

#' Get PhenEx Version
#'
#' Returns the version of the installed PhenEx Python package
#'
#' @return Character string with version number
#' @export
phenex_version <- function() {
  if (!phenex_available()) {
    stop("PhenEx is not available")
  }
  phenex_env$phenex$`__version__`
}

# Initialize when package is loaded
.onLoad <- function(libname, pkgname) {
  # Try to initialize automatically, but don't fail if Python/PhenEx isn't available
  tryCatch({
    phenex_initialize()
  }, error = function(e) {
    packageStartupMessage("PhenEx initialization deferred. Use phenex_initialize() to set up.")
  })
}