# ============================================================================
# Generate multipliers.json with tax (TOPI) columns for the web app
#
# Reads the updated CSV files and outputs a complete multipliers.json
# that includes Direct_Tax_Coef, Type_I_Tax, Type_II_Tax in all sections.
# ============================================================================

library(tidyverse)
library(jsonlite)

# Read the existing JSON to preserve metadata and propertyTypes
existing_json <- fromJSON(
  "/Users/ksr/Library/CloudStorage/GoogleDrive-kphilander@gmail.com/My Drive/1 - Documents/Research/Econ Impact/Claude/casino_impact_study/webapp/src/data/multipliers.json",
  simplifyDataFrame = TRUE
)

message("Existing JSON sections: ", paste(names(existing_json), collapse = ", "))

# Read updated CSVs with tax columns
emp_mult <- read.csv("employment_multipliers_2023.csv", stringsAsFactors = FALSE)
gambling_mult <- read.csv("gambling_multipliers_2023.csv", stringsAsFactors = FALSE)

message("Employment mult columns: ", paste(names(emp_mult), collapse = ", "))
message("Gambling mult columns: ", paste(names(gambling_mult), collapse = ", "))

# Verify tax columns exist
stopifnot("Direct_Tax_Coef" %in% names(emp_mult))
stopifnot("Direct_Tax_Coef" %in% names(gambling_mult))

# Update the multipliers section (sectors 711AS, 713, 721, 722)
# Keep all existing columns and add tax columns
existing_mult_df <- as.data.frame(existing_json$multipliers)
message("\nExisting multiplier columns: ", paste(names(existing_mult_df), collapse = ", "))

# Merge tax columns into existing multipliers
tax_cols <- emp_mult %>%
  select(State, Sector, Direct_Tax_Coef, Type_I_Tax, Type_II_Tax)

updated_mult <- existing_mult_df %>%
  left_join(tax_cols, by = c("State", "Sector"))

missing <- sum(is.na(updated_mult$Direct_Tax_Coef))
message("Multipliers missing tax data: ", missing, " / ", nrow(updated_mult))

# Update gambling section
existing_gambling_df <- as.data.frame(existing_json$gambling)
message("\nExisting gambling columns: ", paste(names(existing_gambling_df), collapse = ", "))

gambling_tax_cols <- gambling_mult %>%
  select(State, Direct_Tax_Coef, Type_I_Tax, Type_II_Tax)

updated_gambling <- existing_gambling_df %>%
  left_join(gambling_tax_cols, by = "State")

missing_g <- sum(is.na(updated_gambling$Direct_Tax_Coef))
message("Gambling missing tax data: ", missing_g, " / ", nrow(updated_gambling))

# Update propertyTypes section - add tax columns there too
# PropertyTypes uses the same underlying sector multipliers
if ("propertyTypes" %in% names(existing_json)) {
  message("\nProperty types sections: ", paste(names(existing_json$propertyTypes), collapse = ", "))

  updated_property_types <- existing_json$propertyTypes

  for (pt_name in names(updated_property_types)) {
    pt_df <- as.data.frame(updated_property_types[[pt_name]])
    message("  ", pt_name, ": ", nrow(pt_df), " rows, columns: ", paste(names(pt_df), collapse = ", "))

    # Property types map to specific sectors:
    # 721120 (Casino Hotel) -> 721
    # 713210 (Stand-alone Casino) -> 713
    # 713290 (Slot Parlor) -> 713
    # 722410 (Bar/Restaurant Gaming) -> 722
    pt_sector_map <- c("721120" = "721", "713210" = "713", "713290" = "713", "722410" = "722")
    mapped_sector <- pt_sector_map[pt_name]

    if (!is.na(mapped_sector)) {
      sector_tax <- emp_mult %>%
        filter(Sector == mapped_sector) %>%
        select(State, Direct_Tax_Coef, Type_I_Tax, Type_II_Tax)

      # Property types have their own adjusted coefficients, but TOPI follows the sector
      # For now, use the sector-level TOPI (can be refined later with property-type adjustment)
      pt_df <- pt_df %>%
        left_join(sector_tax, by = "State")

      updated_property_types[[pt_name]] <- pt_df
      message("    -> Added tax columns from sector ", mapped_sector)
    }
  }
} else {
  updated_property_types <- NULL
}

# Build the output JSON
output_json <- list(
  metadata = existing_json$metadata,
  multipliers = updated_mult,
  gambling = updated_gambling
)

# Update metadata
output_json$metadata$notes <- c(
  existing_json$metadata$notes,
  "Tax columns (Direct_Tax_Coef, Type_I_Tax, Type_II_Tax) represent Taxes on Production & Imports (TOPI)",
  "TOPI for gambling (7132) uses adjustment ratio of 0.6086 (direct) and 0.7144 (multiplier) from BEA Detail IO"
)

if (!is.null(updated_property_types)) {
  output_json$propertyTypes <- updated_property_types
}

# Preserve propertyTypeMetadata and states from original
if ("propertyTypeMetadata" %in% names(existing_json)) {
  output_json$propertyTypeMetadata <- existing_json$propertyTypeMetadata
}
if ("states" %in% names(existing_json)) {
  output_json$states <- existing_json$states
}

# Write JSON
json_output <- toJSON(output_json, pretty = TRUE, auto_unbox = TRUE, digits = 6)

output_path <- "multipliers_with_tax.json"
writeLines(json_output, output_path)
message("\nSaved: ", output_path, " (", file.size(output_path), " bytes)")

# Verification
message("\n=== Verification ===")
nv_mult <- updated_mult %>% filter(State == "Nevada", Sector == "713")
nv_gamb <- updated_gambling %>% filter(State == "Nevada")

message("Nevada 713: Direct_Tax_Coef=", round(nv_mult$Direct_Tax_Coef, 4),
        " Type_I_Tax=", round(nv_mult$Type_I_Tax, 4),
        " Type_II_Tax=", round(nv_mult$Type_II_Tax, 4))
message("Nevada 7132: Direct_Tax_Coef=", round(nv_gamb$Direct_Tax_Coef, 4),
        " Type_I_Tax=", round(nv_gamb$Type_I_Tax, 4),
        " Type_II_Tax=", round(nv_gamb$Type_II_Tax, 4))

message("\n=== COMPLETE ===")
