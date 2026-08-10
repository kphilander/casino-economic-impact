# ============================================================================
# EXTRACT NATIONAL NAICS RATIOS FROM BEA DETAIL IO TABLES
# ============================================================================
#
# Purpose: Extract NAICS-specific coefficients from the BEA Detail IO tables
# using the useeior package, and calculate ratios relative to parent sectors.
#
# These ratios are applied to state-level parent sector data to derive
# property-type-specific multipliers for the casino impact calculator.
#
# Property Types and their BEA Detail mappings:
# - Resort with Hotel & Casino (721120) → 721000 Accommodation
# - Stand-alone Casino (713210) → 713200 Gambling Industries
# - Slot Parlors / Bingo Halls (713290) → 713200 Gambling Industries
# - Bars/Restaurants with Slots (722410) → 722A00 Other food/drinking
#
# Note: Casino Hotels (721120) don't have a separate BEA code - they're
# included in 721000 Accommodation. We'll use accommodation sector data.
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

# Property type mappings
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

# Type I Output multiplier (column sums of Leontief inverse)
type_i_output <- colSums(L[, targets])

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
  emp_direct_perM = as.numeric(emp_direct) * 1e6,  # Jobs per $1M
  type_i_output = as.numeric(type_i_output),
  stringsAsFactors = FALSE
)

message("Direct Coefficients by BEA Sector:")
print(coefficients %>%
        select(bea_code, va_direct, wage_direct, emp_direct_perM, type_i_output) %>%
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
type_i_713_blended <- sum(type_i_output[idx_713] * output_713) / total_713

# Blended 722 (Food Services) - output-weighted average
idx_722 <- c("722110/US", "722A00/US")
output_722 <- output[idx_722]
total_722 <- sum(output_722)

va_722_blended <- sum(va_direct[idx_722] * output_722) / total_722
wage_722_blended <- sum(wage_direct[idx_722] * output_722) / total_722
emp_722_blended <- sum(emp_direct[idx_722] * output_722) / total_722
type_i_722_blended <- sum(type_i_output[idx_722] * output_722) / total_722

# 721 has only one sector at detail level
va_721 <- va_direct["721000/US"]
wage_721 <- wage_direct["721000/US"]
emp_721 <- emp_direct["721000/US"]
type_i_721 <- type_i_output["721000/US"]

blended_parents <- data.frame(
  parent_sector = c("713", "721", "722"),
  va_blended = c(va_713_blended, va_721, va_722_blended),
  wage_blended = c(wage_713_blended, wage_721, wage_722_blended),
  emp_blended_perM = c(emp_713_blended * 1e6, emp_721 * 1e6, emp_722_blended * 1e6),
  type_i_blended = c(type_i_713_blended, type_i_721, type_i_722_blended),
  stringsAsFactors = FALSE
)

message("Blended Parent Sector Coefficients:")
print(blended_parents %>%
        mutate(across(where(is.numeric), ~round(., 4))))

# ============================================================================
# CALCULATE PROPERTY TYPE RATIOS
# ============================================================================

message("\n=== CALCULATING PROPERTY TYPE RATIOS ===\n")

# Function to calculate ratios for a property type
calc_ratios <- function(bea_proxy, parent_sector) {
  # Get proxy sector coefficients
  proxy_va <- va_direct[bea_proxy]
  proxy_wage <- wage_direct[bea_proxy]
  proxy_emp <- emp_direct[bea_proxy]
  proxy_type_i <- type_i_output[bea_proxy]

  # Get parent blended coefficients
  parent_row <- blended_parents[blended_parents$parent_sector == parent_sector, ]
  parent_va <- parent_row$va_blended
  parent_wage <- parent_row$wage_blended
  parent_emp <- parent_row$emp_blended_perM / 1e6  # Convert back
  parent_type_i <- parent_row$type_i_blended

  data.frame(
    va_ratio = as.numeric(proxy_va / parent_va),
    wage_ratio = as.numeric(proxy_wage / parent_wage),
    # National direct-jobs adjustment used by the recovered property pipeline.
    # State QCEW observations remain a separate validation/reference series.
    emp_ratio = as.numeric(proxy_emp / parent_emp),
    type_i_output_ratio = as.numeric(proxy_type_i / parent_type_i),
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

message("Property Type Ratios (relative to parent IO sector):")
print(property_type_ratios %>%
        select(property_type, property_label, parent_io_sector,
               va_ratio, wage_ratio, emp_ratio, type_i_output_ratio) %>%
        mutate(across(where(is.numeric), ~round(., 3))))

# ============================================================================
# COMPARE TO EXISTING HARDCODED RATIOS
# ============================================================================

message("\n=== COMPARISON TO EXISTING HARDCODED RATIOS ===\n")

# Current hardcoded values from 12_gambling_specific_data.R
existing <- data.frame(
  metric = c("VA coefficient ratio", "Wage coefficient ratio"),
  existing_value = c(0.89, 0.63),
  new_value = c(
    property_type_ratios$va_ratio[property_type_ratios$property_type == "713210"],
    property_type_ratios$wage_ratio[property_type_ratios$property_type == "713210"]
  )
)
existing$difference <- (existing$new_value - existing$existing_value) / existing$existing_value * 100

message("Gambling (713210) vs existing hardcoded ratios:")
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

message("Property Type Adjustment Factors for State Multipliers:")
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

message("IMPORTANT: The employment ratio is a national calibration.")
message("The recovered property pipeline uses it for direct jobs and keeps state QCEW as validation/reference data.")

message("\n=== COMPLETE ===\n")
