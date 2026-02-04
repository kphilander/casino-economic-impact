# ============================================================================
# PROPERTY ECONOMIC IMPACT CALCULATOR
#
# User-facing script to calculate economic impact for a specific property.
# Input your property data below and run the script to generate EI table.
#
# The model uses your actual data for direct effects where provided,
# and pulls multipliers from EPA StateIO (2019) to calculate indirect
# and induced effects.
#
# Usage:
#   1. Edit the USER INPUTS section below with your property data
#   2. Run the entire script: source("11_property_impact_calculator.R")
#   3. View results in console and exported CSV file
# ============================================================================

# ============================================================================
# USER INPUTS - EDIT THIS SECTION
# ============================================================================

property_name <- "My Casino"           # Name of property
state <- "Nevada"                      # State (required)
sector <- "713"                        # IO sector code:
                                       #   "713"   = Amusement, Gambling, Recreation
                                       #   "721"   = Accommodation
                                       #   "722"   = Food Services & Drinking Places
                                       #   "711AS" = Arts, Entertainment, Recreation

# Revenue/Output (provide at least one)
direct_output <- NULL                  # Total direct output in $M (or NULL)
ggr <- 100                             # Gross gaming revenue in $M (or NULL)
                                       # If both provided, direct_output is used

# Employment & Wages (optional - will be calculated if NULL)
direct_employment <- NULL              # Actual property jobs (or NULL)
direct_wages <- NULL                   # Actual total wages in $M (or NULL)

# Output options
output_file <- NULL                    # Filename (auto-generated if NULL)

# ============================================================================
# DO NOT EDIT BELOW THIS LINE
# ============================================================================

library(tidyverse)

# Load the multiplier data
source("10_casino_impact_model.R")

# ============================================================================
# INPUT VALIDATION
# ============================================================================

if (is.null(MULTIPLIER_DATA)) {
  stop("Multiplier data not loaded. Run scripts 07-09 first to generate data.")
}

# Resolve direct output
if (is.null(direct_output) && is.null(ggr)) {
  stop("Must provide either direct_output or ggr")
}
if (is.null(direct_output)) {
  direct_output <- ggr
}

# Get state multipliers
state_data <- MULTIPLIER_DATA %>%
  filter(State == state, Sector == sector)

if (nrow(state_data) == 0) {
  # Try partial match
  possible_states <- unique(MULTIPLIER_DATA$State)
  matches <- grep(state, possible_states, ignore.case = TRUE, value = TRUE)

  if (length(matches) == 1) {
    state_data <- MULTIPLIER_DATA %>%
      filter(State == matches[1], Sector == sector)
    state <- matches[1]
  } else if (length(matches) > 1) {
    stop("Multiple states match '", state, "': ", paste(matches, collapse = ", "))
  } else {
    stop("No data found for state: ", state, " and sector: ", sector,
         "\nAvailable states: ", paste(head(possible_states, 10), collapse = ", "), "...")
  }
}

# ============================================================================
# EXTRACT COEFFICIENTS AND MULTIPLIERS
# ============================================================================

va_coef <- state_data$Direct_VA_Coef
wage_coef <- state_data$Direct_Wage_Coef
emp_coef <- state_data$Emp_Coef
type1_output <- state_data$Type_I_Output
type2_output <- state_data$Type_II_Output
type1_va <- state_data$Type_I_VA
type2_va <- state_data$Type_II_VA
type1_wage <- state_data$Type_I_Wage
type2_wage <- state_data$Type_II_Wage
type1_emp_mult <- state_data$Type_I_Emp_Mult
type2_emp_mult <- state_data$Type_II_Emp_Mult

# ============================================================================
# CALCULATE DIRECT EFFECTS
# ============================================================================

# Direct GDP is always calculated from VA coefficient
direct_gdp <- direct_output * va_coef

# Employment: use user value or calculate
if (is.null(direct_employment)) {
  direct_employment <- direct_gdp * emp_coef
  emp_source <- "calculated from IO coefficients"
} else {
  emp_source <- "user-provided"
}

# Wages: use user value or calculate
if (is.null(direct_wages)) {
  direct_wages <- direct_output * wage_coef
  wage_source <- "calculated from IO coefficients"
} else {
  wage_source <- "user-provided"
}

# ============================================================================
# CALCULATE INDIRECT EFFECTS (Type I - Direct)
# ============================================================================

indirect_output <- direct_output * (type1_output - 1)
indirect_gdp <- direct_output * type1_va - direct_gdp

# For wages: if user provided direct wages, scale indirect proportionally
if (wage_source == "user-provided") {
  # Scale by ratio of actual to calculated wage coefficient
  actual_wage_coef <- direct_wages / direct_output
  indirect_wages <- direct_output * type1_wage - direct_output * actual_wage_coef
} else {
  indirect_wages <- direct_output * type1_wage - direct_wages
}

# For employment: use actual employment multipliers (accounts for labor intensity
# of sectors in the supply chain, which differs from output multipliers)
indirect_employment <- direct_employment * (type1_emp_mult - 1)

# ============================================================================
# CALCULATE INDUCED EFFECTS (Type II - Type I)
# ============================================================================

induced_output <- direct_output * (type2_output - type1_output)
induced_gdp <- direct_output * (type2_va - type1_va)
induced_wages <- direct_output * (type2_wage - type1_wage)
induced_employment <- direct_employment * (type2_emp_mult - type1_emp_mult)

# ============================================================================
# CALCULATE TOTALS
# ============================================================================

total_output <- direct_output + indirect_output + induced_output
total_gdp <- direct_gdp + indirect_gdp + induced_gdp
total_employment <- direct_employment + indirect_employment + induced_employment
total_wages <- direct_wages + indirect_wages + induced_wages

# ============================================================================
# BUILD SUMMARY TABLE
# ============================================================================

summary_df <- data.frame(
  Metric = c("Output ($M)", "GDP ($M)", "Employment (Jobs)", "Wages ($M)"),
  Direct = c(
    round(direct_output, 2),
    round(direct_gdp, 2),
    round(direct_employment, 0),
    round(direct_wages, 2)
  ),
  Indirect = c(
    round(indirect_output, 2),
    round(indirect_gdp, 2),
    round(indirect_employment, 0),
    round(indirect_wages, 2)
  ),
  Induced = c(
    round(induced_output, 2),
    round(induced_gdp, 2),
    round(induced_employment, 0),
    round(induced_wages, 2)
  ),
  Total = c(
    round(total_output, 2),
    round(total_gdp, 2),
    round(total_employment, 0),
    round(total_wages, 2)
  ),
  Multiplier = c(
    round(type2_output, 3),
    round(total_gdp / direct_gdp, 3),
    round(total_employment / direct_employment, 3),
    round(total_wages / direct_wages, 3)
  ),
  stringsAsFactors = FALSE
)

# ============================================================================
# PRINT RESULTS
# ============================================================================

cat("\n")
cat("===================================================================\n")
cat("              PROPERTY ECONOMIC IMPACT ANALYSIS                    \n")
cat("===================================================================\n")
cat("\n")
cat("Property:      ", property_name, "\n", sep = "")
cat("State:         ", state, "\n", sep = "")
cat("Sector:        ", state_data$Sector_Name, " (", sector, ")\n", sep = "")
cat("Direct Output: $", format(direct_output, big.mark = ","), " million\n", sep = "")
cat("\n")
cat("-------------------------------------------------------------------\n")
cat("Data Sources:\n")
cat("  - Employment: ", emp_source, "\n", sep = "")
cat("  - Wages:      ", wage_source, "\n", sep = "")
cat("  - Multipliers: EPA StateIO (2019)\n")
cat("  - Employment coefficients: BLS QCEW (2023)\n")
cat("-------------------------------------------------------------------\n")
cat("\n")
print(summary_df, row.names = FALSE, right = TRUE)
cat("\n")

# ============================================================================
# EXPORT TO CSV
# ============================================================================

if (is.null(output_file)) {
  # Auto-generate filename
  safe_name <- gsub("[^A-Za-z0-9]", "_", property_name)
  output_file <- paste0("EI_", safe_name, "_", format(Sys.time(), "%Y%m%d"), ".csv")
}

# Build export with metadata header
meta_df <- data.frame(
  Metric = c(
    paste0("Property: ", property_name),
    paste0("State: ", state),
    paste0("Sector: ", state_data$Sector_Name),
    paste0("Direct Output: $", direct_output, "M"),
    paste0("Employment: ", emp_source),
    paste0("Wages: ", wage_source),
    paste0("IO Data: EPA StateIO 2019"),
    paste0("Employment Data: BLS QCEW 2023"),
    paste0("Generated: ", Sys.time()),
    ""
  ),
  Direct = rep("", 10),
  Indirect = rep("", 10),
  Induced = rep("", 10),
  Total = rep("", 10),
  Multiplier = rep("", 10),
  stringsAsFactors = FALSE
)

export_df <- rbind(meta_df, summary_df)
write.csv(export_df, output_file, row.names = FALSE)

cat("Exported: ", output_file, "\n", sep = "")
cat("===================================================================\n")
cat("\n")
