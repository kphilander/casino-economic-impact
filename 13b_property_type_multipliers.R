# ============================================================================
# ASSEMBLE LAND-BASED PROPERTY-TYPE DATA FROM THE CANONICAL GAMBLING MODEL
# ============================================================================
#
# Property type is a reporting/UI classification, not a production-function
# substitution. Every land-based property's gaming activity uses the same
# state-localized StateIO 713 structure adapted with the reproducible national
# USEEIO 713200 ratios. In department mode, lodging, food, and other revenue are
# modeled separately with StateIO 721, 722, and 711AS.
# ============================================================================

library(tidyverse)

gambling_file <- Sys.getenv(
  "GEMS_GAMBLING_MULTIPLIERS_FILE",
  unset = "gambling_multipliers_2023.csv"
)
if (!file.exists(gambling_file)) stop("Missing input: ", gambling_file)

gambling <- read.csv(gambling_file, stringsAsFactors = FALSE)

property_definitions <- tribble(
  ~Property_Type, ~Property_Label,
  "721120", "Resort with Hotel & Casino",
  "713210", "Stand-alone Casino",
  "713290", "Slot Parlors / Bingo Halls",
  "722410", "Bars/Restaurants with Slots"
)

property_multipliers <- bind_rows(lapply(seq_len(nrow(property_definitions)), function(i) {
  gambling %>%
    mutate(
      Property_Type = property_definitions$Property_Type[i],
      Property_Label = property_definitions$Property_Label[i],
      Parent_Sector = "713",
      Coefficient_Source = paste(
        "Canonical gambling model; property type is descriptive.",
        "Use department mode for lodging/food/other revenue composition."
      )
    ) %>%
    select(State, Abbrev, Property_Type, Property_Label, Parent_Sector,
           Coefficient_Source, everything())
}))

stopifnot(nrow(property_multipliers) == 200)
write.csv(property_multipliers, "property_type_multipliers_2023.csv", row.names = FALSE)
message("Saved property_type_multipliers_2023.csv (200 rows)")
