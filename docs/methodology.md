# GEMS 2026 — Gaming Economic Modeling System

## Methodology Documentation

**Product:** GEMS (Gaming Economic Modeling System), the Casino Economic Impact Model
**Model version:** 2026 (release edition)
**Publisher:** GP Consulting
**Live calculator:** https://gamblingpolicy.com/tools/economic-impact/
**White paper (PDF):** https://gamblingpolicy.com/tools/economic-impact/GEMS-2026-Methodology.pdf — generated from [`generate_whitepaper.py`](generate_whitepaper.py); regenerate after content changes with `python3 docs/generate_whitepaper.py` (requires `pip install reportlab`)

### Suggested Citation

> Philander, K. (2026). GEMS: Gaming Economic Modeling System (Version 2026) [Computer software]. GP Consulting. https://gamblingpolicy.com/tools/economic-impact/

When citing results produced by the model, please also state the analysis date and the inputs used (state, property type, and revenue assumptions), as results depend on user-supplied inputs.

---

## 1. Overview

GEMS quantifies the total economic footprint of casino and gaming operations at the state level for all 50 US states. District of Columbia coefficients are not included in the deployed GEMS 2026 dataset. For a given revenue profile, it computes **direct, indirect, and induced** effects across six metrics:

| Metric | What It Measures |
|--------|-----------------|
| Output | Total economic activity (gross output) generated |
| GDP | Value added (contribution to Gross Domestic Product) |
| Employment | Filled full- and part-time jobs supported (not FTEs) |
| Estimated FTEs | Industry-weighted full-time-equivalent estimate reported separately from jobs |
| Employee Compensation | Cash wages plus employer-paid supplements generated |
| Tax Revenue | TOPI, payroll, and household taxes; gaming tax is a memo component of TOPI |

## 2. Modeling Framework

### 2.1 Industry Technology Assumption (ITA)

GEMS uses the Industry Technology Assumption framework from Input-Output (IO) economics:

**Step 1 — Direct Requirements Matrix:** `A = D × B`, where **D** is the market share matrix (from the Make table) and **B** is the commodity coefficient matrix (from the Use table).

**Step 2 — Leontief Inverse (Type I):** `L = (I − A)⁻¹`. Column sums give Type I output multipliers, capturing all rounds of inter-industry (supply chain) purchasing.

**Step 3 — Type II Augmentation:** The A matrix is augmented with a household row (labor income coefficients) and household column (consumer spending patterns). The augmented Leontief inverse yields Type II multipliers that additionally capture induced effects from household spending.

### 2.2 Effect Decomposition

| Effect | Source |
|--------|--------|
| Direct | The initial economic activity of the gaming operation |
| Indirect | Supply-chain purchasing by the operation and its suppliers |
| Induced | Household spending of wages earned in direct and indirect activity |

- Direct output = revenue
- Indirect output = revenue × (Type I multiplier − 1)
- Induced output = revenue × (Type II multiplier − Type I multiplier)
- Total output = revenue × Type II multiplier

The same decomposition applies to GDP, employee compensation, and TOPI using their respective multiplier pairs.

### 2.3 Employment Coefficients

Employment uses a consistent-2023 satellite rather than a simple output multiplier:

```
Direct jobs = Direct output × Direct jobs/output coefficient
Supplier or induced jobs = GDP effect × Effect-specific jobs/GDP coefficient
```

QCEW jobs are divided by 2023 StateIO output and value added. Jobs/output is propagated through the Leontief output-requirements matrix; the resulting supplier and induced jobs totals are divided by the corresponding GDP effects to produce `Indirect_Emp_Coef` and `Induced_Emp_Coef`. `Emp_Coef` retains the direct jobs/value-added diagnostic, while `Direct_Jobs_Per_1M_Output` drives calculated direct jobs in the application.

The QCEW employment input counts filled jobs, including full-time, part-time, temporary, and permanent positions. It does not contain hours or an FTE conversion, and a person holding multiple jobs may be counted more than once. GEMS therefore reports **jobs** as its primary employment measure. See the [BLS QCEW definition](https://www.bls.gov/cew/questions-and-answers.htm#Q18).

The model also reports a separate estimated-FTE measure. `08b_generate_bea_fte_ratios.R` divides 2023 BEA NIPA table 6.5D FTE employees by table 6.4D full- and part-time employee jobs for each national industry and maps those ratios to the 71 StateIO sectors. A separate FTE/output satellite is then propagated through the Type I and Type II matrices. Direct, supplier, and induced FTEs therefore use the ratios of the industries where the corresponding jobs occur. The estimates are not establishment-reported hours and should always be labeled **estimated FTEs**. See the [BEA FTE definition](https://www.bea.gov/help/faq/368).

### 2.4 Reporting Basis and the Employment Base-Year Adjustment

**All monetary results the model reports — output, GDP, employee compensation, and tax revenue — are in current-year (nominal) dollars**, the same dollars the user enters. The dollar multipliers and coefficients are unitless ratios applied directly to current-dollar revenue, so their results are automatically in current dollars. No reported dollar figure is deflated.

Employment is the one quantity that needs a base-year adjustment, because the employment coefficients carry a dollar denomination. They are calibrated with **2023** QCEW jobs and 2023 StateIO output/value added. The model therefore restates the relevant output or GDP effect in 2023 dollars purely as an internal step in the jobs calculation:

```
Deflator = CPI_2023 / CPI_current_year
Jobs = (Output_or_GDP_in_current_dollars × Deflator) × Employment_Coefficient
```

This conversion affects the employment estimate only; it does not change any displayed dollar figure.

The CPI table uses official BLS calendar-year annual averages. When the analysis year is newer than the latest complete annual average, GEMS uses the latest complete year (currently 2025) rather than presenting a partial-year index as an annual value.

The production structure remains a deliberate hybrid: the make/use matrices and household closure use 2019 relationships to avoid pandemic distortion, while the employment satellite uses internally consistent 2023 numerator and denominator data. This preserves the stated COVID rationale without interpreting nominal industry growth as a change in labor intensity.

### 2.5 Gambling-Specific Adjustments

GEMS separates regional structure from gaming-industry composition. EPA StateIO supplies state-specific supplier relationships, import leakages, and Leontief multipliers. National BEA detail data supplies ratios describing how gambling differs from its broader parent sector. Applying those ratios to the StateIO results preserves geographic variation without treating a casino as an average local hotel, restaurant, or recreation establishment.

The IO tables contain only the blended sector 713 (Amusement, Gambling, and Recreation). The single canonical generator uses `useeior::buildModel("USEEIOv2.0.1-411")` to compare detailed gambling (`713200/US`) with an output-weighted 713 parent:

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

These ratios adapt StateIO 713 direct and incremental Type I effects. Because USEEIO is an open Type I model, the same documented supplier-side ratios scale the StateIO induced increments. Supplier and induced job intensity is not multiplied by the casino operator's direct labor ratio. The former competing legacy calibration has been removed.

## 3. Tax Estimates

GEMS computes three categories of tax revenue:

1. **Taxes on Production & Imports (TOPI)** — derived from the IO tables and flowed through the Leontief inverse; captures gross-receipts, amusement, license, property, excise, and other production-related taxes.
2. **Gaming Tax (memo)** — state-specific tax on Gross Gaming Revenue (GGR), supporting flat-rate, graduated-tier, split-by-game-type, and split-tiered structures. Because gaming-related gross-receipts, amusement, and license taxes fall within TOPI, this estimate is displayed but not added to TOPI again. GEMS does not attempt to subtract and replace an embedded amount because StateIO does not identify the gaming-tax portion of sector 713 TOPI by state.
3. **Payroll & Household Taxes** — employer-side FICA, FUTA, SUTA, and state SDI/PFML contributions; household taxes estimated via BEA personal current tax ratios. Both use estimated cash wages rather than total employee compensation.

StateIO `V001` is employee compensation: wages and salaries plus employer contributions for pensions, insurance, and government social insurance. To avoid applying wage-based tax rates to benefits, GEMS estimates cash wages using the 2019 national BEA NIPA table 1.12 ratio: `9,323.5 / 11,447.7 = 0.8144`. This national share is an explicit approximation pending industry-by-state wage shares.

## 4. Data Sources

| Source | Vintage | Use |
|--------|---------|-----|
| EPA State Input-Output (StateIO) models, via the [`stateior`](https://github.com/USEPA/stateior) R package | 2019 and 2023 | 2019 state production structure; 2023 output/value-added denominators for employment |
| BLS Quarterly Census of Employment and Wages (QCEW) | 2023 annual averages | Filled-job numerators for employment coefficients and diagnostic earnings fields |
| BEA Detail IO Tables via `useeior` (USEEIOv2.0.1-411) | 2017 | National gambling/property-to-parent adjustment factors; versioned outputs in `bea_detail_coefficients.csv`, `blended_parent_coefficients.csv`, and `national_naics_ratios.csv` |
| State gaming commissions, AGA State of the States | Current | Gaming tax schedules |
| BLS CPI-U annual averages | Current | Inflation adjustment |

## 5. Sector and Property-Type Mapping

| IO Sector | NAICS | Casino Department |
|-----------|-------|-------------------|
| 711AS | 711, 712 | Other (entertainment, retail) |
| 713 | 713 | Gaming (GGR) |
| 721 | 721 | Lodging |
| 722 | 722 | Food & Beverage |

Property types: Casino Hotel (721120), Stand-alone Casino (713210), Slot Parlor (713290), Bar/Restaurant Gaming (722410), plus online casino and sports betting variants. All four land-based labels use the same canonical gambling production function. In department mode, separately entered lodging, food, and other revenue use StateIO 721, 722, and 711AS. In total mode, the full amount uses the gambling function and should be treated as an approximation when non-gaming revenue is material.

Legacy land-based total operating revenue is not treated as GGR for the statutory gaming-tax memo. The tax memo requires an explicit gaming-revenue input in department mode. Online total revenue is GGR by construction.

## 6. Limitations and Appropriate Use

- Results are **estimates** based on average inter-industry relationships; they should be interpreted as indicative rather than definitive.
- The deployed multiplier data cover 50 states and 200 state-sector rows, not the District of Columbia.
- Employment uses 2023 jobs/output and jobs/value-added satellites with a retained 2019 interindustry structure; it is a deliberate structural hybrid, not a mixed numerator/denominator coefficient.
- The national gambling ratios, employment coefficients, property assembler, deployed JSON, and offline integrity tests are versioned and reproducible. Script 08a downloads or reads the official BLS 2023 annual singlefile through `GEMS_QCEW_SINGLEFILE_ZIP` and uses exact, versioned StateIO mappings.
- QCEW has no compatible employment measure for StateIO's synthetic owner-occupied housing and government-enterprise sectors. `HS`, `GFE`, and `GSLE` therefore use explicit zero satellite coefficients rather than average-sector imputations; public-administration sectors use disclosed ownership proxies.
- Online multipliers are approximations. Direct online labor intensity may be adjusted from operator data, but supplier and induced job intensities should reflect the industries where those effects occur rather than inherit the direct operator ratio.
- State-level analysis captures only impacts within the state boundary; spending that leaks to other states is excluded.
- The model is appropriate for policy analysis, planning, and comparative assessment. It is **not** appropriate for precise forecasting, investment decisions without professional advice, or legal proceedings.
- IO models assume fixed production technology and no supply constraints; very large projects may alter local economic structure in ways the model does not capture.

## 7. Versioning

The model version is the release edition year (e.g., GEMS 2026). When a new edition is published — whether from regenerated datasets or methodology updates — the version is bumped and this document is updated. Reports generated by the calculator embed the model version and the data vintages used (see Data Sources above) so results remain traceable.

### Version History

| Version | Released | Notes |
|---------|----------|-------|
| GEMS 2026 | 2026 | Initial release. 2019 EPA StateIO multipliers, 2023 QCEW employment, USEEIOv2.0.1-411 gambling adjustments. |

## 8. Key References

- Leontief, W. (1936). Quantitative input and output relations in the economic systems of the United States. *The Review of Economics and Statistics*, 18(3), 105–125.
- Miller, R. E., & Blair, P. D. (2009). *Input-Output Analysis: Foundations and Extensions* (2nd ed.). Cambridge University Press.
- Ingwersen, W., et al. USEPA `stateior` and `useeior` R packages.
