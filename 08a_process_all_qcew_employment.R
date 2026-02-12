# ============================================================================
# PROCESS ALL QCEW EMPLOYMENT DATA FOR IO SECTORS
#
# Reads BLS QCEW 2023 data for all industries and maps to IO sector codes.
# This provides employment coefficients for all 71 IO sectors, which are
# needed to calculate true employment-weighted multipliers.
#
# Input: 2023.annual.by_industry/ folder with QCEW CSV files
# Output: employment_all_sectors_2023.csv
# ============================================================================

library(tidyverse)

# ============================================================================
# NAICS TO IO SECTOR MAPPING
# ============================================================================

# BEA Summary IO sectors use combinations of NAICS codes
# This mapping is based on BEA's concordance for Summary-level IO tables

naics_to_io <- tribble(
  ~naics_prefix, ~io_sector, ~io_name,
  # Agriculture, Forestry, Fishing
  "111", "111CA", "Farms",
  "112", "111CA", "Farms",
  "113", "113FF", "Forestry, fishing, and related activities",
  "114", "113FF", "Forestry, fishing, and related activities",
  "115", "113FF", "Forestry, fishing, and related activities",

  # Mining
  "211", "211", "Oil and gas extraction",
  "212", "212", "Mining, except oil and gas",
  "213", "213", "Support activities for mining",

  # Utilities
  "22", "22", "Utilities",
  "221", "22", "Utilities",

  # Construction
  "23", "23", "Construction",
  "236", "23", "Construction",
  "237", "23", "Construction",
  "238", "23", "Construction",

  # Manufacturing - Food, Beverage, Tobacco
  "311", "311FT", "Food and beverage and tobacco products",
  "312", "311FT", "Food and beverage and tobacco products",

  # Manufacturing - Textiles, Apparel, Leather
  "313", "313TT", "Textile mills and textile product mills",
  "314", "313TT", "Textile mills and textile product mills",
  "315", "315AL", "Apparel and leather and allied products",
  "316", "315AL", "Apparel and leather and allied products",

  # Manufacturing - Wood, Paper, Printing
  "321", "321", "Wood products",
  "322", "322", "Paper products",
  "323", "323", "Printing and related support activities",

  # Manufacturing - Petroleum, Chemical, Plastics
  "324", "324", "Petroleum and coal products",
  "325", "325", "Chemical products",
  "326", "326", "Plastics and rubber products",

  # Manufacturing - Nonmetallic minerals, Metals
  "327", "327", "Nonmetallic mineral products",
  "331", "331", "Primary metals",
  "332", "332", "Fabricated metal products",

  # Manufacturing - Machinery, Electronics
  "333", "333", "Machinery",
  "334", "334", "Computer and electronic products",
  "335", "335", "Electrical equipment, appliances, and components",

  # Manufacturing - Transportation equipment
  "3361", "3361MV", "Motor vehicles, bodies and trailers, and parts",
  "3362", "3361MV", "Motor vehicles, bodies and trailers, and parts",
  "3363", "3361MV", "Motor vehicles, bodies and trailers, and parts",
  "3364", "3364OT", "Other transportation equipment",
  "3365", "3364OT", "Other transportation equipment",
  "3366", "3364OT", "Other transportation equipment",
  "3369", "3364OT", "Other transportation equipment",

  # Manufacturing - Furniture, Misc
  "337", "337", "Furniture and related products",
  "339", "339", "Miscellaneous manufacturing",

  # Wholesale Trade
  "42", "42", "Wholesale trade",
  "423", "42", "Wholesale trade",
  "424", "42", "Wholesale trade",
  "425", "42", "Wholesale trade",

  # Retail Trade
  "441", "441", "Motor vehicle and parts dealers",
  "444", "4A0", "Other retail",
  "445", "445", "Food and beverage stores",
  "449", "4A0", "Other retail",
  "452", "452", "General merchandise stores",
  "455", "452", "General merchandise stores",
  "456", "4A0", "Other retail",
  "457", "4A0", "Other retail",
  "458", "4A0", "Other retail",
  "459", "4A0", "Other retail",

  # Transportation
  "481", "481", "Air transportation",
  "482", "482", "Rail transportation",
  "483", "483", "Water transportation",
  "484", "484", "Truck transportation",
  "485", "485", "Transit and ground passenger transportation",
  "486", "486", "Pipeline transportation",
  "487", "487OS", "Other transportation and support activities",
  "488", "487OS", "Other transportation and support activities",
  "491", "487OS", "Other transportation and support activities",
  "492", "487OS", "Other transportation and support activities",
  "493", "493", "Warehousing and storage",

  # Information
  "511", "511", "Publishing industries, except internet",
  "512", "512", "Motion picture and sound recording industries",
  "515", "513", "Broadcasting and telecommunications",
  "517", "513", "Broadcasting and telecommunications",
  "518", "514", "Data processing, internet publishing, and other information services",
  "519", "514", "Data processing, internet publishing, and other information services",

  # Finance and Insurance
  "521", "521CI", "Federal Reserve banks, credit intermediation, and related activities",
  "522", "521CI", "Federal Reserve banks, credit intermediation, and related activities",
  "523", "523", "Securities, commodity contracts, and investments",
  "524", "524", "Insurance carriers and related activities",
  "525", "525", "Funds, trusts, and other financial vehicles",

  # Real Estate
  "531", "HS", "Housing",  # Owner-occupied housing imputed
  "5311", "ORE", "Other real estate",
  "5312", "ORE", "Other real estate",
  "532", "532RL", "Rental and leasing services and lessors of intangible assets",
  "533", "532RL", "Rental and leasing services and lessors of intangible assets",

  # Professional Services
  "5411", "5411", "Legal services",
  "5412", "5412OP", "Miscellaneous professional, scientific, and technical services",
  "5413", "5412OP", "Miscellaneous professional, scientific, and technical services",
  "5414", "5412OP", "Miscellaneous professional, scientific, and technical services",
  "5415", "5415", "Computer systems design and related services",
  "5416", "5412OP", "Miscellaneous professional, scientific, and technical services",
  "5417", "5412OP", "Miscellaneous professional, scientific, and technical services",
  "5418", "5412OP", "Miscellaneous professional, scientific, and technical services",
  "5419", "5412OP", "Miscellaneous professional, scientific, and technical services",

  # Management
  "55", "55", "Management of companies and enterprises",
  "551", "55", "Management of companies and enterprises",

  # Administrative and Waste Services
  "561", "561", "Administrative and support services",
  "562", "562", "Waste management and remediation services",

  # Education
  "61", "61", "Educational services",
  "611", "61", "Educational services",

  # Health Care
  "621", "621", "Ambulatory health care services",
  "622", "622", "Hospitals",
  "623", "623", "Nursing and residential care facilities",
  "624", "624", "Social assistance",

  # Arts, Entertainment, Recreation
  "711", "711AS", "Performing arts, spectator sports, museums, and related activities",
  "712", "711AS", "Performing arts, spectator sports, museums, and related activities",
  "713", "713", "Amusements, gambling, and recreation industries",

  # Accommodation and Food Services
  "721", "721", "Accommodation",
  "722", "722", "Food services and drinking places",

  # Other Services
  "81", "81", "Other services, except government",
  "811", "81", "Other services, except government",
  "812", "81", "Other services, except government",
  "813", "81", "Other services, except government",
  "814", "81", "Other services, except government",

  # Government
  "92", "GSLG", "State and local general government",
  "921", "GSLG", "State and local general government",
  "922", "GSLG", "State and local general government",
  "923", "GSLG", "State and local general government",
  "924", "GSLG", "State and local general government",
  "925", "GSLG", "State and local general government",
  "926", "GSLG", "State and local general government",
  "927", "GSLG", "State and local general government",
  "928", "GFGD", "Federal general government (defense)",  # Simplified
  "999", "GSLG", "State and local general government"  # Unclassified -> state/local
)

# State FIPS codes
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

# ============================================================================
# FUNCTION: Read and process QCEW file
# ============================================================================

process_qcew_file <- function(file_path) {

  # Extract NAICS code from filename
  filename <- basename(file_path)

  # Pattern: "2023.annual XXX NAICS XXX description.csv"
  naics_match <- str_match(filename, "NAICS (\\d+)")
  if (is.na(naics_match[1])) {
    return(NULL)
  }
  naics_code <- naics_match[2]

  # Read file
  tryCatch({
    df <- read.csv(file_path, stringsAsFactors = FALSE)

    # Filter for state-level private sector data
    state_data <- df %>%
      filter(
        agglvl_code %in% c(50, 51, 52, 53, 54, 55, 56, 57, 58),  # State-level by ownership
        own_code == 5,  # Private sector
        grepl("000$", area_fips),  # Statewide totals
        area_fips %in% names(state_fips)
      ) %>%
      select(
        area_fips,
        industry_code,
        annual_avg_emplvl,
        total_annual_wages
      ) %>%
      mutate(
        naics = naics_code,
        state_name = state_fips[area_fips]
      )

    return(state_data)

  }, error = function(e) {
    return(NULL)
  })
}

# ============================================================================
# MAIN PROCESSING
# ============================================================================

message("\n=== Processing All QCEW Employment Data ===\n")

qcew_dir <- "2023.annual.by_industry"

# Get all NAICS files (3-digit level preferred for IO mapping)
all_files <- list.files(qcew_dir, pattern = "NAICS.*\\.csv$", full.names = TRUE)
message("Found ", length(all_files), " QCEW files")

# Process files for 3-digit NAICS codes (best mapping to IO sectors)
naics_3digit_files <- all_files[grepl("NAICS [0-9]{3} ", basename(all_files))]
message("Processing ", length(naics_3digit_files), " 3-digit NAICS files")

all_data <- data.frame()

for (file in naics_3digit_files) {
  file_data <- process_qcew_file(file)
  if (!is.null(file_data) && nrow(file_data) > 0) {
    all_data <- rbind(all_data, file_data)
  }
}

message("Total records from 3-digit files: ", nrow(all_data))

# Also process 2-digit NAICS for sectors that aggregate at that level
naics_2digit_files <- all_files[grepl("NAICS [0-9]{2} ", basename(all_files))]
message("Processing ", length(naics_2digit_files), " 2-digit NAICS files for aggregates")

for (file in naics_2digit_files) {
  file_data <- process_qcew_file(file)
  if (!is.null(file_data) && nrow(file_data) > 0) {
    # Only add if not already covered by 3-digit
    existing_naics <- unique(substr(all_data$naics, 1, 2))
    file_naics <- unique(file_data$naics)
    if (!file_naics %in% existing_naics) {
      all_data <- rbind(all_data, file_data)
    }
  }
}

message("Total records after adding 2-digit: ", nrow(all_data))

# ============================================================================
# MAP TO IO SECTORS
# ============================================================================

message("\n=== Mapping NAICS to IO Sectors ===\n")

# Function to find IO sector for a NAICS code
find_io_sector <- function(naics) {
  # Try exact match first, then progressively shorter prefixes
  for (len in c(nchar(naics), 4, 3, 2)) {
    prefix <- substr(naics, 1, len)
    match <- naics_to_io %>% filter(naics_prefix == prefix)
    if (nrow(match) > 0) {
      return(match$io_sector[1])
    }
  }
  return(NA_character_)
}

# Map each record to IO sector
all_data <- all_data %>%
  rowwise() %>%
  mutate(io_sector = find_io_sector(naics)) %>%
  ungroup()

# Check mapping coverage
mapped <- sum(!is.na(all_data$io_sector))
total <- nrow(all_data)
message("Mapped ", mapped, " of ", total, " records (", round(100*mapped/total, 1), "%)")

# Show unmapped NAICS codes
unmapped_naics <- all_data %>%
  filter(is.na(io_sector)) %>%
  distinct(naics)
if (nrow(unmapped_naics) > 0) {
  message("Unmapped NAICS codes: ", paste(unmapped_naics$naics, collapse = ", "))
}

# ============================================================================
# AGGREGATE TO IO SECTOR LEVEL
# ============================================================================

message("\n=== Aggregating to IO Sector Level ===\n")

employment_by_io <- all_data %>%
  filter(!is.na(io_sector)) %>%
  group_by(state_name, io_sector) %>%
  summarise(
    employment = sum(annual_avg_emplvl, na.rm = TRUE),
    total_wages = sum(total_annual_wages, na.rm = TRUE),
    avg_wage = if(sum(annual_avg_emplvl, na.rm = TRUE) > 0) {
      sum(total_annual_wages, na.rm = TRUE) / sum(annual_avg_emplvl, na.rm = TRUE)
    } else {
      NA_real_
    },
    .groups = "drop"
  )

# Check coverage
io_sectors_found <- length(unique(employment_by_io$io_sector))
states_found <- length(unique(employment_by_io$state_name))
message("Found ", io_sectors_found, " unique IO sectors across ", states_found, " states")

# ============================================================================
# SAVE RESULTS
# ============================================================================

message("\n=== Saving Results ===\n")

output_file <- "employment_all_sectors_2023.csv"
write.csv(employment_by_io, output_file, row.names = FALSE)
message("Saved: ", output_file)
message("Records: ", nrow(employment_by_io))

# Show Nevada summary
message("\n=== Nevada Employment by IO Sector (sample) ===\n")
nv_sample <- employment_by_io %>%
  filter(state_name == "Nevada") %>%
  arrange(desc(employment)) %>%
  head(15)
print(nv_sample)

# Show sector coverage
message("\n=== IO Sectors with Employment Data ===\n")
io_sectors <- employment_by_io %>%
  group_by(io_sector) %>%
  summarise(
    states = n(),
    total_emp = sum(employment, na.rm = TRUE),
    .groups = "drop"
  ) %>%
  arrange(desc(total_emp))

print(io_sectors)

message("\n=== COMPLETE ===\n")
