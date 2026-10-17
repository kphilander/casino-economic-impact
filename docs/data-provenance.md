# Multiplier Data Provenance

This note records how GEMS combines state-level economic geography with national gaming-industry composition. The deployed pipeline has one land-based gambling calibration.

## Architecture

1. **EPA StateIO (`stateior`)** supplies 2019 state make/use relationships, regional purchase patterns, leakages, and the Type I/Type II structure. The pre-pandemic structure is retained deliberately.
2. **BLS QCEW plus 2023 StateIO** supply the employment satellite. QCEW annual-average filled jobs are divided by 2023 StateIO output and value added, so the labor numerator and dollar denominator have the same vintage.
3. **BEA NIPA tables 6.4D and 6.5D** supply national industry FTE/job ratios for a separate estimated-FTE satellite.
4. **National BEA detail IO (`useeior`)** supplies ratios describing detailed gambling (`713200/US`) relative to the output-weighted 713 parent.

The national ratios adapt StateIO results while retaining state geography. The model does not substitute an average local hotel or restaurant production function for gaming.

## Employment lineage

`08a_process_all_qcew_employment.R` downloads or reads BLS's official [2023 annual singlefile](https://data.bls.gov/cew/data/files/2023/csv/2023_annual_singlefile.zip) and maps QCEW filled jobs to StateIO sectors. It uses exact aggregates to prevent hierarchical double counting and explicitly bridges the 2022 NAICS retail and information changes. `08_state_multipliers_2023.R` combines those jobs with cached 2023 StateIO output and value added while retaining the 2019 Leontief matrices:

- jobs per 2023 output is the satellite multiplied through the output-requirements matrix;
- jobs per 2023 value added is retained as the direct labor-intensity diagnostic;
- supplier and induced jobs/GDP coefficients are derived from the employment-weighted job totals and the corresponding GDP increments.

QCEW itself supplies no hours or FTE conversion, so jobs remain the primary measure. `08b_generate_bea_fte_ratios.R` downloads the 2023 BEA employee-job and FTE series through FRED, validates the FTE/job ratios, and writes the versioned 71-sector `fte_ratios_2023.csv` crosswalk. Script 08 multiplies each industry's QCEW jobs coefficients by its own BEA ratio before propagating this second satellite through the Leontief matrices. The resulting direct, supplier, and induced FTEs are estimates, not establishment-reported hours.

Owner-occupied housing (`HS`) and the federal/state-local government-enterprise sectors (`GFE`, `GSLE`) have no QCEW-compatible satellite, so they are explicit zeros rather than unrelated within-state averages. `GFGD`, `GFGN`, and `GSLG` use disclosed QCEW public-administration ownership proxies; uniformed military personnel are outside QCEW coverage.

The public ZIP can be supplied with `GEMS_QCEW_SINGLEFILE_ZIP`; otherwise script 08a downloads it from BLS. The generated satellite paths can be overridden with `GEMS_QCEW_ALL_SECTORS_FILE` and `GEMS_FTE_RATIO_FILE`. Script 07 is only a compatibility extractor and no longer ingests a second collection of developer-local source files.

## USEEIO gambling calibration

`13_extract_national_naics_ratios.R` builds `USEEIOv2.0.1-411` and extracts:

- `713100/US` — amusement parks and arcades;
- `713200/US` — gambling industries except casino hotels;
- `713900/US` — other amusement and recreation;
- comparison sectors `721000/US`, `722110/US`, and `722A00/US`.

It writes three versioned evidence tables:

| File | Role |
|------|------|
| `bea_detail_coefficients.csv` | Direct and Type I output, value added, compensation, TOPI, and jobs measures |
| `blended_parent_coefficients.csv` | Output-weighted parent-sector benchmarks |
| `national_naics_ratios.csv` | Direct and supplier-increment ratios; `calibration_role` distinguishes canonical gaming rows from comparison-only hospitality rows |

The canonical 713200-to-713 ratios are 1.008 for direct value added, 0.863 for direct employee compensation, 0.609 for direct TOPI, and 0.540 for direct jobs/output. Supplier increments use separately derived ratios rather than applying a direct coefficient ratio indiscriminately.

`generate_complete_multipliers.R` is the only substantive land-based gambling generator. `12_gambling_specific_data.R` remains as a backward-compatible entry point and calls that generator; the former hard-coded `0.89` value-added and `0.63` compensation calibration no longer coexists with it.

## Property labels

`13b_property_type_multipliers.R` assembles the four land-based property labels from the canonical gambling rows. The labels do not claim four independently estimated production functions. In department mode, lodging, food, and other revenue are assigned to StateIO 721, 722, and 711AS. Total mode applies the gambling production function to the full input and is an approximation when non-gaming revenue is material.

Legacy land-based total-revenue input is never silently treated as GGR for statutory gaming tax, which requires an explicit gaming-revenue input in department mode; online total revenue remains GGR by construction.

Online casino and sportsbook data remain a documented scenario approximation because BEA IO data do not isolate online gambling. The operator's direct labor ratio is not applied to supplier or induced jobs/GDP coefficients.

## TOPI and statutory gaming tax

BEA classifies state and local taxes on gaming receipts and admissions (Census "amusements" taxes, T11) as taxes on products within TOPI and, in the GDP-by-state accounts, assigns them to "Amusement, gambling, and recreation". `stateior::assembleStateSummaryGrossValueAdded` gives every state the national TOPI-to-value-added intensity, so StateIO's 713 TOPI embeds a national-average gaming tax unrelated to the state's own rate. Adding the statutory tax would double count it.

The statutory gaming tax therefore **replaces** the gaming share of the gaming stream's direct TOPI. The retained share is the part of BEA detail industry 713200's TOPI recorded as other taxes on production rather than taxes on products: T00OTOP / (T00TOP + T00OTOP) = 737 / 2,130 = 0.346 in the 2017 detail supply-use table (`useeior::Detail_Use_SUT_2017_17sch`). `scripts/derive_gaming_topi_share.R` derives it into `webapp/src/data/fiscalAssumptions.json`. Flat per-device license fees stay inside the retained share and small non-gaming product taxes are removed with the gaming tax; both are minor relative to GGR taxes. Indirect and induced TOPI are unchanged.

## Tribal casinos

BEA records gaming administered by tribal governments as a state and local government enterprise (GSLE), not as part of the private gambling industry; QCEW codes tribal casinos as local government (own_code 3). StateIO's 713 output therefore excludes tribal gaming, and the employment satellite correctly keeps the private-only filter: adding tribal jobs would place them over an output base that does not contain them. A **tribal ownership** option instead omits the state gaming tax, replaces the gaming stream's direct TOPI with the compact revenue share, and shows no direct-jobs range (the Economic Census benchmark excludes most tribal casinos).

## Wage basis and household taxes

Model compensation (StateIO V001 = BEA compensation) is converted to QCEW-comparable wages by industry for payroll and income-tax bases and for user-entered payroll: national 2023 QCEW private wages ÷ BEA NIPA Table 6.2D compensation (`webapp/src/data/wageBasis.json`). Household income taxes use wage-level tables for 2025 built by `scripts/build_income_tax_tables.py` from `data/income_tax_parameters_2025.json`. Each state's parameters were verified against official 2025 instructions, schedules or statutes, and the build asserts 1,337 reference and hand-checked values.

## Verification

```bash
Rscript tests/test_useeior_provenance.R
Rscript tests/test_multiplier_integrity.R
cd webapp && npm test
```

The offline tests independently recalculate the national parent benchmarks and ratios, verify the 2023 employment denominators, confirm all 50 states and 200 sector rows, and confirm that every land-based property label uses the canonical gambling coefficients.
