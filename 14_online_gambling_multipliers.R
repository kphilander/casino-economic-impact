# ============================================================================
# ONLINE GAMBLING-SPECIFIC MULTIPLIER ADJUSTMENTS
#
# This script:
#   1. Loads existing gambling (7132) multipliers as the base
#   2. Applies online-specific adjustment factors to create online gambling
#      multiplier datasets for iGaming and sports betting
#
# Online gambling operators (DraftKings, FanDuel, Rush Street) have fundamentally
# different economics than land-based casinos:
#   - Far fewer employees per $M revenue (~1.0-1.1 vs ~5.0 land-based)
#   - Higher-paid, tech-heavy workforce
#   - Lower wage-to-revenue ratio (~14% vs ~25.5% for 7132)
#   - Different supply chains (tech, payment processing, marketing)
#
# METHODOLOGY NOTE:
#   Unlike the 7132 adjustments (derived from BEA Detail IO Tables via useeior),
#   these online adjustment factors are ESTIMATED from public company financial
#   data (DraftKings, FanDuel/Flutter, Rush Street Interactive SEC filings 2024). The BEA IO
#   tables do not distinguish online from land-based gambling operations.
#   These are approximations, not official IO-derived coefficients.
#
# Data Sources:
#   - DraftKings 2024: 5,100 employees / $4.77B revenue (1.07 emp/$1M rev)
#   - Rush Street Interactive 2024: ~883 employees / $924M revenue (0.96 emp/$1M rev)
#   - Flutter/FanDuel 2024: 27,345 employees (global) / $14.05B revenue
#   - Land-based average (AGA 2022): 332K employees / $66B GGR
#   - Gambling multipliers from 12_gambling_specific_data.R
#
# NOTE: BetMGM excluded from employment calculations. As a JV between
#   MGM Resorts and Entain, its reported ~1,400 employees understates
#   the true workforce (Entain provides technology platform, MGM provides
#   brand/marketing infrastructure). This makes its 0.67 emp/$1M revenue
#   figure unreliable. RSI confirms the DraftKings ratio (~1.0 emp/$1M).
# ============================================================================

library(tidyverse)

# ============================================================================
# ONLINE ADJUSTMENT FACTORS (estimated from SEC filings)
# ============================================================================

# These ratios compare online gambling operations to land-based gambling (7132)
# Calculated from public company financial data (2024)

ONLINE_ADJUSTMENT_FACTORS <- list(
  # Direct coefficients (ratios applied to 7132 gambling values)
  va_coef_ratio = 0.90,       # Online VA coef / Gambling VA coef
                               # Online platforms have slightly lower VA ratio
                               # due to high platform licensing/payment processing costs

  wage_coef_ratio = 0.55,     # Online wage coef / Gambling wage coef
                               # Online: ~14% of revenue to wages vs 7132: ~25.5%
                               # Fewer but higher-paid employees (tech workers)

  topi_coef_ratio = 1.0,      # Online TOPI coef / Gambling TOPI coef
                               # Similar production tax treatment

  # Multiplier ratios (applied to indirect/induced portions)
  output_mult_ratio = 0.85,   # Lower output multiplier - online supply chains
                               # are more geographically diffuse (tech, cloud)

  va_mult_ratio = 0.85,       # Similar reasoning for VA multiplier

  wage_mult_ratio = 0.80,     # Online supply chains generate fewer wage jobs
                               # per dollar of intermediate purchases

  topi_mult_ratio = 0.90,     # Slightly lower TOPI in supply chain

  # Employment coefficient adjustment
  # Land-based: ~5.0 employees per $1M revenue
  # Online: ~1.01 employees per $1M revenue (avg of DraftKings 1.07 + RSI 0.96)
  # Ratio: 1.01/5.0 = 0.202
  # But Emp_Coef is jobs per $1M GDP, not revenue, so we adjust:
  # If online VA ratio is 0.90 of 7132, employment per $M GDP ratio is:
  # 0.202 / 0.90 = 0.224
  emp_coef_ratio = 0.23,      # Online employment per $1M GDP / Gambling per $1M GDP

  # Source data (for documentation)
  source_note = "Estimated from DraftKings, Rush Street Interactive, Flutter SEC filings (2024)",
  source_year = 2024
)

message("=== ONLINE ADJUSTMENT FACTORS ===")
message("These factors convert gambling (7132) multipliers to online-specific estimates:")
message("  VA coefficient ratio:   ", ONLINE_ADJUSTMENT_FACTORS$va_coef_ratio)
message("  Wage coefficient ratio: ", ONLINE_ADJUSTMENT_FACTORS$wage_coef_ratio)
message("  TOPI coefficient ratio: ", ONLINE_ADJUSTMENT_FACTORS$topi_coef_ratio)
message("  Output mult ratio:      ", ONLINE_ADJUSTMENT_FACTORS$output_mult_ratio)
message("  VA mult ratio:          ", ONLINE_ADJUSTMENT_FACTORS$va_mult_ratio)
message("  Wage mult ratio:        ", ONLINE_ADJUSTMENT_FACTORS$wage_mult_ratio)
message("  TOPI mult ratio:        ", ONLINE_ADJUSTMENT_FACTORS$topi_mult_ratio)
message("  Employment coef ratio:  ", ONLINE_ADJUSTMENT_FACTORS$emp_coef_ratio)

# ============================================================================
# LOAD GAMBLING MULTIPLIERS (7132 base)
# ============================================================================

message("\n=== Loading Gambling (7132) Multipliers ===\n")

gambling_mult <- read.csv("gambling_multipliers_2023.csv", stringsAsFactors = FALSE)
message("Loaded ", nrow(gambling_mult), " state records")

# ============================================================================
# CREATE ONLINE GAMBLING-ADJUSTED MULTIPLIERS
# ============================================================================

message("\n=== Creating Online Gambling-Adjusted Multipliers ===\n")

online_multipliers <- gambling_mult %>%
  mutate(
    Parent_Direct_VA_Coef = Direct_VA_Coef,
    Parent_Direct_Wage_Coef = Direct_Wage_Coef,
    Parent_Direct_Tax_Coef = Direct_Tax_Coef,
    Parent_Type_I_Output = Type_I_Output,
    Parent_Type_I_VA = Type_I_VA,
    Parent_Type_I_Wage = Type_I_Wage,
    Parent_Type_I_Tax = Type_I_Tax,
    Parent_Direct_Jobs_Per_1M_Output = Direct_Jobs_Per_1M_Output,

    # Adjust direct coefficients
    Direct_VA_Coef = Parent_Direct_VA_Coef * ONLINE_ADJUSTMENT_FACTORS$va_coef_ratio,
    Direct_Wage_Coef = Parent_Direct_Wage_Coef * ONLINE_ADJUSTMENT_FACTORS$wage_coef_ratio,
    Direct_Tax_Coef = Parent_Direct_Tax_Coef * ONLINE_ADJUSTMENT_FACTORS$topi_coef_ratio,

    # Adjust Type I multipliers (direct + indirect)
    Type_I_Output = 1 + (Parent_Type_I_Output - 1) * ONLINE_ADJUSTMENT_FACTORS$output_mult_ratio,
    Type_I_VA = Direct_VA_Coef + (Parent_Type_I_VA - Parent_Direct_VA_Coef) *
      ONLINE_ADJUSTMENT_FACTORS$va_mult_ratio,
    Type_I_Wage = Direct_Wage_Coef + (Parent_Type_I_Wage - Parent_Direct_Wage_Coef) *
      ONLINE_ADJUSTMENT_FACTORS$wage_mult_ratio,
    Type_I_Tax = Direct_Tax_Coef + (Parent_Type_I_Tax - Parent_Direct_Tax_Coef) *
      ONLINE_ADJUSTMENT_FACTORS$topi_mult_ratio,

    # Adjust Type II multipliers (direct + indirect + induced)
    Type_II_Output = Type_I_Output + (Type_II_Output - Parent_Type_I_Output) *
      ONLINE_ADJUSTMENT_FACTORS$output_mult_ratio,
    Type_II_VA = Type_I_VA + (Type_II_VA - Parent_Type_I_VA) *
      ONLINE_ADJUSTMENT_FACTORS$va_mult_ratio,
    Type_II_Wage = Type_I_Wage + (Type_II_Wage - Parent_Type_I_Wage) *
      ONLINE_ADJUSTMENT_FACTORS$wage_mult_ratio,
    Type_II_Tax = Type_I_Tax + (Type_II_Tax - Parent_Type_I_Tax) *
      ONLINE_ADJUSTMENT_FACTORS$topi_mult_ratio,

    # Adjust only the online operator's direct labor intensity. Indirect and
    # induced coefficients describe supplier and household-spending industries,
    # so applying the operator's direct employment ratio to them has no economic
    # basis. Their GDP amounts are already adjusted through the online Type I/II
    # multipliers above.
    Emp_Coef = Emp_Coef * ONLINE_ADJUSTMENT_FACTORS$emp_coef_ratio,

    VA_M = Industry_Output_M * Direct_VA_Coef,
    Direct_Jobs_Per_1M_Output = Parent_Direct_Jobs_Per_1M_Output *
      ONLINE_ADJUSTMENT_FACTORS$emp_coef_ratio *
      ONLINE_ADJUSTMENT_FACTORS$va_coef_ratio,
    Type_I_Jobs_Per_1M_Output = Direct_Jobs_Per_1M_Output +
      (Type_I_VA - Direct_VA_Coef) * Indirect_Emp_Coef,
    Type_II_Jobs_Per_1M_Output = Type_I_Jobs_Per_1M_Output +
      (Type_II_VA - Type_I_VA) * Induced_Emp_Coef,
    Type_I_Emp_Mult = Type_I_Jobs_Per_1M_Output / Direct_Jobs_Per_1M_Output,
    Type_II_Emp_Mult = Type_II_Jobs_Per_1M_Output / Direct_Jobs_Per_1M_Output,
    Jobs_Per_1M_GDP_Direct = Emp_Coef,
    Jobs_Per_1M_GDP_TypeI = Type_I_Jobs_Per_1M_Output / Type_I_VA,
    Jobs_Per_1M_GDP_TypeII = Type_II_Jobs_Per_1M_Output / Type_II_VA,

    # Update sector labels
    Sector = "ONLINE",
    Sector_Name = "Online Gambling (iGaming & Sports Betting)"
  ) %>%
  select(-starts_with("Parent_"))

# ============================================================================
# SELECT OUTPUT COLUMNS
# ============================================================================

output_online <- online_multipliers %>%
  select(State, Abbrev, Sector, Sector_Name, everything())

# ============================================================================
# SAVE
# ============================================================================

online_mult_file <- "online_gambling_multipliers_2023.csv"
write.csv(output_online, online_mult_file, row.names = FALSE)
message("Saved: ", online_mult_file)

# ============================================================================
# COMPARISON
# ============================================================================

message("\n=== MULTIPLIER COMPARISON: Nevada ===\n")

nv_7132 <- gambling_mult %>% filter(State == "Nevada")
nv_online <- output_online %>% filter(State == "Nevada")

comparison <- data.frame(
  Metric = c("Direct VA Coef", "Direct Wage Coef", "Direct Tax Coef",
             "Type II Output", "Type II VA", "Type II Wage", "Type II Tax",
             "Emp Coef (jobs/$1M GDP)"),
  Gambling_7132 = c(nv_7132$Direct_VA_Coef, nv_7132$Direct_Wage_Coef, nv_7132$Direct_Tax_Coef,
                    nv_7132$Type_II_Output, nv_7132$Type_II_VA, nv_7132$Type_II_Wage, nv_7132$Type_II_Tax,
                    nv_7132$Emp_Coef),
  Online = c(nv_online$Direct_VA_Coef, nv_online$Direct_Wage_Coef, nv_online$Direct_Tax_Coef,
             nv_online$Type_II_Output, nv_online$Type_II_VA, nv_online$Type_II_Wage, nv_online$Type_II_Tax,
             nv_online$Emp_Coef)
)
comparison$Ratio <- round(comparison$Online / comparison$Gambling_7132, 3)

print(comparison)

message("\n=== $100M Online GGR Impact Example: Nevada ===\n")

ggr <- 100  # $100M

cat(sprintf("%-30s %14s %14s\n", "", "Land-based", "Online"))
cat(sprintf("%-30s %14s %14s\n", "---", "---", "---"))
cat(sprintf("%-30s $%11.2fM $%11.2fM\n", "Direct Employee Compensation", ggr * nv_7132$Direct_Wage_Coef, ggr * nv_online$Direct_Wage_Coef))
cat(sprintf("%-30s $%11.2fM $%11.2fM\n", "Total Compensation (Type II)", ggr * nv_7132$Type_II_Wage, ggr * nv_online$Type_II_Wage))
cat(sprintf("%-30s $%11.2fM $%11.2fM\n", "Direct GDP", ggr * nv_7132$Direct_VA_Coef, ggr * nv_online$Direct_VA_Coef))
cat(sprintf("%-30s $%11.2fM $%11.2fM\n", "Total GDP (Type II)", ggr * nv_7132$Type_II_VA, ggr * nv_online$Type_II_VA))

message("\n=== COMPLETE ===")
