# ============================================================================
# Process 2023 QCEW Employment Data for Casino Economic Impact Model
# ============================================================================
#
# This script processes BLS Quarterly Census of Employment and Wages (QCEW)
# data for 2023 and aggregates it to match EPA StateIO sector definitions.
#
# Input files:
#   - 2023.annual 711 NAICS 711 Performing arts, spectator sports...csv
#   - 2023.annual 712 NAICS 712 Museums, historical sites...csv
#   - 2023.annual 713 NAICS 713 Amusement, gambling, and recreation...csv
#   - 2023.annual 721 NAICS 721 Accommodation.csv
#   - 2023.annual 722 NAICS 722 Food services and drinking places.csv
#
# Output:
#   - employment_by_state_2023.csv
#
# IO Sector Mapping:
#   - 711AS = 711 + 712 (Performing arts + Museums)
#   - 713   = 713 (Amusement, gambling, recreation)
#   - 721   = 721 (Accommodation)
#   - 722   = 722 (Food services)
# ============================================================================

library(tidyverse)

# ============================================================================
# CONFIGURATION
# ============================================================================

# NAICS files to process
qcew_files <- list(
  "711" = "2023.annual 711 NAICS 711 Performing arts, spectator sports, and related industries.csv",
  "712" = "2023.annual 712 NAICS 712 Museums, historical sites, and similar institutions.csv",
  "713" = "2023.annual 713 NAICS 713 Amusement, gambling, and recreation industries.csv",
  "721" = "2023.annual 721 NAICS 721 Accommodation.csv",
  "722" = "2023.annual 722 NAICS 722 Food services and drinking places.csv"
)

# Mapping from NAICS to IO sector codes
naics_to_io <- list(
  "711" = "711AS",
  "712" = "711AS",
  "713" = "713",
  "721" = "721",
  "722" = "722"
)

# State FIPS codes (ending in 000 = statewide)
state_fips <- c(
  "01000" = "Alabama", "02000" = "Alaska", "04000" = "Arizona", "05000" = "Arkansas",
  "06000" = "California", "08000" = "Colorado", "09000" = "Connecticut", "10000" = "Delaware",
  "11000" = "District of Columbia", "12000" = "Florida", "13000" = "Georgia", "15000" = "Hawaii",
  "16000" = "Idaho", "17000" = "Illinois", "18000" = "Indiana", "19000" = "Iowa",
  "20000" = "Kansas", "21000" = "Kentucky", "22000" = "Louisiana", "23000" = "Maine",
  "24000" = "Maryland", "25000" = "Massachusetts", "26000" = "Michigan", "27000" = "Minnesota",
  "28000" = "Mississippi", "29000" = "Missouri", "30000" = "Montana", "31000" = "Nebraska",
  "32000" = "Nevada", "33000" = "New Hampshire", "34000" = "New Jersey", "35000" = "New Mexico",
  "36000" = "New York", "37000" = "North Carolina", "38000" = "North Dakota", "39000" = "Ohio",
  "40000" = "Oklahoma", "41000" = "Oregon", "42000" = "Pennsylvania", "44000" = "Rhode Island",
  "45000" = "South Carolina", "46000" = "South Dakota", "47000" = "Tennessee", "48000" = "Texas",
  "49000" = "Utah", "50000" = "Vermont", "51000" = "Virginia", "53000" = "Washington",
  "54000" = "West Virginia", "55000" = "Wisconsin", "56000" = "Wyoming"
)

state_abbrevs <- c(
  "Alabama" = "AL", "Alaska" = "AK", "Arizona" = "AZ", "Arkansas" = "AR",
  "California" = "CA", "Colorado" = "CO", "Connecticut" = "CT", "Delaware" = "DE",
  "District of Columbia" = "DC", "Florida" = "FL", "Georgia" = "GA", "Hawaii" = "HI",
  "Idaho" = "ID", "Illinois" = "IL", "Indiana" = "IN", "Iowa" = "IA",
  "Kansas" = "KS", "Kentucky" = "KY", "Louisiana" = "LA", "Maine" = "ME",
  "Maryland" = "MD", "Massachusetts" = "MA", "Michigan" = "MI", "Minnesota" = "MN",
  "Mississippi" = "MS", "Missouri" = "MO", "Montana" = "MT", "Nebraska" = "NE",
  "Nevada" = "NV", "New Hampshire" = "NH", "New Jersey" = "NJ", "New Mexico" = "NM",
  "New York" = "NY", "North Carolina" = "NC", "North Dakota" = "ND", "Ohio" = "OH",
  "Oklahoma" = "OK", "Oregon" = "OR", "Pennsylvania" = "PA", "Rhode Island" = "RI",
  "South Carolina" = "SC", "South Dakota" = "SD", "Tennessee" = "TN", "Texas" = "TX",
  "Utah" = "UT", "Vermont" = "VT", "Virginia" = "VA", "Washington" = "WA",
  "West Virginia" = "WV", "Wisconsin" = "WI", "Wyoming" = "WY"
)

# ============================================================================
# FUNCTION: Read and process single QCEW file
# ============================================================================

process_qcew_file <- function(file_path, naics_code) {

  message("Reading: ", basename(file_path))

  # Read the CSV
  df <- read.csv(file_path, stringsAsFactors = FALSE)

  # Filter for:
  # - State-level data (agglvl_code = 55 for "State, NAICS 3-digit -- by ownership sector")
  # - Private sector (own_code = 5)
  # - Statewide totals (area_fips ends in "000")
  state_data <- df %>%
    filter(
      agglvl_code == 55,
      own_code == 5,
      grepl("000$", area_fips),
      area_fips %in% names(state_fips)
    ) %>%
    select(
      area_fips,
      area_title,
      industry_code,
      annual_avg_emplvl,
      total_annual_wages,
      avg_annual_pay
    ) %>%
    mutate(
      naics = naics_code,
      io_sector = naics_to_io[[naics_code]],
      state_name = state_fips[area_fips],
      state_abbrev = state_abbrevs[state_name]
    )

  message("  Found ", nrow(state_data), " state-level records")

  return(state_data)
}

# ============================================================================
# MAIN PROCESSING
# ============================================================================

message("\n=== Processing 2023 QCEW Employment Data ===\n")

# Process all files
all_data <- data.frame()

for (naics in names(qcew_files)) {
  file_path <- qcew_files[[naics]]

  if (file.exists(file_path)) {
    file_data <- process_qcew_file(file_path, naics)
    all_data <- rbind(all_data, file_data)
  } else {
    message("WARNING: File not found - ", file_path)
  }
}

message("\nTotal records loaded: ", nrow(all_data))

# ============================================================================
# AGGREGATE TO IO SECTOR LEVEL
# ============================================================================

message("\n=== Aggregating to IO Sector Level ===\n")

# Aggregate by state and IO sector
# Note: 711AS = 711 + 712, so we sum those together
employment_by_state <- all_data %>%
  group_by(state_name, state_abbrev, io_sector) %>%
  summarise(
    employment = sum(annual_avg_emplvl, na.rm = TRUE),
    total_wages = sum(total_annual_wages, na.rm = TRUE),
    avg_wage = if(sum(annual_avg_emplvl, na.rm = TRUE) > 0) {
      sum(total_annual_wages, na.rm = TRUE) / sum(annual_avg_emplvl, na.rm = TRUE)
    } else {
      NA_real_
    },
    .groups = "drop"
  ) %>%
  arrange(state_name, io_sector)

message("Unique states: ", n_distinct(employment_by_state$state_name))
message("Records per IO sector:")
print(table(employment_by_state$io_sector))

# ============================================================================
# SUMMARY STATISTICS
# ============================================================================

message("\n=== Employment Summary by IO Sector (National Totals) ===\n")

national_summary <- employment_by_state %>%
  group_by(io_sector) %>%
  summarise(
    total_employment = sum(employment, na.rm = TRUE),
    total_wages_billions = sum(total_wages, na.rm = TRUE) / 1e9,
    avg_wage = sum(total_wages, na.rm = TRUE) / sum(employment, na.rm = TRUE),
    states_with_data = sum(employment > 0),
    .groups = "drop"
  )

print(national_summary)

# ============================================================================
# SAMPLE STATE DATA
# ============================================================================

message("\n=== Sample: Nevada Employment Data ===\n")

nevada_data <- employment_by_state %>%
  filter(state_name == "Nevada")

print(nevada_data)

# ============================================================================
# SAVE OUTPUT
# ============================================================================

message("\n=== Saving Results ===\n")

output_file <- "employment_by_state_2023.csv"
write.csv(employment_by_state, output_file, row.names = FALSE)

message("Saved: ", output_file)
message("  Rows: ", nrow(employment_by_state))
message("  Columns: ", ncol(employment_by_state))

# Also save national summary
write.csv(national_summary, "employment_national_summary_2023.csv", row.names = FALSE)
message("Saved: employment_national_summary_2023.csv")

message("\n=== Complete ===\n")
