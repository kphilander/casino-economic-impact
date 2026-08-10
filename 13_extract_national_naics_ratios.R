# ============================================================================
# EXTRACT NATIONAL NAICS RATIOS FROM BEA DETAIL IO TABLES
# ============================================================================
#
# Purpose: Extract NAICS-specific coefficients from the BEA Detail IO tables
# using the useeior package, and calculate ratios relative to parent sectors.
#
# The 713200-to-713 ratios are the canonical land-based gambling calibration.
# Accommodation and food rows are retained as transparent comparison evidence;
# they are not substituted for the gambling production function.
#
# Reporting labels and their BEA Detail comparison mappings:
# - Resort with Hotel & Casino (721120) → 721000 Accommodation
# - Stand-alone Casino (713210) → 713200 Gambling Industries
# - Slot Parlors / Bingo Halls (713290) → 713200 Gambling Industries
# - Bars/Restaurants with Slots (722410) → 722A00 Other food/drinking
#
# Note: BEA has no separate casino-hotel detail code. The 721000 row is a
# comparison only; department mode uses 721 for separately entered room revenue.
#
# ============================================================================

library(useeior)
library(dplyr)
library(tidyr)

message("\n=== EXTRACTING NATIONAL NAICS RATIOS FROM BEA DETAIL IO ===\n")

# ============================================================================
# BUILD THE USEEIO DETAIL MODEL
# ============================================================================

message("Building USEEIOv2.0.1-411 model (411-industry detail)...")
message("This may take a moment to download data...\n")

model <- buildModel('USEEIOv2.0.1-411')

message("\nModel built successfully!")
message("Number of industries: ", ncol(model$A))

# ============================================================================
# DEFINE TARGET SECTORS
# ============================================================================

# BEA Detail codes for hospitality/gambling sectors
bea_sectors <- data.frame(
  bea_code = c("713200/US", "713100/US", "713900/US", "721000/US", "722110/US", "722A00/US"),
  bea_name = c(
    "Gambling Industries (except casino hotels)",
    "Amusement Parks and Arcades",
    "Other Amusement and Recreation",
    "Accommodation",
    "Full-service Restaurants",
    "Other Food and Drinking Places"
  ),
  stringsAsFactors = FALSE
)

# Calibration and comparison mappings
property_types <- data.frame(
  property_type = c("721120", "713210", "713290", "722410"),
  property_label = c(
    "Resort with Hotel & Casino",
    "Stand-alone Casino",
    "Slot Parlors / Bingo Halls",
    "Bars/Restaurants with Slots"
  ),
  bea_proxy = c("721000/US", "713200/US", "713200/US", "722A00/US"),
  parent_io_sector = c("721", "713", "713", "722"),
  calibration_role = c(
    "comparison_only", "canonical_gambling",
    "canonical_gambling", "comparison_only"
  ),
  stringsAsFactors = FALSE
)

# ============================================================================
# EXTRACT COEFFICIENTS FROM MODEL MATRICES
# ============================================================================

message("\n=== EXTRACTING COEFFICIENTS ===\n")

# D matrix: Direct impacts per dollar of output
D <- model$D

# B matrix: Direct flows per dollar (includes Compensation)
B <- model$B

# L matrix: Leontief inverse (total requirements)
L <- model$L

# q: Industry output
q <- model$q

# Extract for target sectors
targets <- bea_sectors$bea_code

# Direct Value Added (per $ output)
va_direct <- D["Value Added", targets]

# Direct Employment (jobs per $ output) - convert to per $M
emp_direct <- D["Jobs Supported", targets]

# Direct Wage/Compensation (per $ output)
wage_direct <- B["Compensation of employees//USD", targets]

# Direct taxes on production and imports, less subsidies (per $ output)
topi_row <- "Taxes on production and imports, less subsidies//USD"
topi_direct <- B[topi_row, targets]

# Type I Output multiplier (column sums of Leontief inverse)
type_i_output <- colSums(L[, targets])

# Type I value added, employee compensation, and TOPI per dollar of direct
# final demand. These are used to calibrate the indirect increments separately
# from the direct coefficients.
type_i_va <- as.numeric(D["Value Added", , drop = FALSE] %*% L[, targets])
names(type_i_va) <- targets
type_i_wage <- as.numeric(B["Compensation of employees//USD", , drop = FALSE] %*%
                            L[, targets])
names(type_i_wage) <- targets
type_i_topi <- as.numeric(B[topi_row, , drop = FALSE] %*% L[, targets])
names(type_i_topi) <- targets

# Industry output for weighting
output <- q[targets]

# ============================================================================
# CREATE COEFFICIENT TABLE
# ============================================================================

coefficients <- data.frame(
  bea_code = targets,
  bea_name = bea_sectors$bea_name,
  output_M = as.numeric(output) / 1e6,  # Convert to millions
  va_direct = as.numeric(va_direct),
  wage_direct = as.numeric(wage_direct),
  topi_direct = as.numeric(topi_direct),
  emp_direct_perM = as.numeric(emp_direct) * 1e6,  # Jobs per $1M
  type_i_output = as.numeric(type_i_output),
  type_i_va = as.numeric(type_i_va),
  type_i_wage = as.numeric(type_i_wage),
  type_i_topi = as.numeric(type_i_topi),
  stringsAsFactors = FALSE
)

message("Direct Coefficients by BEA Sector:")
print(coefficients %>%
        select(bea_code, va_direct, wage_direct, topi_direct,
               emp_direct_perM, type_i_output, type_i_va,
               type_i_wage, type_i_topi) %>%
        mutate(across(where(is.numeric), ~round(., 4))))

# ============================================================================
# CALCULATE BLENDED PARENT SECTOR COEFFICIENTS
# ============================================================================

message("\n=== CALCULATING BLENDED PARENT SECTOR COEFFICIENTS ===\n")

# Blended 713 (Amusement/Gambling/Recreation) - output-weighted average
idx_713 <- c("713100/US", "713200/US", "713900/US")
output_713 <- output[idx_713]
total_713 <- sum(output_713)

va_713_blended <- sum(va_direct[idx_713] * output_713) / total_713
wage_713_blended <- sum(wage_direct[idx_713] * output_713) / total_713
emp_713_blended <- sum(emp_direct[idx_713] * output_713) / total_713
topi_713_blended <- sum(topi_direct[idx_713] * output_713) / total_713
type_i_713_blended <- sum(type_i_output[idx_713] * output_713) / total_713
type_i_va_713_blended <- sum(type_i_va[idx_713] * output_713) / total_713
type_i_wage_713_blended <- sum(type_i_wage[idx_713] * output_713) / total_713
type_i_topi_713_blended <- sum(type_i_topi[idx_713] * output_713) / total_713

# Blended 722 (Food Services) - output-weighted average
idx_722 <- c("722110/US", "722A00/US")
output_722 <- output[idx_722]
total_722 <- sum(output_722)

va_722_blended <- sum(va_direct[idx_722] * output_722) / total_722
wage_722_blended <- sum(wage_direct[idx_722] * output_722) / total_722
emp_722_blended <- sum(emp_direct[idx_722] * output_722) / total_722
topi_722_blended <- sum(topi_direct[idx_722] * output_722) / total_722
type_i_722_blended <- sum(type_i_output[idx_722] * output_722) / total_722
type_i_va_722_blended <- sum(type_i_va[idx_722] * output_722) / total_722
type_i_wage_722_blended <- sum(type_i_wage[idx_722] * output_722) / total_722
type_i_topi_722_blended <- sum(type_i_topi[idx_722] * output_722) / total_722

# 721 has only one sector at detail level
va_721 <- va_direct["721000/US"]
wage_721 <- wage_direct["721000/US"]
emp_721 <- emp_direct["721000/US"]
topi_721 <- topi_direct["721000/US"]
type_i_721 <- type_i_output["721000/US"]
type_i_va_721 <- type_i_va["721000/US"]
type_i_wage_721 <- type_i_wage["721000/US"]
type_i_topi_721 <- type_i_topi["721000/US"]

blended_parents <- data.frame(
  parent_sector = c("713", "721", "722"),
  va_blended = c(va_713_blended, va_721, va_722_blended),
  wage_blended = c(wage_713_blended, wage_721, wage_722_blended),
  topi_blended = c(topi_713_blended, topi_721, topi_722_blended),
  emp_blended_perM = c(emp_713_blended * 1e6, emp_721 * 1e6, emp_722_blended * 1e6),
  type_i_blended = c(type_i_713_blended, type_i_721, type_i_722_blended),
  type_i_va_blended = c(type_i_va_713_blended, type_i_va_721, type_i_va_722_blended),
  type_i_wage_blended = c(type_i_wage_713_blended, type_i_wage_721, type_i_wage_722_blended),
  type_i_topi_blended = c(type_i_topi_713_blended, type_i_topi_721, type_i_topi_722_blended),
  stringsAsFactors = FALSE
)

message("Blended Parent Sector Coefficients:")
print(blended_parents %>%
        mutate(across(where(is.numeric), ~round(., 4))))

# ============================================================================
# CALCULATE PROPERTY TYPE RATIOS
# ============================================================================

message("\n=== CALCULATING CALIBRATION AND COMPARISON RATIOS ===\n")

# Function to calculate ratios for a property type
calc_ratios <- function(bea_proxy, parent_sector) {
  # Get proxy sector coefficients
  proxy_va <- va_direct[bea_proxy]
  proxy_wage <- wage_direct[bea_proxy]
  proxy_emp <- emp_direct[bea_proxy]
  proxy_topi <- topi_direct[bea_proxy]
  proxy_type_i <- type_i_output[bea_proxy]
  proxy_type_i_va <- type_i_va[bea_proxy]
  proxy_type_i_wage <- type_i_wage[bea_proxy]
  proxy_type_i_topi <- type_i_topi[bea_proxy]

  # Get parent blended coefficients
  parent_row <- blended_parents[blended_parents$parent_sector == parent_sector, ]
  parent_va <- parent_row$va_blended
  parent_wage <- parent_row$wage_blended
  parent_emp <- parent_row$emp_blended_perM / 1e6  # Convert back
  parent_topi <- parent_row$topi_blended
  parent_type_i <- parent_row$type_i_blended

  data.frame(
    va_ratio = as.numeric(proxy_va / parent_va),
    wage_ratio = as.numeric(proxy_wage / parent_wage),
    topi_ratio = as.numeric(proxy_topi / parent_topi),
    # National direct-jobs adjustment used by the canonical gambling pipeline.
    emp_ratio = as.numeric(proxy_emp / parent_emp),
    emp_va_ratio = as.numeric((proxy_emp / proxy_va) / (parent_emp / parent_va)),
    type_i_output_ratio = as.numeric(proxy_type_i / parent_type_i),
    output_indirect_ratio = as.numeric((proxy_type_i - 1) /
                                         (parent_type_i - 1)),
    va_indirect_ratio = as.numeric((proxy_type_i_va - proxy_va) /
                                     (parent_row$type_i_va_blended - parent_va)),
    wage_indirect_ratio = as.numeric((proxy_type_i_wage - proxy_wage) /
                                       (parent_row$type_i_wage_blended - parent_wage)),
    topi_indirect_ratio = as.numeric((proxy_type_i_topi - proxy_topi) /
                                       (parent_row$type_i_topi_blended - parent_topi)),
    stringsAsFactors = FALSE
  )
}

# Calculate ratios for each property type
ratios_list <- lapply(1:nrow(property_types), function(i) {
  pt <- property_types[i, ]
  ratios <- calc_ratios(pt$bea_proxy, pt$parent_io_sector)
  cbind(pt, ratios)
})

property_type_ratios <- do.call(rbind, ratios_list)

message("Calibration/comparison ratios (relative to parent IO sector):")
print(property_type_ratios %>%
        select(property_type, property_label, parent_io_sector,
               va_ratio, wage_ratio, topi_ratio, emp_ratio, emp_va_ratio,
               output_indirect_ratio, va_indirect_ratio,
               wage_indirect_ratio, topi_indirect_ratio) %>%
        mutate(across(where(is.numeric), ~round(., 3))))

# ============================================================================
# DOCUMENT THE REMOVED LEGACY HARDCODED RATIOS
# ============================================================================

message("\n=== LEGACY RATIO DIAGNOSTIC ===\n")

# Former hardcoded values removed from 12_gambling_specific_data.R
existing <- data.frame(
  metric = c("VA coefficient ratio", "Wage coefficient ratio"),
  existing_value = c(0.89, 0.63),
  new_value = c(
    property_type_ratios$va_ratio[property_type_ratios$property_type == "713210"],
    property_type_ratios$wage_ratio[property_type_ratios$property_type == "713210"]
  )
)
existing$difference <- (existing$new_value - existing$existing_value) / existing$existing_value * 100

message("Gambling (713210) vs removed legacy ratios:")
print(existing)

message("\nNote: Differences may be due to:")
message("  - Different base years (existing uses 2017, this uses 2017 schema)")
message("  - Different aggregation methods")
message("  - Updated BEA data")

# ============================================================================
# SAVE OUTPUT
# ============================================================================

message("\n=== SAVING OUTPUT ===\n")

# Save the full property type ratios
write.csv(property_type_ratios, "national_naics_ratios.csv", row.names = FALSE)
message("Saved: national_naics_ratios.csv")

# Save the blended parent coefficients for reference
write.csv(blended_parents, "blended_parent_coefficients.csv", row.names = FALSE)
message("Saved: blended_parent_coefficients.csv")

# Save the detailed BEA sector coefficients
write.csv(coefficients, "bea_detail_coefficients.csv", row.names = FALSE)
message("Saved: bea_detail_coefficients.csv")

# ============================================================================
# SUMMARY
# ============================================================================

message("\n=== SUMMARY ===\n")

message("National calibration and comparison factors:")
message("")
for (i in 1:nrow(property_type_ratios)) {
  pt <- property_type_ratios[i, ]
  message(sprintf("%s (%s):", pt$property_label, pt$property_type))
  message(sprintf("  Parent IO Sector: %s", pt$parent_io_sector))
  message(sprintf("  VA ratio:     %.3f (multiply state %s VA_coef by this)", pt$va_ratio, pt$parent_io_sector))
  message(sprintf("  Wage ratio:   %.3f (multiply state %s Wage_coef by this)", pt$wage_ratio, pt$parent_io_sector))
  message(sprintf("  Emp ratio:    %.3f (national direct-jobs adjustment)", pt$emp_ratio))
  message("")
}

message("IMPORTANT: Only rows marked canonical_gambling calibrate land-based gaming.")
message("Comparison-only hospitality rows do not replace the gambling production function.")

message("\n=== COMPLETE ===\n")
