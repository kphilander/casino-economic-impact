# ============================================================================
# CASINO ECONOMIC IMPACT MODEL
# Main User-Facing Function
#
# Takes casino revenue (GGR) and computes:
#   - Direct, Indirect, and Induced effects
#   - Output, GDP (Value Added), Employment, and Wages
#
# Data Year: 2023 (employment), 2019 (IO tables)
# Sources:
#   - EPA StateIO (2019) for IO multipliers (pre-pandemic)
#   - BLS QCEW (2023) for employment data
#
# Usage:
#   source("10_casino_impact_model.R")
#   impact <- calculate_casino_impact(100, "713", "Nevada")
#   print(impact)
# ============================================================================

library(tidyverse)

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
    include_details = FALSE
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

  # Employment multipliers (account for labor intensity across sectors)
  type1_emp_mult <- state_data$Type_I_Emp_Mult
  type2_emp_mult <- state_data$Type_II_Emp_Mult

  # Direct coefficients
  va_coef <- state_data$Direct_VA_Coef
  wage_coef <- state_data$Direct_Wage_Coef
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

  # Use employment multipliers to calculate indirect/induced
  # These multipliers account for the different labor intensities
  # of sectors receiving indirect and induced spending
  emp_indirect <- emp_direct * (type1_emp_mult - 1)
  emp_induced <- emp_direct * (type2_emp_mult - type1_emp_mult)
  emp_total <- emp_direct * type2_emp_mult

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
    )
  )

  # ========================================
  # Return results
  # ========================================

  result <- list(
    summary = summary_df,
    metadata = metadata
  )

  if (include_details) {
    result$details <- list(
      # Direct coefficients
      direct_va_coef = va_coef,
      direct_wage_coef = wage_coef,
      employment_coef = emp_coef,

      # Type I multipliers
      type1_output = type1_output,
      type1_va = type1_va,
      type1_wage = type1_wage,

      # Type II multipliers
      type2_output = type2_output,
      type2_va = type2_va,
      type2_wage = type2_wage,

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
           Direct_VA_Coef, Emp_Coef)

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
    cat("Employment Coefficient:    ", round(impact$details$employment_coef, 2), " (jobs per $1M GDP)\n")
    cat("\n")
    cat("Type I Output Multiplier:  ", round(impact$details$type1_output, 4), "\n")
    cat("Type II Output Multiplier: ", round(impact$details$type2_output, 4), "\n")
  }

  message("\n=== Compare Major Gaming States ===\n")

  gaming_states <- c("Nevada", "New Jersey", "Pennsylvania", "Michigan", "Massachusetts")

  comparison <- compare_states(100, "713", gaming_states)
  print(comparison)

}
