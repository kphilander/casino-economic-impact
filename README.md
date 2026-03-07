# Casino Economic Impact Calculator

This repository contains the economic model and web application for computing state-level economic impacts of casino and gaming operations across all 50 US states and the District of Columbia.

**Live Calculator:** https://gamblingpolicy.com/tools/economic-impact/

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Methodology](#methodology)
  - [Industry Technology Assumption (ITA)](#industry-technology-assumption-ita)
  - [Direct, Indirect, and Induced Effects](#direct-indirect-and-induced-effects)
  - [Employment Multipliers](#employment-multipliers)
  - [Tax Estimates](#tax-estimates)
  - [Inflation Adjustment](#inflation-adjustment)
  - [Gambling-Specific Adjustments](#gambling-specific-adjustments)
- [Data Sources](#data-sources)
- [IO Sector Mapping](#io-sector-mapping)
- [Property Types](#property-types)
- [Output Metrics](#output-metrics)
- [Repository Structure](#repository-structure)
  - [R Scripts (Data Pipeline)](#r-scripts-data-pipeline)
  - [Data Files](#data-files)
  - [Web Application](#web-application)
- [Regenerating Data from Scratch](#regenerating-data-from-scratch)
- [Dependencies](#dependencies)
- [Important Technical Notes](#important-technical-notes)
- [License](#license)

## Overview

The calculator quantifies the total economic footprint of a casino or gaming property by computing **direct, indirect, and induced** effects across five metrics:

| Metric | What It Measures |
|--------|-----------------|
| **Output** | Total economic activity (gross output) generated |
| **GDP** | Value added (contribution to Gross Domestic Product) |
| **Employment** | Jobs supported (FTE positions) |
| **Wages** | Employee compensation generated |
| **Tax Revenue** | Government revenue from production taxes and gaming taxes |

Users can input revenue by department (Gaming, Food & Beverage, Lodging, Other) or as a single total. The model applies the appropriate sector-specific multipliers for each revenue stream and aggregates the results.

## How It Works

1. **User enters** casino revenue (by department or total) and selects a state and property type
2. **Revenue is mapped** to the appropriate IO sector(s) with state-specific multipliers
3. **Direct effects** are calculated using coefficients (e.g., VA coefficient converts revenue to GDP contribution)
4. **Indirect effects** are computed via the Leontief inverse, capturing supply-chain purchasing
5. **Induced effects** capture household spending by employees throughout the economy
6. **Employment** is estimated using industry-weighted employment coefficients, deflated to 2019 base dollars
7. **Tax estimates** combine IO-derived production taxes with state-specific gaming tax schedules

## Methodology

### Industry Technology Assumption (ITA)

The model uses the **Industry Technology Assumption** framework from Input-Output economics:

**Step 1 — Direct Requirements Matrix:**

```
A = D × B
```

- **D** = Market share matrix (derived from the Make table — shows what share of each commodity is produced by each industry)
- **B** = Commodity coefficient matrix (derived from the Use table — shows how much of each commodity is required per dollar of output)
- **A** = The resulting industry-by-industry direct requirements matrix

**Step 2 — Leontief Inverse (Type I):**

```
L = (I - A)^(-1)
```

The Leontief inverse captures all rounds of inter-industry purchasing. Each column sum gives the **Type I output multiplier** — the total output generated per dollar of direct output, including all supplier effects.

**Step 3 — Type II Augmentation:**

The A matrix is augmented with a household row (labor income coefficients) and household column (consumer spending patterns). The resulting augmented Leontief inverse yields **Type II multipliers** that additionally capture induced effects from household spending.

### Direct, Indirect, and Induced Effects

| Effect | Source | Example |
|--------|--------|---------|
| **Direct** | The initial economic activity | Casino hires employees, pays wages, generates revenue |
| **Indirect** | Supply chain purchasing | Casino buys food, linens, equipment from suppliers; those suppliers buy from their suppliers |
| **Induced** | Household spending | Casino employees (and supplier employees) spend their wages on housing, groceries, services |

**Decomposition from multipliers:**

- Direct output = revenue
- Indirect output = revenue × (Type I multiplier − 1)
- Induced output = revenue × (Type II multiplier − Type I multiplier)
- Total output = revenue × Type II multiplier

The same decomposition applies to GDP, wages, and tax metrics using their respective multiplier pairs.

### Employment Multipliers

Employment is calculated differently from the other metrics. Rather than using simple output-based multipliers, the model uses **true employment-weighted coefficients**:

```
Jobs = GDP_effect × Employment_Coefficient
```

Three separate coefficients capture the different labor intensities across each effect type:

| Coefficient | Applies To | What It Reflects |
|------------|-----------|-----------------|
| `Emp_Coef` | Direct employment | Labor intensity of the casino/gaming industry itself |
| `Indirect_Emp_Coef` | Indirect employment | Weighted average labor intensity of supplier industries |
| `Induced_Emp_Coef` | Induced employment | Weighted average labor intensity of household-spending industries |

These coefficients are expressed as **jobs per $1M of GDP (Value Added)**, not per $1M of gross output. Using Value Added as the denominator avoids overstating the economic base.

The coefficients are computed in the R scripts using the Leontief inverse weighted by sector-level employment-to-GDP ratios from QCEW data.

### Tax Estimates

The model computes three categories of tax revenue:

**1. Taxes on Production & Imports (TOPI)**

Derived from the IO tables, TOPI flows through the Leontief inverse like wages. It captures sales taxes, property taxes, excise taxes, and other production-related taxes across all direct, indirect, and induced activity.

**2. Gaming Tax**

State-specific tax on Gross Gaming Revenue (GGR). The calculator supports multiple tax structures:

- **Flat rate** — single percentage (e.g., Nevada at 6.75%)
- **Graduated tiers** — increasing rates at revenue thresholds (e.g., Colorado, Iowa)
- **Split by game type** — different rates for slots vs. table games (e.g., Pennsylvania)
- **Split-tiered** — separate graduated schedules for slots and tables (e.g., Illinois)

Tax rates are sourced from state gaming commission reports and the AGA State of the States.

**3. Payroll & Household Taxes**

- **Payroll taxes** — employer-side FICA (Social Security + Medicare), FUTA, SUTA, and state-specific SDI/PFML contributions
- **Household taxes** — estimated via BEA personal current tax ratios (federal + state + local income taxes)

### Inflation Adjustment

Employment coefficients are calibrated to **2019 dollars** (the base year of the IO tables). When a user enters revenue in current-year dollars, the model deflates GDP values to 2019 dollars using the CPI-U annual average before applying employment coefficients:

```
Deflator = CPI_2019 / CPI_current_year
Jobs = (GDP_in_current_dollars × Deflator) × Employment_Coefficient
```

Without this adjustment, entering $100M in 2026 would be treated as equivalent to $100M in 2019, overstating employment by approximately 29% due to cumulative inflation.

### Gambling-Specific Adjustments

The IO tables only contain the blended sector **713** (Amusement, Gambling, and Recreation), which includes golf courses, fitness centers, bowling alleys, and other activities with very different economics than gambling. The model applies adjustment factors derived from **BEA Detail IO Tables** (USEEIOv2.0.1-411) to isolate gambling-specific coefficients:

| Coefficient | Blended 713 | Gambling (713200) | Ratio |
|------------|-------------|-------------------|-------|
| VA coefficient | 0.651 | 0.577 | 0.89 |
| Wage coefficient | 0.406 | 0.255 | 0.63 |
| TOPI coefficient | 0.058 | 0.035 | 0.61 |

These ratios are applied to state-level blended multipliers to produce gambling-specific estimates. Indirect and induced effects reflect supply-chain and household spending across *other* sectors, so no gambling adjustment is needed for those components.

## Data Sources

### Input-Output Tables

| Attribute | Value |
|-----------|-------|
| **Source** | EPA State Input-Output (StateIO) models |
| **Package** | [`stateior`](https://github.com/USEPA/stateior) R package |
| **Year** | 2019 |
| **Rationale** | Pre-pandemic data avoids distorted economic relationships in 2020 |
| **Tables used** | Two-Region Make, Domestic Use, Industry Output, Commodity Output, Value Added |

### Employment Data

| Attribute | Value |
|-----------|-------|
| **Source** | BLS Quarterly Census of Employment and Wages (QCEW) |
| **URL** | https://www.bls.gov/cew/downloadable-data-files.htm |
| **Year** | 2023 Annual Averages |
| **Coverage** | All 50 states + DC, private employment only |

### Gaming Tax Rates

| Attribute | Value |
|-----------|-------|
| **Sources** | State gaming commission reports, AGA State of the States |
| **Coverage** | All 50 states (0% for states without legal commercial casinos) |

### Gambling Adjustment Factors

| Attribute | Value |
|-----------|-------|
| **Source** | BEA Detail IO Tables via `useeior` package (USEEIOv2.0.1-411) |
| **Purpose** | Isolate gambling (NAICS 713200) from blended sector 713 |

## IO Sector Mapping

| IO Sector | NAICS Codes | Description | Casino Department |
|-----------|-------------|-------------|-------------------|
| 711AS | 711, 712 | Arts, Entertainment, Recreation | Other (entertainment, retail) |
| 713 | 713 | Amusement, Gambling, Recreation | Gaming (GGR) |
| 721 | 721 | Accommodation | Lodging |
| 722 | 722 | Food Services & Drinking Places | Food & Beverage |

When the user selects **department-level input**, each revenue stream is matched to its corresponding IO sector. When using **total revenue input**, the model applies property-type-specific multipliers.

## Property Types

The calculator supports four casino property types, each mapped to a specific NAICS code:

| NAICS Code | Property Type | Typical Operations |
|------------|--------------|-------------------|
| 721120 | Casino Hotel | Full-service resort with gaming, lodging, F&B |
| 713210 | Stand-alone Casino | Gaming facility without hotel |
| 713290 | Slot Parlor | Slot machines / VLTs only |
| 722410 | Bar/Restaurant Gaming | Gaming as secondary to food/beverage service |

Each property type has its own set of multipliers reflecting the different economic structures of these business models.

## Output Metrics

For each analysis, the calculator produces:

| Metric | Unit | Description |
|--------|------|-------------|
| **Output** | $M | Total gross economic output (all rounds of spending) |
| **GDP (Value Added)** | $M | Net contribution to GDP (output minus intermediate purchases) |
| **Employment** | Jobs | Full-time equivalent positions supported |
| **Wages** | $M | Total employee compensation |
| **TOPI** | $M | Taxes on production and imports (from IO tables) |
| **Gaming Tax** | $M | State GGR tax (computed from state-specific tax schedules) |
| **Payroll Tax** | $M | Employer-side payroll taxes (FICA, FUTA, SUTA, SDI, PFML) |
| **Household Tax** | $M | Personal income and property taxes on supported wages |

Each metric is decomposed into **Direct**, **Indirect**, **Induced**, and **Total** components, along with the implied **multiplier** (Total / Direct).

## Repository Structure

### R Scripts (Data Pipeline)

Scripts are numbered to indicate execution order:

| Script | Purpose |
|--------|---------|
| `07_process_qcew_employment_2023.R` | Parse BLS QCEW files, filter for target NAICS sectors (711, 712, 713, 721, 722), aggregate to state level |
| `08_state_multipliers_2023.R` | Load EPA StateIO Make/Use tables, construct direct requirements matrix (A = D × B), compute Leontief inverse, extract Type I and Type II multipliers for all 50 states |
| `08a_process_all_qcew_employment.R` | Process QCEW for all 71 IO sectors to build employment coefficients for indirect/induced effect weighting |
| `09_employment_multipliers_2023.R` | Merge IO multipliers with QCEW employment data, calculate employment-weighted coefficients (direct, indirect, induced) |
| `10_casino_impact_model.R` | Main impact calculation engine — takes revenue, sector, and state as input, returns full impact table with multiplier decomposition and tax estimates |
| `11_property_impact_calculator.R` | Property-specific analysis and reporting script |
| `12_gambling_specific_data.R` | Extract gambling-only (NAICS 7132 + 72112) employment from QCEW, apply BEA adjustment factors to create gambling-specific multipliers |
| `state_gaming_tax_rates.R` | Compile state-by-state gaming tax rates from state gaming commissions and AGA reports |
| `generate_complete_multipliers.R` | Generate the complete multiplier CSV/JSON datasets |
| `generate_multipliers_json.R` | Convert multiplier CSVs to JSON format for the web application |
| `generate_tax_multipliers.R` | Generate tax-specific multiplier datasets |

### Data Files

**CSV files** (used by R scripts and served as public data):

| File | Rows | Description |
|------|------|-------------|
| `employment_multipliers_2023.csv` | 201 | 50 states + DC × 4 sectors — full multiplier dataset with employment coefficients |
| `gambling_multipliers_2023.csv` | 51 | Gambling-specific multipliers (one per state), adjusted from blended 713 |
| `state_multipliers_with_tax.csv` | 201 | Multipliers enriched with tax coefficients |

Each row contains: state identifiers, QCEW employment and wage data, direct coefficients (VA, wage, tax, employment), Type I and Type II multipliers (output, VA, wage, tax), and employment coefficients (direct, indirect, induced).

**JSON files** (consumed by the web application):

| File | Description |
|------|-------------|
| `multipliers_with_tax.json` | Comprehensive multiplier dataset with metadata |
| `state_gaming_tax_rates.json` | Full state tax rate configurations (flat, tiered, split) |
| `gaming_tax_rates_frontend.json` | Frontend-optimized version of tax rates |

### Web Application

A React/Vite single-page application located in `webapp/`:

```
webapp/
├── src/
│   ├── App.jsx                          # Main application component
│   ├── components/
│   │   ├── PageHeader.jsx               # Site header
│   │   ├── PremiumModal.jsx             # License upgrade modal
│   │   ├── WatermarkOverlay.jsx         # Evaluation watermark
│   │   ├── ConfirmPropertyModal.jsx     # Property confirmation
│   │   └── WrongPropertyModal.jsx       # Property mismatch dialog
│   ├── utils/
│   │   ├── calculations.js              # Economic impact calculation engine
│   │   ├── licenseValidator.js          # License key validation
│   │   ├── pptxGenerator.js             # PowerPoint report generation
│   │   ├── starterTemplateGenerator.js  # Template report generation
│   │   └── templateFiller.js            # Template data injection
│   └── data/
│       ├── multipliers.json             # State multipliers
│       ├── gamingTaxRates.json          # Gaming tax configurations
│       └── employmentTaxRates.json      # Payroll/household tax rates
├── netlify/functions/                   # Serverless payment functions
│   ├── create-checkout.js               # Stripe checkout session
│   └── verify-session.js               # Payment verification
└── public/data/                         # Publicly served CSV data
```

**Key technologies:** React, Vite, Tailwind CSS, Recharts (charting), PptxGenJS (report generation), Stripe (payments)

**Deployment:** Netlify with serverless functions

## Regenerating Data from Scratch

To regenerate all multiplier data from raw sources:

1. **Download QCEW data** from BLS — the `2023.annual.by_industry` folder of annual averages
2. **Install R dependencies** (see [Dependencies](#dependencies))
3. **Run scripts in order:**

```r
source("08a_process_all_qcew_employment.R")  # Process all 71 IO sectors from QCEW
source("07_process_qcew_employment_2023.R")   # Process target casino sectors
source("08_state_multipliers_2023.R")         # Calculate state IO multipliers (this downloads StateIO data)
source("09_employment_multipliers_2023.R")    # Merge multipliers with employment data
source("12_gambling_specific_data.R")         # Create gambling-specific multipliers
source("generate_complete_multipliers.R")     # Generate complete output datasets
source("generate_multipliers_json.R")         # Convert to JSON for webapp
```

Note: Script `08_state_multipliers_2023.R` downloads ~2GB of StateIO data on first run via the `stateior` package.

## Dependencies

### R

```r
install.packages("tidyverse")

# For regenerating multipliers from scratch:
install.packages("stateior")  # EPA State IO data access
# stateior may also require: useeior
```

### Web Application

```bash
cd webapp
npm install
npm run dev    # Development server
npm run build  # Production build
```

Key npm packages: `react`, `recharts`, `pptxgenjs`, `@stripe/stripe-js`, `tailwindcss`

## Important Technical Notes

1. **2019 IO Tables:** The model deliberately uses 2019 IO data rather than 2020 to avoid pandemic-distorted inter-industry relationships. The 2019 multipliers are combined with 2023 employment data.

2. **Employment Coefficients vs. Output Multipliers:** Employment multipliers differ from output/GDP multipliers because they account for varying labor intensities. A dollar of indirect GDP generates more or fewer jobs depending on whether it flows to labor-intensive sectors (restaurants) or capital-intensive sectors (utilities).

3. **Value Added as Denominator:** Employment coefficients use Value Added (GDP) rather than Gross Output as the denominator. Using Gross Output would double-count intermediate purchases and understate the jobs-per-dollar ratio.

4. **Gambling vs. Blended 713:** The blended IO sector 713 includes golf courses, fitness centers, and amusement parks alongside gambling. These have fundamentally different cost structures (e.g., wage coefficients of 0.41 blended vs. 0.26 for gambling). The gambling-specific adjustments are critical for accurate casino impact estimates.

5. **State Variation:** Multipliers vary significantly across states due to differences in economic structure, supply chain density, and trade patterns. States with more diversified, self-sufficient economies (e.g., California, Texas) tend to have higher multipliers because more supplier spending stays in-state.

6. **Known Data Override:** When users provide actual employment counts or wage totals, the model uses those values for the direct effect rather than estimating from coefficients. Indirect and induced effects are still computed from the multipliers.

## License

MIT
