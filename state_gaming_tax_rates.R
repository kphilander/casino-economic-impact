# ============================================================================
# STATE GAMING TAX RATES - COMPREHENSIVE DATA
# ============================================================================
#
# Compiled: May 2025
# Sources:
#   - American Gaming Association (AGA) State of the States reports
#   - Individual state gaming commission websites
#   - Tax Foundation state gambling tax rate compilations
#   - State statutes as referenced per entry
#
# IMPORTANT: These rates were compiled from training knowledge as of May 2025.
#   Verify critical rates against current state gaming commission publications
#   before using in official reports. Legislative changes may have occurred.
#
# Usage:
#   source("state_gaming_tax_rates.R")
#   # Access the flat lookup:
#   GAMING_TAX_RATES$effective_rate[GAMING_TAX_RATES$state == "Nevada"]
#   # Access detailed tiers:
#   get_tiered_rate("Illinois", ggr = 120000000)
#   # Access full detail:
#   get_state_gaming_detail("Pennsylvania")
# ============================================================================

library(jsonlite)

# ============================================================================
# 1. FLAT EFFECTIVE RATE LOOKUP (for quick use in impact model)
# ============================================================================
# This is the simple version: one blended effective rate per state.
# For states with split slot/table rates, the effective rate is a weighted
# estimate assuming roughly 65% slot / 35% table revenue split (national avg).

GAMING_TAX_RATES <- data.frame(
  state = c(
    "Alabama", "Alaska", "Arizona", "Arkansas", "California",
    "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
    "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
    "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
    "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
    "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
  ),
  abbrev = c(
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
  ),
  has_commercial = c(
    FALSE, FALSE, FALSE, TRUE,  FALSE, TRUE,  FALSE, TRUE,  TRUE,  FALSE,
    FALSE, FALSE, TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,
    TRUE,  TRUE,  FALSE, TRUE,  TRUE,  FALSE, TRUE,  TRUE,  FALSE, TRUE,
    TRUE,  TRUE,  FALSE, FALSE, TRUE,  FALSE, FALSE, TRUE,  TRUE,  FALSE,
    TRUE,  FALSE, FALSE, FALSE, FALSE, TRUE,  FALSE, TRUE,  FALSE, FALSE
  ),
  has_tribal = c(
    TRUE,  FALSE, TRUE,  FALSE, TRUE,  TRUE,  TRUE,  FALSE, TRUE,  FALSE,
    FALSE, TRUE,  FALSE, FALSE, TRUE,  TRUE,  FALSE, TRUE,  TRUE,  FALSE,
    TRUE,  TRUE,  TRUE,  TRUE,  FALSE, TRUE,  TRUE,  FALSE, FALSE, FALSE,
    TRUE,  TRUE,  TRUE,  TRUE,  FALSE, TRUE,  TRUE,  FALSE, FALSE, TRUE,
    TRUE,  FALSE, TRUE,  FALSE, FALSE, FALSE, TRUE,  FALSE, TRUE,  TRUE
  ),
  # Rate structure: flat, tiered, split_game_type, split_by_license,
  #                 split_by_facility, state_operated, tribal_compact, none
  rate_structure = c(
    "none",            # AL
    "none",            # AK
    "tribal_compact",  # AZ
    "tiered",          # AR
    "tribal_compact",  # CA
    "tiered",          # CO
    "tribal_compact",  # CT (compact, not traditional commercial)
    "state_operated",  # DE
    "tribal_compact",  # FL
    "none",            # GA
    "none",            # HI
    "tribal_compact",  # ID
    "tiered",          # IL
    "tiered",          # IN
    "tiered",          # IA
    "flat",            # KS
    "split_game_type", # KY
    "flat",            # LA
    "split_by_facility", # ME
    "split_game_type", # MD
    "split_by_license", # MA
    "flat",            # MI
    "tribal_compact",  # MN
    "tiered",          # MS
    "flat",            # MO
    "flat",            # MT (limited VGTs only)
    "flat",            # NE
    "flat",            # NV
    "none",            # NH
    "flat",            # NJ
    "flat",            # NM
    "split_game_type", # NY
    "tribal_compact",  # NC
    "none",            # ND
    "flat",            # OH
    "tribal_compact",  # OK
    "tribal_compact",  # OR
    "split_game_type", # PA
    "state_operated",  # RI
    "none",            # SC
    "flat",            # SD
    "none",            # TN
    "none",            # TX
    "none",            # UT
    "none",            # VT
    "tiered",          # VA
    "tribal_compact",  # WA
    "split_game_type", # WV
    "tribal_compact",  # WI
    "tribal_compact"   # WY
  ),
  # Blended effective rate estimate
  # For tiered: assumes a mid-to-large casino (~$150-250M GGR)
  # For split: assumes ~65% slots / 35% tables (national average)
  effective_rate = c(
    0.000,   # AL - no commercial casinos
    0.000,   # AK - no gambling
    0.080,   # AZ - tribal compact ~8% top tier
    0.130,   # AR - 13% (most casinos under $150M threshold)
    0.000,   # CA - tribal (no state GGR tax)
    0.185,   # CO - graduated, effective ~18.5%
    0.250,   # CT - 25% tribal compact (slots only)
    0.375,   # DE - blended ~37.5% (43.5% slots, 15.5% tables)
    0.120,   # FL - Seminole compact ~12%
    0.000,   # GA - no gambling
    0.000,   # HI - no gambling
    0.000,   # ID - tribal only
    0.400,   # IL - graduated, effective ~40% for large casinos
    0.320,   # IN - graduated + supplemental, effective ~32%
    0.220,   # IA - 22% (nearly all revenue in top bracket)
    0.270,   # KS - 27% state-owned
    0.075,   # KY - blended ~7.5% (8.5% slots, 6.5% tables)
    0.215,   # LA - 21.5% riverboat
    0.390,   # ME - blended across facilities
    0.400,   # MD - blended ~40% (40-61% slots, 20% tables)
    0.250,   # MA - 25% for Category 1 resort casinos
    0.193,   # MI - 8.35% state + 10.9% city = ~19.3%
    0.000,   # MN - tribal only (no revenue sharing)
    0.120,   # MS - 8% state + ~4% local = ~12%
    0.210,   # MO - 21%
    0.150,   # MT - 15% on VGTs (limited gaming)
    0.200,   # NE - 20%
    0.068,   # NV - 6.75%
    0.000,   # NH - no casinos
    0.098,   # NJ - 8.5% + 1.25% invest + 2.5% community
    0.260,   # NM - 26% racinos
    0.370,   # NY - blended ~37% (45% slots, 10% tables)
    0.000,   # NC - tribal only
    0.000,   # ND - tribal only
    0.330,   # OH - 33%
    0.060,   # OK - tribal ~6% weighted average
    0.000,   # OR - tribal only
    0.420,   # PA - blended ~42% (54% slots, 16% tables)
    0.510,   # RI - state share ~51% (VLTs)
    0.000,   # SC - no casinos
    0.090,   # SD - 9%
    0.000,   # TN - no casinos (sports betting only)
    0.000,   # TX - no casinos
    0.000,   # UT - no gambling
    0.000,   # VT - no casinos
    0.180,   # VA - 18% (most revenue in first tier)
    0.000,   # WA - tribal only
    0.380,   # WV - blended ~38% (44% VLTs, 35% tables)
    0.000,   # WI - tribal only
    0.000    # WY - tribal only
  ),
  source_year = rep(2024, 50),
  stringsAsFactors = FALSE
)


# ============================================================================
# 2. DETAILED SLOT/TABLE SPLIT RATES
# ============================================================================
# For states that tax slots and table games differently

SPLIT_RATE_STATES <- data.frame(
  state = c(
    "Pennsylvania", "Pennsylvania",
    "New York", "New York",
    "Maryland", "Maryland",
    "West Virginia", "West Virginia",
    "Delaware", "Delaware",
    "Rhode Island", "Rhode Island",
    "Maine", "Maine",
    "Connecticut", "Connecticut",
    "Kentucky", "Kentucky"
  ),
  game_type = c(
    "slots", "table_games",
    "slots", "table_games",
    "slots", "table_games",
    "slots", "table_games",
    "slots", "table_games",
    "slots", "table_games",
    "slots", "table_games",
    "slots", "table_games",
    "slots", "table_games"
  ),
  rate = c(
    0.54, 0.16,    # PA
    0.45, 0.10,    # NY
    0.50, 0.20,    # MD (avg across facilities; actual range 40-61% slots)
    0.44, 0.35,    # WV
    0.435, 0.155,  # DE
    0.611, 0.16,   # RI (state share)
    0.42, 0.16,    # ME (weighted avg across facilities)
    0.25, 0.00,    # CT (compact: 25% on slots, nothing on tables)
    0.085, 0.065   # KY
  ),
  notes = c(
    "Highest slot rate among full-scale commercial states",
    "Relatively low table rate; 2% local share included",
    "Commercial casinos (upstate); VLT/racinos have different structure",
    "10% on table games at commercial casinos",
    "Range: 40% (Tioga Downs) to 61% (Live! Casino) across facilities",
    "20% of table game GGR",
    "Net terminal income to state",
    "35% of table game GGR",
    "State retains as revenue (state-operated)",
    "15.5% of table game GGR",
    "61.1% state share (state-operated model)",
    "16% state share of table game GGR",
    "Weighted average across Oxford (46%) and Bangor (39%)",
    "Oxford Casino rate; Bangor differs",
    "Tribal compact revenue sharing on slots only",
    "No compact payment on table games",
    "Authorized 2023, effective 2025",
    "Authorized 2023, effective 2025"
  ),
  stringsAsFactors = FALSE
)


# ============================================================================
# 3. TIERED RATE SCHEDULES
# ============================================================================
# For states with graduated/progressive tax brackets

TIERED_RATE_STATES <- list(
  Illinois = data.frame(
    bracket = 1:7,
    min_ggr = c(0, 25e6, 50e6, 75e6, 100e6, 150e6, 200e6),
    max_ggr = c(25e6, 50e6, 75e6, 100e6, 150e6, 200e6, Inf),
    rate = c(0.15, 0.225, 0.275, 0.325, 0.375, 0.40, 0.50),
    notes = c(rep("Standard graduated rates", 6),
              "Chicago casino faces additional 3.5% surcharge"),
    stringsAsFactors = FALSE
  ),

  Indiana = data.frame(
    bracket = 1:5,
    min_ggr = c(0, 25e6, 50e6, 75e6, 150e6),
    max_ggr = c(25e6, 50e6, 75e6, 150e6, Inf),
    rate = c(0.15, 0.20, 0.25, 0.30, 0.35),
    notes = c(rep("Graduated wagering tax", 4),
              "Plus 3.5% supplemental wagering tax on all AGR"),
    stringsAsFactors = FALSE
  ),

  Iowa = data.frame(
    bracket = 1:3,
    min_ggr = c(0, 1e6, 3e6),
    max_ggr = c(1e6, 3e6, Inf),
    rate = c(0.05, 0.10, 0.22),
    notes = rep("Graduated gaming tax", 3),
    stringsAsFactors = FALSE
  ),

  Colorado = data.frame(
    bracket = 1:6,
    min_ggr = c(0, 2e6, 5e6, 8e6, 10e6, 13e6),
    max_ggr = c(2e6, 5e6, 8e6, 10e6, 13e6, Inf),
    rate = c(0.005, 0.02, 0.09, 0.11, 0.16, 0.20),
    notes = rep("Graduated tax on adjusted gross proceeds", 6),
    stringsAsFactors = FALSE
  ),

  Mississippi = data.frame(
    bracket = 1:3,
    min_ggr = c(0, 50000, 134000),
    max_ggr = c(50000, 134000, Inf),
    rate = c(0.04, 0.06, 0.08),
    notes = c(rep("State rate; local jurisdictions add up to 4%", 2),
              "State rate 8% + typical local 4% = 12% total"),
    stringsAsFactors = FALSE
  ),

  Arkansas = data.frame(
    bracket = 1:2,
    min_ggr = c(0, 150e6),
    max_ggr = c(150e6, Inf),
    rate = c(0.13, 0.20),
    notes = c("Per Amendment 100 (2018)",
              "Revenue above $150M taxed at 20%"),
    stringsAsFactors = FALSE
  ),

  Virginia = data.frame(
    bracket = 1:3,
    min_ggr = c(0, 200e6, 400e6),
    max_ggr = c(200e6, 400e6, Inf),
    rate = c(0.18, 0.23, 0.30),
    notes = rep("Graduated AGR tax", 3),
    stringsAsFactors = FALSE
  ),

  Arizona = data.frame(
    bracket = 1:4,
    min_ggr = c(0, 25e6, 75e6, 100e6),
    max_ggr = c(25e6, 75e6, 100e6, Inf),
    rate = c(0.01, 0.03, 0.06, 0.08),
    notes = rep("Tribal compact revenue sharing tiers", 4),
    stringsAsFactors = FALSE
  )
)


# ============================================================================
# 4. HELPER FUNCTIONS
# ============================================================================

#' Calculate the effective tiered tax rate for a given GGR amount
#'
#' @param state Character. State name (must be in TIERED_RATE_STATES)
#' @param ggr Numeric. Gross gaming revenue in dollars
#' @return Numeric. Total tax amount
#'
#' @examples
#' get_tiered_tax("Illinois", 120000000)  # $120M GGR
get_tiered_tax <- function(state, ggr) {
  if (!state %in% names(TIERED_RATE_STATES)) {
    stop("State '", state, "' does not have tiered rates. ",
         "Available: ", paste(names(TIERED_RATE_STATES), collapse = ", "))
  }

  tiers <- TIERED_RATE_STATES[[state]]
  total_tax <- 0

  for (i in 1:nrow(tiers)) {
    bracket_min <- tiers$min_ggr[i]
    bracket_max <- tiers$max_ggr[i]

    if (ggr > bracket_min) {
      taxable_in_bracket <- min(ggr, bracket_max) - bracket_min
      total_tax <- total_tax + taxable_in_bracket * tiers$rate[i]
    }
  }

  return(total_tax)
}


#' Get the effective rate for a tiered state given a GGR amount
#'
#' @param state Character. State name
#' @param ggr Numeric. Gross gaming revenue in dollars
#' @return Numeric. Effective tax rate (0-1)
get_tiered_rate <- function(state, ggr) {
  tax <- get_tiered_tax(state, ggr)
  return(tax / ggr)
}


#' Get the split rate for a state and game type
#'
#' @param state Character. State name
#' @param game_type Character. "slots" or "table_games"
#' @return Numeric. Tax rate for that game type
get_split_rate <- function(state, game_type = c("slots", "table_games")) {
  game_type <- match.arg(game_type)
  row <- SPLIT_RATE_STATES[SPLIT_RATE_STATES$state == state &
                             SPLIT_RATE_STATES$game_type == game_type, ]
  if (nrow(row) == 0) {
    warning("No split rate found for ", state, " / ", game_type)
    return(NA)
  }
  return(row$rate)
}


#' Calculate blended rate given slot and table GGR
#'
#' @param state Character. State name (must be in SPLIT_RATE_STATES)
#' @param slot_ggr Numeric. Slot machine GGR
#' @param table_ggr Numeric. Table game GGR
#' @return List with slot_tax, table_tax, total_tax, effective_rate
calculate_blended_tax <- function(state, slot_ggr, table_ggr) {
  slot_rate <- get_split_rate(state, "slots")
  table_rate <- get_split_rate(state, "table_games")

  if (is.na(slot_rate) || is.na(table_rate)) {
    # Fall back to flat effective rate
    eff_rate <- GAMING_TAX_RATES$effective_rate[GAMING_TAX_RATES$state == state]
    total_ggr <- slot_ggr + table_ggr
    return(list(
      slot_tax = NA,
      table_tax = NA,
      total_tax = total_ggr * eff_rate,
      effective_rate = eff_rate,
      method = "flat_fallback"
    ))
  }

  slot_tax <- slot_ggr * slot_rate
  table_tax <- table_ggr * table_rate
  total_ggr <- slot_ggr + table_ggr
  total_tax <- slot_tax + table_tax

  return(list(
    slot_tax = slot_tax,
    table_tax = table_tax,
    total_tax = total_tax,
    effective_rate = total_tax / total_ggr,
    slot_rate = slot_rate,
    table_rate = table_rate,
    method = "split"
  ))
}


#' Get comprehensive detail for a state
#'
#' @param state Character. Full state name
#' @return List with all available gaming tax information
get_state_gaming_detail <- function(state) {
  row <- GAMING_TAX_RATES[GAMING_TAX_RATES$state == state, ]

  if (nrow(row) == 0) {
    stop("State not found: ", state)
  }

  detail <- list(
    state = state,
    abbrev = row$abbrev,
    has_commercial = row$has_commercial,
    has_tribal = row$has_tribal,
    rate_structure = row$rate_structure,
    effective_rate = row$effective_rate,
    source_year = row$source_year
  )

  # Add split rates if applicable
  splits <- SPLIT_RATE_STATES[SPLIT_RATE_STATES$state == state, ]
  if (nrow(splits) > 0) {
    detail$slot_rate <- splits$rate[splits$game_type == "slots"]
    detail$table_rate <- splits$rate[splits$game_type == "table_games"]
    detail$slot_notes <- splits$notes[splits$game_type == "slots"]
    detail$table_notes <- splits$notes[splits$game_type == "table_games"]
  }

  # Add tiers if applicable
  if (state %in% names(TIERED_RATE_STATES)) {
    detail$tiers <- TIERED_RATE_STATES[[state]]
  }

  return(detail)
}


#' Get effective rate for any state, with optional GGR for tiered calculation
#'
#' This is the primary function for the impact model. It returns the best
#' available rate estimate for the given state and revenue level.
#'
#' @param state Character. Full state name
#' @param ggr_dollars Numeric. GGR in dollars (used for tiered states). Default 150M.
#' @param slot_share Numeric. Share of GGR from slots (0-1). Default 0.65.
#' @return Numeric. Effective tax rate (0-1)
get_effective_gaming_tax_rate <- function(state, ggr_dollars = 150e6, slot_share = 0.65) {

  row <- GAMING_TAX_RATES[GAMING_TAX_RATES$state == state, ]
  if (nrow(row) == 0) {
    warning("State not found: ", state, ". Returning 0.")
    return(0)
  }

  structure <- row$rate_structure

  # Tiered states: calculate actual effective rate
  if (state %in% names(TIERED_RATE_STATES)) {
    return(get_tiered_rate(state, ggr_dollars))
  }

  # Split game type states: calculate blended rate
  splits <- SPLIT_RATE_STATES[SPLIT_RATE_STATES$state == state, ]
  if (nrow(splits) == 2) {
    slot_ggr <- ggr_dollars * slot_share
    table_ggr <- ggr_dollars * (1 - slot_share)
    result <- calculate_blended_tax(state, slot_ggr, table_ggr)
    return(result$effective_rate)
  }

  # All other states: return the flat effective rate

  return(row$effective_rate)
}


# ============================================================================
# 5. SUMMARY TABLE FOR REFERENCE
# ============================================================================

#' Print a formatted summary of all state gaming tax rates
print_gaming_tax_summary <- function() {
  cat("\n")
  cat("============================================================\n")
  cat("    US STATE GAMING TAX RATES - COMMERCIAL CASINOS\n")
  cat("    Compiled May 2025 (rates as of 2024 unless noted)\n")
  cat("============================================================\n\n")

  commercial_states <- GAMING_TAX_RATES[GAMING_TAX_RATES$has_commercial, ]
  commercial_states <- commercial_states[order(-commercial_states$effective_rate), ]

  cat(sprintf("%-20s %8s %15s %s\n",
              "State", "Eff.Rate", "Structure", "Notes"))
  cat(paste(rep("-", 75), collapse = ""), "\n")

  for (i in 1:nrow(commercial_states)) {
    r <- commercial_states[i, ]
    note <- ""
    if (r$rate_structure == "split_game_type") note <- "Separate slot/table rates"
    if (r$rate_structure == "tiered") note <- "Graduated brackets"
    if (r$rate_structure == "state_operated") note <- "State-operated model"
    if (r$rate_structure == "split_by_license") note <- "Varies by license type"
    if (r$rate_structure == "split_by_facility") note <- "Varies by facility"

    cat(sprintf("%-20s %7.1f%% %15s %s\n",
                r$state,
                r$effective_rate * 100,
                r$rate_structure,
                note))
  }

  cat("\n")
  cat("Tribal-only states (no commercial):\n")
  tribal_only <- GAMING_TAX_RATES[!GAMING_TAX_RATES$has_commercial &
                                     GAMING_TAX_RATES$has_tribal, ]
  cat(paste(tribal_only$state, collapse = ", "), "\n")

  cat("\nNo casino gaming:\n")
  no_gaming <- GAMING_TAX_RATES[!GAMING_TAX_RATES$has_commercial &
                                   !GAMING_TAX_RATES$has_tribal, ]
  cat(paste(no_gaming$state, collapse = ", "), "\n\n")
}


# ============================================================================
# LOAD CONFIRMATION
# ============================================================================

message("State gaming tax rates loaded: ", nrow(GAMING_TAX_RATES), " states")
message("  Commercial casino states: ",
        sum(GAMING_TAX_RATES$has_commercial))
message("  Tribal gaming states: ",
        sum(GAMING_TAX_RATES$has_tribal))
message("  States with split slot/table rates: ",
        length(unique(SPLIT_RATE_STATES$state)))
message("  States with tiered brackets: ",
        length(TIERED_RATE_STATES))
message("")
message("Key functions:")
message("  get_effective_gaming_tax_rate(state, ggr_dollars, slot_share)")
message("  get_state_gaming_detail(state)")
message("  get_tiered_rate(state, ggr)")
message("  calculate_blended_tax(state, slot_ggr, table_ggr)")
message("  print_gaming_tax_summary()")
