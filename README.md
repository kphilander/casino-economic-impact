# Casino Economic Impact Model

Economic impact multipliers for casino-related sectors across all 50 US states using EPA StateIO data.

## Quick Start

```r
# Load the impact model
source("10_casino_impact_model.R")

# Calculate impact of $100M casino GGR in Nevada
impact <- calculate_casino_impact(100, "713", "Nevada")
print(impact)

# Compare impacts across states
comparison <- compare_states(100, "713", c("Nevada", "New Jersey", "Pennsylvania"))
print(comparison)
```

### Example Output: $100M Casino GGR in Nevada

| Metric | Direct | Indirect | Induced | Total | Multiplier |
|--------|--------|----------|---------|-------|------------|
| Output ($M) | 100.0 | 30.3 | 68.4 | 198.6 | 1.99 |
| GDP ($M) | 59.0 | 15.2 | 43.0 | 117.2 | 1.99 |
| Employment | 662 | 748 | 611 | 2,020 | 3.05 |
| Wages ($M) | 36.4 | 7.4 | 19.5 | 63.2 | 1.74 |

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
| `10_casino_impact_model.R` | **Main user-facing impact function** |
| `11_property_impact_calculator.R` | User-input script for property-specific analysis |

## Output Files

| File | Description |
|------|-------------|
| `employment_multipliers_2023.csv` | Complete dataset with all multipliers and coefficients |
| `state_multipliers_2023.csv` | IO multipliers by state and sector |
| `employment_by_state_2023.csv` | Employment counts by state and sector |
| `employment_multipliers_by_state_wide.csv` | Type II employment multipliers in wide format |

## Usage Examples

### Basic Impact Calculation
```r
source("10_casino_impact_model.R")

impact <- calculate_casino_impact(
  casino_revenue = 100,     # in millions USD
  sector = "713",           # gambling sector
  state = "Nevada"
)
print(impact)
```

### Property-Specific Analysis
Edit `11_property_impact_calculator.R` with your property data:
```r
property_name <- "My Casino"
state <- "Nevada"
ggr <- 100                    # Gross gaming revenue in $M
direct_employment <- 850      # Actual jobs (or NULL to calculate)
direct_wages <- 35            # Actual wages in $M (or NULL to calculate)
```
Then run the script to generate an impact table.

### Available Functions
```r
list_states()                 # All 50 states
list_sectors()                # Available IO sectors
get_state_multipliers("Nevada")
compare_states(100, "713", c("Nevada", "New Jersey", "Pennsylvania"))
```

## Key Findings

### Employment Multipliers by State (Sector 713 - Gambling)

| Rank | State | Type II Emp Mult | Jobs per $100M GGR |
|------|-------|------------------|-------------------|
| 1 | New Hampshire | 3.34 | 2,062 |
| 2 | Nevada | 3.05 | 2,022 |
| 3 | Florida | 2.99 | 3,410 |
| ... | ... | ... | ... |
| 50 | North Dakota | 2.12 | 4,359 |

States with higher multipliers (like Nevada) often have fewer total jobs because they have more capital-intensive operations (fewer jobs per dollar of GDP). States with lower multipliers tend to have more labor-intensive industries.

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

## License

MIT
