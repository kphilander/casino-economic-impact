# ============================================================================
# EXPORT STATE INPUT-OUTPUT TABLES FOR THE BROWSER ENGINE
# ============================================================================
#
# Writes the in-state block of each state's StateIO two-region summary tables,
# with the 2023 employment satellite, to webapp/src/data/io/{AB}.json, and the
# national inputs (sector list, BEA FTE ratios, gambling and online ratios) to
# webapp/src/data/io/national.json.
#
# The export contains data only. The browser engine (webapp/src/engine)
# computes the industry-technology direct requirements, the Type I and Type II
# Leontief inverses and every multiplier from these tables, exactly as
# 08_state_multipliers_2023.R does. The webapp tests check that the engine
# reproduces employment_multipliers_2023.csv, construction_multipliers_2023.csv,
# gambling_multipliers_2023.csv and online_gambling_multipliers_2023.csv.
#
# Inputs:
#   StateIO data files (stateior::loadStateIODataFile; cached by stateior):
#     TwoRegion_Summary_Make_2019, TwoRegion_Summary_DomesticUse_2019,
#     TwoRegion_Summary_IndustryOutput_2019, TwoRegion_Summary_CommodityOutput_2019,
#     TwoRegion_Summary_ValueAdded_2019, State_Summary_IndustryOutput_2023,
#     State_Summary_DomesticUse_2023
#   employment_all_sectors_2023.csv  (08a_process_all_qcew_employment.R)
#   fte_ratios_2023.csv              (08b_generate_bea_fte_ratios.R)
#   household_spending_2023.csv      (08c_household_spending.R): pceAll and the
#                                    household spending share (with its range)
#   national_naics_ratios.csv        (13_extract_national_naics_ratios.R)
#
# Usage: Rscript scripts/export_state_io.R   (from the repository root)
# ============================================================================

suppressPackageStartupMessages({
  library(stateior)
  library(jsonlite)
})

io_year <- 2019
employment_year <- 2023
out_dir <- Sys.getenv("GEMS_IO_EXPORT_DIR", unset = file.path("webapp", "src", "data", "io"))
employment_file <- Sys.getenv("GEMS_QCEW_ALL_SECTORS_FILE", unset = "employment_all_sectors_2023.csv")

for (f in c(employment_file, "fte_ratios_2023.csv", "national_naics_ratios.csv")) {
  if (!file.exists(f)) stop("Missing input: ", f)
}
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

load_io <- function(name) {
  df <- loadStateIODataFile(name)
  files <- list.files(file.path(rappdirs::user_data_dir(), "stateio"),
                      pattern = paste0("^", name, "_.*\\.rds$"), full.names = TRUE)
  attr(df, "source_file") <- basename(files[which.max(file.mtime(files))])
  attr(df, "md5") <- unname(tools::md5sum(files[which.max(file.mtime(files))]))
  df
}

make <- load_io(paste0("TwoRegion_Summary_Make_", io_year))
use <- load_io(paste0("TwoRegion_Summary_DomesticUse_", io_year))
ind_output <- load_io(paste0("TwoRegion_Summary_IndustryOutput_", io_year))
com_output <- load_io(paste0("TwoRegion_Summary_CommodityOutput_", io_year))
value_added <- load_io(paste0("TwoRegion_Summary_ValueAdded_", io_year))
output_2023 <- load_io(paste0("State_Summary_IndustryOutput_", employment_year))
use_2023 <- load_io(paste0("State_Summary_DomesticUse_", employment_year))
sources <- lapply(list(make, use, ind_output, com_output, value_added, output_2023, use_2023),
                  function(x) list(file = attr(x, "source_file"), md5 = attr(x, "md5")))

employment <- read.csv(employment_file, stringsAsFactors = FALSE)
fte <- read.csv("fte_ratios_2023.csv", stringsAsFactors = FALSE)
household_spending <- read.csv(Sys.getenv("GEMS_HOUSEHOLD_SPENDING_FILE", unset = "household_spending_2023.csv"),
                               stringsAsFactors = FALSE)
ratios <- read.csv("national_naics_ratios.csv", stringsAsFactors = FALSE)

state_names <- state.name
state_abbrevs <- state.abb

strip <- function(x, sfx) sub(paste0(sfx, "$"), "", x)
ends <- function(x, sfx) x[grepl(paste0(sfx, "$"), x)]

industries <- NULL
commodities <- NULL
index <- list()

for (i in seq_along(state_names)) {
  st <- state_names[i]
  ab <- state_abbrevs[i]
  sfx <- paste0("/US-", ab)

  M <- make[[st]]
  U0 <- use[[st]]
  ind_rows <- ends(rownames(M), sfx)
  com_cols <- ends(colnames(M), sfx)
  use_rows <- ends(rownames(U0), sfx)
  use_rows <- use_rows[!strip(use_rows, sfx) %in% c("V001", "V002", "V003")]
  use_cols <- ends(colnames(U0), sfx)
  use_cols <- use_cols[!grepl("^F", strip(use_cols, sfx))]

  g <- ind_output[[st]]
  g <- g[ends(names(g), sfx)]
  names(g) <- strip(names(g), sfx)
  q <- com_output[[st]]
  q <- q[ends(names(q), sfx)]
  names(q) <- strip(names(q), sfx)

  # Same sector alignment as 08_state_multipliers_2023.R
  ind <- Reduce(intersect, list(strip(ind_rows, sfx), strip(use_cols, sfx), names(g)))
  com <- Reduce(intersect, list(strip(com_cols, sfx), strip(use_rows, sfx), names(q)))
  if (is.null(industries)) {
    industries <- ind
    commodities <- com
  }
  if (!identical(ind, industries) || !identical(com, commodities)) {
    stop("Sector order differs for ", st)
  }

  V <- as.matrix(M[paste0(ind, sfx), paste0(com, sfx)])
  U <- as.matrix(U0[paste0(com, sfx), paste0(ind, sfx)])
  pce_col <- paste0("F010", sfx)
  if (!pce_col %in% colnames(U0)) stop("No F010 column for ", st)
  pce <- as.numeric(U0[paste0(com, sfx), pce_col])
  pce[is.na(pce)] <- 0

  va <- value_added[[st]]
  va_rows <- paste0(c("V001", "V002", "V003"), sfx)
  va_m <- as.matrix(va[va_rows, paste0(ind, sfx)])

  o23 <- output_2023[[st]]
  o23 <- setNames(as.numeric(o23[[1]]), rownames(o23))
  u23 <- use_2023[[st]]
  va23_sectors <- intersect(ind, colnames(u23))
  va23 <- setNames(rep(NA_real_, length(ind)), ind)
  va23[va23_sectors] <- colSums(u23[c("V001", "V002", "V003"), va23_sectors, drop = FALSE])

  hs <- household_spending[household_spending$state_name == st, ]
  if (nrow(hs) != 1L) stop("No household spending share for ", st)
  emp <- employment[employment$state_name == st, ]
  jobs <- setNames(emp$employment, emp$io_sector)[ind]

  na_to_null <- function(x) {
    x <- as.numeric(x)
    lapply(x, function(v) if (is.na(v)) NULL else v)
  }

  rec <- list(
    state = st,
    abbrev = ab,
    ioYear = io_year,
    employmentYear = employment_year,
    units = "US dollars",
    make = unname(V),
    use = unname(U),
    industryOutput = unname(as.numeric(g[ind])),
    commodityOutput = unname(as.numeric(q[com])),
    compensation = unname(as.numeric(va_m[1, ])),
    topi = unname(as.numeric(va_m[2, ])),
    gos = unname(as.numeric(va_m[3, ])),
    pce = pce,
    pceAll = hs$pce_all_2019,
    householdSpending = list(share = hs$household_spending_share,
                             low = hs$household_spending_low,
                             high = hs$household_spending_high,
                             avgWage = hs$avg_wage,
                             consumptionShare = hs$consumption_share_dpi),
    jobs2023 = na_to_null(jobs),
    output2023 = na_to_null(o23[ind]),
    valueAdded2023 = na_to_null(va23[ind])
  )
  writeLines(toJSON(rec, auto_unbox = TRUE, digits = I(12), null = "null", matrix = "rowmajor"),
             file.path(out_dir, paste0(ab, ".json")), useBytes = TRUE)
  index[[ab]] <- st
  message(sprintf("[%2d/50] %s", i, st))
}

fte <- fte[match(industries, fte$io_sector), ]
if (any(is.na(fte$fte_per_job))) stop("FTE ratios missing for some sectors")
gambling <- ratios[ratios$property_type == "713210" & ratios$calibration_role == "canonical_gambling", ]
if (nrow(gambling) != 1) stop("Expected one canonical 713210 ratio row")

national <- list(
  metadata = list(
    generatedBy = "scripts/export_state_io.R",
    stateior = as.character(packageVersion("stateior")),
    ioYear = io_year,
    employmentYear = employment_year,
    sources = sources,
    employmentSatellite = "employment_all_sectors_2023.csv (08a_process_all_qcew_employment.R): 2023 QCEW private annual-average filled jobs by StateIO sector; HS, GFE and GSLE are explicit zeros",
    ftePerJob = "fte_ratios_2023.csv (08b_generate_bea_fte_ratios.R): BEA NIPA tables 6.4D/6.5D, 2023"
  ),
  industries = lapply(seq_along(industries), function(k) list(code = industries[k], name = fte$bea_industry[k])),
  commodities = commodities,
  ftePerJob = as.numeric(fte$fte_per_job),
  states = index,
  gambling = list(
    source = "national_naics_ratios.csv (13_extract_national_naics_ratios.R): USEEIOv2.0.1-411 713200/US relative to the output-weighted 713 parent",
    parentSector = "713",
    direct = list(va = gambling$va_ratio, compensation = gambling$wage_ratio,
                  topi = gambling$topi_ratio, jobs = gambling$emp_ratio, jobsPerVa = gambling$emp_va_ratio),
    increment = list(output = gambling$output_indirect_ratio, va = gambling$va_indirect_ratio,
                     compensation = gambling$wage_indirect_ratio, topi = gambling$topi_indirect_ratio)
  ),
  online = list(
    source = "14_online_gambling_multipliers.R: scenario ratios estimated from DraftKings, Rush Street Interactive and Flutter SEC filings (2024)",
    direct = list(va = 0.90, compensation = 0.55, topi = 1.0, jobsPerVa = 0.23),
    increment = list(output = 0.85, va = 0.85, compensation = 0.80, topi = 0.90),
    fteSector = "5415"
  )
)
writeLines(toJSON(national, auto_unbox = TRUE, digits = I(15), pretty = TRUE),
           file.path(out_dir, "national.json"), useBytes = TRUE)
message("Wrote ", length(index), " state files and national.json to ", out_dir)
