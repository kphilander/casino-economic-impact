# ============================================================================
# GAMBLING-SPECIFIC EMPLOYMENT DATA AND ADJUSTED MULTIPLIERS
#
# This script:
#   1. Extracts gambling-specific (NAICS 7132 + 72112) employment from QCEW
#   2. Calculates adjustment factors from national detail IO tables
#   3. Creates gambling-adjusted multiplier dataset
#
# The blended 713 sector includes golf courses, fitness centers, etc.
# which have very different economics than gambling:
#   - Gambling wage coefficient: 0.255 (vs 0.406 blended)
#   - Gambling VA coefficient: 0.577 (vs 0.651 blended)
#
# Data Sources:
#   - BLS QCEW 2023 for gambling employment
#   - BEA Detail IO Tables 2017 via useeior package
#   - EPA StateIO 2019 for state multipliers
# ============================================================================

library(tidyverse)

# ============================================================================
# CONFIGURATION
# ============================================================================

qcew_dir <- "2023.annual.by_industry"
my_year <- 2023

# Gambling-related NAICS codes
gambling_naics <- c(
  "7132",   # Gambling industries
  "71321",  # Casinos (except casino hotels)
  "713210", # Casinos (except casino hotels) - 6 digit
  "71329",  # Other gambling industries
  "713290", # Other gambling industries - 6 digit
  "72112",  # Casino hotels
  "721120"  # Casino hotels - 6 digit
)

# State FIPS codes
state_fips <- data.frame(
  fips = c("01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
           "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
           "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
           "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
           "45", "46", "47", "48", "49", "50", "51", "53", "54", "55", "56"),
  state_name = c("Alabama", "Alaska", "Arizona", "Arkansas", "California",
                 "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida",
                 "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana",
                 "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
                 "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
                 "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
                 "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota",
                 "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
                 "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah",
                 "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"),
  stringsAsFactors = FALSE
)

# ============================================================================
# ADJUSTMENT FACTORS (from national detail IO analysis)
# ============================================================================

# These ratios compare gambling (713200) to blended 713 at national level
# Calculated from BEA Detail IO Tables 2017 via useeior package

ADJUSTMENT_FACTORS <- list(
  # Direct coefficients
  va_coef_ratio = 0.89,      # Gambling VA coef / Blended VA coef
  wage_coef_ratio = 0.63,    # Gambling wage coef / Blended wage coef
  topi_coef_ratio = 0.6086,  # Gambling TOPI coef / Blended TOPI coef

  # Multipliers
  output_mult_ratio = 0.91,  # Type I output multiplier ratio
  va_mult_ratio = 0.88,      # Type I VA multiplier ratio
  wage_mult_ratio = 0.76,    # Type I wage multiplier ratio
  topi_mult_ratio = 0.7144,  # Type I TOPI multiplier ratio

  # Actual gambling coefficients (national, USEEIOv2.0.1-411)
  gambling_va_coef = 0.577,
  gambling_wage_coef = 0.255,
  gambling_topi_coef = 0.035024
)

message("=== ADJUSTMENT FACTORS ===")
message("These factors convert blended 713 multipliers to gambling-specific estimates:")
message("  VA coefficient ratio:   ", ADJUSTMENT_FACTORS$va_coef_ratio)
message("  Wage coefficient ratio: ", ADJUSTMENT_FACTORS$wage_coef_ratio)
message("  TOPI coefficient ratio: ", ADJUSTMENT_FACTORS$topi_coef_ratio)
message("  Output mult ratio:      ", ADJUSTMENT_FACTORS$output_mult_ratio)
message("  VA mult ratio:          ", ADJUSTMENT_FACTORS$va_mult_ratio)
message("  Wage mult ratio:        ", ADJUSTMENT_FACTORS$wage_mult_ratio)
message("  TOPI mult ratio:        ", ADJUSTMENT_FACTORS$topi_mult_ratio)

# ============================================================================
# LOAD AND PROCESS GAMBLING EMPLOYMENT DATA
# ============================================================================

message("\n=== Processing Gambling Employment Data ===\n")

# Function to read QCEW file for a specific NAICS
read_qcew_naics <- function(naics_code, dir) {
  # Find matching file
  files <- list.files(dir, pattern = paste0("NAICS ", naics_code, " "), full.names = TRUE)

  if (length(files) == 0) {
    message("  No file found for NAICS ", naics_code)
    return(NULL)
  }

  message("  Reading NAICS ", naics_code, ": ", basename(files[1]))
  df <- read.csv(files[1], stringsAsFactors = FALSE)

  # Determine agglvl_code based on NAICS digit length
  # 4-digit: 56, 5-digit: 57, 6-digit: 58
  naics_len <- nchar(naics_code)
  agglvl <- case_when(
    naics_len == 4 ~ 56,
    naics_len == 5 ~ 57,
    naics_len == 6 ~ 58,
    TRUE ~ 56
  )

  # Filter for state-level, private ownership
  df <- df %>%
    filter(
      agglvl_code == agglvl,  # State level, by NAICS
      own_code == 5           # Private
    ) %>%
    select(
      area_fips,
      industry_code,
      annual_avg_emplvl,
      total_annual_wages
    )

  if (nrow(df) == 0) {
    message("    No state-level data found")
    return(NULL)
  }

  df$naics <- naics_code
  message("    Found ", nrow(df), " state records")
  return(df)
}

# Read all gambling-related files
gambling_data <- map_dfr(gambling_naics, ~read_qcew_naics(.x, qcew_dir))

message("Raw gambling records: ", nrow(gambling_data))

# Merge with state names
gambling_data <- gambling_data %>%
  mutate(state_fips = substr(area_fips, 1, 2)) %>%
  left_join(state_fips, by = c("state_fips" = "fips")) %>%
  filter(!is.na(state_name))

# ============================================================================
# AGGREGATE TO STATE LEVEL
# ============================================================================

# We want the most detailed non-overlapping categories:
# - 71321 (Casinos except casino hotels)
# - 71329 (Other gambling industries)
# - 72112 (Casino hotels)

# Use 5-digit codes to avoid double counting
gambling_5digit <- gambling_data %>%
  filter(naics %in% c("71321", "71329", "72112"))

# Aggregate by state
gambling_by_state <- gambling_5digit %>%
  group_by(state_name) %>%
  summarise(
    gambling_employment = sum(annual_avg_emplvl, na.rm = TRUE),
    gambling_wages = sum(total_annual_wages, na.rm = TRUE),
    n_categories = n(),
    .groups = "drop"
  ) %>%
  mutate(
    gambling_avg_wage = gambling_wages / gambling_employment
  )

message("\nGambling employment by state (top 10):")
print(head(gambling_by_state %>% arrange(desc(gambling_employment)), 10))

# ============================================================================
# COMPARE TO BLENDED 713 EMPLOYMENT
# ============================================================================

message("\n=== Comparing Gambling vs Blended 713 Employment ===\n")

# Load the existing 713 employment data
emp_713 <- read.csv("employment_by_state_2023.csv", stringsAsFactors = FALSE) %>%
  filter(io_sector == "713") %>%
  select(state_name, employment_713 = employment, wages_713 = total_wages)

# Merge
comparison <- gambling_by_state %>%
  left_join(emp_713, by = "state_name") %>%
  mutate(
    gambling_share = gambling_employment / employment_713 * 100,
    gambling_wage_ratio = (gambling_wages / gambling_employment) / (wages_713 / employment_713)
  )

message("Gambling share of 713 employment by state:")
print(comparison %>%
        select(state_name, gambling_employment, employment_713, gambling_share) %>%
        arrange(desc(gambling_share)) %>%
        head(10))

message("\nNational summary:")
message("  Total gambling employment: ", format(sum(gambling_by_state$gambling_employment), big.mark = ","))
message("  Total 713 employment: ", format(sum(emp_713$employment_713), big.mark = ","))
message("  Gambling share of 713: ", round(sum(gambling_by_state$gambling_employment) / sum(emp_713$employment_713) * 100, 1), "%")

# ============================================================================
# CREATE GAMBLING-ADJUSTED MULTIPLIERS
# ============================================================================

message("\n=== Creating Gambling-Adjusted Multipliers ===\n")

# Load the existing 713 multipliers
multipliers_713 <- read.csv("employment_multipliers_2023.csv", stringsAsFactors = FALSE) %>%
  filter(Sector == "713")

# Create gambling-adjusted version
gambling_multipliers <- multipliers_713 %>%
  mutate(
    # Adjust direct coefficients
    Direct_VA_Coef_Gambling = Direct_VA_Coef * ADJUSTMENT_FACTORS$va_coef_ratio,
    Direct_Wage_Coef_Gambling = Direct_Wage_Coef * ADJUSTMENT_FACTORS$wage_coef_ratio,
    Direct_Tax_Coef_Gambling = Direct_Tax_Coef * ADJUSTMENT_FACTORS$topi_coef_ratio,

    # Adjust Type I multipliers
    Type_I_Output_Gambling = 1 + (Type_I_Output - 1) * ADJUSTMENT_FACTORS$output_mult_ratio,
    Type_I_VA_Gambling = Direct_VA_Coef_Gambling + (Type_I_VA - Direct_VA_Coef) * ADJUSTMENT_FACTORS$va_mult_ratio,
    Type_I_Wage_Gambling = Direct_Wage_Coef_Gambling + (Type_I_Wage - Direct_Wage_Coef) * ADJUSTMENT_FACTORS$wage_mult_ratio,
    Type_I_Tax_Gambling = Direct_Tax_Coef_Gambling + (Type_I_Tax - Direct_Tax_Coef) * ADJUSTMENT_FACTORS$topi_mult_ratio,

    # Adjust Type II multipliers (same ratio as Type I for induced)
    Type_II_Output_Gambling = Type_I_Output_Gambling + (Type_II_Output - Type_I_Output) * ADJUSTMENT_FACTORS$output_mult_ratio,
    Type_II_VA_Gambling = Type_I_VA_Gambling + (Type_II_VA - Type_I_VA) * ADJUSTMENT_FACTORS$va_mult_ratio,
    Type_II_Wage_Gambling = Type_I_Wage_Gambling + (Type_II_Wage - Type_I_Wage) * ADJUSTMENT_FACTORS$wage_mult_ratio,
    Type_II_Tax_Gambling = Type_I_Tax_Gambling + (Type_II_Tax - Type_I_Tax) * ADJUSTMENT_FACTORS$topi_mult_ratio,

    # Mark as gambling-adjusted
    Sector = "7132",
    Sector_Name = "Gambling Industries"
  )

# Add gambling-specific employment for reference (not for coefficient calculation)
gambling_multipliers <- gambling_multipliers %>%
  left_join(
    gambling_by_state %>% select(state_name, gambling_employment, gambling_wages, gambling_avg_wage),
    by = c("State" = "state_name")
  ) %>%
  mutate(
    # Store actual gambling employment for reference
    Gambling_Employment_Actual = gambling_employment,
    Gambling_Wages_M_Actual = gambling_wages / 1e6,
    Gambling_Avg_Wage_Actual = gambling_avg_wage,

    # For the employment coefficient, keep the same STRUCTURE as blended 713
    # but the coefficient is already accounting for the different VA coefficient
    # This maintains consistency with the IO methodology
    VA_M_Gambling = Industry_Output_M * Direct_VA_Coef_Gambling,

    # Keep original employment coefficient - it represents the labor intensity
    # of the sector structure. We don't want to inflate it with actual gambling
    # employment which includes integrated resort employees.
    # The model calculates direct employment as: GGR × VA_coef × Emp_coef
    # Lower VA_coef already reduces direct employment appropriately.
    Emp_Coef_Gambling = Emp_Coef  # Keep blended 713 employment coefficient
  )

# ============================================================================
# SELECT OUTPUT COLUMNS
# ============================================================================

output_gambling <- gambling_multipliers %>%
  select(
    State,
    Abbrev,
    Sector,
    Sector_Name,

    # Employment data (from blended 713 for coefficient consistency)
    Employment,
    Total_Wages_M,
    Avg_Wage,

    # Actual gambling employment for reference
    Gambling_Employment_Actual,
    Gambling_Wages_M_Actual,
    Gambling_Avg_Wage_Actual,

    # Economic structure (gambling-adjusted)
    Industry_Output_M,
    VA_M = VA_M_Gambling,
    Direct_VA_Coef = Direct_VA_Coef_Gambling,
    Direct_Wage_Coef = Direct_Wage_Coef_Gambling,

    # Output multipliers (gambling-adjusted)
    Type_I_Output = Type_I_Output_Gambling,
    Type_II_Output = Type_II_Output_Gambling,

    # VA multipliers (gambling-adjusted)
    Type_I_VA = Type_I_VA_Gambling,
    Type_II_VA = Type_II_VA_Gambling,

    # Wage multipliers (gambling-adjusted)
    Type_I_Wage = Type_I_Wage_Gambling,
    Type_II_Wage = Type_II_Wage_Gambling,

    # Tax multipliers (gambling-adjusted TOPI)
    Direct_Tax_Coef = Direct_Tax_Coef_Gambling,
    Type_I_Tax = Type_I_Tax_Gambling,
    Type_II_Tax = Type_II_Tax_Gambling,

    # Employment coefficients (keep blended 713 structure for consistency)
    # These are jobs per $1M GDP for each effect type
    Emp_Coef = Emp_Coef_Gambling,
    Indirect_Emp_Coef,   # Jobs per $1M of indirect GDP (supply chain industries)
    Induced_Emp_Coef     # Jobs per $1M of induced GDP (household spending industries)
  )

# ============================================================================
# SAVE GAMBLING EMPLOYMENT DATA
# ============================================================================

gambling_emp_file <- "gambling_employment_by_state_2023.csv"
write.csv(gambling_by_state, gambling_emp_file, row.names = FALSE)
message("Saved: ", gambling_emp_file)

# ============================================================================
# SAVE GAMBLING-ADJUSTED MULTIPLIERS
# ============================================================================

gambling_mult_file <- "gambling_multipliers_2023.csv"
write.csv(output_gambling, gambling_mult_file, row.names = FALSE)
message("Saved: ", gambling_mult_file)

# ============================================================================
# CREATE COMBINED DATASET (713 blended + 7132 gambling)
# ============================================================================

# Load original multipliers
original_mult <- read.csv("employment_multipliers_2023.csv", stringsAsFactors = FALSE)

# Add gambling to the dataset
combined_mult <- bind_rows(original_mult, output_gambling) %>%
  arrange(State, Sector)

combined_file <- "employment_multipliers_2023_with_gambling.csv"
write.csv(combined_mult, combined_file, row.names = FALSE)
message("Saved: ", combined_file)

# ============================================================================
# COMPARISON SUMMARY
# ============================================================================

message("\n=== MULTIPLIER COMPARISON: Nevada ===\n")

nevada_713 <- original_mult %>% filter(State == "Nevada", Sector == "713")
nevada_7132 <- output_gambling %>% filter(State == "Nevada")

comparison_df <- data.frame(
  Metric = c("Direct VA Coef", "Direct Wage Coef", "Direct Tax Coef",
             "Type II Output", "Type II VA", "Type II Wage", "Type II Tax"),
  Blended_713 = c(nevada_713$Direct_VA_Coef, nevada_713$Direct_Wage_Coef, nevada_713$Direct_Tax_Coef,
                  nevada_713$Type_II_Output, nevada_713$Type_II_VA, nevada_713$Type_II_Wage, nevada_713$Type_II_Tax),
  Gambling_7132 = c(nevada_7132$Direct_VA_Coef, nevada_7132$Direct_Wage_Coef, nevada_7132$Direct_Tax_Coef,
                    nevada_7132$Type_II_Output, nevada_7132$Type_II_VA, nevada_7132$Type_II_Wage, nevada_7132$Type_II_Tax)
)
comparison_df$Difference = paste0(round((comparison_df$Gambling_7132 / comparison_df$Blended_713 - 1) * 100, 0), "%")

print(comparison_df)

message("\n=== IMPACT EXAMPLE: $100M GGR in Nevada ===\n")

ggr <- 100  # $100M

# Blended 713
impact_713 <- data.frame(
  Type = "Blended 713",
  Direct_Wages_M = ggr * nevada_713$Direct_Wage_Coef,
  Total_Wages_M = ggr * nevada_713$Type_II_Wage,
  Direct_GDP_M = ggr * nevada_713$Direct_VA_Coef,
  Total_GDP_M = ggr * nevada_713$Type_II_VA,
  Direct_TOPI_M = ggr * nevada_713$Direct_Tax_Coef,
  Total_TOPI_M = ggr * nevada_713$Type_II_Tax
)

# Gambling 7132
impact_7132 <- data.frame(
  Type = "Gambling 7132",
  Direct_Wages_M = ggr * nevada_7132$Direct_Wage_Coef,
  Total_Wages_M = ggr * nevada_7132$Type_II_Wage,
  Direct_GDP_M = ggr * nevada_7132$Direct_VA_Coef,
  Total_GDP_M = ggr * nevada_7132$Type_II_VA,
  Direct_TOPI_M = ggr * nevada_7132$Direct_Tax_Coef,
  Total_TOPI_M = ggr * nevada_7132$Type_II_Tax
)

impact_comparison <- bind_rows(impact_713, impact_7132)
print(impact_comparison)

message("\nUsing blended 713 OVERESTIMATES wage impacts by ~",
        round((impact_713$Total_Wages_M / impact_7132$Total_Wages_M - 1) * 100, 0), "%")
message("Using blended 713 OVERESTIMATES TOPI impacts by ~",
        round((impact_713$Total_TOPI_M / impact_7132$Total_TOPI_M - 1) * 100, 0), "%")

message("\n=== COMPLETE ===\n")
