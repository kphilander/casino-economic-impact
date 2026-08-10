# ============================================================================
# EXPORT THE VERSIONED MULTIPLIER DATA TO THE WEB APPLICATION
# ============================================================================

library(tidyverse)
library(jsonlite)
employment <- read.csv("employment_multipliers_2023.csv", stringsAsFactors = FALSE)
gambling <- read.csv("gambling_multipliers_2023.csv", stringsAsFactors = FALSE)
properties <- read.csv("property_type_multipliers_2023.csv", stringsAsFactors = FALSE)
online <- read.csv("online_gambling_multipliers_2023.csv", stringsAsFactors = FALSE)

stopifnot(nrow(employment) == 200, nrow(gambling) == 50,
          nrow(properties) == 200, nrow(online) == 50)

land_codes <- c("721120", "713210", "713290", "722410")
property_types <- setNames(lapply(land_codes, function(code) {
  properties %>% filter(Property_Type == code)
}), land_codes)

# Online casino and sportsbook share the same online production-function
# estimate; the codes distinguish reporting/tax treatment in the interface.
property_types$ONLINE_CASINO <- online %>%
  mutate(Property_Type = "ONLINE_CASINO", Property_Label = "Online Casino / iGaming")
property_types$ONLINE_SPORTSBOOK <- online %>%
  mutate(Property_Type = "ONLINE_SPORTSBOOK", Property_Label = "Online Sportsbook")

property_metadata <- list(
  "721120" = list(
    code = "721120", label = "Resort with Hotel & Casino",
    shortLabel = "Casino Hotel",
    description = paste(
      "Integrated casino-hotel reporting label.",
      "Gaming uses the canonical gambling coefficients; use department mode",
      "to model lodging and food revenue separately."
    ),
    parentSector = "713", parentSectorName = "Canonical gambling model"
  ),
  "713210" = list(
    code = "713210", label = "Stand-alone Casino", shortLabel = "Casino",
    description = paste(
      "Traditional casino reporting label.",
      "Gaming uses the canonical gambling coefficients."
    ),
    parentSector = "713", parentSectorName = "Canonical gambling model"
  ),
  "713290" = list(
    code = "713290", label = "Slot Parlors / Bingo Halls",
    shortLabel = "Slot Parlor",
    description = paste(
      "Limited-gaming venue reporting label.",
      "Gaming uses the canonical gambling coefficients."
    ),
    parentSector = "713", parentSectorName = "Canonical gambling model"
  ),
  "722410" = list(
    code = "722410", label = "Bars/Restaurants with Slots",
    shortLabel = "Bar Gaming",
    description = paste(
      "Ancillary-gaming reporting label.",
      "Gaming uses the canonical gambling coefficients; use department mode",
      "to model food and beverage revenue separately."
    ),
    parentSector = "713", parentSectorName = "Canonical gambling model"
  ),
  "ONLINE_CASINO" = list(
    code = "ONLINE_CASINO", label = "Online Casino / iGaming",
    shortLabel = "iGaming",
    description = "Online casino operations (slots, table games, poker)",
    parentSector = "7132",
    parentSectorName = "Gambling Industries (online-adjusted)"
  ),
  "ONLINE_SPORTSBOOK" = list(
    code = "ONLINE_SPORTSBOOK", label = "Online Sportsbook",
    shortLabel = "Sportsbook", description = "Online sports betting operations",
    parentSector = "7132",
    parentSectorName = "Gambling Industries (online-adjusted)"
  )
)

export_date <- Sys.getenv(
  "GEMS_EXPORT_DATE",
  unset = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
)

output <- list(
  metadata = list(
    exportDate = export_date,
    dataYear = 2023,
    ioTableYear = 2019,
    qcewYear = 2023,
    employmentCoefficientYear = 2023,
    stateCount = 50,
    multiplierRowCount = 200,
    description = paste(
      "2019 StateIO interindustry structure with consistent-2023 employment",
      "satellites and national USEEIO gambling calibration"
    ),
    propertyTypesIncluded = c(land_codes, "ONLINE_CASINO", "ONLINE_SPORTSBOOK"),
    notes = list(
      "Employment is QCEW filled jobs, not FTEs.",
      "Employment coefficients use 2023 QCEW jobs and 2023 StateIO output/value added.",
      "Owner-occupied housing and federal/state-local government-enterprise employment have no QCEW-compatible satellite; HS, GFE, and GSLE are explicit zeros rather than imputed averages.",
      "Land-based gaming uses StateIO 713 localized geography adapted with reproducible USEEIO 713200/US ratios.",
      "Land-based property type is descriptive; department mode uses 721, 722, and 711AS for separately entered lodging, food, and other revenue.",
      "Wage fields are StateIO V001 employee compensation; cash wages are estimated separately for tax bases.",
      "TOPI includes production taxes. Statutory gaming tax is a memo component and is not added to TOPI.",
      "Online coefficients are scenario approximations; enter observed in-state jobs and cash wages when available."
    )
  ),
  multipliers = employment,
  gambling = gambling,
  onlineGaming = online,
  propertyTypes = property_types,
  propertyTypeMetadata = property_metadata,
  states = sort(unique(employment$State))
)

json_output <- toJSON(output, pretty = TRUE, auto_unbox = TRUE, digits = 10,
                      na = "null")
writeLines(json_output, "webapp/src/data/multipliers.json")
writeLines(json_output, "multipliers_with_tax.json")
message("Exported webapp/src/data/multipliers.json and multipliers_with_tax.json")
