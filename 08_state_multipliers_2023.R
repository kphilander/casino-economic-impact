# ============================================================================
# STATE-LEVEL ECONOMIC MULTIPLIERS FOR CASINO-RELATED SECTORS
# All 50 US States
#
# Calculates:
#   - Type I Output Multipliers (direct + indirect)
#   - Type II Output Multipliers (direct + indirect + induced)
#   - Type I Value Added (GDP) Multipliers
#   - Type II Value Added (GDP) Multipliers
#   - Type I Wage Multipliers
#   - Type II Wage Multipliers
#   - Direct coefficients (VA, wage per $ output)
#
# Data Source: EPA StateIO via stateior R package
# Note: Using 2019 IO data to avoid pandemic-distorted interindustry
#       relationships. The employment satellite uses 2023 QCEW jobs and 2023
#       StateIO output/value added so its numerator and denominator share a
#       consistent vintage.
# Methodology: Industry Technology Assumption (ITA)
# ============================================================================

library(stateior)
library(tidyverse)

# ============================================================================
# CONFIGURATION
# ============================================================================

# Note: Using 2019 IO tables to avoid pandemic-distorted relationships in 2020
io_year <- 2019
employment_year <- 2023
fte_ratio_year <- 2023

# Target casino-related sectors, plus construction (23) for one-time
# construction-phase impacts of new or expanded properties
target_sectors <- c("711AS", "713", "721", "722", "23")
sector_names <- c(
  "711AS" = "Arts, Entertainment, Recreation",
  "713" = "Amusement, Gambling, Recreation",
  "721" = "Accommodation",
  "722" = "Food Services & Drinking Places",
  "23" = "Construction"
)

# All 50 states
state_names <- c(
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
)

state_abbrevs <- c(
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
)

# ============================================================================
# LOAD STATE IO DATA
# ============================================================================

message("\n=== Loading Two-Region StateIO Data (", io_year, ") ===\n")

two_region_make <- loadStateIODataFile(paste0("TwoRegion_Summary_Make_", io_year))
two_region_use <- loadStateIODataFile(paste0("TwoRegion_Summary_DomesticUse_", io_year))
two_region_ind_output <- loadStateIODataFile(paste0("TwoRegion_Summary_IndustryOutput_", io_year))
two_region_com_output <- loadStateIODataFile(paste0("TwoRegion_Summary_CommodityOutput_", io_year))
two_region_va <- loadStateIODataFile(paste0("TwoRegion_Summary_ValueAdded_", io_year))

# State-summary tables supply the 2023 dollar denominators for the QCEW jobs
# satellite. They do not replace the 2019 make/use matrices or Leontief inverse.
employment_year_use <- loadStateIODataFile(
  paste0("State_Summary_DomesticUse_", employment_year)
)
employment_year_output <- loadStateIODataFile(
  paste0("State_Summary_IndustryOutput_", employment_year)
)

message("Data loaded successfully!\n")

# ============================================================================
# LOAD QCEW EMPLOYMENT DATA FOR ALL SECTORS
# ============================================================================

message("=== Loading QCEW Employment Data ===\n")

qcew_all_sectors_file <- Sys.getenv(
  "GEMS_QCEW_ALL_SECTORS_FILE",
  unset = "employment_all_sectors_2023.csv"
)
if (file.exists(qcew_all_sectors_file)) {
  QCEW_ALL_SECTORS <- read.csv(qcew_all_sectors_file, stringsAsFactors = FALSE)
  message("Loaded employment data: ", nrow(QCEW_ALL_SECTORS), " state-sector records")
} else {
  stop("Employment data file not found: ", qcew_all_sectors_file,
       "\nRun 08a_process_all_qcew_employment.R first.")
}

required_employment_columns <- c("state_name", "io_sector", "employment")
if (!all(required_employment_columns %in% names(QCEW_ALL_SECTORS))) {
  stop("Employment input is missing required columns: ",
       paste(setdiff(required_employment_columns, names(QCEW_ALL_SECTORS)),
             collapse = ", "))
}
if (length(unique(QCEW_ALL_SECTORS$state_name)) != 50L ||
    length(unique(QCEW_ALL_SECTORS$io_sector)) != 71L) {
  stop("Expected a complete 50-state x 71-sector employment satellite")
}
unsupported_satellite_sectors <- c("HS", "GFE", "GSLE")
if (any(QCEW_ALL_SECTORS$employment[
  QCEW_ALL_SECTORS$io_sector %in% unsupported_satellite_sectors
] != 0, na.rm = TRUE)) {
  stop("HS, GFE, and GSLE must remain explicit zero-satellite sectors")
}

# National BEA FTE/job ratios are a second, explicitly estimated employment
# satellite. QCEW filled jobs remain the primary employment measure.
fte_ratio_file <- Sys.getenv(
  "GEMS_FTE_RATIO_FILE",
  unset = paste0("fte_ratios_", fte_ratio_year, ".csv")
)
if (!file.exists(fte_ratio_file)) {
  stop("FTE ratio file not found: ", fte_ratio_file,
       "\nRun 08b_generate_bea_fte_ratios.R first.")
}
FTE_RATIOS <- read.csv(fte_ratio_file, stringsAsFactors = FALSE)
required_fte_columns <- c("io_sector", "fte_per_job", "source_year")
if (!all(required_fte_columns %in% names(FTE_RATIOS))) {
  stop("FTE ratio input is missing required columns: ",
       paste(setdiff(required_fte_columns, names(FTE_RATIOS)), collapse = ", "))
}
if (nrow(FTE_RATIOS) != 71L || anyDuplicated(FTE_RATIOS$io_sector) ||
    any(FTE_RATIOS$source_year != fte_ratio_year) ||
    any(FTE_RATIOS$fte_per_job < 0 | FTE_RATIOS$fte_per_job > 1)) {
  stop("Expected a complete, valid 71-sector BEA FTE/job crosswalk for ",
       fte_ratio_year)
}

# Household spending share of compensation for the Type II closure.
household_spending_file <- Sys.getenv(
  "GEMS_HOUSEHOLD_SPENDING_FILE",
  unset = paste0("household_spending_", fte_ratio_year, ".csv")
)
if (!file.exists(household_spending_file)) {
  stop("Household spending file not found: ", household_spending_file,
       "\nRun 08c_household_spending.R first.")
}
household_spending_data <- read.csv(household_spending_file, stringsAsFactors = FALSE)
if (nrow(household_spending_data) != 50L ||
    any(!is.finite(household_spending_data$household_spending_share)) ||
    any(household_spending_data$pce_all_2019 <= 0)) {
  stop("Expected a complete, valid 50-state household spending file")
}

# ============================================================================
# FUNCTION: Calculate all multipliers for a single state
# ============================================================================

calculate_state_multipliers <- function(state_name, state_abbrev,
                                        make_data, use_data,
                                        ind_output_data, com_output_data,
                                        va_data, qcew_emp_data,
                                        fte_ratio_data,
                                        employment_use_data,
                                        employment_output_data) {

  state_suffix <- paste0("/US-", state_abbrev)

  tryCatch({
    # Get state data
    state_make <- make_data[[state_name]]
    state_use <- use_data[[state_name]]
    state_ind_output <- ind_output_data[[state_name]]
    state_com_output <- com_output_data[[state_name]]
    state_va <- va_data[[state_name]]
    state_employment_use <- employment_use_data[[state_name]]
    state_employment_output <- employment_output_data[[state_name]]

    if (is.null(state_make) || is.null(state_use)) {
      stop("Data not found for state")
    }

    # ========================================
    # Extract state-specific rows/columns
    # ========================================

    make_rows <- rownames(state_make)
    make_cols <- colnames(state_make)
    state_ind_rows <- make_rows[grep(paste0(state_suffix, "$"), make_rows)]
    state_com_cols <- make_cols[grep(paste0(state_suffix, "$"), make_cols)]

    use_rows <- rownames(state_use)
    use_cols <- colnames(state_use)
    state_use_rows <- use_rows[grep(paste0(state_suffix, "$"), use_rows)]
    state_use_cols <- use_cols[grep(paste0(state_suffix, "$"), use_cols)]

    # Filter out value-added rows and final demand columns
    non_industry <- c("V001", "V002", "V003")
    state_use_rows <- state_use_rows[!gsub(state_suffix, "", state_use_rows) %in% non_industry]
    state_use_cols <- state_use_cols[!grepl("^F", gsub(state_suffix, "", state_use_cols))]

    # Output vectors - filter to state
    state_g <- state_ind_output[grep(paste0(state_suffix, "$"), names(state_ind_output))]
    state_q <- state_com_output[grep(paste0(state_suffix, "$"), names(state_com_output))]

    # Clean names (remove suffix)
    ind_codes <- gsub(state_suffix, "", state_ind_rows)
    com_codes <- gsub(state_suffix, "", state_com_cols)
    use_com_codes <- gsub(state_suffix, "", state_use_rows)
    use_ind_codes <- gsub(state_suffix, "", state_use_cols)
    names(state_g) <- gsub(state_suffix, "", names(state_g))
    names(state_q) <- gsub(state_suffix, "", names(state_q))

    # ========================================
    # Find common sectors across all tables
    # ========================================

    common_ind <- Reduce(intersect, list(ind_codes, use_ind_codes, names(state_g)))
    common_com <- Reduce(intersect, list(com_codes, use_com_codes, names(state_q)))

    # Extract and align Make matrix (Industry × Commodity)
    V <- as.matrix(state_make[state_ind_rows, state_com_cols])
    rownames(V) <- ind_codes
    colnames(V) <- com_codes
    V <- V[common_ind, common_com]

    # Extract and align Use matrix (Commodity × Industry)
    U <- as.matrix(state_use[state_use_rows, state_use_cols])
    rownames(U) <- use_com_codes
    colnames(U) <- use_ind_codes
    U <- U[common_com, common_ind]

    # Output vectors
    g <- state_g[common_ind]  # Industry output
    q <- state_q[common_com]  # Commodity output

    n <- length(common_ind)

    # ========================================
    # ITA Method: A = D × B
    # ========================================

    # D = Market Share Matrix (Industry × Commodity)
    # D[i,c] = V[i,c] / q[c]
    D <- sweep(V, 2, q, "/")
    D[is.na(D)] <- 0
    D[is.infinite(D)] <- 0

    # B = Commodity Coefficient Matrix (Commodity × Industry)
    # B[c,j] = U[c,j] / g[j]
    B <- sweep(U, 2, g, "/")
    B[is.na(B)] <- 0
    B[is.infinite(B)] <- 0

    # A = Direct Requirements Matrix (Industry × Industry)
    A <- D %*% B

    # ========================================
    # Type I Leontief Inverse
    # ========================================

    I_mat <- diag(n)
    L <- solve(I_mat - A)

    # Type I Output Multipliers
    type1_output <- colSums(L)
    names(type1_output) <- common_ind

    # ========================================
    # Value Added Coefficients (from separate VA table)
    # ========================================

    # Extract V001 (employee comp), V002 (taxes), V003 (gross operating surplus)
    # from the ValueAdded table (separate from Use table)
    va_rows <- c(paste0("V001", state_suffix),
                 paste0("V002", state_suffix),
                 paste0("V003", state_suffix))
    va_cols <- paste0(common_ind, state_suffix)

    V001 <- as.numeric(state_va[va_rows[1], va_cols])  # Employee compensation
    V002 <- as.numeric(state_va[va_rows[2], va_cols])  # Taxes on production
    V003 <- as.numeric(state_va[va_rows[3], va_cols])  # Gross operating surplus

    names(V001) <- names(V002) <- names(V003) <- common_ind

    # Total value added
    total_va <- V001 + V002 + V003

    # Value added coefficient (VA per $ output)
    va_coef <- total_va / g
    va_coef[is.na(va_coef)] <- 0
    va_coef[is.infinite(va_coef)] <- 0

    # Wage coefficient (employee comp per $ output)
    wage_coef <- V001 / g
    wage_coef[is.na(wage_coef)] <- 0
    wage_coef[is.infinite(wage_coef)] <- 0

    # Tax coefficient (taxes on production & imports per $ output)
    tax_coef <- V002 / g
    tax_coef[is.na(tax_coef)] <- 0
    tax_coef[is.infinite(tax_coef)] <- 0

    # Type I VA Multipliers
    type1_va <- as.numeric(va_coef %*% L)
    names(type1_va) <- common_ind

    # Type I Wage Multipliers
    type1_wage <- as.numeric(wage_coef %*% L)
    names(type1_wage) <- common_ind

    # Type I Tax Multipliers
    type1_tax <- as.numeric(tax_coef %*% L)
    names(type1_tax) <- common_ind

    # ========================================
    # Type II Multipliers (with induced effects)
    # ========================================

    # Household row: labor income per $ output
    hh_row <- wage_coef

    # Household column: consumption pattern
    # Get PCE (Personal Consumption Expenditure) from Use table
    pce_col <- paste0("F010", state_suffix)

    if (pce_col %in% colnames(state_use)) {
      pce <- as.numeric(state_use[paste0(common_com, state_suffix), pce_col])
      names(pce) <- common_com
      pce[is.na(pce)] <- 0
    } else {
      pce <- rep(0, length(common_com))
      names(pce) <- common_com
    }

    # Households spend household_spending_share of each $ of compensation
    # (after payroll and income taxes and saving; 08c_household_spending.R),
    # in the pattern of the state's personal consumption. pce is in-state
    # commodities only, so pce / pce_all_2019 keeps the in-state part.
    hs <- household_spending_data[household_spending_data$state_name == state_name, ]
    if (nrow(hs) != 1L) stop("No household spending share for ", state_name)
    hh_col_com <- hs$household_spending_share * pce / hs$pce_all_2019
    hh_col_com[is.na(hh_col_com)] <- 0
    hh_col_com[is.infinite(hh_col_com)] <- 0

    # Convert commodity consumption to industry using D
    hh_col <- as.numeric(D %*% hh_col_com)

    # Augmented A-bar matrix (n+1 × n+1)
    A_bar <- matrix(0, n+1, n+1)
    A_bar[1:n, 1:n] <- A
    A_bar[n+1, 1:n] <- hh_row      # Household row
    A_bar[1:n, n+1] <- hh_col      # Household column

    # Type II Leontief Inverse
    L_type2 <- solve(diag(n+1) - A_bar)

    # Type II Output Multipliers (sum industry portions only)
    type2_output <- colSums(L_type2[1:n, 1:n])
    names(type2_output) <- common_ind

    # Type II VA Multipliers
    va_coef_bar <- c(va_coef, 0)
    type2_va <- as.numeric(va_coef_bar %*% L_type2)[1:n]
    names(type2_va) <- common_ind

    # Type II Wage Multipliers
    wage_coef_bar <- c(wage_coef, 0)
    type2_wage <- as.numeric(wage_coef_bar %*% L_type2)[1:n]
    names(type2_wage) <- common_ind

    # Type II Tax Multipliers
    tax_coef_bar <- c(tax_coef, 0)
    type2_tax <- as.numeric(tax_coef_bar %*% L_type2)[1:n]
    names(type2_tax) <- common_ind

    # ========================================
    # Employment Multipliers (true employment-weighted)
    # ========================================

    # Get employment data for this state from QCEW
    state_emp_data <- qcew_emp_data %>%
      filter(state_name == !!state_name)

    # Build consistent-2023 employment satellite vectors for ALL sectors.
    # Jobs/output is the dimensionally correct coefficient for multiplying the
    # Leontief output requirements. Jobs/value added is retained separately for
    # the frontend's direct-GDP calculation.
    employment_output_coef <- rep(0, n)
    employment_va_coef <- rep(0, n)
    employment_output_m <- rep(NA_real_, n)
    employment_va_m <- rep(NA_real_, n)
    names(employment_output_coef) <- names(employment_va_coef) <- common_ind
    names(employment_output_m) <- names(employment_va_m) <- common_ind

    available_employment_sectors <- intersect(common_ind, colnames(state_employment_use))
    employment_va_m[available_employment_sectors] <-
      colSums(state_employment_use[c("V001", "V002", "V003"),
                                   available_employment_sectors, drop = FALSE]) / 1e6

    employment_output_vector <- setNames(
      as.numeric(state_employment_output[[1]]),
      rownames(state_employment_output)
    )
    available_output_sectors <- intersect(common_ind, names(employment_output_vector))
    employment_output_m[available_output_sectors] <-
      as.numeric(employment_output_vector[available_output_sectors]) / 1e6

    for (sector in common_ind) {
      sector_emp <- state_emp_data %>%
        filter(io_sector == sector)

      if (nrow(sector_emp) > 0 && !is.na(sector_emp$employment[1])) {
        sector_jobs <- sector_emp$employment[1]
        if (!is.na(employment_output_m[sector]) && employment_output_m[sector] > 0) {
          employment_output_coef[sector] <- sector_jobs / employment_output_m[sector]
        }
        if (!is.na(employment_va_m[sector]) && employment_va_m[sector] > 0) {
          employment_va_coef[sector] <- sector_jobs / employment_va_m[sector]
        }
      }
    }

    # QCEW private employment is unavailable for several synthetic/government
    # StateIO sectors. Treat those unsupported satellite entries as zero rather
    # than assigning an unrelated within-state average labor intensity.
    employment_output_coef[is.na(employment_output_coef)] <- 0
    employment_va_coef[is.na(employment_va_coef)] <- 0

    fte_per_job <- setNames(
      fte_ratio_data$fte_per_job,
      fte_ratio_data$io_sector
    )[common_ind]
    if (any(is.na(fte_per_job))) {
      stop("Missing BEA FTE/job ratio for StateIO sectors: ",
           paste(common_ind[is.na(fte_per_job)], collapse = ", "))
    }
    fte_output_coef <- employment_output_coef * fte_per_job

    # Total jobs supported per $1M of direct output.
    type1_emp_raw <- as.numeric(employment_output_coef %*% L)
    names(type1_emp_raw) <- common_ind

    # Type II Employment Multipliers: emp_coef × L_type2
    emp_coef_bar <- c(employment_output_coef, 0)
    type2_emp_raw <- as.numeric(emp_coef_bar %*% L_type2)[1:n]
    names(type2_emp_raw) <- common_ind

    # Estimated FTEs are propagated with their own industry-specific satellite,
    # so supplier and induced effects reflect the industries in which the jobs
    # occur rather than the direct casino industry's FTE/job ratio.
    type1_fte_raw <- as.numeric(fte_output_coef %*% L)
    names(type1_fte_raw) <- common_ind
    fte_coef_bar <- c(fte_output_coef, 0)
    type2_fte_raw <- as.numeric(fte_coef_bar %*% L_type2)[1:n]
    names(type2_fte_raw) <- common_ind

    # Convert to multiplier form: total / direct
    direct_emp_per_output <- employment_output_coef
    type1_emp <- type1_emp_raw / direct_emp_per_output
    type2_emp <- type2_emp_raw / direct_emp_per_output

    # Handle division issues
    type1_emp[is.na(type1_emp) | is.infinite(type1_emp)] <- 1.0
    type2_emp[is.na(type2_emp) | is.infinite(type2_emp)] <- 1.0

    direct_fte_per_output <- fte_output_coef
    type1_fte <- type1_fte_raw / direct_fte_per_output
    type2_fte <- type2_fte_raw / direct_fte_per_output
    type1_fte[is.na(type1_fte) | is.infinite(type1_fte)] <- 1.0
    type2_fte[is.na(type2_fte) | is.infinite(type2_fte)] <- 1.0

    # ========================================
    # Extract target sectors and build results
    # ========================================

    results <- data.frame()

    for (sector in target_sectors) {
      if (sector %in% common_ind) {
        results <- rbind(results, data.frame(
          State = state_name,
          Abbrev = state_abbrev,
          Sector = sector,
          Sector_Name = sector_names[sector],

          # Direct coefficients
          Direct_VA_Coef = round(va_coef[sector], 6),
          Direct_Wage_Coef = round(wage_coef[sector], 6),
          Direct_Tax_Coef = round(tax_coef[sector], 6),
          Industry_Output_M = round(g[sector] / 1e6, 2),
          Employment_Output_M = round(employment_output_m[sector], 2),
          Employment_VA_M = round(employment_va_m[sector], 2),
          Employment_Coefficient_Year = employment_year,
          FTE_Ratio_Year = fte_ratio_year,
          IO_Structure_Year = io_year,

          # Type I multipliers
          Type_I_Output = round(type1_output[sector], 4),
          Type_I_VA = round(type1_va[sector], 4),
          Type_I_Wage = round(type1_wage[sector], 4),
          Type_I_Tax = round(type1_tax[sector], 4),

          # Type II multipliers
          Type_II_Output = round(type2_output[sector], 4),
          Type_II_VA = round(type2_va[sector], 4),
          Type_II_Wage = round(type2_wage[sector], 4),
          Type_II_Tax = round(type2_tax[sector], 4),

          # Employment multipliers (true employment-weighted)
          Type_I_Emp = round(type1_emp[sector], 4),
          Type_II_Emp = round(type2_emp[sector], 4),
          Direct_Jobs_Per_1M_Output = round(direct_emp_per_output[sector], 6),
          Type_I_Jobs_Per_1M_Output = round(type1_emp_raw[sector], 6),
          Type_II_Jobs_Per_1M_Output = round(type2_emp_raw[sector], 6),

          # Estimated FTE satellite (BEA national industry ratios)
          FTE_Per_Job = round(fte_per_job[sector], 9),
          Direct_FTE_Per_1M_Output = round(direct_fte_per_output[sector], 6),
          Type_I_FTE_Per_1M_Output = round(type1_fte_raw[sector], 6),
          Type_II_FTE_Per_1M_Output = round(type2_fte_raw[sector], 6),
          Type_I_FTE_Mult = round(type1_fte[sector], 4),
          Type_II_FTE_Mult = round(type2_fte[sector], 4),

          stringsAsFactors = FALSE
        ))
      }
    }

    return(results)

  }, error = function(e) {
    message("  Error processing ", state_name, ": ", e$message)
    return(NULL)
  })
}

# ============================================================================
# MAIN EXECUTION - Calculate multipliers for all 50 states
# ============================================================================

message("=== Calculating Multipliers for All 50 States ===\n")
message("IO structure year: ", io_year)
message("Employment coefficient year: ", employment_year)
message("Target sectors: ", paste(target_sectors, collapse = ", "))
message("")

all_results <- data.frame()

for (i in seq_along(state_names)) {
  state <- state_names[i]
  abbrev <- state_abbrevs[i]
  message(sprintf("[%2d/50] %s (%s)", i, state, abbrev))

  state_results <- calculate_state_multipliers(
    state, abbrev,
    two_region_make, two_region_use,
    two_region_ind_output, two_region_com_output,
    two_region_va,
    QCEW_ALL_SECTORS,
    FTE_RATIOS,
    employment_year_use,
    employment_year_output
  )

  if (!is.null(state_results) && nrow(state_results) > 0) {
    all_results <- rbind(all_results, state_results)
    message("       Found ", nrow(state_results), " sectors")
  }
}

# ============================================================================
# SAVE RESULTS
# ============================================================================

# Use 2023 in filename since this will be combined with 2023 employment data
output_file <- "state_multipliers_2023.csv"
write.csv(all_results, output_file, row.names = FALSE)

message("\n=== RESULTS SAVED ===")
message("File: ", output_file)
message("Total records: ", nrow(all_results))

# ============================================================================
# SUMMARY STATISTICS
# ============================================================================

message("\n=== SUMMARY STATISTICS BY SECTOR ===\n")

for (sector in target_sectors) {
  sector_data <- all_results[all_results$Sector == sector, ]

  if (nrow(sector_data) > 0) {
    message("\n", sector, " (", sector_names[sector], "):")
    message("  States with data: ", nrow(sector_data))
    message("")
    message("  Type I Output Multiplier:")
    message("    Range: ", round(min(sector_data$Type_I_Output), 3), " - ",
            round(max(sector_data$Type_I_Output), 3))
    message("    Mean:  ", round(mean(sector_data$Type_I_Output), 3))
    message("")
    message("  Type II Output Multiplier:")
    message("    Range: ", round(min(sector_data$Type_II_Output), 3), " - ",
            round(max(sector_data$Type_II_Output), 3))
    message("    Mean:  ", round(mean(sector_data$Type_II_Output), 3))
    message("")
    message("  Direct VA Coefficient (VA per $ output):")
    message("    Range: ", round(min(sector_data$Direct_VA_Coef), 3), " - ",
            round(max(sector_data$Direct_VA_Coef), 3))
    message("    Mean:  ", round(mean(sector_data$Direct_VA_Coef), 3))
  }
}

# ============================================================================
# VALIDATION
# ============================================================================

message("\n=== VALIDATION CHECKS ===\n")

# Check Type I multipliers are >= 1.0
type1_check <- all(all_results$Type_I_Output >= 1.0, na.rm = TRUE)
if (type1_check) {
  message("✓ All Type I output multipliers >= 1.0")
} else {
  message("✗ Some Type I output multipliers < 1.0")
}

# Check Type II >= Type I
type2_check <- all(all_results$Type_II_Output >= all_results$Type_I_Output, na.rm = TRUE)
if (type2_check) {
  message("✓ All Type II output multipliers >= Type I")
} else {
  message("✗ Some Type II output multipliers < Type I")
}

# Check VA coefficients in reasonable range (0 to 1)
va_check <- all(all_results$Direct_VA_Coef >= 0 & all_results$Direct_VA_Coef <= 1, na.rm = TRUE)
if (va_check) {
  message("✓ All VA coefficients in valid range (0-1)")
} else {
  message("✗ Some VA coefficients outside range")
}

fte_check <- all(
  all_results$Direct_FTE_Per_1M_Output <= all_results$Direct_Jobs_Per_1M_Output &
    all_results$Type_I_FTE_Per_1M_Output <= all_results$Type_I_Jobs_Per_1M_Output &
    all_results$Type_II_FTE_Per_1M_Output <= all_results$Type_II_Jobs_Per_1M_Output,
  na.rm = TRUE
)
if (fte_check) {
  message("✓ Estimated FTEs do not exceed filled jobs")
} else {
  message("✗ Some estimated FTE totals exceed filled jobs")
}

# Check variation across states
for (sector in target_sectors) {
  sector_data <- all_results[all_results$Sector == sector, ]
  if (nrow(sector_data) > 1) {
    sd_val <- sd(sector_data$Type_I_Output, na.rm = TRUE)
    if (sd_val > 0.01) {
      message("✓ ", sector, " multipliers vary across states (SD = ", round(sd_val, 4), ")")
    } else {
      message("⚠ ", sector, " multipliers may be too similar across states")
    }
  }
}

# ============================================================================
# SAMPLE OUTPUT - Nevada (key casino state)
# ============================================================================

message("\n=== SAMPLE: Nevada Multipliers ===\n")

nevada_data <- all_results[all_results$State == "Nevada", ]
print(nevada_data[, c("Sector", "Type_I_Output", "Type_II_Output",
                      "Type_I_VA", "Type_II_VA", "Direct_VA_Coef")])

message("\n=== COMPLETE ===\n")
