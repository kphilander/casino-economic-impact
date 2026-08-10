# Offline integrity checks for the deployed multiplier artifacts.

file_arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
script_path <- normalizePath(sub("^--file=", "", file_arg[[1]]))
repo_root <- dirname(dirname(script_path))

read_repo_csv <- function(name) {
  read.csv(file.path(repo_root, name), stringsAsFactors = FALSE,
           check.names = FALSE)
}

employment <- read_repo_csv("employment_multipliers_2023.csv")
gambling <- read_repo_csv("gambling_multipliers_2023.csv")
properties <- read_repo_csv("property_type_multipliers_2023.csv")
online <- read_repo_csv("online_gambling_multipliers_2023.csv")
ratios <- read_repo_csv("national_naics_ratios.csv")
fte_ratios <- read_repo_csv("fte_ratios_2023.csv")

assert_close <- function(actual, expected, label, tolerance = 1e-8) {
  if (length(actual) != length(expected) ||
      any(!is.finite(actual)) || any(!is.finite(expected)) ||
      any(abs(actual - expected) > tolerance)) {
    stop(label, " failed", call. = FALSE)
  }
}

stopifnot(
  nrow(employment) == 200L,
  length(unique(employment$State)) == 50L,
  identical(sort(unique(employment$Sector)),
            sort(c("711AS", "713", "721", "722"))),
  all(employment$Employment_Coefficient_Year == 2023),
  all(employment$FTE_Ratio_Year == 2023),
  all(employment$IO_Structure_Year == 2019),
  nrow(fte_ratios) == 71L,
  !anyDuplicated(fte_ratios$io_sector),
  all(fte_ratios$source_year == 2023L),
  all(fte_ratios$fte_per_job >= 0 & fte_ratios$fte_per_job <= 1),
  nrow(gambling) == 50L,
  nrow(properties) == 200L,
  nrow(online) == 50L
)

assert_close(
  employment$Emp_Coef,
  employment$Employment / employment$Employment_VA_M,
  "2023 jobs/value-added coefficient"
)
assert_close(
  employment$Direct_Jobs_Per_1M_Output,
  employment$Employment / employment$Employment_Output_M,
  "2023 jobs/output coefficient",
  tolerance = 2e-4
)
assert_close(
  employment$Indirect_Emp_Coef,
  (employment$Type_I_Jobs_Per_1M_Output -
     employment$Direct_Jobs_Per_1M_Output) /
    (employment$Type_I_VA - employment$Direct_VA_Coef),
  "supplier jobs/GDP coefficient",
  tolerance = 1e-5
)
assert_close(
  employment$Induced_Emp_Coef,
  (employment$Type_II_Jobs_Per_1M_Output -
     employment$Type_I_Jobs_Per_1M_Output) /
    (employment$Type_II_VA - employment$Type_I_VA),
  "induced jobs/GDP coefficient",
  tolerance = 1e-5
)

target_fte_ratios <- fte_ratios[match(employment$Sector,
                                      fte_ratios$io_sector), ]
assert_close(employment$FTE_Per_Job, target_fte_ratios$fte_per_job,
             "target-sector BEA FTE/job ratio")
assert_close(
  employment$Direct_FTE_Per_1M_Output,
  employment$Direct_Jobs_Per_1M_Output * employment$FTE_Per_Job,
  "direct estimated FTE/output coefficient",
  tolerance = 2e-6
)
assert_close(employment$FTE_Coef,
             employment$Emp_Coef * employment$FTE_Per_Job,
             "direct estimated FTE/GDP coefficient")
assert_close(
  employment$Indirect_FTE_Coef,
  (employment$Type_I_FTE_Per_1M_Output -
     employment$Direct_FTE_Per_1M_Output) /
    (employment$Type_I_VA - employment$Direct_VA_Coef),
  "supplier FTE/GDP coefficient",
  tolerance = 1e-5
)
assert_close(
  employment$Induced_FTE_Coef,
  (employment$Type_II_FTE_Per_1M_Output -
     employment$Type_I_FTE_Per_1M_Output) /
    (employment$Type_II_VA - employment$Type_I_VA),
  "induced FTE/GDP coefficient",
  tolerance = 1e-5
)
stopifnot(
  all(employment$Direct_FTE_Per_1M_Output <=
        employment$Direct_Jobs_Per_1M_Output),
  all(employment$Type_I_FTE_Per_1M_Output <=
        employment$Type_I_Jobs_Per_1M_Output),
  all(employment$Type_II_FTE_Per_1M_Output <=
        employment$Type_II_Jobs_Per_1M_Output)
)

parent <- employment[employment$Sector == "713", ]
parent <- parent[match(gambling$State, parent$State), ]
casino_ratio <- ratios[ratios$property_type == "713210", ]
assert_close(gambling$Direct_VA_Coef / parent$Direct_VA_Coef,
             rep(casino_ratio$va_ratio, 50), "gambling VA calibration")
assert_close(gambling$Direct_Wage_Coef / parent$Direct_Wage_Coef,
             rep(casino_ratio$wage_ratio, 50), "gambling compensation calibration")
assert_close(gambling$Direct_Tax_Coef / parent$Direct_Tax_Coef,
             rep(casino_ratio$topi_ratio, 50), "gambling TOPI calibration")
assert_close(gambling$Direct_Jobs_Per_1M_Output /
               parent$Direct_Jobs_Per_1M_Output,
             rep(casino_ratio$emp_ratio, 50), "gambling jobs calibration")

core_fields <- c(
  "Direct_VA_Coef", "Direct_Wage_Coef", "Direct_Tax_Coef",
  "Emp_Coef", "Indirect_Emp_Coef", "Induced_Emp_Coef",
  "Direct_Jobs_Per_1M_Output", "Type_I_Jobs_Per_1M_Output",
  "Type_II_Jobs_Per_1M_Output", "Type_I_Emp_Mult", "Type_II_Emp_Mult",
  "FTE_Per_Job", "FTE_Coef", "Indirect_FTE_Coef", "Induced_FTE_Coef",
  "Direct_FTE_Per_1M_Output", "Type_I_FTE_Per_1M_Output",
  "Type_II_FTE_Per_1M_Output", "Type_I_FTE_Mult", "Type_II_FTE_Mult",
  "Type_I_Output", "Type_II_Output", "Type_I_VA", "Type_II_VA",
  "Type_I_Wage", "Type_II_Wage", "Type_I_Tax", "Type_II_Tax"
)
for (code in unique(properties$Property_Type)) {
  property <- properties[properties$Property_Type == code, ]
  property <- property[match(gambling$State, property$State), ]
  for (field in core_fields) {
    assert_close(property[[field]], gambling[[field]],
                 paste(code, field, "canonical gambling match"))
  }
}

online <- online[match(gambling$State, online$State), ]
assert_close(
  online$Indirect_Emp_Coef,
  gambling$Indirect_Emp_Coef,
  "online supplier labor intensity remains tied to supplier industries"
)
assert_close(
  online$Induced_Emp_Coef,
  gambling$Induced_Emp_Coef,
  "online induced labor intensity remains tied to household-spending industries"
)
assert_close(
  online$Indirect_FTE_Coef,
  gambling$Indirect_FTE_Coef,
  "online supplier FTE intensity remains tied to supplier industries"
)
assert_close(
  online$Induced_FTE_Coef,
  gambling$Induced_FTE_Coef,
  "online induced FTE intensity remains tied to household-spending industries"
)
online_direct_ratio <- fte_ratios$fte_per_job[fte_ratios$io_sector == "5415"]
assert_close(
  online$Direct_FTE_Per_1M_Output / online$Direct_Jobs_Per_1M_Output,
  rep(online_direct_ratio, 50),
  "online direct FTE/job ratio uses computer-systems proxy"
)

message("Jobs and FTE multiplier integrity checks passed for 50 states and 4 property labels.")
