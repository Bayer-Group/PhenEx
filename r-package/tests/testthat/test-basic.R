test_that("PhenEx initialization works", {
  skip_if_not(reticulate::py_available(), "Python not available")
  
  # Test basic availability check
  expect_true(is.logical(phenex_available()))
  
  # If PhenEx is available, test initialization
  if (phenex_available()) {
    expect_silent(phenex_initialize())
    expect_true(is.character(phenex_version()))
  }
})

test_that("Codelist creation works", {
  skip_if_not(phenex_available(), "PhenEx not available")
  
  # Test simple codelist creation
  codelist <- Codelist$new(
    codelist = list("ICD10" = c("E11", "E11.9")),
    name = "diabetes"
  )
  
  expect_s3_class(codelist, "Codelist")
  expect_equal(codelist$get_name(), "diabetes")
  expect_true(length(codelist$to_tuples()) > 0)
})

test_that("Basic phenotype creation works", {
  skip_if_not(phenex_available(), "PhenEx not available")
  
  # Test age phenotype
  age <- AgePhenotype$new()
  expect_s3_class(age, "AgePhenotype")
  expect_s3_class(age, "Phenotype")
  
  # Test sex phenotype
  sex <- SexPhenotype$new()
  expect_s3_class(sex, "SexPhenotype")
  expect_s3_class(sex, "Phenotype")
})

test_that("CodelistPhenotype creation works", {
  skip_if_not(phenex_available(), "PhenEx not available")
  
  codelist <- Codelist$new(
    codelist = list("SNOMED" = c("313217")),
    name = "af"
  )
  
  phenotype <- CodelistPhenotype$new(
    domain = "CONDITION_OCCURRENCE",
    codelist = codelist,
    name = "atrial_fibrillation"
  )
  
  expect_s3_class(phenotype, "CodelistPhenotype")
  expect_s3_class(phenotype, "Phenotype")
  expect_equal(phenotype$get_name(), "atrial_fibrillation")
})

test_that("Utility functions work", {
  expect_true(is.logical(is_phenotype("not a phenotype")))
  expect_false(is_phenotype("not a phenotype"))
  
  expect_true(is.logical(is_codelist("not a codelist")))
  expect_false(is_codelist("not a codelist"))
  
  # Test convenience functions
  if (phenex_available()) {
    age <- common_phenotype("age")
    expect_s3_class(age, "AgePhenotype")
    
    diabetes_codes <- icd_codelist(c("E11", "E11.9"), "diabetes")
    expect_s3_class(diabetes_codes, "Codelist")
  }
})

test_that("Example data creation works", {
  example_data <- create_example_omop_data(n_patients = 10)
  
  expect_true(is.list(example_data))
  expect_true("PERSON" %in% names(example_data))
  expect_true("CONDITION_OCCURRENCE" %in% names(example_data))
  expect_true("MEASUREMENT" %in% names(example_data))
  
  expect_equal(nrow(example_data$PERSON), 10)
  expect_true(nrow(example_data$CONDITION_OCCURRENCE) > 0)
  expect_true(nrow(example_data$MEASUREMENT) > 0)
})

# Integration test with example workflow
test_that("Example workflow runs without errors", {
  skip_if_not(phenex_available(), "PhenEx not available")
  skip_on_cran()  # Skip on CRAN due to complexity
  
  expect_silent({
    results <- phenex_example_workflow(use_example_data = TRUE)
  })
  
  expect_true(is.list(results))
})