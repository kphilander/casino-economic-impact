# Backward-compatible tax-only export.
#
# TOPI is calculated with every other StateIO coefficient in
# 08_state_multipliers_2023.R. This script no longer maintains a second copy of
# the Leontief calculation.

library(tidyverse)

input_file <- Sys.getenv(
  "GEMS_STATE_MULTIPLIERS_FILE",
  unset = "state_multipliers_2023.csv"
)
if (!file.exists(input_file)) {
  stop("Missing ", input_file, "; run 08_state_multipliers_2023.R first")
}

state_multipliers <- read.csv(input_file, stringsAsFactors = FALSE)
tax_export <- state_multipliers %>%
  select(State, Abbrev, Sector, Sector_Name, Direct_VA_Coef,
         Direct_Wage_Coef, Direct_Tax_Coef, Industry_Output_M,
         Type_I_Output, Type_I_VA, Type_I_Wage, Type_I_Tax,
         Type_II_Output, Type_II_VA, Type_II_Wage, Type_II_Tax,
         IO_Structure_Year)

write.csv(tax_export, "state_multipliers_with_tax.csv", row.names = FALSE)
message("Saved state_multipliers_with_tax.csv (compatibility export)")
