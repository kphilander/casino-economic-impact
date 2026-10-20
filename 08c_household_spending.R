# ============================================================================
# BUILD THE HOUSEHOLD SPENDING SHARE FOR THE TYPE II CLOSURE
# ============================================================================
#
# Type II models close the input-output table with households: industries pay
# compensation (the household row) and households spend part of it in the
# state (the household column). This script estimates, for each state, how
# much of $1 of compensation households spend:
#
#   theta = c x (1 - b x (employer payroll tax + employee payroll tax
#                         + income tax) / W)
#
#   c  consumption share of disposable personal income, national 2023
#      (BEA NIPA Table 2.1: PCE / DPI, through FRED)
#   b  cash wages per $1 of compensation for all private industries
#      (wageBasis.json, the base that the calculator's fiscal module taxes)
#   W  average 2023 QCEW private wage in the state
#   taxes at W from the calculator's own employment- and income-tax tables
#      (employmentTaxRates.json, incomeTaxRates.json). Employee Social
#      Security and Medicare are added to the employer taxes that the fiscal
#      module reports, because they also reduce disposable income.
#
# Compensation enters personal income less contributions for government
# social insurance, and disposable income less personal current taxes, so
# 1 - b x taxes / W is the disposable income from $1 of compensation.
#
# The household column then spends theta in the pattern of in-state personal
# consumption: theta x PCE(in-state commodity) / PCE(all origins), with PCE of
# the StateIO 2019 two-region tables. The earlier closure spent
# PCE(in-state) / compensation, which attributes consumption financed by
# transfers and property income to wages.
#
# Range for the calculator's Sensitivity view: low uses the lowest annual
# PCE / DPI since 2000; high assumes that households spend all disposable
# income (c = 1).
#
# Inputs : GEMS_QCEW_ALL_SECTORS_FILE (08a output), webapp/src/data/*.json,
#          StateIO TwoRegion_Summary_Use_2019 and _DomesticUse_2019, FRED
# Output : household_spending_2023.csv
# ============================================================================

suppressPackageStartupMessages({ library(tidyverse); library(jsonlite); library(stateior) })

year <- 2023L
io_year <- 2019L
output_file <- Sys.getenv("GEMS_HOUSEHOLD_SPENDING_FILE", unset = paste0("household_spending_", year, ".csv"))
qcew_file <- Sys.getenv("GEMS_QCEW_ALL_SECTORS_FILE", unset = "employment_all_sectors_2023.csv")
if (!file.exists(qcew_file)) stop("QCEW employment file not found: ", qcew_file, "\nRun 08a_process_all_qcew_employment.R first.")

# ---------------------------------------------------------------- national c
# FRED graph CSV, NIPA Table 2.1: PCECA = personal consumption expenditures,
# A067RC1A027NBEA = disposable personal income (billions of dollars, annual).
fred_ids <- c(pce = "PCECA", dpi = "A067RC1A027NBEA")
fred <- read.csv(paste0("https://fred.stlouisfed.org/graph/fredgraph.csv?id=", paste(fred_ids, collapse = ",")),
                 check.names = FALSE, stringsAsFactors = FALSE)
names(fred)[1] <- "date"
fred <- fred %>% mutate(year = as.integer(substr(date, 1, 4)),
                        pce = as.numeric(.data[[fred_ids[["pce"]]]]), dpi = as.numeric(.data[[fred_ids[["dpi"]]]]),
                        c = pce / dpi) %>% filter(!is.na(c))
c_central <- fred$c[fred$year == year]
if (length(c_central) != 1L) stop("FRED response does not contain ", year)
c_low <- min(fred$c[fred$year >= 2000 & fred$year <= year])
c_low_year <- fred$year[fred$year >= 2000 & fred$year <= year][which.min(fred$c[fred$year >= 2000 & fred$year <= year])]
c_high <- 1
message(sprintf("PCE / DPI %d = %.4f (PCE %.1f, DPI %.1f $B); lowest since 2000 = %.4f (%d)",
                year, c_central, fred$pce[fred$year == year], fred$dpi[fred$year == year], c_low, c_low_year))

# ---------------------------------------------------------------- tax tables
emp_tax <- fromJSON("webapp/src/data/employmentTaxRates.json")
inc_tax <- fromJSON("webapp/src/data/incomeTaxRates.json")
wage_basis <- fromJSON("webapp/src/data/wageBasis.json")
b <- wage_basis$private
fed <- emp_tax$federal

# taxAtWage in webapp/src/engine/tax.ts
tax_at_wage <- function(table, w) {
  g <- inc_tax$wageGrid; last <- length(table)
  if (!(w > 0)) return(0)
  if (w >= g$max) return(table[last] + (table[last] - table[last - 1]) * (w - g$max) / g$step)
  x <- (max(w, g$min) - g$min) / g$step; i <- floor(x)
  table[i + 1] + (table[i + 2] - table[i + 1]) * (x - i)
}
num <- function(x) if (is.null(x) || is.na(x)) 0 else x
# payrollTax in webapp/src/engine/tax.ts (employer), per worker at wage w
employer_tax <- function(st, w) {
  s <- emp_tax$states[[st]]
  min(w, fed$fica_ss_wage_cap) * fed$fica_ss_rate + w * fed$fica_medicare_rate +
    min(w, fed$futa_wage_base) * fed$futa_rate +
    (if (num(s$suta_avg_rate) > 0 && num(s$suta_wage_base) > 0) min(w, s$suta_wage_base) * s$suta_avg_rate else 0) +
    w * max(num(s$sdi_employer_rate), 0) + w * max(num(s$pfml_employer_rate), 0)
}
employee_tax <- function(w) min(w, fed$fica_ss_wage_cap) * fed$fica_ss_rate + w * fed$fica_medicare_rate
income_tax <- function(st, w) {
  s <- inc_tax$states[[st]]
  if (is.null(s)) return(w * num(emp_tax$states[[st]]$household_tax_ratio))
  tax_at_wage(inc_tax$federal$tax, w) + tax_at_wage(s$state, w) + tax_at_wage(s$local, w)
}

# ---------------------------------------------------------------- states
qcew <- read.csv(qcew_file, stringsAsFactors = FALSE)
avg_wage <- qcew %>% group_by(state_name) %>%
  summarise(wage = sum(total_wages, na.rm = TRUE) / sum(employment, na.rm = TRUE), .groups = "drop")
if (nrow(avg_wage) != 50L) stop("Expected 50 states in ", qcew_file)

use_all <- loadStateIODataFile(paste0("TwoRegion_Summary_Use_", io_year))
use_dom <- loadStateIODataFile(paste0("TwoRegion_Summary_DomesticUse_", io_year))

rows <- lapply(avg_wage$state_name, function(st) {
  ab <- state.abb[match(st, state.name)]
  sfx <- paste0("/US-", ab)
  w <- avg_wage$wage[avg_wage$state_name == st]
  er <- employer_tax(st, w) / w; ee <- employee_tax(w) / w; it <- income_tax(st, w) / w
  disposable <- 1 - b * (er + ee + it)
  pce_all <- sum(use_all[[st]][, paste0("F010", sfx)], na.rm = TRUE)
  dom <- use_dom[[st]]
  pce_instate <- sum(dom[grepl(paste0(sfx, "$"), rownames(dom)), paste0("F010", sfx)], na.rm = TRUE)
  data.frame(state_name = st, state_abbrev = ab, avg_wage = w, cash_wage_share = b,
             employer_tax_rate = er, employee_tax_rate = ee, income_tax_rate = it,
             disposable_per_compensation = disposable,
             consumption_share_dpi = c_central,
             household_spending_share = c_central * disposable,
             household_spending_low = c_low * disposable,
             household_spending_high = c_high * disposable,
             pce_all_2019 = pce_all, pce_instate_2019 = pce_instate,
             instate_share = pce_instate / pce_all,
             source = sprintf("FRED PCECA / A067RC1A027NBEA %d (low: %d); QCEW %d private wages; calculator tax tables",
                              year, c_low_year, year),
             stringsAsFactors = FALSE)
})
out <- bind_rows(rows) %>% arrange(state_name)
if (any(out$household_spending_share <= 0.4 | out$household_spending_share >= 0.9)) stop("Household spending share out of range")
if (any(out$instate_share <= 0.4 | out$instate_share >= 0.95)) stop("In-state consumption share out of range")
write.csv(out, output_file, row.names = FALSE)
message(sprintf("Wrote %s: spending share of compensation %.3f to %.3f (median %.3f); in-state share median %.3f",
                output_file, min(out$household_spending_share), max(out$household_spending_share),
                median(out$household_spending_share), median(out$instate_share)))
