# Casino Economic Impact Calculator - Methodology

This repository contains the R code used to compute state-level economic multipliers for the Casino Economic Impact Calculator.

## Live Calculator

**The interactive calculator is available at: https://gamblingpolicy.com/tools/economic-impact/**

## Overview

This methodology computes economic impact multipliers for casino and gaming sectors across all 50 US states. The multipliers quantify the direct, indirect, and induced effects of casino revenue on employment, GDP, output, and wages.

## Data Sources

### Input-Output Tables (2019)
- **Source:** EPA State Input-Output (StateIO) models via `stateior` R package
- **Year:** 2019 (pre-pandemic, to avoid distorted economic relationships)
- **Repository:** https://github.com/USEPA/stateior

### Employment Data (2023)
- **Source:** BLS Quarterly Census of Employment and Wages (QCEW), 2023 Annual Averages
- **URL:** https://www.bls.gov/cew/downloadable-data-files.htm
- **Coverage:** All 50 states, private employment only

## Methodology

### Industry Technology Assumption (ITA)

1. **Direct Requirements Matrix:** A = D × B
   - D = Market share matrix (from Make table)
   - B = Commodity coefficient matrix (from Use table)

2. **Type I Multipliers** (Direct + Indirect):
   - Leontief inverse: L = (I - A)^(-1)
   - Output multiplier = column sum of L

3. **Type II Multipliers** (Direct + Indirect + Induced):
   - Augmented A matrix with household row/column
   - Captures consumer spending effects

4. **Employment Multipliers:**
   - True employment-weighted multipliers using `emp_coef × L`
   - Accounts for different labor intensities across all sectors in supply chain
   - Employment coefficient = Jobs per $1M GDP (Value Added)

### IO Sector Mapping

| IO Sector | NAICS Codes | Description |
|-----------|-------------|-------------|
| 711AS | 711 + 712 | Arts, Entertainment, Recreation |
| 713 | 713 | Amusement, Gambling, Recreation |
| 721 | 721 | Accommodation |
| 722 | 722 | Food Services & Drinking Places |

## R Scripts

| Script | Description |
|--------|-------------|
| `07_process_qcew_employment_2023.R` | Process QCEW employment files for target sectors |
| `08_state_multipliers_2023.R` | Calculate state IO multipliers from StateIO |
| `08a_process_all_qcew_employment.R` | Process QCEW for all 71 IO sectors (for employment multipliers) |
| `09_employment_multipliers_2023.R` | Merge multipliers with employment data |
| `10_casino_impact_model.R` | Main impact calculation functions |
| `11_property_impact_calculator.R` | Property-specific analysis script |

## Dependencies

```r
install.packages("tidyverse")

# For regenerating multipliers from scratch:
install.packages("stateior")
```

## Regenerating Data

To regenerate all multiplier data from scratch:

1. Download QCEW data from BLS (2023.annual.by_industry folder)
2. Run scripts in order:
```r
source("08a_process_all_qcew_employment.R")  # Process all QCEW sectors
source("07_process_qcew_employment_2023.R")  # Process target sectors
source("08_state_multipliers_2023.R")        # Calculate IO multipliers
source("09_employment_multipliers_2023.R")   # Merge with employment
```

## Important Notes

1. **2019 vs 2020 IO Data:** Uses 2019 IO tables to avoid pandemic-distorted economic relationships in 2020 data.

2. **Employment Multipliers:** True employment-weighted multipliers differ from output/GDP multipliers because they account for varying labor intensities across sectors in the supply chain.

3. **Value Added vs Gross Output:** Employment coefficients use Value Added (GDP) as denominator, not Gross Output, which would overstate the economic base.

## Citation

If you use this methodology in research, please cite:

> Philander, K.S. (2024). Casino Economic Impact Calculator Methodology. GP Consulting. https://github.com/kphilander/casino-economic-impact

## License

MIT
