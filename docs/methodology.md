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

GEMS quantifies the total economic footprint of casino and gaming operations at the state level for all 50 US states and the District of Columbia. For a given revenue profile, it computes **direct, indirect, and induced** effects across five metrics:

| Metric | What It Measures |
|--------|-----------------|
| Output | Total economic activity (gross output) generated |
| GDP | Value added (contribution to Gross Domestic Product) |
| Employment | Jobs supported (FTE positions) |
| Wages | Employee compensation generated |
| Tax Revenue | Government revenue from production taxes and gaming taxes |

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

The same decomposition applies to GDP, wages, and tax metrics using their respective multiplier pairs.

### 2.3 Employment Coefficients

Employment uses true employment-weighted coefficients rather than output-based multipliers:

```
Jobs = GDP_effect × Employment_Coefficient
```

Three coefficients capture the differing labor intensities of each effect type: `Emp_Coef` (direct — labor intensity of the gaming industry itself), `Indirect_Emp_Coef` (weighted average labor intensity of supplier industries), and `Induced_Emp_Coef` (weighted average labor intensity of household-spending industries). Coefficients are expressed as jobs per $1M of Value Added (GDP), not gross output, to avoid double-counting intermediate purchases.

### 2.4 Reporting Basis and the Employment Base-Year Adjustment

**All monetary results the model reports — output, GDP, wages, and tax revenue — are in current-year (nominal) dollars**, the same dollars the user enters. The dollar multipliers and coefficients are unitless ratios applied directly to current-dollar revenue, so their results are automatically in current dollars. No reported dollar figure is deflated.

Employment is the one quantity that needs a base-year adjustment, because the employment coefficients carry a dollar denomination: they are jobs per $1M of value added expressed in **2019 dollars** (the IO table base year, and the denominator used when the coefficients were estimated). Applying that coefficient to a current-dollar GDP figure would mismatch the price bases. The model therefore restates GDP in 2019 dollars purely as an internal step in the jobs calculation, then applies the coefficient:

```
Deflator = CPI_2019 / CPI_current_year
Jobs = (GDP_in_current_dollars × Deflator) × Employment_Coefficient
```

This conversion affects the employment estimate only; it does not change any dollar figure the model displays. Without it, current-dollar GDP would be matched against a coefficient denominated in cheaper 2019 dollars, overstating jobs by the cumulative price growth since 2019.

### 2.5 Gambling-Specific Adjustments

The IO tables contain only the blended sector 713 (Amusement, Gambling, and Recreation). GEMS applies adjustment factors derived from BEA Detail IO Tables (USEEIOv2.0.1-411) to isolate gambling-specific (NAICS 713200) coefficients:

| Coefficient | Blended 713 | Gambling (713200) | Ratio |
|------------|-------------|-------------------|-------|
| VA coefficient | 0.651 | 0.577 | 0.89 |
| Wage coefficient | 0.406 | 0.255 | 0.63 |
| TOPI coefficient | 0.058 | 0.035 | 0.61 |

Indirect and induced effects reflect spending across other sectors, so no gambling adjustment is applied to those components.

## 3. Tax Estimates

GEMS computes three categories of tax revenue:

1. **Taxes on Production & Imports (TOPI)** — derived from the IO tables and flowed through the Leontief inverse; captures sales, property, excise, and other production-related taxes.
2. **Gaming Tax** — state-specific tax on Gross Gaming Revenue (GGR), supporting flat-rate, graduated-tier, split-by-game-type, and split-tiered structures, sourced from state gaming commission reports and the AGA State of the States.
3. **Payroll & Household Taxes** — employer-side FICA, FUTA, SUTA, and state SDI/PFML contributions; household income taxes estimated via BEA personal current tax ratios.

## 4. Data Sources

| Source | Vintage | Use |
|--------|---------|-----|
| EPA State Input-Output (StateIO) models, via the [`stateior`](https://github.com/USEPA/stateior) R package | 2019 | State multipliers (pre-pandemic year chosen to avoid distorted 2020 relationships) |
| BLS Quarterly Census of Employment and Wages (QCEW) | 2023 annual averages | Employment and wage coefficients |
| BEA Detail IO Tables via `useeior` (USEEIOv2.0.1-411) | 2017 | Gambling-specific adjustment factors |
| State gaming commissions, AGA State of the States | Current | Gaming tax schedules |
| BLS CPI-U annual averages | Current | Inflation adjustment |

## 5. Sector and Property-Type Mapping

| IO Sector | NAICS | Casino Department |
|-----------|-------|-------------------|
| 711AS | 711, 712 | Other (entertainment, retail) |
| 713 | 713 | Gaming (GGR) |
| 721 | 721 | Lodging |
| 722 | 722 | Food & Beverage |

Property types: Casino Hotel (721120), Stand-alone Casino (713210), Slot Parlor (713290), Bar/Restaurant Gaming (722410), plus online casino and sports betting variants. Each property type carries its own multiplier set reflecting its economic structure.

## 6. Limitations and Appropriate Use

- Results are **estimates** based on average inter-industry relationships; they should be interpreted as indicative rather than definitive.
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
