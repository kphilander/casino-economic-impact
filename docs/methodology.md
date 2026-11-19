# GEMS 2026 — Gaming Economic Modeling System

## Methodology Documentation

**Product:** GEMS (Gaming Economic Modeling System), the Casino Economic Impact Model
**Model version:** 2026 (release edition)
**Publisher:** GP Consulting
**Live calculator:** https://gamblingpolicy.com/tools/economic-impact/
**White paper (PDF):** https://gamblingpolicy.com/tools/economic-impact/GEMS-2026-Methodology.pdf — generated from [`generate_whitepaper.py`](generate_whitepaper.py); regenerate after content changes with `python3 docs/generate_whitepaper.py` (requires `pip install reportlab`). The PDF describes the model as deployed in November 2026, in ASD-STE100 Simplified Technical English. Keep the two documents in agreement; where they differ, this document applies.

### Suggested Citation

> Simeon-Rose, K. (2026). GEMS: Gaming Economic Modeling System (Version 2026) [Computer software]. GP Consulting. https://gamblingpolicy.com/tools/economic-impact/

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
| Tax Revenue | Gaming tax (replacing the gaming share of direct TOPI), other TOPI, payroll and household income taxes, by federal vs. state and local |

## 2. Modeling Framework

### 2.1 Industry Technology Assumption (ITA)

GEMS uses the Industry Technology Assumption framework from Input-Output (IO) economics:

**Step 1 — Direct Requirements Matrix:** `A = D × B`, where **D** is the market share matrix (from the Make table) and **B** is the commodity coefficient matrix (from the Use table).

**Step 2 — Leontief Inverse (Type I):** `L = (I − A)⁻¹`. Column sums give Type I output multipliers, capturing all rounds of inter-industry (supply chain) purchasing.

**Step 3 — Type II Augmentation:** The A matrix is augmented with a household row (labor income coefficients) and household column (consumer spending patterns). The augmented Leontief inverse yields Type II multipliers that additionally capture induced effects from household spending.

The household row is employee compensation per dollar of output (V001 ÷ g). Households spend a share θ of each dollar of compensation, and the household column is θ × in-state PCE ÷ all PCE of the state (StateIO 2019 F010; all PCE includes purchases from other states and imports), converted to industries with D. `08c_household_spending.R` estimates θ for each state:

θ = c × (1 − b × (employer payroll taxes + employee Social Security and Medicare + income taxes) ÷ W)

- c = 0.902, personal consumption expenditures ÷ disposable personal income, 2023 (BEA NIPA Table 2.1 via FRED).
- b = 0.806, cash wages per dollar of compensation for all private industries (Section 3.3).
- W = the state's average 2023 QCEW private wage. The taxes at W come from the calculator's own payroll and income tax rules (Section 3.2), so the household closure spends only the income that remains after the taxes that the fiscal estimates count. Compensation enters personal income less contributions for government social insurance, and disposable income less personal current taxes.

θ is 0.64 to 0.73 across states (median 0.70); about 70% of household spending goes to in-state suppliers. The Sensitivity view shows results with a low θ (c = 0.819, the lowest annual ratio since 2000, in 2020) and a high θ (c = 1, all disposable income spent).

Before October 2026 the household column was in-state PCE ÷ total compensation. That spent a median of $0.90 in the state per $1 of compensation (up to $1.20 in Florida), because it attributed consumption financed by transfers and property income to wages. With θ, the median is $0.48. Type II output and value-added multipliers for 713, 721 and 722 are about 20% lower, Type II jobs 12–16% lower; Type I multipliers do not change. Against BEA RIMS II multipliers for four non-gaming industries, the earlier closure gave induced output per dollar of supplier-round labor income about 45% above RIMS II and the new closure about 35% below it, and Type II output multipliers of 0.99 and 0.82 times RIMS II (medians). RIMS II's location-quotient regionalization also keeps more supplier and household purchases in the state.

**Computation.** The calculator does these steps in the browser. `scripts/export_state_io.R` writes the in-state block of each state's StateIO tables to `webapp/src/data/io/{state}.json`: the Make and domestic Use tables, industry and commodity output, the value-added components V001–V003, in-state personal consumption (F010), all personal consumption of the state, the household spending share θ with its range and inputs, and the 2023 jobs satellite. The export contains no derived quantities. The engine (`webapp/src/engine/io.ts`) forms D, B, A, the Type I and Type II inverses and all coefficients, as `08_state_multipliers_2023.R` does. Its tests reproduce every value in `employment_multipliers_2023.csv`, `construction_multipliers_2023.csv`, `gambling_multipliers_2023.csv` and `online_gambling_multipliers_2023.csv` to the rounding of those files, so the R pipeline remains the reference and the browser model cannot drift from it.

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

The same decomposition applies to GDP, employee compensation, and TOPI using their respective multiplier pairs. The engine keeps each effect by the industry in which it occurs; the calculator reports supplier and induced jobs by industry.

### 2.3 Employment Coefficients

Employment uses a consistent-2023 satellite rather than a simple output multiplier:

```
Jobs in industry i = jobs per $1M of output in industry i × output of industry i in each round
```

QCEW jobs are divided by 2023 StateIO output for each of the 71 industries. The direct round is the revenue entered; the supplier and induced rounds are the output requirements from the Type I and Type II inverses. The R pipeline summarizes the same quantities as `Indirect_Emp_Coef` and `Induced_Emp_Coef` (jobs per dollar of supplier or induced GDP); `Emp_Coef` retains the direct jobs/value-added diagnostic.

Two corrections apply to the satellite (`scripts/employment_satellite.R`, used by the R pipeline and the browser export). First, StateIO 0.4.0 divides 2023 retail output among the four retail sectors (441, 445, 452, 4A0) in a way that does not agree with the 2019 tables or with QCEW: sector 452 has no output in any state, and 441 has about five times its 2019 output. The retail total is plausible. The satellite keeps each state's 2023 retail total and divides it among the four sectors by their 2019 shares. Second, QCEW does not disclose employment for some state-sector cells. Where a sector has output in a state but no recorded jobs, the satellite uses the national jobs per dollar of output of that sector. Each state file lists these sectors (`jobsImputed`). Together, the corrections changed supplier and induced jobs only: across states and the four casino-related sectors, induced jobs per dollar of induced GDP changed by −14% to +2%, and Type II jobs per dollar of output by −5% to 0%.

The QCEW employment input counts filled jobs, including full-time, part-time, temporary, and permanent positions. It does not contain hours or an FTE conversion, and a person holding multiple jobs may be counted more than once. GEMS therefore reports **jobs** as its primary employment measure. See the [BLS QCEW definition](https://www.bls.gov/cew/questions-and-answers.htm#Q18).

The model also reports a separate estimated-FTE measure. `08b_generate_bea_fte_ratios.R` divides 2023 BEA NIPA table 6.5D FTE employees by table 6.4D full- and part-time employee jobs for each national industry and maps those ratios to the 71 StateIO sectors. A separate FTE/output satellite is then propagated through the Type I and Type II matrices. Direct, supplier, and induced FTEs therefore use the ratios of the industries where the corresponding jobs occur. The estimates are not establishment-reported hours and should always be labeled **estimated FTEs**. See the [BEA FTE definition](https://www.bea.gov/help/faq/368).

### 2.4 Reporting Basis and the Employment Base-Year Adjustment

**All monetary results the model reports — output, GDP, employee compensation, and tax revenue — are in current-year (nominal) dollars**, the same dollars the user enters. The dollar multipliers and coefficients are unitless ratios applied directly to current-dollar revenue, so their results are automatically in current dollars. No reported dollar figure is deflated.

Employment is the one quantity that needs a base-year adjustment, because the employment coefficients carry a dollar denomination. They are calibrated with **2023** QCEW jobs and 2023 StateIO output/value added. The model therefore restates the relevant output or GDP effect in 2023 dollars purely as an internal step in the jobs calculation:

```
Deflator = CPI_2023 / CPI_analysis_year
Jobs = (Output_or_GDP_in_analysis_year_dollars × Deflator) × Employment_Coefficient
```

This conversion affects the employment estimate only; it does not change any displayed dollar figure.

The **analysis year** is the dollar year of the revenue inputs and is an explicit input (Annual revenue → Dollar year of revenue), defaulting to the latest year with a complete BLS CPI-U annual average (currently 2025). It is not taken from the browser clock, so a 2024 revenue figure entered in 2026 is deflated from 2024 dollars. The CPI table uses official BLS calendar-year annual averages.

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

In the engine, the gambling activity is the state's 713 response with each metric's direct effect and supplier and induced increments scaled by these ratios (`webapp/src/engine/profiles.ts`). Supplier and induced jobs scale with value added, because jobs per dollar of supplier or induced GDP stay at the 713 values. The industry distribution of gambling supplier and induced effects is therefore that of 713.

### 2.6 Validation of Direct Jobs and Predictive Ranges

Direct jobs are the one employment quantity with an observed, non-circular benchmark. Two benchmarks were used, each compared state by state with the gambling coefficient for casino property types (NAICS 713210, 713290, 721120):

1. **QCEW, jobs per wage dollar** (2023, all states, cells with at least 50 jobs). The coefficient appears short: geometric-mean ratios of 0.71 for stand-alone casinos, 0.84 for casino hotels and 0.90 for slot parlors. This requires converting model compensation to QCEW-comparable wages by industry (Section 3.3); without the conversion the shortfall roughly doubles.
2. **2022 Economic Census, jobs and payroll per revenue dollar.** Unlike QCEW, the Census observes receipts, so it can separate jobs per dollar of output from compensation per dollar of output.
   - **Jobs per revenue dollar show no average bias:** ratios of 0.94, 1.06 and 0.96, with p > 0.5. But the variation of the coefficient between states carries no information for casinos (see below).
   - **The payroll share of revenue is 18–53% too high**, and the observed share falls as the state's effective gaming tax rises. StateIO gives every state the national value-added composition, so the coefficient cannot reflect that gaming taxes take a large share of revenue in high-tax states.
   - The jobs-per-wage shortfall in the QCEW test is therefore a compensation overstatement, not a shortage of jobs.

**National rate for direct gaming jobs (November 2026).** The absence of average bias hid two problems. Across 21 gaming-stream cells in 15 states with commercial casinos, the state gambling coefficient has no correlation with observed jobs per revenue dollar (r = −0.08). And observed jobs per revenue dollar fall as the gaming tax rate rises, at about the same rate as the payroll share (Section 2.7), while the coefficient does not. The coefficient was therefore too high in high-tax states (model ÷ Census of 1.5 for Pennsylvania) and too low in low-tax states (0.62 to 0.66 for Nevada and New Jersey).

For the gaming stream of commercial stand-alone casinos (713210) and casino hotels (721120), GEMS replaces the state coefficient with a national rate (`webapp/src/data/directJobsRate.json`; `directJobsRate` in `webapp/src/engine/scenario.ts`):

```text
direct gaming jobs per $1M of revenue (2023 dollars) = 4.57 × exp(−0.992 × τ)
```

- τ is the same effective gaming tax rate as in Section 2.7.
- Estimation: log(observed jobs per $1M) on τ, standard errors clustered by state; slope 0.992 (SE 0.42, p = 0.034), level 4.57 (SE of the log 0.11). The cells are stand-alone casinos (employees ÷ receipts, 8 states) and casino hotels (employees less modeled non-gaming jobs, per dollar of gaming receipts from the Census product lines, 13 states). Stand-alone casinos alone give 4.80 × exp(−1.06 τ) (slope SE 0.21).
- Leave-one-state-out mean absolute log error: state coefficient 0.236; state coefficient with a tax factor exp(−bτ) 0.251; national constant 0.185; national rate 0.169. A tax factor on the state coefficient, the form used for compensation, does not help, because the state coefficient is the larger source of error.
- The rate changes direct jobs and direct estimated FTEs of the gaming stream (FTEs keep the FTE-per-job ratio of the sector). Compensation, value added and supplier and induced effects do not change. User-entered jobs replace the rate.
- With the rate, the casino-hotel department-mode test (17 states) gives a geometric-mean ratio of 1.06 and an aggregate ratio of 1.02 (1.08 and 0.97 with the state coefficient), and the mean absolute log error falls from 0.21 to 0.16. Thirteen of these states are in the estimation sample.
- Not applied to slot parlors and bingo halls (the rate does not lower their error; the industry is heterogeneous), bars with slots, tribal properties (outside the sample) or online operators. These keep the state coefficient.

Limits of the rate:

- For the casino-hotel cells alone the slope is not significant (p = 0.18) and the rate is not better than a national constant; the result rests mostly on the eight stand-alone cells. The casino-hotel cells also depend on the lodging, food and other coefficients of the model.
- The rate is linear in revenue. The Nevada Gaming Abstract for fiscal year 2025 shows 4.6 jobs per $1M of total revenue (2023 dollars) at casinos with rooms and gaming revenue of $72M or more, against 7.8 to 8.6 in the smaller classes. The model is therefore closest for large properties and too low for small ones. In the same data the Nevada lodging coefficient (5.04) is above the 3.5 observed for the largest class, and the coefficient for other revenue (1.70) is below the 3.9 observed.
- GGR includes the retail value of complimentaries. In Nevada, complimentaries are 28% of gross gaming win. Do not take them out of GGR by hand: the gaming tax is levied on GGR, so a net figure understates it. Enter GGR and the comped value by receiving department (Section 2.8); the rate then applies to the gaming stream's output, GGR less the comps, at the effective tax rate on GGR. If the comped value is unknown, leave the fields blank: the rate then applies to all of GGR, so direct gaming jobs are higher by the rate times the comped value, and the departments that provide the comps get no jobs for it. In either case, enter only the cash revenue of the lodging, food and other departments. Department revenue that includes complimentaries, entered with GGR, counts that revenue two times.
- The rate was estimated on 2022 Economic Census receipts, and the two kinds of cell treat complimentaries differently. **Casino hotels:** the gaming product lines are mostly net of complimentaries. The Census Bureau's 2022 Service Annual Survey form for accommodation tells casino hotels to report sales net of promotional allowances, and Nevada's Census casino-hotel gaming receipts ($10.84B) are much nearer the Nevada Gaming Abstract's gaming revenue after complimentaries ($9.83B, casinos with rooms, mean of fiscal 2022 and 2023) than its gross win ($13.43B), while total receipts agree ($27.33B and $27.23B). Applying the rate to GGR less the comps is therefore the better approximation for casino hotels. It is not exact: Mississippi's Census casino-hotel gaming receipts are 93% of the regulator's gross gaming revenue. **Stand-alone casinos:** the cell is employees ÷ total receipts. Complimentaries move between departments and largely cancel in the total, so that denominator behaves like gross win plus cash sales of the other departments. With comps entered, the model applies the rate to GGR less the comps and so gives too few direct gaming jobs for a stand-alone casino, by approximately the share of comps in GGR. The Economic Census forms and instruction sheets do not say how to report complimentaries; the above rests on the survey instruction and on the comparisons with regulator figures (2022 Economic Census tables EC2272BASIC and EC2200NAPCSINDPRD; Nevada Gaming Abstract, fiscal 2022 and 2023; Mississippi Gaming Commission, 2022).

For land-based commercial casinos GEMS reports a **90% predictive range** for direct and total jobs. The range is the 5th–95th percentile of a lognormal fitted to the log errors across states:

| Stream | Cells | Predicted ÷ Census jobs per revenue $ | 90% range (× direct jobs) | Basis |
|---|---:|---:|---|---|
| Gaming department (national rate) | 21 | 1.00 | 0.67–1.48 | leave-one-state-out |
| Stand-alone casino, total revenue (national rate) | 8 | 0.97 | 0.87–1.21 | leave-one-state-out |
| Casino hotel, total revenue (national rate on all receipts) | 15 | 0.88 | 0.87–1.49 | in-sample; includes the bias |
| Slot parlor / other gambling (713290, state coefficient) | 22 | 1.06 (p = 0.65) | 0.33–2.70 | `jobsRange.json` |

Scope and assumptions:

- In total mode, the selected property type's range applies. In department mode, only the gaming stream carries a range: the gaming-department range (the slot-parlor range for slot parlors).
- The stand-alone range rests on eight cells and is narrow; treat it as a lower limit of the uncertainty.
- No range is shown in these cases:
  - Bars/restaurants with slots in total mode: there is no gaming-tavern benchmark.
  - Tribal properties: the Economic Census excludes most tribal casinos, and BEA records tribal gaming as a government enterprise.
  - Online operations.
  - User-entered jobs.
- Supplier and induced jobs have no observed benchmark and enter the range as modeled.
- Census receipts include non-gaming revenue, consistent with the total-revenue input; Census employment is the mid-March pay period. Census and QCEW agree on jobs per payroll dollar within 2–4% for casinos and casino hotels.
- The overstated compensation share is corrected by the gaming-tax adjustment of Section 2.7.

Replication: `kphilander/casino-io-validation`, scripts 15 (QCEW), 19 and 19b (Economic Census) and 19c (national rate); private until publication.

### 2.7 Gaming-Tax Adjustment of Direct Compensation

The Census comparison shows that the model's payroll share of casino revenue is too high, and more so where the gaming tax is high. Casino revenue includes the gaming tax, and a higher tax leaves a smaller share of revenue for labor. StateIO gives every state the national value-added composition of the sector, so the unadjusted coefficient cannot show this.

GEMS adjusts the direct compensation of land-based gaming revenue for the effective gaming tax rate τ:

```
adjusted direct compensation = model direct compensation × exp(−b τ)
```

- b = 0.916 (SE 0.333; 95% CI 0.22–1.61; p = 0.012) is the slope of a regression of log(model / observed payroll share of revenue) on τ.
- The sample is 23 Economic Census cells of stand-alone casinos and casino hotels in states with commercial casinos, each with at least 50 employees.
- The intercept (−0.024, p = 0.81) is not different from zero. The adjustment is therefore anchored at τ = 0, where the coefficient is unbiased.
- In leave-one-out prediction, the mean absolute log error of the payroll share falls from 0.26 to 0.147.
- Values: `webapp/src/data/payrollAdjustment.json`.

Application:

- τ is the effective rate the analysis applies to gaming revenue: the computed statutory or custom rate when GGR is entered, otherwise the state's blended effective rate. Tribal compact revenue shares are treated the same way, although tribal casinos are outside the estimation sample.
- Direct value added does not change. Direct jobs of commercial casinos fall with the tax rate through the national rate of Section 2.6, not through this adjustment.
- Direct value added and supplier purchases per revenue dollar are national values. At a high gaming tax rate, direct labor income, the gaming tax and other direct taxes together can be more than direct value added (at default inputs: Maryland, Pennsylvania, Rhode Island and West Virginia). Direct GDP is then possibly too low and supplier effects possibly too high. The calculator shows a note when this occurs (`gamingAccounts` in `webapp/src/engine/scenario.ts`); it does not change the estimates.
- Lower direct compensation lowers cash wages and the payroll and income taxes based on them.
- Induced effects scale with the change in direct plus supplier compensation. This is exact in the Type II model, where household spending is proportional to labor income.
- User-entered wages replace the adjusted value. The adjustment does not apply to online operators or to lodging, food and other revenue.

Replication: `kphilander/casino-io-validation`, script 19 (`analysis_output/output_side_payroll_adjustment.csv`).

### 2.8 Optional Modules

**Net new impact.** The headline results are a gross *economic contribution*. When enabled, GEMS also reports net new impact:

```
net share = non-resident revenue share + resident share × recapture share
```

The recapture share is the part of residents' gaming spending that would otherwise have left the state (for example, play at casinos across the border). The rest of resident spending is treated as displaced from other local businesses. Output, GDP, jobs and compensation are scaled by the net share, which is exact under the linear I-O model. Fiscal estimates remain gross. Neither figure accounts for social costs.

**Construction phase.** A one-time impact of building or expanding a property, using the state's StateIO construction (sector 23) response. Inputs are construction cost, the share spent in state (excluding land, gaming equipment and out-of-state purchases), and the build period. Jobs are **job-years** over the build period; the module also reports average annual jobs. Construction impacts are temporary and are reported separately from operating impacts.

**Complimentaries.** GGR (gross gaming win) includes the retail value of the rooms, meals, drinks and other items that a casino gives to players as complimentaries ("comps"). Casino financial statements under ASC 606 record that value as revenue of the department that provides it, and they report gaming revenue net of it. The Nevada Gaming Abstract, for example, shows "Complimentary Room Sales" in the rooms department and a negative "Contra Revenue (Complimentary Expense)" in the casino department. Without this input, GEMS models all of GGR as gaming output and models only the cash revenue entered for the other departments. When the user enters the comped value by receiving department (food and beverage, lodging, other; $M), GEMS changes the outputs as follows:

```
gaming stream output     = GGR − (comped food and beverage + comped lodging + comped other)
department d output      = cash revenue of d + comped value of d
gaming tax               = statutory schedule applied to GGR (unchanged)
```

Total revenue does not change. Only its split between the gambling coefficients and the food, lodging and other coefficients changes. The gaming tax still replaces the gaming share of the gaming stream's direct TOPI (Section 3.1), and that TOPI is now computed on the smaller gaming output. The gaming-tax adjustment of direct compensation (Section 2.7) still uses the effective rate on GGR. For commercial stand-alone casinos and casino hotels, the national rate for direct gaming jobs (Section 2.6) also uses the effective rate on GGR and applies to the smaller gaming output. The implied surplus of the gaming accounts compares value added on the net gaming output with the tax on GGR.

The input applies only to land-based revenue entered by department. If the comps entered exceed GGR, they are scaled down to GGR. When the fields are blank, results are identical to an analysis without the input. The Revenue Forecaster sends archetype-based estimates (`compFood`, `compLodging`, `compOther`).

Enter all of GGR as gaming revenue, not GGR less the comps; a net figure gives too low a gaming tax. Enter only the cash revenue of the other departments; department revenue that includes comps counts the comped value two times.

## 3. Tax Estimates

Every tax line is additive and is assigned to the federal or the state and local level; reports show both subtotals and the total.

### 3.1 Taxes on production and imports, and the statutory gaming tax

**TOPI** (taxes on production and imports) come from the I-O tables and flow through the Leontief inverse. They cover sales, property, excise, license and gross-receipts taxes paid by the operation and its supply chain.

BEA records state and local taxes on gaming receipts and admissions (Census "amusements" taxes) as taxes on products within TOPI, assigned to the amusement-and-gambling industry. StateIO gives every state the national TOPI intensity. Adding the statutory gaming tax to the I-O TOPI would therefore count gaming taxes twice.

GEMS lets the **statutory gaming tax replace** the gaming share of the gaming stream's direct TOPI:

```
Direct taxes on gaming = statutory gaming tax + nonGamingShare × I-O direct TOPI of the gaming stream
```

`nonGamingShare` = 0.346 is the share of BEA detail industry 713200's TOPI that is "other taxes on production" (property taxes, licenses) rather than taxes on products: $737M of $2,130M in the 2017 detail supply-use table. It is derived by `scripts/derive_gaming_topi_share.R` into `webapp/src/data/fiscalAssumptions.json`. Supplier and induced TOPI are unchanged.

The statutory gaming tax uses state schedules in `webapp/src/data/gamingTaxRates.json`. Supported structures:
- flat
- graduated tiers
- split by game type
- split-tiered
- a flat add-on on top of any schedule (`additionalRate`, e.g. Detroit's city wagering tax)
- handle-based taxes (`handleRate` with a stated hold)

Twenty-eight states were re-verified against statutes and regulator reports in October 2026; those entries record `lastVerified` and `sources` (`scripts/apply_verified_gaming_tax_2026.py`). The gaming tax requires an explicit gaming-revenue input: land-based total operating revenue is never treated as GGR.

**Tribal properties** pay compact revenue sharing rather than state gaming taxes and are largely exempt from state and local taxes on trust land. For them, the gaming stream's direct TOPI is replaced entirely by the revenue share entered as the custom rate.

### 3.2 Payroll and household income taxes

- **Payroll taxes** are applied per job:
  - **Federal:** employer and employee FICA Social Security (6.2% each, to the wage cap) and Medicare (1.45% each), and FUTA. The employee halves are withheld from wages and are federal revenue; they were left out before October 2026.
  - **State:** SUTA (unemployment insurance), plus employer SDI and PFML where they exist. Employee SDI and paid-leave contributions are not included.
- **Household income taxes** are calculated per worker. The average wage per job for each effect is taxed as the income of a single filer with no dependents, using 2025 federal and state schedules plus a typical local wage-tax rate where local income taxes are common.
  - The federal standard deduction is $15,750, under P.L. 119-21.
  - State schedules include phase-outs, recaptures and federal-tax deductions.
  - Tables by wage level are generated by `scripts/build_income_tax_tables.py` from the verified parameter file `data/income_tax_parameters_2025.json` (1,337 self-checks).
  - Ignored: household composition, refundable credits (EITC), itemized deductions, and the 2025–2028 federal deductions for tips and overtime.
  - This replaces a ratio of all personal taxes to wages, which overstated taxes at casino wage levels.

### 3.3 Wage basis

StateIO `V001` is BEA employee compensation. QCEW and payroll wages are lower for two reasons: employer supplements, and BEA's own adjustments to QCEW wages for unreported income, such as tips, which are large in gaming, lodging and food service and are not a tax base. GEMS converts compensation to QCEW-comparable wages by industry (`webapp/src/data/wageBasis.json`):

| Sector | QCEW private wages / BEA compensation, 2023 |
|---|---:|
| 713 Amusements, gambling and recreation | 0.698 |
| 721 Accommodation | 0.757 |
| 722 Food services and drinking places | 0.738 |
| 711–712 Arts and entertainment | 0.834 |
| 23 Construction | 0.821 |
| All private industries (supplier and induced effects; online operators) | 0.806 |

This replaces the earlier national NIPA wage share (0.814), which removes supplements only. User-entered payroll is treated as QCEW-comparable wages and grossed up to compensation with the same shares.

## 4. Data Sources

| Source | Vintage | Use |
|--------|---------|-----|
| EPA State Input-Output (StateIO) models, via the [`stateior`](https://github.com/USEPA/stateior) R package | 2019 and 2023 | 2019 state production structure; 2023 output/value-added denominators for employment |
| BLS Quarterly Census of Employment and Wages (QCEW) | 2023 annual averages | Filled-job numerators for employment coefficients and diagnostic earnings fields |
| BEA Detail IO Tables via `useeior` (USEEIOv2.0.1-411) | 2017 | National gambling/property-to-parent adjustment factors; versioned outputs in `bea_detail_coefficients.csv`, `blended_parent_coefficients.csv`, and `national_naics_ratios.csv` |
| State gaming commissions, AGA State of the States | Current | Gaming tax schedules |
| BLS CPI-U annual averages | 2019–2025 | Deflation of the revenue dollar year to 2023 |
| BEA NIPA Tables 6.2D/6.3D (via FRED) and QCEW 2023 private wages | 2023 | Compensation-to-wage conversion by industry |
| BEA NIPA Table 2.1 (via FRED: PCECA, A067RC1A027NBEA) and QCEW 2023 average private wages | 2000–2023 | Household spending share of compensation (Type II closure) |
| BEA 2017 detail supply-use table (via `useeior`) | 2017 | Non-gaming share of gambling TOPI |
| IRS Rev. Proc. 2024-40, P.L. 119-21, state 2025 tax instructions and statutes | 2025 | Household income tax tables |
| U.S. Census Bureau 2022 Economic Census (EC2271BASIC, EC2272BASIC) and QCEW 2023 | 2022–2023 | Validation of direct jobs; predictive ranges |

## 5. Sector and Property-Type Mapping

| IO Sector | NAICS | Casino Department |
|-----------|-------|-------------------|
| 711AS | 711, 712 | Other (entertainment, retail) |
| 713 | 713 | Gaming (GGR) |
| 721 | 721 | Lodging |
| 722 | 722 | Food & Beverage |

Construction-phase estimates use StateIO sector 23 (Construction). `construction_multipliers_2023.csv` is the R reference for these multipliers.

Property types: Casino Hotel (721120), Stand-alone Casino (713210), Slot Parlor (713290), Bar/Restaurant Gaming (722410), plus online casino and sports betting variants. All four land-based labels use the same canonical gambling production function. In department mode, separately entered lodging, food, and other revenue use StateIO 721, 722, and 711AS. In total mode, the full amount uses the gambling function and should be treated as an approximation when non-gaming revenue is material.

Legacy land-based total operating revenue is not treated as GGR for the statutory gaming tax, which requires an explicit gaming-revenue input in department mode. Online total revenue is GGR by construction.

## 6. Limitations and Appropriate Use

- Results are **estimates** based on average inter-industry relationships; they should be interpreted as indicative rather than definitive.
- The deployed model covers the 50 states, with 71 industries each, not the District of Columbia.
- Employment uses 2023 jobs/output and jobs/value-added satellites with a retained 2019 interindustry structure; it is a deliberate structural hybrid, not a mixed numerator/denominator coefficient.
- The national gambling ratios, employment coefficients, exported state tables, and offline integrity tests are versioned and reproducible. Script 08a downloads or reads the official BLS 2023 annual singlefile through `GEMS_QCEW_SINGLEFILE_ZIP` and uses exact, versioned StateIO mappings.
- QCEW has no compatible employment measure for StateIO's synthetic owner-occupied housing and government-enterprise sectors. `HS`, `GFE`, and `GSLE` therefore use explicit zero satellite coefficients rather than average-sector imputations; public-administration sectors use disclosed ownership proxies.
- Online multipliers are approximations. Direct online labor intensity may be adjusted from operator data, but supplier and induced job intensities should reflect the industries where those effects occur rather than inherit the direct operator ratio.
- State-level analysis captures only impacts within the state boundary; spending that leaks to other states is excluded.
- The model is appropriate for policy analysis, planning, and comparative assessment. It is **not** appropriate for precise forecasting, investment decisions without professional advice, or legal proceedings.
- IO models assume fixed production technology and no supply constraints; very large projects may alter local economic structure in ways the model does not capture.
- Direct jobs per revenue dollar are the same for small and large properties. Large casinos have fewer jobs per revenue dollar than small ones (Section 2.6); enter observed jobs where they are known.
- Indirect and induced effects cannot be validated against observation without circularity: no agency measures them, and published "total impact" figures are themselves model output. Only the direct jobs coefficient is checked against observed data (Section 2.6).
- The direct value-added, compensation and TOPI coefficients in the StateIO summary tables are national constants within each sector; state variation in modeled labor intensity comes from jobs per output.

## 7. Versioning

The model version is the release edition year (e.g., GEMS 2026). When a new edition is published — whether from regenerated datasets or methodology updates — the version is bumped and this document is updated. The calculator's Method view lists the data files behind every result, with checksums, and a share link records every input of an analysis, so results remain traceable.

### Version History

| Version | Released | Notes |
|---------|----------|-------|
| GEMS 2026 | 2026 | Initial release. 2019 EPA StateIO multipliers, 2023 QCEW employment, USEEIOv2.0.1-411 gambling adjustments. |
| GEMS 2026 (methodology update) | October 2026 | Direct jobs validated against the Economic Census, with predictive ranges; tribal ownership option; statutory gaming tax replaces the gaming share of direct TOPI; 28 states' gaming taxes re-verified; per-worker 2025 income taxes; industry wage basis; payroll taxes by level of government; revenue dollar-year input; net-impact and construction-phase modules. |
| GEMS 2026 (calculator rebuild) | October 2026 | Calculator rebuilt in TypeScript; the regional model is computed in the browser from the StateIO tables and tested against the R pipeline; gaming-tax adjustment of direct compensation; supplier and induced jobs by industry; report exports and licensing removed. |
| GEMS 2026 (household closure) | October 2026 | Households spend the share of compensation that remains after payroll and income taxes and saving (Section 2.1), not all in-state consumption per dollar of compensation. Induced effects are lower; Type II output about 20% lower. Sensitivity view shows a low and high spending share. |
| GEMS 2026 (employee FICA) | October 2026 | Federal payroll taxes include the employee halves of Social Security and Medicare. |
| GEMS 2026 (jobs satellite corrections) | November 2026 | 2023 retail output divided among the four retail sectors by 2019 shares; national jobs per dollar of output where QCEW does not disclose a state-sector cell; a slot share of 0% is accepted; note where the gaming tax, labor income and other direct taxes are more than direct value added. Supplier and induced jobs changed slightly (Section 2.3). |
| GEMS 2026 (national gaming jobs rate) | November 2026 | Direct gaming jobs of commercial stand-alone casinos and casino hotels use a national rate that falls with the gaming tax rate, 4.57 × exp(−0.992 τ) jobs per $1M, in place of the state gambling coefficient (Section 2.6). Predictive ranges re-estimated. |
| GEMS 2026 (complimentaries) | November 2026 | Optional comped value by receiving department: the gaming stream's output is GGR less the comps, each department's output is its cash revenue plus its comps, and the gaming tax stays on GGR (Section 2.8). A Revenue Forecaster link can carry the dollar year, the slot share of GGR and the comped value by department. |

## 8. Key References

- Leontief, W. (1936). Quantitative input and output relations in the economic systems of the United States. *The Review of Economics and Statistics*, 18(3), 105–125.
- Miller, R. E., & Blair, P. D. (2009). *Input-Output Analysis: Foundations and Extensions* (2nd ed.). Cambridge University Press.
- Ingwersen, W., et al. USEPA `stateior` and `useeior` R packages.
