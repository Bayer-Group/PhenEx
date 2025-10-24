# PhenEx R Bindings - Interactive Cohort Example using DomainsMocker
# ================================================================
# 
# This INTERACTIVE example walks you through the PhenEx workflow step-by-step:
# 1. Generate mock OMOP data using DomainsMocker
# 2. Create medical codelists 
# 3. Define phenotypes
# 4. Build and execute cohorts
# 5. Generate professional waterfall reports
#
# Prerequisites:
# - phenexr package installed
# - Python virtual environment with PhenEx installed
# - See README.md for installation instructions
#
# SETUP REQUIRED:
# Update the python_path variable below to match your system:
# - macOS (Homebrew): "/opt/homebrew/bin/python3.12" or your venv path
# - macOS (system): "/usr/bin/python3" or your venv path  
# - Linux: "/usr/bin/python3" or your venv path
# - Virtual env: "/path/to/your/project/.venv/bin/python"

# Helper function for interactive prompts
wait_for_user <- function(message = "Press [Enter] to continue...") {
  cat("\n", message, "\n")
  invisible(readline())
}

# Helper function to display step headers
show_step <- function(step_num, title, description = "") {
  cat("\n")
  cat("=" %r% 60, "\n")
  cat("📋 STEP", step_num, ":", title, "\n")
  cat("=" %r% 60, "\n")
  if (description != "") {
    cat(description, "\n\n")
  }
}

# String repeat helper
`%r%` <- function(x, n) paste(rep(x, n), collapse = "")

cat("🚀 INTERACTIVE PhenEx R Bindings - Cohort Example\n")
cat("================================================\n")
cat("This tutorial will walk you through creating cohorts step-by-step.\n")
cat("You'll be prompted at each stage to review the results before continuing.\n\n")

wait_for_user("Ready to start? Press [Enter] to begin...")

# Load required libraries
cat("Loading required R libraries...\n")
library(reticulate)

# Load the phenexr package and initialize
cat("Loading phenexr package and initializing PhenEx...\n")
library(phenexr)
phenex_result <- phenex_initialize()
cat("✅ PhenEx initialization result:", phenex_result, "\n")

show_step(1, "SETUP MOCK OMOP DATA", 
  "We'll create realistic mock OMOP data with 100 patients for this tutorial.\n   This includes all standard OMOP tables with realistic relationships.")

wait_for_user("Ready to create mock data? Press [Enter] to continue...")

# Import required Python modules
cat("Importing PhenEx Python modules...\n")
mappers <- import("phenex.mappers")
sim <- import("phenex.sim")
phenotypes <- import("phenex.phenotypes")

# Create DomainsMocker with OMOPDomains (100 patients)
cat("📊 Creating DomainsMocker with 100 patients...\n")
cat("   (This will generate realistic OMOP data with proper relationships)\n")
domains_mocker <- sim$DomainsMocker(
  domains_dict = mappers$OMOPDomains,
  n_patients = 100L,
  random_seed = 42L
)

# Get mapped tables (already in PhenEx format)
cat("📋 Generating mapped tables...\n")
tables <- domains_mocker$get_mapped_tables()
cat("   ✅ Generated", length(tables), "OMOP tables\n")
cat("   📊 Available tables:", paste(names(tables), collapse = ", "), "\n")

# Show a sample of the data
cat("\n🔍 Let's peek at some of the generated data:\n")
person_table <- tables$PERSON$to_pandas()
person_r <- py_to_r(person_table)
cat("   Person table sample (first 3 patients):\n")
print(head(person_r[,1:5], 3))

wait_for_user("\nData generation complete! Press [Enter] to proceed to codelists...")

show_step(2, "CREATE MEDICAL CODELISTS", 
  "Medical codelists define the concept codes that identify conditions.\n   We'll create codelists for diabetes and atrial fibrillation using OMOP concept IDs.")

wait_for_user("Ready to create codelists? Press [Enter] to continue...")

# These are the actual concept IDs that DomainsMocker generates
cat("🏥 Creating diabetes codelist...\n")
diabetes_codelist <- Codelist$new("diabetes", c("201820"))  # Diabetes mellitus
cat("   ✅ Diabetes codelist created with concept ID:", diabetes_codelist$to_list()[[1]], "\n")

cat("\n💓 Creating atrial fibrillation codelist...\n")
af_codelist <- Codelist$new("atrial_fib", c("1569171", "4232691", "4154290"))  # Multiple AF codes
cat("   ✅ Atrial fibrillation codelist created with", length(af_codelist$to_list()[[1]]), "concept IDs\n")
cat("   📋 AF Codes:", paste(af_codelist$to_list()[[1]], collapse = ", "), "\n")

cat("\n💡 What are codelists?\n")
cat("   Codelists map clinical concepts to standardized codes (like OMOP concept IDs)\n")
cat("   They allow us to identify patients with specific conditions in the data\n")

wait_for_user("\nCodelists created! Press [Enter] to proceed to phenotype creation...")

show_step(3, "CREATE PHENOTYPES", 
  "Phenotypes combine codelists with data domains to identify patients.\n   We'll create phenotypes for diabetes and atrial fibrillation conditions.")

wait_for_user("Ready to create phenotypes? Press [Enter] to continue...")

# Create condition-based phenotypes using R6 wrapper
cat("🔬 Creating diabetes phenotype...\n")
cat("   This will search the CONDITION_OCCURRENCE table for diabetes codes\n")
diabetes_phenotype <- phenotypes$CodelistPhenotype(
  domain = "CONDITION_OCCURRENCE",
  codelist = diabetes_codelist$py_object,  # Pass the Python codelist object
  name = "diabetes_patients"
)
cat("   ✅ Diabetes phenotype created\n")

cat("\n🫀 Creating atrial fibrillation phenotype...\n")
cat("   This will search the CONDITION_OCCURRENCE table for AF codes\n")
af_phenotype <- phenotypes$CodelistPhenotype(
  domain = "CONDITION_OCCURRENCE", 
  codelist = af_codelist$py_object,
  name = "af_patients"
)
cat("   ✅ Atrial fibrillation phenotype created\n")

cat("\n💡 What are phenotypes?\n")
cat("   Phenotypes define HOW to find patients with specific characteristics\n")
cat("   They combine codelists with data tables (domains) and optional filters\n")
cat("   Each phenotype can be executed to return matching patients\n")

# Let's test one phenotype to show how it works
cat("\n🧪 Let's test the diabetes phenotype to see how many patients it finds:\n")
diabetes_result <- diabetes_phenotype$execute(tables)
diabetes_df <- diabetes_result$to_pandas()
diabetes_count <- nrow(py_to_r(diabetes_df))
cat("   📊 Found", diabetes_count, "patients with diabetes diagnoses\n")

if (diabetes_count > 0) {
  cat("   🔍 Sample diabetes patients:\n")
  sample_diabetes <- py_to_r(diabetes_df)
  print(head(sample_diabetes[,1:4], min(3, diabetes_count)))
}

wait_for_user("\nPhenotypes created and tested! Press [Enter] to proceed to cohort building...")

show_step(4, "CREATE AND EXECUTE COHORTS", 
  "Cohorts define patient populations using entry criteria, inclusions, and exclusions.\n   We'll start with a simple diabetes cohort, then create a more complex one.")

wait_for_user("Ready to create your first cohort? Press [Enter] to continue...")

# First create an entry criterion phenotype (this defines the index event)
cat("🎯 Setting up entry criterion...\n")
cat("   The entry criterion defines the 'index event' - when patients enter the study\n")
entry_phenotype <- diabetes_phenotype  # Use diabetes as entry criterion
cat("   ✅ Using diabetes diagnosis as entry criterion\n")

# Simple diabetes cohort
cat("\n🏥 Creating simple diabetes cohort...\n")
diabetes_cohort <- phenotypes$Cohort(
  name = "diabetes_cohort",
  entry_criterion = entry_phenotype,
  description = "Patients with diabetes diagnosis"
)
cat("   ✅ Diabetes cohort definition created\n")
cat("   📋 This cohort includes ALL patients with diabetes (no additional filters)\n")

wait_for_user("\nCohort defined! Press [Enter] to execute it and see the results...")

# Execute the cohort
cat("🔄 Executing diabetes cohort...\n")
cat("   This will find all patients meeting the entry criterion...\n")
diabetes_result <- diabetes_cohort$execute(tables)
cat("   ✅ Cohort execution complete!\n")

# Use PhenEx waterfall reporter for professional cohort attrition analysis
cat("\n📊 Generating waterfall analysis report...\n")
reporting <- import("phenex.reporting")
waterfall_reporter <- reporting$Waterfall()

# Generate waterfall report for diabetes cohort
cat("🌊 Diabetes Cohort Waterfall Analysis:\n")
cat("   (This shows how many patients flow through each step)\n")
diabetes_waterfall <- waterfall_reporter$execute(diabetes_cohort)
print(diabetes_waterfall)

wait_for_user("\nFirst cohort complete! Press [Enter] to create a more complex cohort...")

show_step(5, "COMPLEX COHORT WITH INCLUSION CRITERIA", 
  "Now we'll create a more complex cohort: patients with diabetes AND atrial fibrillation.\n   This demonstrates using inclusion criteria to refine your patient population.")

wait_for_user("Ready to create a complex cohort? Press [Enter] to continue...")

cat("🔬 Creating complex cohort with inclusion criteria...\n")
cat("   Entry criterion: Diabetes diagnosis (defines index date)\n")
cat("   Inclusion criterion: Atrial fibrillation diagnosis (must also be present)\n")
cat("   Result: Patients who have BOTH diabetes AND atrial fibrillation\n\n")

combined_cohort <- phenotypes$Cohort(
  name = "diabetes_with_af_cohort",
  entry_criterion = entry_phenotype,  # Diabetes as entry
  inclusions = list(af_phenotype),    # AF as inclusion criterion
  description = "Patients with diabetes AND atrial fibrillation"
)
cat("   ✅ Complex cohort definition created\n")

cat("\n💡 Understanding Entry vs Inclusion:\n")
cat("   • Entry criterion: Defines the index date (when patient enters study)\n")
cat("   • Inclusion criteria: Additional requirements patients must meet\n")
cat("   • Patients must satisfy ALL criteria to be included in final cohort\n")

wait_for_user("\nComplex cohort defined! Press [Enter] to execute and compare results...")

cat("🔄 Executing combined cohort...\n")  
combined_result <- combined_cohort$execute(tables)
cat("   ✅ Complex cohort execution complete!\n")

# Generate waterfall report for combined cohort
cat("\n🌊 Combined Cohort (Diabetes + AF) Waterfall Analysis:\n")
combined_waterfall <- waterfall_reporter$execute(combined_cohort)
print(combined_waterfall)

cat("\n📊 Comparing Simple vs Complex Cohorts:\n")
cat("   Simple diabetes cohort: ", nrow(py_to_r(diabetes_result$to_pandas())), " patients\n")
cat("   Complex diabetes+AF cohort: ", nrow(py_to_r(combined_result$to_pandas())), " patients\n")
cat("   Reduction: ", nrow(py_to_r(diabetes_result$to_pandas())) - nrow(py_to_r(combined_result$to_pandas())), " patients filtered out by AF requirement\n")

wait_for_user("\nComplex cohort analysis complete! Press [Enter] to explore the data...")

show_step(6, "EXPLORE THE RESULTS", 
  "Let's examine the actual patient data from our cohorts and understand\n   what's in the underlying OMOP tables.")

wait_for_user("Ready to explore the data? Press [Enter] to continue...")

# Show sample of diabetes cohort results
cat("🔍 Examining simple diabetes cohort results:\n")
diabetes_df <- diabetes_result$to_pandas()
diabetes_r <- py_to_r(diabetes_df)
cat("   Total patients in diabetes cohort:", nrow(diabetes_r), "\n")
if (nrow(diabetes_r) > 0) {
  cat("   Sample patients (first 3):\n")
  print(head(diabetes_r[,1:min(4, ncol(diabetes_r))], 3))
}

cat("\n🔍 Examining complex diabetes+AF cohort results:\n")
combined_df <- combined_result$to_pandas()
combined_r <- py_to_r(combined_df)
cat("   Total patients in diabetes+AF cohort:", nrow(combined_r), "\n")
if (nrow(combined_r) > 0) {
  cat("   Sample patients (first 3):\n")
  print(head(combined_r[,1:min(4, ncol(combined_r))], 3))
}

wait_for_user("\nCohort data reviewed! Press [Enter] to peek at the source OMOP tables...")

# Show some condition occurrence data (first few rows to avoid timestamp issues)
cat("🔍 Examining source OMOP data - CONDITION_OCCURRENCE table:\n")
cat("   This table contains all diagnosis records in our mock dataset\n")
condition_df <- tables$CONDITION_OCCURRENCE$to_pandas()
condition_r <- py_to_r(condition_df)
cat("   Total condition records:", nrow(condition_r), "\n")
cat("   Sample condition occurrences (first 3 rows):\n")
print(head(condition_r[,1:min(5, ncol(condition_r))], 3))

cat("\n🔍 Examining PERSON table:\n")
cat("   This table contains basic demographic information\n")  
person_df <- tables$PERSON$to_pandas()
person_r <- py_to_r(person_df)
cat("   Total patients in dataset:", nrow(person_r), "\n")
cat("   Sample person records (first 3 rows):\n")
print(head(person_r[,1:min(5, ncol(person_r))], 3))

cat("\n🎉 Data exploration completed successfully!\n")

wait_for_user("\nExploration complete! Press [Enter] to see the summary and next steps...")

show_step("FINAL", "TUTORIAL COMPLETE! 🎉", 
  "Congratulations! You've successfully completed the interactive PhenEx tutorial.")

# Calculate actual results
diabetes_count <- nrow(py_to_r(diabetes_result$to_pandas()))
combined_count <- nrow(py_to_r(combined_result$to_pandas()))
total_patients <- nrow(py_to_r(tables$PERSON$to_pandas()))

cat("� YOUR RESULTS SUMMARY:\n")
cat("=" %r% 40, "\n")
cat("   📋 Mock dataset: ", total_patients, " patients with full OMOP structure\n")
cat("   🏥 Diabetes patients: ", diabetes_count, " (", round(diabetes_count/total_patients*100, 1), "% of total)\n")
cat("   💓 Diabetes + AF patients: ", combined_count, " (", round(combined_count/total_patients*100, 1), "% of total)\n")
if (diabetes_count > 0) {
  cat("   🔗 AF prevalence among diabetes patients: ", round(combined_count/diabetes_count*100, 1), "%\n")
}

cat("\n💡 WHAT YOU LEARNED:\n")
cat("=" %r% 30, "\n")
cat("   ✓ Using DomainsMocker to generate realistic OMOP test data\n")
cat("   ✓ Creating medical codelists with OMOP concept IDs\n")
cat("   ✓ Building phenotypes that search specific data domains\n") 
cat("   ✓ Creating simple cohorts with entry criteria\n")
cat("   ✓ Using inclusion criteria to create complex cohorts\n")
cat("   ✓ Generating waterfall reports for cohort attrition analysis\n")
cat("   ✓ Exploring results and understanding OMOP data structure\n")

cat("\n� READY FOR MORE? Try these advanced features:\n")
cat("=" %r% 50, "\n")
cat("   🚫 Add exclusion criteria to filter out unwanted patients\n")
cat("   📏 Create measurement-based phenotypes (lab values, vitals)\n")
cat("   📅 Add temporal filters (date ranges, time windows)\n")
cat("   🔄 Create phenotypes with different aggregation methods\n")
cat("   💾 Export cohort results to CSV files for further analysis\n")
cat("   🧮 Build complex phenotype combinations with logic operators\n")
cat("   🏥 Try with real OMOP databases (when available)\n")

cat("\n🎯 WHAT'S NEXT?\n")
cat("=" %r% 20, "\n")
cat("   This tutorial demonstrated the complete PhenEx R workflow.\n")
cat("   You can now apply these patterns to real-world epidemiological\n")
cat("   and clinical research applications!\n")

cat("\n📚 ADDITIONAL RESOURCES:\n")
cat("=" %r% 30, "\n")
cat("   • Check the phenexr documentation for more phenotype types\n")
cat("   • Explore the PhenEx Python documentation for advanced features\n")
cat("   • Look at other example scripts in the examples/ directory\n")
cat("   • Visit the PhenEx GitHub repository for updates and issues\n")

cat("\n" %r% 60, "\n")
cat("🎊 Thank you for completing the PhenEx Interactive Tutorial! 🎊\n")
cat("=" %r% 60, "\n")