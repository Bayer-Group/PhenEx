#' CodelistPhenotype Class
#'
#' R6 class wrapping PhenEx Python CodelistPhenotype functionality
#'
#' @description
#' CodelistPhenotype extracts patients from a CodeTable based on a specified
#' codelist and other optional filters such as date range, relative time range
#' and categorical filters.
#'
#' @export
CodelistPhenotype <- R6::R6Class(
  "CodelistPhenotype",
  inherit = Phenotype,
  
  public = list(
    #' @description
    #' Create a new CodelistPhenotype
    #' @param domain The domain of the phenotype (e.g., "CONDITION_OCCURRENCE")
    #' @param codelist A Codelist object
    #' @param name Name of the phenotype (optional, derived from codelist if not provided)
    #' @param date_range A DateFilter object
    #' @param relative_time_range A RelativeTimeRangeFilter object or list of them
    #' @param return_date Whether to return 'first', 'last', 'nearest', or 'all' event dates
    #' @param return_value Which values to return (NULL or 'all')
    #' @param categorical_filter Additional categorical filters
    #' @param ... Additional arguments
    initialize = function(domain, codelist, name = NULL, date_range = NULL,
                         relative_time_range = NULL, return_date = "first",
                         return_value = NULL, categorical_filter = NULL, ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      if (!inherits(codelist, "Codelist")) {
        stop("codelist must be a Codelist object")
      }
      
      # Convert R objects to Python objects as needed
      py_date_range <- if (is.null(date_range)) NULL else date_range$py_object
      py_relative_time_range <- if (is.null(relative_time_range)) {
        NULL
      } else if (is.list(relative_time_range)) {
        lapply(relative_time_range, function(x) x$py_object)
      } else {
        relative_time_range$py_object
      }
      py_categorical_filter <- if (is.null(categorical_filter)) NULL else categorical_filter$py_object
      
      self$py_object <- phenex_env$phenotypes$CodelistPhenotype(
        domain = domain,
        codelist = codelist$py_object,
        name = name,
        date_range = py_date_range,
        relative_time_range = py_relative_time_range,
        return_date = return_date,
        return_value = return_value,
        categorical_filter = py_categorical_filter,
        ...
      )
    }
  )
)

#' MeasurementPhenotype Class
#'
#' R6 class wrapping PhenEx Python MeasurementPhenotype functionality
#'
#' @export
MeasurementPhenotype <- R6::R6Class(
  "MeasurementPhenotype",
  inherit = CodelistPhenotype,
  
  public = list(
    #' @description
    #' Create a new MeasurementPhenotype
    #' @param domain The domain of the phenotype
    #' @param codelist A Codelist object
    #' @param aggregator Aggregation method ('mean', 'median', 'first', 'last', etc.)
    #' @param ... Additional arguments passed to CodelistPhenotype
    initialize = function(domain, codelist, aggregator = "mean", ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      # Convert aggregator string to Python aggregator object if needed
      if (is.character(aggregator)) {
        py_aggregator <- switch(aggregator,
          "mean" = phenex_env$aggregators$Mean(),
          "median" = phenex_env$aggregators$Median(),
          "first" = phenex_env$aggregators$First(),
          "last" = phenex_env$aggregators$Last(),
          "min" = phenex_env$aggregators$Min(),
          "max" = phenex_env$aggregators$Max(),
          "sum" = phenex_env$aggregators$Sum(),
          "count" = phenex_env$aggregators$Count(),
          stop("Unknown aggregator: ", aggregator)
        )
      } else {
        py_aggregator <- aggregator$py_object
      }
      
      self$py_object <- phenex_env$phenotypes$MeasurementPhenotype(
        domain = domain,
        codelist = codelist$py_object,
        aggregator = py_aggregator,
        ...
      )
    }
  )
)

#' AgePhenotype Class
#'
#' R6 class wrapping PhenEx Python AgePhenotype functionality
#'
#' @export
AgePhenotype <- R6::R6Class(
  "AgePhenotype",
  inherit = Phenotype,
  
  public = list(
    #' @description
    #' Create a new AgePhenotype
    #' @param name Name of the phenotype
    #' @param ... Additional arguments
    initialize = function(name = "age", ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      self$py_object <- phenex_env$phenotypes$AgePhenotype(
        name = name,
        ...
      )
    }
  )
)

#' SexPhenotype Class
#'
#' R6 class wrapping PhenEx Python SexPhenotype functionality
#'
#' @export
SexPhenotype <- R6::R6Class(
  "SexPhenotype",
  inherit = Phenotype,
  
  public = list(
    #' @description
    #' Create a new SexPhenotype
    #' @param name Name of the phenotype
    #' @param ... Additional arguments
    initialize = function(name = "sex", ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      self$py_object <- phenex_env$phenotypes$SexPhenotype(
        name = name,
        ...
      )
    }
  )
)

#' BinPhenotype Class
#'
#' R6 class wrapping PhenEx Python BinPhenotype functionality
#'
#' @export
BinPhenotype <- R6::R6Class(
  "BinPhenotype",
  inherit = Phenotype,
  
  public = list(
    #' @description
    #' Create a new BinPhenotype
    #' @param phenotype The phenotype to bin
    #' @param bins Numeric vector of bin edges or named list for discrete mapping
    #' @param name Name of the phenotype
    #' @param ... Additional arguments
    initialize = function(phenotype, bins, name = NULL, ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      if (!inherits(phenotype, "Phenotype")) {
        stop("phenotype must be a Phenotype object")
      }
      
      # Convert bins to appropriate Python format
      if (is.numeric(bins)) {
        py_bins <- reticulate::r_to_py(bins)
      } else if (is.list(bins)) {
        py_bins <- reticulate::dict(bins)
      } else {
        py_bins <- bins
      }
      
      self$py_object <- phenex_env$phenotypes$BinPhenotype(
        phenotype = phenotype$py_object,
        bins = py_bins,
        name = name,
        ...
      )
    }
  )
)

#' EventCountPhenotype Class
#'
#' R6 class wrapping PhenEx Python EventCountPhenotype functionality
#'
#' @export
EventCountPhenotype <- R6::R6Class(
  "EventCountPhenotype",
  inherit = Phenotype,
  
  public = list(
    #' @description
    #' Create a new EventCountPhenotype
    #' @param phenotype The phenotype to count events for
    #' @param name Name of the phenotype
    #' @param ... Additional arguments
    initialize = function(phenotype, name = NULL, ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      if (!inherits(phenotype, "Phenotype")) {
        stop("phenotype must be a Phenotype object")
      }
      
      self$py_object <- phenex_env$phenotypes$EventCountPhenotype(
        phenotype = phenotype$py_object,
        name = name,
        ...
      )
    }
  )
)

#' DeathPhenotype Class
#'
#' R6 class wrapping PhenEx Python DeathPhenotype functionality
#'
#' @export
DeathPhenotype <- R6::R6Class(
  "DeathPhenotype",
  inherit = Phenotype,
  
  public = list(
    #' @description
    #' Create a new DeathPhenotype
    #' @param name Name of the phenotype
    #' @param ... Additional arguments
    initialize = function(name = "death", ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      self$py_object <- phenex_env$phenotypes$DeathPhenotype(
        name = name,
        ...
      )
    }
  )
)

#' ArithmeticPhenotype Class
#'
#' R6 class wrapping PhenEx Python ArithmeticPhenotype functionality
#'
#' @export
ArithmeticPhenotype <- R6::R6Class(
  "ArithmeticPhenotype",
  inherit = Phenotype,
  
  public = list(
    #' @description
    #' Create a new ArithmeticPhenotype
    #' @param left_phenotype Left phenotype in the operation
    #' @param right_phenotype Right phenotype in the operation
    #' @param operation Operation to perform ('+', '-', '*', '/')
    #' @param name Name of the phenotype
    #' @param ... Additional arguments
    initialize = function(left_phenotype, right_phenotype, operation, name = NULL, ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      if (!inherits(left_phenotype, "Phenotype")) {
        stop("left_phenotype must be a Phenotype object")
      }
      if (!inherits(right_phenotype, "Phenotype")) {
        stop("right_phenotype must be a Phenotype object")
      }
      
      self$py_object <- phenex_env$phenotypes$ArithmeticPhenotype(
        left_phenotype = left_phenotype$py_object,
        right_phenotype = right_phenotype$py_object,
        operation = operation,
        name = name,
        ...
      )
    }
  )
)

#' LogicPhenotype Class
#'
#' R6 class wrapping PhenEx Python LogicPhenotype functionality
#'
#' @export
LogicPhenotype <- R6::R6Class(
  "LogicPhenotype",
  inherit = Phenotype,
  
  public = list(
    #' @description
    #' Create a new LogicPhenotype
    #' @param left_phenotype Left phenotype in the operation
    #' @param right_phenotype Right phenotype in the operation (NULL for unary operations)
    #' @param operation Logical operation ('&', '|', '~')
    #' @param name Name of the phenotype
    #' @param ... Additional arguments
    initialize = function(left_phenotype, right_phenotype = NULL, operation, name = NULL, ...) {
      if (is.null(phenex_env$phenotypes)) {
        stop("PhenEx not initialized. Call phenex_initialize() first.")
      }
      
      if (!inherits(left_phenotype, "Phenotype")) {
        stop("left_phenotype must be a Phenotype object")
      }
      if (!is.null(right_phenotype) && !inherits(right_phenotype, "Phenotype")) {
        stop("right_phenotype must be a Phenotype object or NULL")
      }
      
      py_right <- if (is.null(right_phenotype)) NULL else right_phenotype$py_object
      
      self$py_object <- phenex_env$phenotypes$LogicPhenotype(
        left_phenotype = left_phenotype$py_object,
        right_phenotype = py_right,
        operation = operation,
        name = name,
        ...
      )
    }
  )
)