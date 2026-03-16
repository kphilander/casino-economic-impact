# Online Gambling Multiplier Methodology

## Why This Is Hard

The BEA Input-Output tables — the foundation of all RIMS II and StateIO economic impact modeling — do not distinguish online gambling from land-based gambling. Both fall under **NAICS 7132 (Gambling Industries)**, which maps to **IO sector 713** (Amusement, Gambling, and Recreation) at the summary level. There is no IO sector for "online casino operator."

This document records the due diligence conducted to determine the best available approach for modeling the economic impact of online gambling (iGaming and sports betting) operations.

---

## Option 1: Use IO Sector 514 (Data Processing, Internet Publishing)

Online gambling platforms are technology companies — they run on cloud infrastructure, employ software engineers, and process payments digitally. NAICS 518/519 maps to **IO sector 514** ("Data processing, internet publishing, and other information services"). This was the first candidate considered.

### Sector 514 Coefficients (StateIO 2019, Nevada)

| Metric | 514 | 713 (Gambling blend) | Our Online-Adj 7132 |
|---|---|---|---|
| Direct VA Coefficient | 1.006 | 0.356 | 0.473 |
| Direct Wage Coefficient | 0.312 | 0.219 | 0.126 |
| Direct TOPI Coefficient | **0.671** | 0.085 | 0.052 |
| Type II Output Multiplier | 1.355 | 1.128 | 1.763 |
| Type II GDP Multiplier | 1.228 | 0.430 | 0.908 |
| Type II Wage Multiplier | 0.436 | 0.261 | 0.289 |

### Problems with Sector 514

1. **TOPI coefficient of 0.67 is disqualifying.** Sector 514 carries an extraordinarily high tax-on-production coefficient because it includes telecommunications and internet service providers subject to FCC fees, state telecom taxes, and gross receipts taxes on data services. Online gambling operators pay gaming taxes (modeled separately) but are not subject to telecom-specific production taxes. Applying 514's TOPI would massively overstate the production tax burden.

2. **VA coefficient near 1.0 is unrealistic for online gambling.** A VA coefficient of ~1.0 means nearly all output is value-added (minimal intermediate purchases). This reflects data center and hosting companies with high gross margins. Online gambling operators have substantial intermediate costs: payment processing fees (~2-5% of handle), platform licensing, third-party odds feeds, identity verification services, and state-mandated responsible gambling tools. A VA coefficient of ~0.47-0.55 is more realistic based on operator financials.

3. **Wage coefficient of 0.31 overstates labor intensity.** Sector 514 employs ~3-4 workers per $1M revenue across its full mix (data centers, hosting, web portals). Online gambling operators employ ~1.0 per $1M (DraftKings: 1.07, Rush Street Interactive: 0.96). Using 514's wage coefficient would overstate direct wage impact by roughly 2.5x.

4. **Supply chain structure is wrong.** Sector 514's intermediate purchases flow to telecom equipment, real estate, and utilities (data center power). Online gambling's intermediate purchases flow to payment processing, marketing/advertising, and software licensing — a fundamentally different supply chain with different geographic leakage patterns.

### Other Information Sectors Considered

All available information and technology sectors at the BEA Summary IO level were evaluated (Nevada, StateIO 2019):

| Sector | Label | VA Coef | Wage Coef | TOPI | TII Wage |
|---|---|---|---|---|---|
| 5415 | Computer Systems Design | 0.530 | 0.442 | 0.077 | 0.481 |
| 511 | Publishing (ex Internet) | 0.679 | 0.369 | 0.295 | 0.421 |
| 514 | Data Proc/Internet Pub | 1.006 | 0.312 | 0.671 | 0.436 |
| 513 | Broadcasting/Telecom | 0.619 | 0.150 | 0.413 | 0.233 |
| 512 | Motion Picture/Sound | 0.525 | 0.237 | 0.243 | 0.305 |

**5415 (Computer Systems Design)** has the most plausible wage structure for a tech-heavy operator (wage coef 0.44, low TOPI), but represents consulting/services firms (Accenture, Cognizant), not platform operators. Its supply chain structure reflects labor-for-hire, not the payment-processing and marketing-heavy purchasing patterns of an online gambling company.

**No summary IO sector maps cleanly to an online gambling operator.** Every candidate would require its own set of ad-hoc adjustment factors — which puts you in the same methodological position as adjusting 7132, just with a less defensible starting point.

---

## Option 2 (Chosen): Adjust 7132 Gambling Multipliers with SEC Filing Data

### Rationale

Since NAICS classifies online gambling under 7132 regardless, and the BEA Detail IO tables provide gambling-specific coefficients (used in `12_gambling_specific_data.R` to adjust the blended 713 sector), the most defensible approach is to start with the existing 7132 gambling-adjusted multipliers and apply a second layer of adjustment factors derived from public company financial data.

This preserves the **correct supply chain structure** (the Leontief inverse for gambling, which captures how gambling industry purchases ripple through the economy) while correcting the **direct coefficients** (wages, employment, VA) that differ most between online and land-based operations.

### Adjustment Factors

| Factor | 7132 Value | Online Estimate | Ratio | Source |
|---|---|---|---|---|
| Wage coefficient | 0.255 | ~0.14 | 0.55 | Cash comp as % of revenue from SEC filings |
| VA coefficient | 0.577 | ~0.50-0.55 | 0.90 | Online platforms have lower VA due to intermediate costs |
| Employment per $1M GDP | ~5.0 jobs | ~1.0 job | 0.23 | SEC filing employee counts / revenue |
| TOPI coefficient | 0.035 | ~0.035 | 1.0 | Similar production tax treatment |
| Output multiplier (indirect) | — | — | 0.85 | Online supply chains leak more out-of-state |
| Wage multiplier (indirect) | — | — | 0.80 | Tech supply chains are less labor-intensive |

### Employment Data Sources (Verified Against SEC 10-K Filings)

| Operator | Employees | Revenue | Emp/$1M Rev | Source |
|---|---|---|---|---|
| DraftKings | 5,100 | $4.77B | 1.07 | 10-K FY2024, filed 2025-02-14 (CIK 0001883685) |
| Rush Street Interactive | 883 | $924M | 0.96 | 10-K FY2024, filed 2025-02-28 (CIK 0001793659) |
| **Average** | | | **1.01** | |
| Land-based average (AGA) | 332,000 | $66B | 5.03 | AGA State of the States 2022 |

**BetMGM** was initially included but removed from calculations. As a joint venture between MGM Resorts and Entain, its reported ~1,400 employees understates the true workforce supporting $2.1B in revenue — Entain provides the technology platform and MGM provides brand/marketing infrastructure, both on parent company payrolls. Its 0.67 emp/$1M figure is unreliable. RSI, as a standalone public company, confirms the DraftKings ratio.

**Flutter/FanDuel** (27,345 employees / $14.05B revenue) was used as contextual reference but excluded from the average because its global workforce includes non-US operations (Paddy Power, Betfair, international markets) that are not comparable to a US-only online gambling operator.

### Known Limitations

1. **Geographic mismatch is the most significant limitation.** IO multipliers assume the economic activity (employment, wages, supply chain purchases) occurs in the state where the model is applied. For land-based casinos this holds — the building, employees, and suppliers are physically in-state. For online operators, it often does not. DraftKings generates GGR in Indiana but employs most of its 5,100 workers in Massachusetts. If an analyst selects "Indiana" and enters DraftKings' Indiana GGR, the model will estimate jobs and wages as if those workers were in Indiana. In reality, Indiana receives gaming tax revenue while the employment, wage, and supply chain effects largely accrue to Massachusetts (and other states where the operator has offices). **Users should select the state where the operator's workforce is located, or enter actual in-state employment as known data.** The gaming tax estimate is valid regardless of location — it flows to the state where bettors are.

2. **Wage coefficient excludes stock-based compensation.** Online operators (especially DraftKings) issue significant equity grants to tech employees. SBC could add 8-10 percentage points of revenue to true compensation costs. The IO framework's "compensation of employees" (V001) also excludes SBC, so this is internally consistent but understates total worker compensation for policy purposes.

3. **Indirect/induced effects use gambling supply chain structure.** The Leontief inverse for 7132 reflects land-based gambling's purchasing patterns (food distributors, hospitality suppliers, construction). Online operators buy from different suppliers (cloud hosting, payment processors, ad networks). The 0.85 output multiplier ratio is an approximate correction, not a re-derivation of the supply chain.

4. **Online operators have a single revenue stream.** Unlike land-based casinos with genuinely separate revenue from hotels (NAICS 721), restaurants (NAICS 722), and entertainment, online operators have one revenue stream: gross gaming revenue (GGR). Marketing, technology, and other operational costs are expenses funded by GGR, not independent revenue streams. The model treats online operations as GGR-only to avoid double-counting.

5. **Two SEC filings is a thin evidence base.** The employment ratio is anchored on two companies. As more online-only operators go public or disclose detailed employment data, this should be revisited.

---

## Recommendation for Users

For the most accurate results when modeling online gambling operations:

1. **Choose the state where the operator's workforce is located**, not necessarily where bettors are. If modeling the impact of GGR from a specific bettor state, use only the gaming tax estimate — the multiplier effects belong to the operator's home state.
2. **Enter actual in-state employment and wage data** as "known data" overrides whenever available. This bypasses the estimated coefficients entirely for direct effects and resolves the geographic mismatch problem.
3. **Treat indirect and induced effects as approximate.** The gambling industry supply chain structure is a reasonable but imperfect proxy for online operations.
4. **Do not add marketing, technology, or other operational costs as separate revenue streams.** These are expenses funded by GGR, not additional economic activity.

---

## Files Implementing This Methodology

| File | Role |
|---|---|
| `14_online_gambling_multipliers.R` | Applies adjustment factors to 7132 base multipliers |
| `online_gambling_multipliers_2023.csv` | 50-state online-adjusted multiplier dataset |
| `webapp/src/data/multipliers.json` | Frontend data (`onlineGaming` section) |
| `webapp/src/utils/calculations.js` | Online multiplier lookup and GGR-only revenue handling |
| `webapp/src/App.jsx` | Conditional UI for online property types |
