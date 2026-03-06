# ============================================================================
# Generate complete multiplier CSVs with tax (TOPI) columns
#
# This script:
#   1. Merges original employment_multipliers (with emp coefficients) with
#      tax multipliers from state_multipliers_with_tax.csv
#   2. Applies gambling-specific TOPI adjustments to create gambling_multipliers
# ============================================================================

library(tidyverse)

# ============================================================================
# STEP 1: Build complete employment_multipliers_2023.csv
# ============================================================================

message("=== Building Complete Employment Multipliers ===\n")

# Original from Google Drive (has Indirect_Emp_Coef, Induced_Emp_Coef, etc.)
original <- read.csv(
  "/Users/ksr/Library/CloudStorage/GoogleDrive-kphilander@gmail.com/My Drive/1 - Documents/Research/Econ Impact/Claude/casino_impact_study/employment_multipliers_2023.csv",
  stringsAsFactors = FALSE
)
message("Original columns: ", paste(names(original), collapse = ", "))
message("Original rows: ", nrow(original))

# Tax multipliers (has Direct_Tax_Coef, Type_I_Tax, Type_II_Tax)
tax_mults <- read.csv("state_multipliers_with_tax.csv", stringsAsFactors = FALSE) %>%
  select(State, Sector, Direct_Tax_Coef, Type_I_Tax, Type_II_Tax)
message("Tax multiplier rows: ", nrow(tax_mults))

# Merge
combined <- original %>%
  left_join(tax_mults, by = c("State", "Sector"))

# Check for any missing tax data
missing_tax <- sum(is.na(combined$Direct_Tax_Coef))
if (missing_tax > 0) {
  message("WARNING: ", missing_tax, " rows missing tax data")
  print(combined %>% filter(is.na(Direct_Tax_Coef)) %>% select(State, Sector) %>% head(10))
} else {
  message("All rows matched with tax data")
}

# Save
write.csv(combined, "employment_multipliers_2023.csv", row.names = FALSE)
message("Saved: employment_multipliers_2023.csv (", nrow(combined), " rows, ", ncol(combined), " columns)")
message("Columns: ", paste(names(combined), collapse = ", "))

# ============================================================================
# STEP 2: Build gambling_multipliers_2023.csv with TOPI
# ============================================================================

message("\n=== Building Gambling Multipliers with TOPI ===\n")

# Adjustment factors (from BEA Detail IO tables, script 13)
ADJUSTMENT_FACTORS <- list(
  va_coef_ratio = 0.89,
  wage_coef_ratio = 0.63,
  topi_coef_ratio = 0.6086,
  output_mult_ratio = 0.91,
  va_mult_ratio = 0.88,
  wage_mult_ratio = 0.76,
  topi_mult_ratio = 0.7144,
  gambling_va_coef = 0.577,
  gambling_wage_coef = 0.255,
  gambling_topi_coef = 0.035024
)

# Load existing gambling multipliers from Google Drive (has employment data)
gambling_orig <- read.csv(
  "/Users/ksr/Library/CloudStorage/GoogleDrive-kphilander@gmail.com/My Drive/1 - Documents/Research/Econ Impact/Claude/casino_impact_study/gambling_multipliers_2023.csv",
  stringsAsFactors = FALSE
)
message("Original gambling multiplier columns: ", paste(names(gambling_orig), collapse = ", "))
message("Original gambling multiplier rows: ", nrow(gambling_orig))

# Get the 713 blended tax multipliers
tax_713 <- combined %>%
  filter(Sector == "713") %>%
  select(State, Direct_Tax_Coef, Type_I_Tax, Type_II_Tax)

# Merge tax data into gambling multipliers
gambling_with_tax <- gambling_orig %>%
  left_join(tax_713, by = "State") %>%
  mutate(
    # Apply gambling-specific TOPI adjustments
    # Direct: scale the blended 713 tax coefficient by the gambling ratio
    Direct_Tax_Coef = Direct_Tax_Coef * ADJUSTMENT_FACTORS$topi_coef_ratio,

    # Type I: gambling direct + scaled indirect portion
    # The indirect portion = Type_I_Tax_blended - Direct_Tax_Coef_blended
    # We need to use the ORIGINAL blended values for the indirect portion
    # So we compute it step by step
    Type_I_Tax = Direct_Tax_Coef +
      (tax_713$Type_I_Tax[match(State, tax_713$State)] -
       tax_713$Direct_Tax_Coef[match(State, tax_713$State)]) * ADJUSTMENT_FACTORS$topi_mult_ratio,

    Type_II_Tax = Type_I_Tax +
      (tax_713$Type_II_Tax[match(State, tax_713$State)] -
       tax_713$Type_I_Tax[match(State, tax_713$State)]) * ADJUSTMENT_FACTORS$topi_mult_ratio
  )

# Verify no NAs
missing <- sum(is.na(gambling_with_tax$Direct_Tax_Coef))
if (missing > 0) {
  message("WARNING: ", missing, " rows missing tax data in gambling multipliers")
} else {
  message("All gambling multiplier rows have tax data")
}

# Save
write.csv(gambling_with_tax, "gambling_multipliers_2023.csv", row.names = FALSE)
message("Saved: gambling_multipliers_2023.csv (", nrow(gambling_with_tax), " rows, ", ncol(gambling_with_tax), " columns)")
message("Columns: ", paste(names(gambling_with_tax), collapse = ", "))

# ============================================================================
# VERIFICATION
# ============================================================================

message("\n=== Verification: Nevada Comparison ===\n")

nv_713 <- combined %>% filter(State == "Nevada", Sector == "713")
nv_7132 <- gambling_with_tax %>% filter(State == "Nevada")

comparison <- data.frame(
  Metric = c("Direct VA Coef", "Direct Wage Coef", "Direct Tax Coef (TOPI)",
             "Type I Output", "Type I VA", "Type I Wage", "Type I Tax",
             "Type II Output", "Type II VA", "Type II Wage", "Type II Tax"),
  Blended_713 = c(nv_713$Direct_VA_Coef, nv_713$Direct_Wage_Coef, nv_713$Direct_Tax_Coef,
                  nv_713$Type_I_Output, nv_713$Type_I_VA, nv_713$Type_I_Wage, nv_713$Type_I_Tax,
                  nv_713$Type_II_Output, nv_713$Type_II_VA, nv_713$Type_II_Wage, nv_713$Type_II_Tax),
  Gambling_7132 = c(nv_7132$Direct_VA_Coef, nv_7132$Direct_Wage_Coef, nv_7132$Direct_Tax_Coef,
                    nv_7132$Type_I_Output, nv_7132$Type_I_VA, nv_7132$Type_I_Wage, nv_7132$Type_I_Tax,
                    nv_7132$Type_II_Output, nv_7132$Type_II_VA, nv_7132$Type_II_Wage, nv_7132$Type_II_Tax)
)
comparison$Ratio <- round(comparison$Gambling_7132 / comparison$Blended_713, 4)

print(comparison)

message("\n=== $100M GGR Impact Example: Nevada ===\n")
ggr <- 100

cat(sprintf("%-30s %12s %12s\n", "", "Blended 713", "Gambling 7132"))
cat(sprintf("%-30s %12s %12s\n", "---", "---", "---"))
cat(sprintf("%-30s $%10.2fM $%10.2fM\n", "Direct TOPI", ggr * nv_713$Direct_Tax_Coef, ggr * nv_7132$Direct_Tax_Coef))
cat(sprintf("%-30s $%10.2fM $%10.2fM\n", "Total TOPI (Type II)", ggr * nv_713$Type_II_Tax, ggr * nv_7132$Type_II_Tax))
cat(sprintf("%-30s $%10.2fM $%10.2fM\n", "Direct Wages", ggr * nv_713$Direct_Wage_Coef, ggr * nv_7132$Direct_Wage_Coef))
cat(sprintf("%-30s $%10.2fM $%10.2fM\n", "Total Wages (Type II)", ggr * nv_713$Type_II_Wage, ggr * nv_7132$Type_II_Wage))
cat(sprintf("%-30s $%10.2fM $%10.2fM\n", "Direct GDP", ggr * nv_713$Direct_VA_Coef, ggr * nv_7132$Direct_VA_Coef))
cat(sprintf("%-30s $%10.2fM $%10.2fM\n", "Total GDP (Type II)", ggr * nv_713$Type_II_VA, ggr * nv_7132$Type_II_VA))

message("\n=== COMPLETE ===")
