# ============================================================================
# 2023 EMPLOYMENT SATELLITE: JOBS, OUTPUT AND VALUE ADDED BY STATE AND SECTOR
# ============================================================================
#
# Shared by 08_state_multipliers_2023.R and scripts/export_state_io.R, so the
# R pipeline and the browser engine use the same jobs coefficients.
#
# Two corrections to the raw inputs:
#
# 1. Retail output. StateIO 0.4.0 State_Summary_IndustryOutput_2023 and
#    State_Summary_DomesticUse_2023 divide retail trade among the four summary
#    sectors (441, 445, 452, 4A0) in a way that does not agree with the 2019
#    tables or with QCEW: in every state 452 is zero, 441 is about five times
#    and 445 about three times its 2019 output, and 4A0 is about half. The
#    retail total is plausible. The satellite therefore keeps each state's
#    2023 retail total and divides it among the four sectors in proportion to
#    their 2019 output (value added: 2019 value added).
#
# 2. Suppressed QCEW cells. QCEW does not disclose employment for some
#    state-sector cells, and 08a_process_all_qcew_employment.R records them as
#    zero. Where a sector has 2023 output in a state but zero recorded jobs,
#    jobs are the national jobs per dollar of output of that sector (from the
#    states with recorded jobs) times the state's output. HS, GFE and GSLE have
#    no QCEW-compatible measure and stay at zero.
# ============================================================================

SATELLITE_RETAIL_SECTORS <- c("441", "445", "452", "4A0")
SATELLITE_ZERO_SECTORS <- c("HS", "GFE", "GSLE")

# Divide the pooled 2023 total of the retail sectors by their 2019 shares.
reallocate_retail <- function(x23, x19) {
  r <- intersect(SATELLITE_RETAIL_SECTORS, names(x19))
  base <- x19[r]
  base[is.na(base)] <- 0
  total <- sum(x23[intersect(r, names(x23))], na.rm = TRUE)
  if (length(r) > 0 && sum(base) > 0) x23[r] <- total * base / sum(base)
  x23
}

# Returns a data frame with one row for each state and sector:
#   state_name, io_sector, jobs, jobs_imputed, output, value_added (US dollars).
# employment:  employment_all_sectors_2023.csv (state_name, io_sector, employment)
# output_2023: StateIO State_Summary_IndustryOutput_2023
# use_2023:    StateIO State_Summary_DomesticUse_2023 (rows V001-V003)
# output_2019: StateIO TwoRegion_Summary_IndustryOutput_2019
# va_2019:     StateIO TwoRegion_Summary_ValueAdded_2019
build_employment_satellite <- function(employment, output_2023, use_2023,
                                       output_2019, va_2019, sectors,
                                       states = state.name, abbrevs = state.abb) {
  va_rows <- c("V001", "V002", "V003")
  rows <- lapply(seq_along(states), function(i) {
    st <- states[i]
    sfx <- paste0("/US-", abbrevs[i])

    o23_raw <- output_2023[[st]]
    o23_raw <- setNames(as.numeric(o23_raw[[1]]), rownames(o23_raw))
    o23 <- setNames(as.numeric(o23_raw[sectors]), sectors)

    u23 <- use_2023[[st]]
    have <- intersect(sectors, colnames(u23))
    v23 <- setNames(rep(NA_real_, length(sectors)), sectors)
    v23[have] <- colSums(u23[va_rows, have, drop = FALSE])

    g19 <- output_2019[[st]]
    g19 <- setNames(as.numeric(g19[paste0(sectors, sfx)]), sectors)
    va19 <- va_2019[[st]]
    va19 <- setNames(
      as.numeric(colSums(as.matrix(va19[paste0(va_rows, sfx), paste0(sectors, sfx)]))),
      sectors
    )

    emp <- employment[employment$state_name == st, ]
    jobs <- setNames(emp$employment, emp$io_sector)[sectors]

    data.frame(
      state_name = st, io_sector = sectors, jobs = as.numeric(jobs),
      output = as.numeric(reallocate_retail(o23, g19)),
      value_added = as.numeric(reallocate_retail(v23, va19)),
      stringsAsFactors = FALSE
    )
  })
  sat <- do.call(rbind, rows)

  # National jobs per dollar of output, from the cells with recorded jobs.
  recorded <- !is.na(sat$jobs) & sat$jobs > 0 & !is.na(sat$output) & sat$output > 0
  national <- tapply(sat$jobs[recorded], sat$io_sector[recorded], sum) /
    tapply(sat$output[recorded], sat$io_sector[recorded], sum)

  sat$jobs_imputed <- !is.na(sat$jobs) & sat$jobs == 0 &
    !is.na(sat$output) & sat$output > 0 &
    !sat$io_sector %in% SATELLITE_ZERO_SECTORS &
    sat$io_sector %in% names(national)
  sat$jobs[sat$jobs_imputed] <-
    as.numeric(national[sat$io_sector[sat$jobs_imputed]]) * sat$output[sat$jobs_imputed]
  sat
}
