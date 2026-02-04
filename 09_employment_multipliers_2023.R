# ============================================================================
# EMPLOYMENT MULTIPLIERS FOR CASINO-RELATED SECTORS
# All 50 US States - 2023 Data
#
# Combines:
#   - State multipliers from 08_state_multipliers_2023.R (includes true
#     employment-weighted multipliers calculated using emp_coef × L)
#   - Employment data from 07_process_qcew_employment_2023.R
#
# The employment multipliers (Type_I_Emp, Type_II_Emp) are calculated in
# script 08 using the full employment coefficient vector across all 71 IO
# sectors. This provides true employment-weighted multipliers that account
# for the different labor intensities of sectors in the supply chain.
#
# This script merges employment data with multipliers and calculates
# additional derived metrics like jobs per $1M of output/GDP.
#
# IMPORTANT: Employment coefficients use GDP (Value Added) as denominator,
#            NOT Gross Output. This is the correct approach for regional
#            economic impact analysis.
# ============================================================================

library(tidyverse)

# ============================================================================
# CONFIGURATION
# ============================================================================

my_year <- 2023

# Input files (from previous scripts)
multiplier_file <- paste0("state_multipliers_", my_year, ".csv")
employment_file <- paste0("employment_by_state_", my_year, ".csv")

# Output file
output_file <- paste0("employment_multipliers_", my_year, ".csv")

# ============================================================================
# LOAD DATA
# ============================================================================

message("\n=== Loading Input Data ===\n")

# Load state multipliers
if (!file.exists(multiplier_file)) {
  stop("Multiplier file not found: ", multiplier_file,
       "\nRun 08_state_multipliers_2023.R first.")
}
multipliers <- read.csv(multiplier_file, stringsAsFactors = FALSE)
message("Loaded multipliers: ", nrow(multipliers), " records from ", multiplier_file)

# Load employment data
if (!file.exists(employment_file)) {
  stop("Employment file not found: ", employment_file,
       "\nRun 07_process_qcew_employment_2023.R first.")
}
employment <- read.csv(employment_file, stringsAsFactors = FALSE)
message("Loaded employment: ", nrow(employment), " records from ", employment_file)

# ============================================================================
# MERGE DATA
# ============================================================================

message("\n=== Merging Multipliers with Employment Data ===\n")

# Merge on state and sector
combined <- merge(
  multipliers,
  employment,
  by.x = c("State", "Sector"),
  by.y = c("state_name", "io_sector"),
  all.x = TRUE
)

# Check for missing employment data
missing_emp <- sum(is.na(combined$employment))
if (missing_emp > 0) {
  message("WARNING: ", missing_emp, " records missing employment data")
}

message("Combined records: ", nrow(combined))

# ============================================================================
# CALCULATE EMPLOYMENT COEFFICIENTS
# ============================================================================

message("\n=== Calculating Employment Coefficients ===\n")

# Employment coefficient = Employment / VA (in millions)
# Jobs per $1 million of GDP (Value Added)

combined <- combined %>%
  mutate(
    # Calculate VA from industry output and VA coefficient
    # Industry_Output_M is in millions
    # Direct_VA_Coef is VA per $ output
    VA_M = Industry_Output_M * Direct_VA_Coef,

    # Employment coefficient: jobs per $1M GDP
    Emp_Coef = if_else(VA_M > 0, employment / VA_M, NA_real_),

    # Wage per employee (from QCEW data)
    Avg_Wage = if_else(employment > 0, total_wages / employment, NA_real_)
  )

# ============================================================================
# USE TRUE EMPLOYMENT MULTIPLIERS FROM SCRIPT 08
# ============================================================================

message("=== Using Employment Multipliers from Script 08 ===\n")

# True employment multipliers (Type_I_Emp, Type_II_Emp) are calculated in
# script 08 using: emp_coef_all_sectors × Leontief_inverse
# This properly accounts for the different labor intensities across all
# sectors in the economy, not just the target sector.

# Rename columns from script 08 to match expected names
combined <- combined %>%
  mutate(
    # Employment multipliers from script 08 (true employment-weighted)
    Type_I_Emp_Mult = Type_I_Emp,
    Type_II_Emp_Mult = Type_II_Emp,

    # Jobs per $1M of final demand (direct sector output)
    # Direct employment per $1M output = emp_coef × va_coef
    Jobs_Per_1M_Output_Direct = Emp_Coef * Direct_VA_Coef,
    Jobs_Per_1M_Output_TypeI = Jobs_Per_1M_Output_Direct * Type_I_Emp_Mult,
    Jobs_Per_1M_Output_TypeII = Jobs_Per_1M_Output_Direct * Type_II_Emp_Mult,

    # Jobs per $1M of GDP (direct value added)
    Jobs_Per_1M_GDP_Direct = Emp_Coef,
    Jobs_Per_1M_GDP_TypeI = Emp_Coef * Type_I_Emp_Mult,
    Jobs_Per_1M_GDP_TypeII = Emp_Coef * Type_II_Emp_Mult
  )

# ============================================================================
# SELECT AND ARRANGE OUTPUT COLUMNS
# ============================================================================

output_data <- combined %>%
  select(
    State,
    Abbrev,
    Sector,
    Sector_Name,

    # Employment data (from QCEW)
    Employment = employment,
    Total_Wages_M = total_wages,
    Avg_Wage,

    # Economic structure
    Industry_Output_M,
    VA_M,
    Direct_VA_Coef,
    Direct_Wage_Coef,

    # Output multipliers
    Type_I_Output,
    Type_II_Output,

    # VA multipliers
    Type_I_VA,
    Type_II_VA,

    # Wage multipliers
    Type_I_Wage,
    Type_II_Wage,

    # Employment coefficients and multipliers
    # (Type_I_Emp_Mult and Type_II_Emp_Mult are true employment-weighted
    # multipliers from script 08, not derived from VA multipliers)
    Emp_Coef,
    Type_I_Emp_Mult,
    Type_II_Emp_Mult,

    # Jobs per $1M (useful for impact calculations)
    Jobs_Per_1M_Output_Direct,
    Jobs_Per_1M_Output_TypeI,
    Jobs_Per_1M_Output_TypeII,
    Jobs_Per_1M_GDP_Direct,
    Jobs_Per_1M_GDP_TypeI,
    Jobs_Per_1M_GDP_TypeII
  ) %>%
  mutate(
    # Convert wages to millions
    Total_Wages_M = Total_Wages_M / 1e6
  ) %>%
  arrange(State, Sector)

# ============================================================================
# SAVE RESULTS
# ============================================================================

message("\n=== Saving Results ===\n")

write.csv(output_data, output_file, row.names = FALSE)
message("Saved: ", output_file)
message("Records: ", nrow(output_data))

# ============================================================================
# SUMMARY STATISTICS
# ============================================================================

message("\n=== EMPLOYMENT COEFFICIENT SUMMARY ===\n")

sector_summary <- output_data %>%
  group_by(Sector, Sector_Name) %>%
  summarise(
    States = n(),
    Total_Employment = sum(Employment, na.rm = TRUE),

    Emp_Coef_Min = min(Emp_Coef, na.rm = TRUE),
    Emp_Coef_Max = max(Emp_Coef, na.rm = TRUE),
    Emp_Coef_Mean = mean(Emp_Coef, na.rm = TRUE),

    Type_I_Emp_Mult_Mean = mean(Type_I_Emp_Mult, na.rm = TRUE),
    Type_II_Emp_Mult_Mean = mean(Type_II_Emp_Mult, na.rm = TRUE),

    .groups = "drop"
  )

for (i in 1:nrow(sector_summary)) {
  row <- sector_summary[i, ]
  message("\n", row$Sector, " (", row$Sector_Name, "):")
  message("  States with data: ", row$States)
  message("  Total Employment: ", format(row$Total_Employment, big.mark = ","))
  message("")
  message("  Employment Coefficient (jobs per $1M GDP):")
  message("    Range: ", round(row$Emp_Coef_Min, 2), " - ", round(row$Emp_Coef_Max, 2))
  message("    Mean:  ", round(row$Emp_Coef_Mean, 2))
  message("")
  message("  Employment Multipliers:")
  message("    Type I Mean:  ", round(row$Type_I_Emp_Mult_Mean, 3))
  message("    Type II Mean: ", round(row$Type_II_Emp_Mult_Mean, 3))
}

# ============================================================================
# VALIDATION
# ============================================================================

message("\n=== VALIDATION CHECKS ===\n")

# Employment coefficients should be positive where data exists
emp_coef_check <- all(output_data$Emp_Coef > 0 | is.na(output_data$Emp_Coef))
if (emp_coef_check) {
  message("✓ All employment coefficients are positive")
} else {
  message("✗ Some employment coefficients <= 0")
}

# Type I emp mult should be >= 1
type1_check <- all(output_data$Type_I_Emp_Mult >= 1, na.rm = TRUE)
if (type1_check) {
  message("✓ All Type I employment multipliers >= 1")
} else {
  message("✗ Some Type I employment multipliers < 1")
}

# Type II >= Type I
type2_check <- all(output_data$Type_II_Emp_Mult >= output_data$Type_I_Emp_Mult, na.rm = TRUE)
if (type2_check) {
  message("✓ All Type II employment multipliers >= Type I")
} else {
  message("✗ Some Type II employment multipliers < Type I")
}

# Reasonable range for employment coefficients (5-50 jobs per $1M GDP typical for service sectors)
emp_range <- output_data %>%
  filter(!is.na(Emp_Coef)) %>%
  summarise(min = min(Emp_Coef), max = max(Emp_Coef))

message("  Employment coefficient range: ", round(emp_range$min, 1), " - ",
        round(emp_range$max, 1), " jobs per $1M GDP")

# ============================================================================
# SAMPLE OUTPUT - Nevada
# ============================================================================

message("\n=== SAMPLE: Nevada Employment Multipliers ===\n")

nevada <- output_data %>%
  filter(State == "Nevada") %>%
  select(Sector, Employment, Emp_Coef, Type_I_Emp_Mult, Type_II_Emp_Mult,
         Jobs_Per_1M_GDP_Direct, Jobs_Per_1M_GDP_TypeII)

print(nevada)

# ============================================================================
# EXPORT SUMMARY TABLE
# ============================================================================

summary_file <- paste0("employment_multiplier_summary_", my_year, ".csv")
write.csv(sector_summary, summary_file, row.names = FALSE)
message("\nSaved summary: ", summary_file)

message("\n=== COMPLETE ===\n")
