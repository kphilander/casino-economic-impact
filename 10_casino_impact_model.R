# ============================================================================
# CASINO ECONOMIC IMPACT MODEL
# Main User-Facing Function
#
# Takes casino revenue (GGR) and computes:
#   - Direct, Indirect, and Induced effects
#   - Output, GDP (Value Added), Employment, Wages
#   - Tax estimates:
#     * Taxes on Production (TOPI from IO tables, direct/indirect/induced)
#     * Gaming Tax (state-specific GGR tax rate, direct only)
#
# Data Year: 2023 (employment), 2019 (IO tables)
# Sources:
#   - EPA StateIO (2019) for IO multipliers (pre-pandemic)
#   - BLS QCEW (2023) for employment data
#   - State gaming commission reports for GGR tax rates
#   - BEA Detail IO (USEEIOv2.0.1-411) for gambling TOPI adjustment ratio
#
# Usage:
#   source("10_casino_impact_model.R")
#   impact <- calculate_casino_impact(100, "713", "Nevada")
#   print(impact)
# ============================================================================

library(tidyverse)

# ============================================================================
# STATE GAMING TAX RATES
# ============================================================================
# Effective GGR tax rates by state. For states with tiered or split
# slot/table rates, a blended effective rate is used.
# Sources: State gaming commission reports, AGA State of the States
#
# Note: These are taxes on gross gaming revenue specifically, not the
# general TOPI from IO tables. States without legal casino gaming
# are included at 0 (they may still have IO multiplier effects from
# other amusement/recreation activity in sector 713).
# ============================================================================

STATE_GAMING_TAX_RATES <- data.frame(
  State = c(
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
  GGR_Tax_Rate = c(
    0.00,  # Alabama - no commercial casinos
    0.00,  # Alaska - no commercial casinos
    0.08,  # Arizona - tribal compacts ~8%
    0.13,  # Arkansas - 13% of net gaming revenue
    0.00,  # California - tribal (no state GGR tax on tribal)
    0.20,  # Colorado - graduated up to 20%
    0.25,  # Connecticut - 25% (tribal compact)
    0.435, # Delaware - 43.5% table games + VLT share
    0.12,  # Florida - tribal compact ~12%
    0.00,  # Georgia - no commercial casinos
    0.00,  # Hawaii - no commercial casinos
    0.00,  # Idaho - tribal only
    0.15,  # Illinois - graduated, effective ~15%
    0.35,  # Indiana - graduated up to 40%, effective ~35%
    0.22,  # Iowa - graduated 5-22%
    0.27,  # Kansas - 27% state-owned casinos
    0.00,  # Kentucky - no commercial casinos (HHR different)
    0.215, # Louisiana - 21.5% riverboat
    0.46,  # Maine - Oxford ~46% (racino)
    0.40,  # Maryland - up to 40% on slots, lower on tables
    0.25,  # Massachusetts - 25% slots, 49% category 2
    0.19,  # Michigan - 19% Detroit casinos
    0.00,  # Minnesota - tribal only
    0.12,  # Mississippi - graduated 4-12%
    0.21,  # Missouri - 21% of AGR
    0.00,  # Montana - no commercial casinos
    0.00,  # Nebraska - 20% (new, effective 2023+)
    0.0675,# Nevada - 6.75% of GGR
    0.00,  # New Hampshire - no commercial casinos
    0.085, # New Jersey - 8.5% + 1.25% investment alt
    0.00,  # New Mexico - tribal compacts
    0.45,  # New York - varies 30-45% on commercial
    0.00,  # North Carolina - tribal only
    0.00,  # North Dakota - tribal only
    0.33,  # Ohio - 33% of GGR
    0.10,  # Oklahoma - tribal compacts ~6-10%
    0.00,  # Oregon - tribal only
    0.54,  # Pennsylvania - 54% slots, 16% table, blended ~42%
    0.51,  # Rhode Island - 51% of VLT net revenue
    0.00,  # South Carolina - no commercial casinos
    0.09,  # South Dakota - 9% of adjusted GGR
    0.00,  # Tennessee - no commercial casinos (sports betting different)
    0.00,  # Texas - no commercial casinos
    0.00,  # Utah - no gambling
    0.00,  # Vermont - no commercial casinos
    0.18,  # Virginia - graduated 18% effective
    0.00,  # Washington - tribal only
    0.35,  # West Virginia - 35% of net terminal income
    0.00,  # Wisconsin - tribal only
    0.00   # Wyoming - no commercial casinos
  ),
  stringsAsFactors = FALSE
)

# ============================================================================
# GAMBLING TOPI ADJUSTMENT RATIO
# ============================================================================
# The IO tables only have sector 713 (blended Amusement/Gambling/Recreation).
# Gambling (713200) has different TOPI characteristics than the blended sector.
# These ratios are derived from BEA Detail IO Tables (USEEIOv2.0.1-411):
#   TOPI_coef: 713200 = 0.035024, 713_blended = 0.057551 → ratio = 0.6086
#   Type I TOPI mult: 713200 = 0.060448, 713_blended = 0.084609 → ratio = 0.7144
# ============================================================================

GAMBLING_TOPI_ADJUSTMENT <- list(
  topi_coef_ratio = 0.6086,     # Direct TOPI coef: gambling / blended 713
  topi_mult_ratio = 0.7144      # Type I TOPI multiplier: gambling / blended 713
)

# ============================================================================
# LOAD MULTIPLIER DATA
# ============================================================================

# Path to multiplier data file
multiplier_data_file <- "employment_multipliers_2023.csv"

# Load on source (will be available as global)
if (file.exists(multiplier_data_file)) {
  MULTIPLIER_DATA <- read.csv(multiplier_data_file, stringsAsFactors = FALSE)
  message("Loaded multiplier data: ", nrow(MULTIPLIER_DATA), " state-sector combinations")
} else {
  warning("Multiplier data file not found: ", multiplier_data_file,
          "\nRun scripts 07-09 first to generate the data.")
  MULTIPLIER_DATA <- NULL
}

# ============================================================================
# SECTOR REFERENCE
# ============================================================================

CASINO_SECTORS <- data.frame(
  code = c("711AS", "713", "721", "722"),
  name = c(
    "Arts, Entertainment, Recreation",
    "Amusement, Gambling, Recreation",
    "Accommodation",
    "Food Services & Drinking Places"
  ),
  description = c(
    "Performing arts, spectator sports, museums",
    "Casinos, gambling, amusement parks, recreation",
    "Hotels, motels, casino hotels",
    "Restaurants, bars, drinking places"
  ),
  stringsAsFactors = FALSE
)

# ============================================================================
# MAIN FUNCTION: Calculate Casino Economic Impact
# ============================================================================

#' Calculate Economic Impact of Casino Revenue
#'
#' @param casino_revenue Numeric. Casino revenue (GGR) in millions of USD
#' @param sector Character. IO sector code: "711AS", "713", "721", or "722"
#' @param state Character. Full state name (e.g., "Nevada", "New Jersey")
#' @param include_details Logical. If TRUE, return additional details
#'
#' @return A list containing:
#'   - summary: Data frame with Direct, Indirect, Induced, Total, and Multiplier
#'   - metadata: Information about the calculation
#'   - details: (if include_details=TRUE) Additional coefficients and data
#'
#' @examples
#' # Calculate impact of $100M casino GGR in Nevada
#' impact <- calculate_casino_impact(100, "713", "Nevada")
#' print(impact$summary)
#'
calculate_casino_impact <- function(
    casino_revenue,
    sector = "713",
    state = "Nevada",
    include_details = FALSE,
    gaming_tax_rate = NULL
) {

  # ========================================
  # Input validation
  # ========================================

  if (is.null(MULTIPLIER_DATA)) {
    stop("Multiplier data not loaded. Run scripts 07-09 to generate data.")
  }

  if (!is.numeric(casino_revenue) || casino_revenue <= 0) {
    stop("casino_revenue must be a positive number (in millions USD)")
  }

  if (!sector %in% CASINO_SECTORS$code) {
    stop("Invalid sector. Use one of: ", paste(CASINO_SECTORS$code, collapse = ", "))
  }

  # Get state data
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
      stop("State not found: ", state,
           "\nAvailable states: ", paste(head(possible_states, 10), collapse = ", "), "...")
    }
  }

  # ========================================
  # Extract multipliers and coefficients
  # ========================================

  # Output multipliers
  type1_output <- state_data$Type_I_Output
  type2_output <- state_data$Type_II_Output

  # Value Added (GDP) multipliers
  type1_va <- state_data$Type_I_VA
  type2_va <- state_data$Type_II_VA

  # Wage multipliers
  type1_wage <- state_data$Type_I_Wage
  type2_wage <- state_data$Type_II_Wage

  # Employment coefficients (jobs per $1M GDP for each effect type)
  indirect_emp_coef <- state_data$Indirect_Emp_Coef
  induced_emp_coef <- state_data$Induced_Emp_Coef

  # Tax multipliers (taxes on production & imports)
  type1_tax <- state_data$Type_I_Tax
  type2_tax <- state_data$Type_II_Tax

  # Direct coefficients
  va_coef <- state_data$Direct_VA_Coef
  wage_coef <- state_data$Direct_Wage_Coef
  tax_coef <- state_data$Direct_Tax_Coef
  emp_coef <- state_data$Emp_Coef

  # ========================================
  # Calculate Output Impacts
  # ========================================

  # Direct = initial spending
  output_direct <- casino_revenue

  # Indirect = supplier purchases (Type I - 1)
  output_indirect <- casino_revenue * (type1_output - 1)

  # Induced = household spending (Type II - Type I)
  output_induced <- casino_revenue * (type2_output - type1_output)

  # Total
  output_total <- casino_revenue * type2_output

  # ========================================
  # Calculate GDP (Value Added) Impacts
  # ========================================

  # Direct GDP = revenue × VA coefficient
  gdp_direct <- casino_revenue * va_coef

  # For indirect and induced, use the VA multiplier decomposition
  # Type I VA = direct VA effect propagated through economy
  # Type II VA = Type I + induced from household spending

  gdp_type1_total <- casino_revenue * type1_va
  gdp_type2_total <- casino_revenue * type2_va

  gdp_indirect <- gdp_type1_total - gdp_direct
  gdp_induced <- gdp_type2_total - gdp_type1_total
  gdp_total <- gdp_type2_total

  # ========================================
  # Calculate Employment Impacts
  # ========================================

  # Direct employment = direct GDP × employment coefficient
  # (jobs per $1M GDP)
  emp_direct <- gdp_direct * emp_coef

  # Indirect/induced employment uses separate coefficients weighted
  # for the industries receiving each type of spending
  emp_indirect <- gdp_indirect * indirect_emp_coef
  emp_induced <- gdp_induced * induced_emp_coef
  emp_total <- emp_direct + emp_indirect + emp_induced

  # ========================================
  # Calculate Wage Impacts
  # ========================================

  # Direct wages = revenue × wage coefficient
  wage_direct <- casino_revenue * wage_coef

  # Total wages using wage multipliers
  wage_type1_total <- casino_revenue * type1_wage
  wage_type2_total <- casino_revenue * type2_wage

  wage_indirect <- wage_type1_total - wage_direct
  wage_induced <- wage_type2_total - wage_type1_total
  wage_total <- wage_type2_total

  # ========================================
  # Calculate Tax Impacts
  # ========================================

  # --- 1. Taxes on Production & Imports (TOPI) from IO tables ---
  # These flow through the Leontief inverse like wages.
  # For sector 713 used as GGR input, the TOPI coefficients are for the
  # blended sector (includes golf, fitness, etc). The gambling-specific
  # TOPI is lower (ratio ~0.61 for direct, ~0.71 for Type I).
  # Indirect and induced TOPI reflect supply chain and household spending
  # taxes across OTHER sectors, so no gambling adjustment needed there.
  topi_direct <- casino_revenue * tax_coef
  topi_type1_total <- casino_revenue * type1_tax
  topi_type2_total <- casino_revenue * type2_tax
  topi_indirect <- topi_type1_total - topi_direct
  topi_induced <- topi_type2_total - topi_type1_total
  topi_total <- topi_type2_total

  # --- 2. Gaming Tax (state-specific rate on GGR, direct only) ---
  if (is.null(gaming_tax_rate)) {
    gaming_tax_rate <- STATE_GAMING_TAX_RATES$GGR_Tax_Rate[
      STATE_GAMING_TAX_RATES$State == state
    ]
    if (length(gaming_tax_rate) == 0) gaming_tax_rate <- 0
  }
  gaming_tax <- casino_revenue * gaming_tax_rate

  # --- Total tax across categories ---
  total_tax_direct <- topi_direct + gaming_tax
  total_tax_indirect <- topi_indirect
  total_tax_induced <- topi_induced
  total_tax_total <- total_tax_direct + total_tax_indirect + total_tax_induced

  # ========================================
  # Build Summary Table
  # ========================================

  summary_df <- data.frame(
    Metric = c("Output ($M)", "GDP ($M)", "Employment (Jobs)", "Wages ($M)"),

    Direct = c(
      round(output_direct, 2),
      round(gdp_direct, 2),
      round(emp_direct, 0),
      round(wage_direct, 2)
    ),

    Indirect = c(
      round(output_indirect, 2),
      round(gdp_indirect, 2),
      round(emp_indirect, 0),
      round(wage_indirect, 2)
    ),

    Induced = c(
      round(output_induced, 2),
      round(gdp_induced, 2),
      round(emp_induced, 0),
      round(wage_induced, 2)
    ),

    Total = c(
      round(output_total, 2),
      round(gdp_total, 2),
      round(emp_total, 0),
      round(wage_total, 2)
    ),

    Multiplier = c(
      round(type2_output, 3),
      round(type2_va / va_coef, 3),
      round(emp_total / emp_direct, 3),
      round(type2_wage / wage_coef, 3)
    ),

    stringsAsFactors = FALSE
  )

  # Tax detail table
  tax_df <- data.frame(
    Tax_Category = c("Gaming Tax", "Taxes on Production", "Total Tax Revenue"),

    Direct = c(
      round(gaming_tax, 2),
      round(topi_direct, 2),
      round(total_tax_direct, 2)
    ),

    Indirect = c(
      round(0, 2),
      round(topi_indirect, 2),
      round(total_tax_indirect, 2)
    ),

    Induced = c(
      round(0, 2),
      round(topi_induced, 2),
      round(total_tax_induced, 2)
    ),

    Total = c(
      round(gaming_tax, 2),
      round(topi_total, 2),
      round(total_tax_total, 2)
    ),

    stringsAsFactors = FALSE
  )

  # ========================================
  # Metadata
  # ========================================

  metadata <- list(
    input_revenue_M = casino_revenue,
    sector_code = sector,
    sector_name = CASINO_SECTORS$name[CASINO_SECTORS$code == sector],
    state = state,
    data_year = 2023,
    methodology = "Industry Technology Assumption (ITA)",
    data_sources = c(
      "IO Tables: EPA StateIO (2019)",
      "Employment: BLS QCEW (2023)"
    ),
    tax_rates = list(
      gaming_tax_rate = gaming_tax_rate
    )
  )

  # ========================================
  # Return results
  # ========================================

  result <- list(
    summary = summary_df,
    tax_summary = tax_df,
    metadata = metadata
  )

  if (include_details) {
    result$details <- list(
      # Direct coefficients
      direct_va_coef = va_coef,
      direct_wage_coef = wage_coef,
      direct_tax_coef = tax_coef,
      employment_coef = emp_coef,

      # Type I multipliers
      type1_output = type1_output,
      type1_va = type1_va,
      type1_wage = type1_wage,
      type1_tax = type1_tax,

      # Type II multipliers
      type2_output = type2_output,
      type2_va = type2_va,
      type2_wage = type2_wage,
      type2_tax = type2_tax,

      # Tax rates used
      gaming_tax_rate = gaming_tax_rate,

      # Industry data
      industry_output_M = state_data$Industry_Output_M,
      total_employment = state_data$Employment,
      avg_wage = state_data$Avg_Wage
    )
  }

  class(result) <- c("casino_impact", "list")

  return(result)
}

# ============================================================================
# PRINT METHOD
# ============================================================================

print.casino_impact <- function(x, ...) {

  cat("\n")
  cat("═══════════════════════════════════════════════════════════════════\n")
  cat("                    CASINO ECONOMIC IMPACT ANALYSIS                 \n")
  cat("═══════════════════════════════════════════════════════════════════\n")
  cat("\n")

  cat("Input:    $", format(x$metadata$input_revenue_M, big.mark = ","), " million GGR\n", sep = "")
  cat("Sector:   ", x$metadata$sector_name, " (", x$metadata$sector_code, ")\n", sep = "")
  cat("State:    ", x$metadata$state, "\n", sep = "")
  cat("Year:     ", x$metadata$data_year, "\n", sep = "")
  cat("\n")

  cat("───────────────────────────────────────────────────────────────────\n")
  cat("                         ECONOMIC IMPACTS                           \n")
  cat("───────────────────────────────────────────────────────────────────\n")
  cat("\n")

  # Print formatted summary table
  summary_wide <- x$summary
  colnames(summary_wide) <- c("Metric", "Direct", "Indirect", "Induced", "Total", "Multiplier")

  # Format for display
  print(summary_wide, row.names = FALSE, right = TRUE)

  cat("\n")
  cat("───────────────────────────────────────────────────────────────────\n")
  cat("                         TAX REVENUE ESTIMATES                      \n")
  cat("───────────────────────────────────────────────────────────────────\n")
  cat("\n")

  print(x$tax_summary, row.names = FALSE, right = TRUE)

  cat("\n")
  cat("  Gaming Tax Rate: ", sprintf("%.1f%%", x$metadata$tax_rates$gaming_tax_rate * 100), "\n", sep = "")

  cat("\n")
  cat("───────────────────────────────────────────────────────────────────\n")
  cat("\n")
  cat("Methodology: ", x$metadata$methodology, "\n", sep = "")
  cat("Data Sources:\n")
  for (src in x$metadata$data_sources) {
    cat("  - ", src, "\n", sep = "")
  }
  cat("\n")
  cat("═══════════════════════════════════════════════════════════════════\n")
  cat("\n")

  invisible(x)
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

#' List Available States
list_states <- function() {
  if (is.null(MULTIPLIER_DATA)) {
    stop("Multiplier data not loaded.")
  }
  sort(unique(MULTIPLIER_DATA$State))
}

#' List Available Sectors
list_sectors <- function() {
  print(CASINO_SECTORS)
}

#' Get Multipliers for a State
get_state_multipliers <- function(state) {
  if (is.null(MULTIPLIER_DATA)) {
    stop("Multiplier data not loaded.")
  }

  state_data <- MULTIPLIER_DATA %>%
    filter(State == state) %>%
    select(Sector, Sector_Name,
           Type_I_Output, Type_II_Output,
           Type_I_VA, Type_II_VA,
           Type_I_Tax, Type_II_Tax,
           Direct_VA_Coef, Direct_Tax_Coef, Emp_Coef)

  return(state_data)
}

#' Compare Impacts Across States
compare_states <- function(casino_revenue, sector, states) {
  results <- data.frame()

  for (s in states) {
    tryCatch({
      impact <- calculate_casino_impact(casino_revenue, sector, s)
      row <- data.frame(
        State = s,
        Output_Total = impact$summary$Total[1],
        GDP_Total = impact$summary$Total[2],
        Employment_Total = impact$summary$Total[3],
        Wages_Total = impact$summary$Total[4],
        Tax_Total = impact$tax_summary$Total[5],
        Output_Mult = impact$summary$Multiplier[1],
        stringsAsFactors = FALSE
      )
      results <- rbind(results, row)
    }, error = function(e) {
      message("Skipping ", s, ": ", e$message)
    })
  }

  return(results %>% arrange(desc(Output_Mult)))
}

# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if (interactive() && !is.null(MULTIPLIER_DATA)) {

  message("\n=== Example: $100M Casino GGR in Nevada ===\n")

  impact <- calculate_casino_impact(
    casino_revenue = 100,
    sector = "713",
    state = "Nevada",
    include_details = TRUE
  )

  print(impact)

  message("\n=== Detailed Coefficients ===\n")

  if (!is.null(impact$details)) {
    cat("Direct VA Coefficient:     ", round(impact$details$direct_va_coef, 4), " (VA per $1 output)\n")
    cat("Direct Wage Coefficient:   ", round(impact$details$direct_wage_coef, 4), " (wages per $1 output)\n")
    cat("Direct Tax Coefficient:    ", round(impact$details$direct_tax_coef, 4), " (TOPI per $1 output)\n")
    cat("Employment Coefficient:    ", round(impact$details$employment_coef, 2), " (jobs per $1M GDP)\n")
    cat("\n")
    cat("Type I Output Multiplier:  ", round(impact$details$type1_output, 4), "\n")
    cat("Type II Output Multiplier: ", round(impact$details$type2_output, 4), "\n")
    cat("Type I Tax Multiplier:     ", round(impact$details$type1_tax, 4), "\n")
    cat("Type II Tax Multiplier:    ", round(impact$details$type2_tax, 4), "\n")
    cat("\n")
    cat("Gaming Tax Rate:           ", sprintf("%.2f%%", impact$details$gaming_tax_rate * 100), "\n")
  }

  message("\n=== Compare Major Gaming States ===\n")

  gaming_states <- c("Nevada", "New Jersey", "Pennsylvania", "Michigan", "Massachusetts")

  comparison <- compare_states(100, "713", gaming_states)
  print(comparison)

}
