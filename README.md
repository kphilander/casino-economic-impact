# GEMS — Gaming Economic Modeling System

**The Casino Economic Impact Model**

This repository contains GEMS (Gaming Economic Modeling System), the economic model and web application for computing state-level economic impacts of casino and gaming operations across all 50 US states. District of Columbia coefficients are not included in the deployed dataset.

**Live Calculator:** https://gamblingpolicy.com/tools/economic-impact/

## Naming, Versioning & Citation

- **Product name:** GEMS (Gaming Economic Modeling System), published by GP Consulting. The descriptive phrase "Casino Economic Impact Model" is retained as a subtitle for clarity and search.
- **Versioning:** The model version is the release edition year — the current release is **GEMS 2026**. Bump the version when a new edition is published. All product naming in the web app is centralized in [`webapp/src/brand.ts`](webapp/src/brand.ts); changing the product name or bumping the version is a one-file change.
- **Methodology:** A versioned, citable methodology document lives at [`docs/methodology.md`](docs/methodology.md). A white paper PDF describing the initial 2026 release is served at [`/GEMS-2026-Methodology.pdf`](https://gamblingpolicy.com/tools/economic-impact/GEMS-2026-Methodology.pdf); regenerate it with `python3 docs/generate_whitepaper.py` after editing. Where the two differ, `docs/methodology.md` applies.
- **Suggested citation:**

> Simeon-Rose, K. (2026). GEMS: Gaming Economic Modeling System (Version 2026) [Computer software]. GP Consulting. https://gamblingpolicy.com/tools/economic-impact/

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

The calculator quantifies the total economic footprint of a casino or gaming property by computing **direct, indirect, and induced** effects across six metrics:

| Metric | What It Measures |
|--------|-----------------|
| **Output** | Total economic activity (gross output) generated |
| **GDP** | Value added (contribution to Gross Domestic Product) |
| **Employment** | Filled full- and part-time jobs supported (not FTEs) |
| **Estimated FTEs** | Jobs converted to a full-time-equivalent basis with BEA industry ratios |
| **Employee Compensation** | Cash wages plus employer-paid supplements generated |
| **Tax Revenue** | Gaming tax (replacing the gaming share of direct TOPI), other TOPI, payroll and household income taxes, by federal vs. state and local |

Users can input revenue by department (Gaming, Food & Beverage, Lodging, Other) or as a single total. The model applies the appropriate sector-specific multipliers for each revenue stream and aggregates the results.

## How It Works

1. **User enters** casino revenue (by department or total) and selects a state and property type
2. **The browser builds the state's input-output model** from its StateIO tables (direct requirements, Type I and Type II Leontief inverses, value-added and jobs satellites), and revenue is mapped to the appropriate industries
3. **Direct effects** are calculated using coefficients (e.g., VA coefficient converts revenue to GDP contribution)
4. **Indirect effects** are computed via the Leontief inverse, capturing supply-chain purchasing
5. **Induced effects** capture household spending by employees throughout the economy
6. **Employment** is estimated with a 2023 QCEW/StateIO jobs satellite, with a separate BEA industry satellite producing estimated FTEs; current inputs are restated in 2023 dollars for these calculations only
7. **Direct labor income of gaming** is adjusted for the gaming tax carried in revenue, estimated against the 2022 Economic Census
8. **Tax estimates** report IO-derived production taxes and state-specific gaming tax schedules without adding gaming tax to TOPI a second time

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

The same decomposition applies to GDP, employee compensation, and TOPI using their respective multiplier pairs.

### Employment Multipliers

Employment is calculated differently from the other metrics. Rather than using simple output-based multipliers, the model uses a consistent-2023 employment satellite:

```
Jobs in industry i = Jobs_per_Output(i) × output of industry i in the direct, supplier or induced round
```

The calculator applies the 71-industry jobs/output satellite to the output requirements of each round. The R pipeline summarizes the result in these coefficients:

| Coefficient | Applies To | What It Reflects |
|------------|-----------|-----------------|
| `Direct_Jobs_Per_1M_Output` | Direct employment | 2023 jobs per $1M of 2023 industry output |
| `Emp_Coef` | Direct diagnostic | 2023 jobs per $1M of 2023 value added |
| `Indirect_Emp_Coef` | Indirect employment | Weighted average labor intensity of supplier industries |
| `Induced_Emp_Coef` | Induced employment | Weighted average labor intensity of household-spending industries |

Propagation through the Leontief inverse uses jobs per output, which is dimensionally consistent with an output-requirements matrix. QCEW counts filled jobs, including full-time, part-time, temporary, and permanent positions; it does not report FTEs and can count a multiple-job holder more than once. See the [BLS QCEW definition](https://www.bls.gov/cew/questions-and-answers.htm#Q18).

The QCEW satellite is regenerated from BLS's official [2023 annual singlefile](https://data.bls.gov/cew/data/files/2023/csv/2023_annual_singlefile.zip). The mapping uses exact aggregate codes and explicitly bridges the 2022 NAICS changes affecting retail and information. Owner-occupied housing (`HS`) and the federal/state-local government-enterprise sectors (`GFE`, `GSLE`) have no QCEW-compatible satellite and are assigned zero rather than an unrelated imputed labor intensity. Government general/defense sectors use disclosed public-administration ownership proxies; QCEW excludes uniformed military personnel.

### Estimated FTE Satellite

QCEW does not provide FTEs. The model therefore retains jobs as the primary employment result and reports a separate estimate:

```
Estimated FTEs = Modeled jobs × (BEA FTE employees / BEA employee jobs)
```

`08b_generate_bea_fte_ratios.R` downloads 2023 BEA NIPA table 6.4D employee-job series and table 6.5D FTE series through FRED and maps them to all 71 StateIO summary sectors. The resulting `fte_ratios_2023.csv` is versioned for reproducibility. Direct effects use the direct industry's ratio; indirect and induced FTEs are calculated with a separate FTE/output satellite propagated through the Leontief matrices, so they reflect the supplier and household-spending industries where the jobs occur. These are national industry estimates, not establishment-reported hours. See the [BEA FTE definition](https://www.bea.gov/help/faq/368).

### Tax Estimates

The model computes three categories of tax revenue:

**1. Taxes on Production & Imports (TOPI)**

Derived from the IO tables, TOPI flows through the Leontief inverse like employee compensation. It captures gross-receipts, amusement, license, property, excise, and other production-related taxes across all direct, indirect, and induced activity.

**2. Gaming Tax**

State-specific tax on Gross Gaming Revenue (GGR). The calculator supports multiple tax structures:

- **Flat rate** — single percentage (e.g., Nevada at 6.75%)
- **Graduated tiers** — increasing rates at revenue thresholds (e.g., Colorado, Iowa)
- **Split by game type** — different rates for slots vs. table games (e.g., Pennsylvania)
- **Split-tiered** — separate graduated schedules for slots and tables (e.g., Illinois)
- **Add-ons** — a flat rate on top of any schedule (`additionalRate`; e.g., Detroit's city wagering tax)
- **Handle taxes** — a rate on amount wagered (`handleRate`) converted to GGR with a stated hold (e.g., Tennessee sports wagering)

Rates come from state statutes, gaming commission reports and the AGA State of the States; 28 states were re-verified against official sources in October 2026 and carry `lastVerified` and `sources` fields (`scripts/apply_verified_gaming_tax_2026.py`).

BEA records state gaming and amusement taxes as taxes on products within TOPI for the amusement-and-gambling industry, and StateIO gives every state the national TOPI intensity. So the statutory gaming tax **replaces** the gaming share of the gaming stream's direct TOPI instead of being added to it: direct taxes on gaming = statutory tax + 0.346 × I-O direct TOPI, where 0.346 is the non-product-tax share of BEA industry 713200's TOPI (2017 detail supply-use table; `scripts/derive_gaming_topi_share.R`). Supplier and induced TOPI are unchanged. For a **tribal** property, the compact revenue share (entered as a custom rate) replaces the gaming stream's direct TOPI entirely. See the [BEA TOPI definition](https://www.bea.gov/help/faq/93) and [GDP-by-state methodology](https://www.bea.gov/sites/default/files/methodologies/0417_GDP_by_State_Methodology.pdf).

**3. Payroll & Household Taxes**

- **Payroll taxes** — employer-side FICA and FUTA (federal) and SUTA, SDI and PFML (state), applied per job to QCEW-comparable wages
- **Household income taxes** — 2025 federal and state schedules applied to the average wage per job for a single filer with no dependents, plus typical local wage taxes; tables generated by `scripts/build_income_tax_tables.py` from verified 2025 parameters (`data/income_tax_parameters_2025.json`)

Every tax line is reported as federal or state and local, with subtotals.

**Gaming-tax adjustment of labor income.** Against the 2022 Economic Census, the model's direct jobs per revenue dollar are unbiased, but its payroll share of casino revenue is too high, increasingly so with the state's gaming tax: StateIO gives every state the national value-added mix, while casino revenue includes the gaming tax. Direct compensation of land-based gaming revenue is therefore multiplied by exp(−0.916 × effective gaming tax rate), with induced effects rescaled to match (`webapp/src/data/payrollAdjustment.json`; [methodology §2.7](docs/methodology.md#27-gaming-tax-adjustment-of-direct-compensation)).

The IO `V001` coefficient is BEA employee compensation. GEMS converts it to QCEW-comparable wages by industry, using national 2023 QCEW private wages ÷ BEA compensation (NIPA Table 6.2D): 0.698 for gambling (713), 0.757 for accommodation, 0.738 for food service, and 0.806 for all private industries (supplier and induced effects). BEA compensation exceeds payroll wages by employer supplements and by BEA's adjustments for unreported income such as tips, which are not a tax base (`webapp/src/data/wageBasis.json`).

### Inflation Adjustment

Employment coefficients are calibrated to **2023 dollars**: QCEW jobs are divided by 2023 StateIO industry output and value added. When a user enters current-year revenue, the model restates the relevant output/GDP values in 2023 dollars using the CPI-U annual average before applying employment coefficients:

```
Deflator = CPI_2023 / CPI_current_year
Jobs = (Output_or_GDP_in_current_dollars × Deflator) × Employment_Coefficient
```

For analysis years newer than the CPI table, the calculator uses the latest complete annual average (currently 2025). The 2019 StateIO year is retained for the production relationships; it no longer supplies a mismatched denominator for 2023 employment.

### Gambling-Specific Adjustments

The calibration deliberately separates **geography** from **industry composition**:

- EPA StateIO supplies each state's regional production structure, import leakages, and Leontief relationships.
- National BEA detail data, built through `useeior`, supplies evidence about how gambling differs from its broader parent sector.
- The national gaming ratios adapt the StateIO results; they do not replace the state model with a generic hospitality multiplier. This retains state-specific supplier geography while avoiding the assumption that a casino has the input composition of an average hotel, restaurant, or recreation business.

The IO tables contain only the blended sector **713** (Amusement, Gambling, and Recreation). `13_extract_national_naics_ratios.R` builds `USEEIOv2.0.1-411`, compares detailed gambling (`713200/US`) with an output-weighted 713 parent, and supplies the single canonical calibration:

| Component | Gambling-to-parent ratio |
|-----------|-------------------------:|
| Direct value added | 1.008 |
| Direct employee compensation | 0.863 |
| Direct TOPI | 0.609 |
| Direct jobs per output | 0.540 |
| Supplier output increment | 0.967 |
| Supplier value-added increment | 0.993 |
| Supplier compensation increment | 1.047 |
| Supplier TOPI increment | 0.940 |

`generate_complete_multipliers.R` applies these ratios to StateIO 713. The same supplier-side ratios are applied to the induced increments because USEEIO is an open Type I model; supplier and induced jobs/GDP coefficients remain those of the industries where the effects occur. The old competing `0.89`/`0.63` calibration has been removed. See [Data Provenance](docs/data-provenance.md).

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
| **Coverage** | All 50 states, private employment only |

### Full-Time-Equivalent Ratios

| Attribute | Value |
|-----------|-------|
| **Source** | BEA NIPA Tables 6.4D and 6.5D, distributed through FRED |
| **Year** | 2023 |
| **Coverage** | National industry ratios mapped to 71 StateIO sectors |
| **Interpretation** | Estimated FTE employees per full- and part-time employee job |

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
| **Versioned evidence** | `bea_detail_coefficients.csv`, `blended_parent_coefficients.csv`, `national_naics_ratios.csv` |

## IO Sector Mapping

| IO Sector | NAICS Codes | Description | Casino Department |
|-----------|-------------|-------------|-------------------|
| 711AS | 711, 712 | Arts, Entertainment, Recreation | Other (entertainment, retail) |
| 713 | 713 | Amusement, Gambling, Recreation | Gaming (GGR) |
| 721 | 721 | Accommodation | Lodging |
| 722 | 722 | Food Services & Drinking Places | Food & Beverage |

When the user selects **department-level input**, gaming uses the canonical gambling calibration and lodging, food, and other revenue use sectors 721, 722, and 711AS. In **total revenue input**, the complete amount is modeled with the canonical gambling production function. Total mode is therefore an approximation; department mode is preferred when the non-gaming revenue mix is known.

For legacy land-based total-revenue analyses, GEMS does not calculate statutory gaming tax because total operating revenue is not necessarily GGR. The statutory gaming tax requires department mode with an explicit gaming-revenue input. Online total revenue is GGR by construction and remains eligible for the online tax schedule.

## Property Types

The calculator supports four casino property types, each mapped to a specific NAICS code:

| NAICS Code | Property Type | Typical Operations |
|------------|--------------|-------------------|
| 721120 | Casino Hotel | Full-service resort with gaming, lodging, F&B |
| 713210 | Stand-alone Casino | Gaming facility without hotel |
| 713290 | Slot Parlor | Slot machines / VLTs only |
| 722410 | Bar/Restaurant Gaming | Gaming as secondary to food/beverage service |

The four land-based property types are descriptive reporting classifications. They all use the same state-localized, nationally calibrated gambling production function; a casino-hotel is not modeled as an average hotel, and bar gaming is not modeled as an average restaurant. Property-specific economic composition is represented only when the user supplies department revenue separately.

## Output Metrics

For each analysis, the calculator produces:

| Metric | Unit | Description |
|--------|------|-------------|
| **Output** | $M | Total gross economic output (all rounds of spending) |
| **GDP (Value Added)** | $M | Net contribution to GDP (output minus intermediate purchases) |
| **Employment** | Jobs | Filled full- and part-time jobs supported; no FTE conversion |
| **Estimated FTEs** | FTEs | Industry-weighted estimate reported separately from jobs |
| **Employee Compensation** | $M | Cash wages plus employer-paid supplements |
| **TOPI** | $M | Taxes on production and imports (from IO tables) |
| **Gaming Tax** | $M | State GGR tax; replaces the gaming share of direct TOPI, so it is additive |
| **Payroll Tax** | $M | Employer-side payroll taxes (FICA, FUTA, SUTA, SDI, PFML) |
| **Household Tax** | $M | Federal, state and local income taxes on supported wages, per worker |

Each metric is decomposed into **Direct**, **Indirect**, **Induced**, and **Total** components, along with the implied **multiplier** (Total / Direct).

## Repository Structure

### R Scripts (Data Pipeline)

Scripts are numbered to indicate execution order:

| Script | Purpose |
|--------|---------|
| `07_process_qcew_employment_2023.R` | Optional compatibility extractor for the four target sectors from the complete QCEW satellite |
| `08_state_multipliers_2023.R` | Build 2019 StateIO Leontief relationships and apply 2023 StateIO/QCEW jobs-per-output satellites for all 50 states |
| `08a_process_all_qcew_employment.R` | Download/read the official BLS annual singlefile and build the complete 50-state × 71-sector employment satellite |
| `08b_generate_bea_fte_ratios.R` | Download BEA NIPA employee-job and FTE series and build the 71-sector FTE/job crosswalk |
| `09_employment_multipliers_2023.R` | Merge IO multipliers with QCEW employment data, calculate employment-weighted coefficients (direct, indirect, induced) |
| `10_casino_impact_model.R` | Main impact calculation engine — takes revenue, sector, and state as input, returns full impact table with multiplier decomposition and tax estimates |
| `11_property_impact_calculator.R` | Property-specific analysis and reporting script |
| `12_gambling_specific_data.R` | Backward-compatible entry point for the canonical gambling generator |
| `13_extract_national_naics_ratios.R` | Rebuild national BEA detail direct and supplier-increment ratios with `useeior` |
| `13b_property_type_multipliers.R` | Assemble four descriptive land-based property labels from the canonical gambling dataset |
| `14_online_gambling_multipliers.R` | Apply documented online scenario adjustments without scaling supplier/induced job intensity by the operator's direct jobs ratio |
| `state_gaming_tax_rates.R` | Compile state-by-state gaming tax rates from state gaming commissions and AGA reports |
| `generate_complete_multipliers.R` | Apply the single national gambling calibration to each state's StateIO 713 results |
| `generate_multipliers_json.R` | Export the multiplier CSVs as one JSON file (`multipliers_with_tax.json`) |
| `scripts/export_state_io.R` | Export each state's StateIO tables and the jobs satellite for the browser engine (`webapp/src/data/io/`) |
| `generate_tax_multipliers.R` | Export tax columns from the canonical state multiplier build (compatibility) |

### Data Files

**CSV files** (used by R scripts and served as public data):

| File | Rows | Description |
|------|------|-------------|
| `employment_multipliers_2023.csv` | 200 | 50 states × 4 sectors — full multiplier dataset with employment coefficients |
| `fte_ratios_2023.csv` | 71 | BEA national employee jobs, FTE employees, and FTE/job ratios mapped to StateIO sectors |
| `gambling_multipliers_2023.csv` | 50 | Gambling-specific multipliers (one per state), adjusted from blended 713 |
| `property_type_multipliers_2023.csv` | 200 | Four descriptive land-based property labels × 50 states, all using the canonical gambling coefficients |
| `state_multipliers_with_tax.csv` | 200 | Backward-compatible tax-only export from the canonical state multiplier build |
| `bea_detail_coefficients.csv` | 6 | Versioned USEEIO detail-sector coefficients used by the recovered property-type calibration |
| `blended_parent_coefficients.csv` | 3 | Output-weighted 713, 721, and 722 parent benchmarks |
| `national_naics_ratios.csv` | 4 | Canonical 713200-to-713 gaming ratios plus explicitly marked hospitality comparison rows |

Each row contains: state identifiers, QCEW employment and wage data, direct coefficients (VA, wage, tax, employment), Type I and Type II multipliers (output, VA, wage, tax), and employment coefficients (direct, indirect, induced).

**JSON files:**

| File | Description |
|------|-------------|
| `webapp/src/data/io/{AB}.json`, `national.json` | State StateIO tables and national inputs read by the browser engine |
| `multipliers_with_tax.json` | Convenience JSON export of the multiplier CSVs (not read by the web app) |
| `state_gaming_tax_rates.json` | Full state tax rate configurations (flat, tiered, split) |
| `gaming_tax_rates_frontend.json` | Frontend-optimized version of tax rates |

### Web Application

A React, Vite and TypeScript single-page application in `webapp/`. It has no server component: the model, the tax calculations and saved analyses all run in the browser.

Each results table has a "How this is computed" panel. It shows the coefficients, CPI deflator, wage ratios, adjustment factors and gaming-tax bands used for the current analysis, read from the record the engine keeps of each computation, so the explanation cannot differ from the result. The Method tab lists the computation steps and every industry's coefficients for the selected state.

```
webapp/
├── src/
│   ├── engine/                 # Model and calculations (no UI code)
│   │   ├── linalg.ts           # Matrix products and Gauss-Jordan inverse
│   │   ├── io.ts               # Regional I-O model from StateIO tables: A, Type I/II inverses, satellites
│   │   ├── profiles.ts         # Gambling (USEEIO ratios) and online profiles
│   │   ├── activities.ts       # Revenue activities mapped to model responses
│   │   ├── impact.ts           # Stream impacts, observed labor data, payroll adjustment
│   │   ├── tax.ts, fiscal.ts   # Gaming, payroll and income taxes; fiscal lines by level
│   │   ├── scenario.ts         # One analysis end to end
│   │   ├── sensitivity.ts      # Revenue and tax-rate sweeps, projections
│   │   ├── share.ts            # Share links, saved projects, forecaster import
│   │   └── *.test.ts           # Tests against the R CSVs and the pre-rebuild calculator
│   ├── ui/                     # React views: inputs, results, compare, sensitivity, method
│   ├── data/                   # Tax tables, ranges, wage basis; io/ holds the state tables
│   ├── App.tsx, main.tsx, styles.css, brand.ts
└── public/                     # Static assets
```

**Key technologies:** React 18, Vite, TypeScript, Vitest. No other runtime dependencies.

**Hosting:** the calculator at https://gamblingpolicy.com/tools/economic-impact/ is a committed build in the `kphilander/gamblingpolicy.com` repository (`public/tools/economic-impact/`). Netlify deploys that repository when its `main` branch changes. Each state's tables load on first use (about 40 KB compressed). The footer and the Method tab show the commit the hosted build comes from.

### Deploying

Deploy only from `main` of this repository:

1. Merge the change into `main`.
2. Run `scripts/deploy-site.sh [path to a gamblingpolicy.com clone]` (default `../gamblingpolicy.com`). The script builds from a clean checkout of `origin/main`, runs the tests, and commits the new snapshot to a `gems-deploy-<commit>` branch of the site clone.
3. Push that branch and open a pull request in `kphilander/gamblingpolicy.com`. Check the Netlify deploy preview at `/tools/economic-impact/`.
4. Merge the pull request. Netlify deploys the site, and the footer shows the new commit.

## Revenue Forecaster Integration

The calculator can be pre-filled via URL parameters from the [Casino Revenue Forecaster](https://gamblingpolicy.com/tools/revenue-forecaster/). When the URL contains `?from=forecaster`, the app opens with the property and department revenue filled in.

### URL Parameters

| Parameter | Example | Description |
|-----------|---------|-------------|
| `from` | `forecaster` | Trigger for auto-import mode |
| `state` | `Nevada` | Full state name (not abbreviation) |
| `name` | `Proposed Casino` | Property name |
| `propertyType` | `721120` | NAICS code (721120, 713210, 713290, 722410) |
| `inputMode` | `department` | Always `department` when from forecaster |
| `gaming` | `149.4` | Gaming GGR in $M |
| `food` | `28.1` | Food & beverage revenue in $M |
| `lodging` | `51.1` | Lodging revenue in $M (0 if no hotel) |
| `other` | `31.5` | Other revenue in $M |
| `gaming_emp`, `archetype` | `2,405`, `mega_resort` | Accepted and ignored |

When imported, a banner links back to the forecaster.

## Access and Privacy

The calculator is free to use. It has no accounts, licensing or payments. Inputs stay in the browser: saved projects and the analysis on screen (restored after a reload) use `localStorage`, and a share link carries the full analysis in its URL.

## Regenerating Data from Scratch

To regenerate all multiplier data from raw sources:

1. **Supply the official QCEW ZIP** with `GEMS_QCEW_SINGLEFILE_ZIP`, or let script 08a download it from BLS
2. **Install R dependencies** (see [Dependencies](#dependencies))
3. **Run scripts in order:**

```r
source("08a_process_all_qcew_employment.R")  # Process mapped private-industry QCEW sectors
source("08b_generate_bea_fte_ratios.R")      # Build national BEA industry FTE/job ratios
source("08_state_multipliers_2023.R")         # Calculate state IO multipliers (this downloads StateIO data)
source("09_employment_multipliers_2023.R")    # Merge multipliers with employment data
source("13_extract_national_naics_ratios.R")  # Rebuild detailed national ratio evidence
source("generate_complete_multipliers.R")     # Apply canonical gambling calibration
source("14_online_gambling_multipliers.R")    # Generate online scenario data
source("13b_property_type_multipliers.R")     # Assemble land-based reporting labels
source("generate_tax_multipliers.R")          # Optional compatibility tax export
source("generate_multipliers_json.R")         # Optional JSON export of the CSVs
source("scripts/export_state_io.R")           # State tables for the browser engine
```

Then check that the browser engine reproduces the new CSVs:

```bash
cd webapp && npm test
```

Note: Script `08_state_multipliers_2023.R` downloads ~2GB of StateIO data on first run via the `stateior` package.

The versioned national-ratio outputs can be checked offline without downloading or rebuilding USEEIO:

```bash
Rscript tests/test_useeior_provenance.R
Rscript tests/test_multiplier_integrity.R
```

## Dependencies

### R

```r
install.packages(c("tidyverse", "data.table", "jsonlite"))

# For regenerating multipliers from scratch:
install.packages("stateior")  # EPA State IO data access
install.packages("useeior")   # BEA/USEEIO detailed national calibration
```

### Web Application

```bash
cd webapp
npm install
npm run dev    # Development server
npm test       # Engine and view tests
npm run build  # Type check and production build
```

Runtime packages: `react`, `react-dom`. Development: `vite`, `typescript`, `vitest`.

## Important Technical Notes

1. **2019 IO Tables:** The model deliberately uses 2019 IO data rather than 2020 to avoid pandemic-distorted inter-industry relationships. Employment is a separate 2023 satellite: QCEW jobs are divided by 2023 StateIO output/value added before being applied to the retained 2019 Leontief structure.

2. **Employment Coefficients vs. Output Multipliers:** Employment multipliers differ from output/GDP multipliers because they account for varying labor intensities. A dollar of indirect GDP generates more or fewer jobs depending on whether it flows to labor-intensive sectors (restaurants) or capital-intensive sectors (utilities).

3. **Employment Dimensions:** Direct and Leontief-propagated jobs use jobs per output, by industry. Direct jobs per value added remains a diagnostic; the R pipeline's supplier and induced jobs/GDP coefficients summarize the same industry totals.

4. **Estimated FTE Dimensions:** FTEs use a separate industry-specific satellite built from BEA NIPA employee jobs and FTE employees. They are reported alongside, never in place of, QCEW jobs. A user-supplied known job count is converted with the selected direct industry's FTE/job ratio.

5. **Gambling vs. Blended 713:** The blended IO sector 713 includes golf courses, fitness centers, and amusement parks alongside gambling. The model uses a single reproducible USEEIO detailed-industry calibration rather than the former competing legacy ratios.

6. **State Variation:** Multipliers vary significantly across states due to differences in economic structure, supply chain density, and trade patterns. States with more diversified, self-sufficient economies (e.g., California, Texas) tend to have higher multipliers because more supplier spending stays in-state.

7. **Known Data Override:** User employment inputs are full- and part-time job counts. User wage inputs are cash wages; the model converts them to employee compensation for reporting. Known cash wages replace the direct cash-wage estimate and proportionally rebase the induced component using adjusted Type I compensation. Known jobs replace direct jobs and are converted to estimated direct FTEs, but do not independently drive induced effects.

8. **Property Types:** All land-based property labels intentionally share the canonical gambling coefficients. Department inputs, not the label, introduce lodging, food, and entertainment composition.

9. **Reproducibility:** The national ratio evidence, complete jobs and FTE coefficient derivations, canonical gambling generator, property assembler, state-table exporter, and offline integrity tests are versioned. The webapp tests check the browser engine against the R CSVs. The public QCEW ZIP can be supplied through `GEMS_QCEW_SINGLEFILE_ZIP`; generated input paths can be overridden with `GEMS_QCEW_ALL_SECTORS_FILE` and `GEMS_FTE_RATIO_FILE`. No developer-specific absolute path is required.

## License

MIT
