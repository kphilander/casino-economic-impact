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
  all(employment$IO_Structure_Year == 2019),
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

message("Multiplier integrity checks passed for 50 states and 4 property labels.")
