# Multiplier Data Provenance

This note records how GEMS combines state-level economic geography with national gaming-industry composition. The deployed pipeline has one land-based gambling calibration.

## Architecture

1. **EPA StateIO (`stateior`)** supplies 2019 state make/use relationships, regional purchase patterns, leakages, and the Type I/Type II structure. The pre-pandemic structure is retained deliberately.
2. **BLS QCEW plus 2023 StateIO** supply the employment satellite. QCEW annual-average filled jobs are divided by 2023 StateIO output and value added, so the labor numerator and dollar denominator have the same vintage.
3. **National BEA detail IO (`useeior`)** supplies ratios describing detailed gambling (`713200/US`) relative to the output-weighted 713 parent.

The national ratios adapt StateIO results while retaining state geography. The model does not substitute an average local hotel or restaurant production function for gaming.

## Employment lineage

`08a_process_all_qcew_employment.R` downloads or reads BLS's official [2023 annual singlefile](https://data.bls.gov/cew/data/files/2023/csv/2023_annual_singlefile.zip) and maps QCEW filled jobs to StateIO sectors. It uses exact aggregates to prevent hierarchical double counting and explicitly bridges the 2022 NAICS retail and information changes. `08_state_multipliers_2023.R` combines those jobs with cached 2023 StateIO output and value added while retaining the 2019 Leontief matrices:

- jobs per 2023 output is the satellite multiplied through the output-requirements matrix;
- jobs per 2023 value added is retained as the direct labor-intensity diagnostic;
- supplier and induced jobs/GDP coefficients are derived from the employment-weighted job totals and the corresponding GDP increments.

No hours or FTE conversion is used. Owner-occupied housing (`HS`) and the federal/state-local government-enterprise sectors (`GFE`, `GSLE`) have no QCEW-compatible satellite, so they are explicit zeros rather than unrelated within-state averages. `GFGD`, `GFGN`, and `GSLG` use disclosed QCEW public-administration ownership proxies; uniformed military personnel are outside QCEW coverage.

The public ZIP can be supplied with `GEMS_QCEW_SINGLEFILE_ZIP`; otherwise script 08a downloads it from BLS. The generated satellite path used by scripts 08 and 09 can be overridden with `GEMS_QCEW_ALL_SECTORS_FILE`. Script 07 is only a compatibility extractor and no longer ingests a second collection of developer-local source files.

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

Legacy land-based total-revenue input is never silently treated as GGR for statutory gaming tax. That memo estimate requires an explicit gaming-revenue input in department mode; online total revenue remains GGR by construction.

Online casino and sportsbook data remain a documented scenario approximation because BEA IO data do not isolate online gambling. The operator's direct labor ratio is not applied to supplier or induced jobs/GDP coefficients.

## TOPI and statutory gaming tax

USEEIO directly identifies “Taxes on production and imports, less subsidies,” allowing the national gambling TOPI ratios to be reproduced alongside the other coefficients. StateIO TOPI can already contain gaming-related gross-receipts, amusement, and license taxes. The application therefore reports statutory gaming tax as a memo component and does not add it to TOPI.

GEMS does not estimate and subtract an embedded state gaming-tax amount. StateIO does not expose that component separately, so a numerical replacement would create unsupported precision. Indirect and induced TOPI remain unchanged by the statutory memo.

## Verification

```bash
Rscript tests/test_useeior_provenance.R
Rscript tests/test_multiplier_integrity.R
cd webapp && npm test
```

The offline tests independently recalculate the national parent benchmarks and ratios, verify the 2023 employment denominators, confirm all 50 states and 200 sector rows, and confirm that every land-based property label uses the canonical gambling coefficients.
