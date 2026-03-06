#!/usr/bin/env python3
"""
Update gaming tax rates with verified data from state gaming commissions,
AGA State of the States 2025, and state statutes.

Sources:
- Illinois Gaming Board FAQ (igb.illinois.gov)
- Casino Association of Indiana (casinoassociation.org)
- Colorado General Assembly gaming tax page
- Virginia Code § 58.1-4124
- Mississippi Department of Revenue
- AGA State of the States 2025
- Individual state gaming commission websites
"""

import json

with open('gaming_tax_rates_frontend.json') as f:
    data = json.load(f)

rates = data['rates']

# ============================================================================
# VERIFIED CORRECTIONS
# ============================================================================

# --- ILLINOIS ---
# Source: Illinois Gaming Board FAQ, effective July 1, 2020
# CRITICAL: Illinois has SEPARATE schedules for slots and tables
rates['Illinois'] = {
    'abbrev': 'IL',
    'hasCommercial': True,
    'hasTribal': False,
    'rateStructure': 'split_tiered',  # Both game-type split AND tiered
    'slotTableSplit': True,
    'effectiveRate': 0.40,  # Blended estimate for large casino
    'slotTiers': [
        {'threshold': 0, 'rate': 0.15},
        {'threshold': 25, 'rate': 0.225},
        {'threshold': 50, 'rate': 0.275},
        {'threshold': 75, 'rate': 0.325},
        {'threshold': 100, 'rate': 0.375},
        {'threshold': 150, 'rate': 0.45},
        {'threshold': 200, 'rate': 0.50}
    ],
    'tableTiers': [
        {'threshold': 0, 'rate': 0.15},
        {'threshold': 25, 'rate': 0.20}
    ],
    'localTaxNotes': 'Admissions tax of $2-$5 per patron depending on annual volume. $1/admission to local governments. Chicago casino faces additional 3.5% privilege tax on top of graduated state tax.',
    'description': 'Graduated tax on AGR. Slots: 15%-50% across 7 tiers. Table games: 15% up to $25M, 20% above. Chicago casino has additional surcharges.',
    'sourceYear': 2025
}

# --- PENNSYLVANIA ---
# Source: AGA Gaming Regulatory Fact Sheet 2025, PA Gaming Control Board
rates['Pennsylvania'] = {
    'abbrev': 'PA',
    'hasCommercial': True,
    'hasTribal': False,
    'rateStructure': 'split_game_type',
    'slotTableSplit': True,
    'slotsRate': 0.55,  # Corrected from 0.54 to 55%
    'tableRate': 0.16,
    'effectiveRate': 0.41,  # ~65% slots / 35% tables blend
    'localTaxNotes': 'Host municipalities receive 2% of slot revenue and 2% of table game revenue (included in state rates). Additional 2% local share on slots. Economic development/tourism fund gets 5% of slots.',
    'description': '55% on slot machine revenue, 16% on table game revenue. Highest slot tax rate in the US for full-scale commercial casinos. iGaming taxed at same rates.',
    'sourceYear': 2025
}

# --- INDIANA ---
# Source: Casino Association of Indiana, IN Gaming Commission
rates['Indiana'] = {
    'abbrev': 'IN',
    'hasCommercial': True,
    'hasTribal': False,
    'rateStructure': 'tiered',
    'slotTableSplit': False,
    'tiers': [
        {'threshold': 0, 'rate': 0.15},      # $0-$25M (5% if prior year <$75M)
        {'threshold': 25, 'rate': 0.20},     # $25-$50M
        {'threshold': 50, 'rate': 0.25},     # $50-$75M
        {'threshold': 75, 'rate': 0.30},     # $75-$150M
        {'threshold': 150, 'rate': 0.35},    # $150-$600M
        {'threshold': 600, 'rate': 0.40}     # $600M+
    ],
    'effectiveRate': 0.32,
    'localTaxNotes': 'Supplemental admission tax of $3 per person ($1 each to state, host city, host county). 25% of graduated wagering tax goes to host city. Casinos with prior year AGR <$75M pay 5% on first $25M instead of 15%.',
    'description': 'Graduated tax on AGR: 15%-40% across 6 tiers. Supplemental $3/person admission tax. 25% of wagering tax to host city.',
    'sourceYear': 2025
}

# --- COLORADO ---
# Source: Colorado General Assembly gaming tax page, effective July 1, 2012
rates['Colorado'] = {
    'abbrev': 'CO',
    'hasCommercial': True,
    'hasTribal': True,
    'rateStructure': 'tiered',
    'slotTableSplit': False,
    'tiers': [
        {'threshold': 0, 'rate': 0.0025},    # $0-$2M: 0.25%
        {'threshold': 2, 'rate': 0.02},       # $2-$5M: 2%
        {'threshold': 5, 'rate': 0.09},       # $5-$8M: 9%
        {'threshold': 8, 'rate': 0.11},       # $8-$10M: 11%
        {'threshold': 10, 'rate': 0.16},      # $10-$13M: 16%
        {'threshold': 13, 'rate': 0.20}       # $13M+: 20%
    ],
    'effectiveRate': 0.185,
    'localTaxNotes': 'Revenue distributed to state general fund, local gaming cities, and community colleges. Commission may set rates up to 40% maximum.',
    'description': 'Graduated tax on adjusted gross proceeds: 0.25%-20% across 6 tiers. Amendment 77 (2020) expanded bet limits. Max statutory rate is 40%.',
    'sourceYear': 2025
}

# --- VIRGINIA ---
# Source: Virginia Code § 58.1-4124
rates['Virginia'] = {
    'abbrev': 'VA',
    'hasCommercial': True,
    'hasTribal': False,
    'rateStructure': 'tiered',
    'slotTableSplit': False,
    'tiers': [
        {'threshold': 0, 'rate': 0.18},      # $0-$200M: 18%
        {'threshold': 200, 'rate': 0.23},     # $200-$400M: 23%
        {'threshold': 400, 'rate': 0.30}      # $400M+: 30%
    ],
    'effectiveRate': 0.18,  # Most casinos under $200M currently
    'localTaxNotes': 'Virginia Indian tribe casinos pay additional 1% to Virginia Indigenous Peoples Trust Fund. Host localities receive negotiated payments.',
    'description': 'Graduated tax on adjusted gross receipts: 18% on first $200M, 23% on $200-400M, 30% above $400M per calendar year.',
    'sourceYear': 2025
}

# --- IOWA ---
# Source: Iowa Code 99F.11, SF 169 (tax cut enacted 2024)
# Phased reduction: 22% → 21% (FY2025) → 20% (FY2026) → 19% (FY2027)
rates['Iowa'] = {
    'abbrev': 'IA',
    'hasCommercial': True,
    'hasTribal': True,
    'rateStructure': 'tiered',
    'slotTableSplit': False,
    'tiers': [
        {'threshold': 0, 'rate': 0.05},     # $0-$1M: 5%
        {'threshold': 1, 'rate': 0.10},      # $1-$3M: 10%
        {'threshold': 3, 'rate': 0.20}       # $3M+: 20% (FY2026, phasing from 22%)
    ],
    'effectiveRate': 0.20,  # Nearly all revenue in top bracket
    'localTaxNotes': 'Tax cut enacted 2024: rate dropping from 22% to 19% over 3 years (FY2025: 21%, FY2026: 20%, FY2027: 19%). Sports wagering taxed at 6.75%.',
    'description': 'Graduated tax: 5% on first $1M, 10% on $1-3M, top rate phasing from 22% to 19% (currently 20% for FY2026). Nearly all revenue hits top bracket.',
    'sourceYear': 2025
}

# --- MISSISSIPPI ---
# Source: Mississippi Department of Revenue, MS Gaming Commission
# IMPORTANT: Mississippi uses MONTHLY thresholds, not annual
rates['Mississippi'] = {
    'abbrev': 'MS',
    'hasCommercial': True,
    'hasTribal': True,
    'rateStructure': 'tiered',
    'slotTableSplit': False,
    'tiers': [
        # Monthly thresholds converted to approximate annual (×12) for the calculator
        {'threshold': 0, 'rate': 0.04},       # $0-$0.6M/yr (< $50K/mo): 4%
        {'threshold': 0.6, 'rate': 0.06},     # $0.6-$1.608M/yr ($50-134K/mo): 6%
        {'threshold': 1.608, 'rate': 0.08}    # $1.608M+/yr (>$134K/mo): 8%
    ],
    'effectiveRate': 0.12,  # 8% state + ~3.2% local + 0.8% local = ~12%
    'localTaxNotes': 'Local graduated tax adds: 0.4% on GGR $0-$50K/mo, 3.2% on $50K-$134K/mo, 4% on >$134K/mo. Combined effective rate approximately 12% for large casinos. Note: Mississippi uses MONTHLY thresholds.',
    'description': 'Graduated state tax computed monthly: 4% up to $50K, 6% on $50-134K, 8% above $134K per month. Local taxes add ~4%, bringing total to ~12%.',
    'sourceYear': 2025
}

# --- NEW YORK ---
# Source: NY Gaming Facility Location Board, AGA
rates['New York'] = {
    'abbrev': 'NY',
    'hasCommercial': True,
    'hasTribal': True,
    'rateStructure': 'split_game_type',
    'slotTableSplit': True,
    'slotsRate': 0.30,    # Upstate commercial casinos (not VLTs)
    'tableRate': 0.10,
    'effectiveRate': 0.37,  # Blended with heavy slot weighting
    'localTaxNotes': 'VLT/racino facilities pay ~38.5-56% on VLTs (state retains larger share). Upstate commercial casinos: 30% slots/ETGs, 10% table games. Downstate licenses (pending): minimum 25% slots, 10% tables — bidders proposing 25-56%.',
    'description': 'Upstate commercial casinos: 30% on slots/ETGs, 10% on table games. VLT/racino facilities pay much higher rates. Three downstate licenses pending with rates TBD.',
    'sourceYear': 2025
}

# --- WEST VIRGINIA ---
# Source: WV Code §29-22C-26, §29-25-21
rates['West Virginia'] = {
    'abbrev': 'WV',
    'hasCommercial': True,
    'hasTribal': False,
    'rateStructure': 'split_game_type',
    'slotTableSplit': True,
    'slotsRate': 0.535,   # 53.5% state share on VLTs (operator retains 46.5%)
    'tableRate': 0.35,    # 35% on table game AGR
    'effectiveRate': 0.47,  # Heavy VLT weighting
    'localTaxNotes': 'Limited video lottery (LVL) facilities pay 50% on net terminal income. iGaming taxed at 15% of GGR.',
    'description': 'VLTs: state retains 53.5% of net terminal income. Table games: 35% tax on AGR. iGaming: 15%. Limited video lottery: 50%.',
    'sourceYear': 2025
}

# --- NEVADA ---
# Source: NRS 463.370, confirmed stable
rates['Nevada']['flatRate'] = 0.0675
rates['Nevada']['effectiveRate'] = 0.0675
rates['Nevada']['sourceYear'] = 2025
rates['Nevada']['description'] = '6.75% of GGR on all game types. Lowest rate among major gaming states.'

# --- NEW JERSEY ---
# Source: N.J.S.A. 5:12-144
rates['New Jersey']['flatRate'] = 0.0975  # 8.5% + 1.25% invest + varies community
rates['New Jersey']['effectiveRate'] = 0.0975
rates['New Jersey']['sourceYear'] = 2025
rates['New Jersey']['description'] = '8.5% state GGR tax, plus 1.25% investment alternative tax, plus community investment alternative (~2.5%). Total ~12.25%. iGaming: 17.5% + 2.5% CRA.'

# --- MICHIGAN ---
# Source: AGA, Michigan Gaming Control Board
rates['Michigan']['flatRate'] = 0.0835
rates['Michigan']['effectiveRate'] = 0.193  # 8.35% state + 10.9% Detroit city
rates['Michigan']['sourceYear'] = 2025
rates['Michigan']['localTaxNotes'] = 'Detroit casinos pay 8.35% state tax plus 10.9% city wagering tax plus 1.25% development agreement tax. Total effective rate ~20.5% for Detroit casinos.'
rates['Michigan']['description'] = '8.35% state tax on AGR. Detroit casinos also pay 10.9% city wagering tax + 1.25% development agreement. Total ~20.5% for Detroit.'

# --- OHIO ---
rates['Ohio']['flatRate'] = 0.33
rates['Ohio']['effectiveRate'] = 0.33
rates['Ohio']['sourceYear'] = 2025
rates['Ohio']['description'] = '33% of GGR for commercial casinos. Racinos (VLTs) at racetracks have different structure.'

# --- MISSOURI ---
rates['Missouri']['flatRate'] = 0.21
rates['Missouri']['effectiveRate'] = 0.21
rates['Missouri']['sourceYear'] = 2025
rates['Missouri']['localTaxNotes'] = 'Plus $2 per person admission fee. Portion of tax revenue to education, local governments.'
rates['Missouri']['description'] = '21% of AGR. Plus $2/person admission fee.'

# --- LOUISIANA ---
rates['Louisiana']['flatRate'] = 0.215
rates['Louisiana']['effectiveRate'] = 0.215
rates['Louisiana']['sourceYear'] = 2025
rates['Louisiana']['localTaxNotes'] = 'Riverboat casinos: 21.5% of net gaming revenue. Land-based (New Orleans): negotiated rate. Racino slot machines: 36.5%.'
rates['Louisiana']['description'] = '21.5% on riverboat casino net gaming revenue. Racino slots at 36.5%. Land-based Harrahs New Orleans has separate agreement.'

# --- SOUTH DAKOTA ---
rates['South Dakota']['flatRate'] = 0.09
rates['South Dakota']['effectiveRate'] = 0.09
rates['South Dakota']['sourceYear'] = 2025
rates['South Dakota']['description'] = '9% of adjusted GGR. Deadwood casinos only.'

# --- ARKANSAS ---
# Source: Arkansas DFA Casino Gaming Section, Amendment 100
rates['Arkansas'] = {
    'abbrev': 'AR',
    'hasCommercial': True,
    'hasTribal': False,
    'rateStructure': 'tiered',
    'slotTableSplit': False,
    'tiers': [
        {'threshold': 0, 'rate': 0.13},      # $0-$150M: 13%
        {'threshold': 150, 'rate': 0.20}     # $150M+: 20%
    ],
    'effectiveRate': 0.13,  # Most casinos under $150M
    'localTaxNotes': 'Tax revenue distributed to state general revenue, host city/county, and Arkansas Racing Commission.',
    'description': '13% on first $150M of net casino gaming receipts, 20% above $150M (Amendment 100 of 2018).',
    'sourceYear': 2025
}

# --- CONNECTICUT ---
rates['Connecticut'] = {
    'abbrev': 'CT',
    'hasCommercial': False,
    'hasTribal': True,
    'rateStructure': 'tribal_compact',
    'slotTableSplit': False,
    'effectiveRate': 0.25,
    'localTaxNotes': 'Mohegan Sun and Foxwoods pay 25% of slot machine revenue to the state under their tribal-state compacts. No tax on table game revenue.',
    'description': '25% of slot machine revenue under tribal compact (Mohegan Sun, Foxwoods). No payment on table game revenue.',
    'sourceYear': 2025
}

# --- DELAWARE ---
rates['Delaware'] = {
    'abbrev': 'DE',
    'hasCommercial': True,
    'hasTribal': False,
    'rateStructure': 'split_game_type',
    'slotTableSplit': True,
    'slotsRate': 0.435,    # State share on VLTs
    'tableRate': 0.155,    # 15.5% on table games
    'effectiveRate': 0.375,
    'localTaxNotes': 'State-operated gaming through Delaware Lottery. Three racinos: Delaware Park, Dover Downs, Harrington Raceway.',
    'description': 'State-operated: 43.5% state share on VLTs, 15.5% on table games. Operated through Delaware Lottery at three racino facilities.',
    'sourceYear': 2025
}

# --- MARYLAND ---
rates['Maryland'] = {
    'abbrev': 'MD',
    'hasCommercial': True,
    'hasTribal': False,
    'rateStructure': 'split_game_type',
    'slotTableSplit': True,
    'slotsRate': 0.40,     # Base rate (varies 40-61% by facility)
    'tableRate': 0.20,
    'effectiveRate': 0.40,
    'localTaxNotes': 'Slot rates vary by facility: MGM National Harbor 61%, Live! Casino 61%, Horseshoe Baltimore 61%, Hollywood Perryville 40%, Ocean Downs 40%, Rocky Gap 40%. Table games uniform at 20%.',
    'description': 'Slot rates: 40-61% depending on facility (larger Baltimore-area facilities pay 61%). Table games: 20%. Rates vary by facility license terms.',
    'sourceYear': 2025
}

# --- RHODE ISLAND ---
rates['Rhode Island'] = {
    'abbrev': 'RI',
    'hasCommercial': True,
    'hasTribal': False,
    'rateStructure': 'state_operated',
    'slotTableSplit': False,
    'effectiveRate': 0.51,
    'localTaxNotes': 'State-operated through RI Lottery at Twin River (Bally\'s) and Tiverton Casino. State retains ~61% of VLT net revenue. Table games revenue split is different.',
    'description': 'State-operated gaming. State retains approximately 61% of VLT net terminal revenue. Two facilities: Bally\'s Twin River and Tiverton Casino.',
    'sourceYear': 2025
}

# --- MAINE ---
rates['Maine'] = {
    'abbrev': 'ME',
    'hasCommercial': True,
    'hasTribal': True,
    'rateStructure': 'split_by_facility',
    'slotTableSplit': False,
    'effectiveRate': 0.39,
    'localTaxNotes': 'Oxford Casino: ~46% on slot revenue. Bangor (Hollywood Casino): ~39% on slot revenue. Rates differ by facility.',
    'description': 'Facility-specific rates: Oxford Casino ~46% on slots, Hollywood Casino Bangor ~39% on slots. Two commercial casinos.',
    'sourceYear': 2025
}

# --- MASSACHUSETTS ---
rates['Massachusetts'] = {
    'abbrev': 'MA',
    'hasCommercial': True,
    'hasTribal': True,
    'rateStructure': 'split_by_license',
    'slotTableSplit': False,
    'effectiveRate': 0.25,
    'localTaxNotes': 'Category 1 (resort casino, e.g., Encore Boston Harbor): 25% of GGR. Category 2 (slots-only, e.g., Plainridge Park): 49% of GGR.',
    'description': 'Category 1 resort casino: 25% of GGR. Category 2 slots-only facility: 49% of GGR.',
    'sourceYear': 2025
}

# --- KANSAS ---
rates['Kansas'] = {
    'abbrev': 'KS',
    'hasCommercial': True,
    'hasTribal': True,
    'rateStructure': 'flat',
    'slotTableSplit': False,
    'flatRate': 0.27,
    'effectiveRate': 0.27,
    'localTaxNotes': 'State-owned casinos managed by private operators. 27% privilege fee on gross gaming revenue. Additional 3% to Problem Gambling and Addictions Grant Fund.',
    'description': '27% privilege fee on GGR at four state-owned casinos managed by private operators.',
    'sourceYear': 2025
}

# --- NEBRASKA ---
rates['Nebraska'] = {
    'abbrev': 'NE',
    'hasCommercial': True,
    'hasTribal': True,
    'rateStructure': 'flat',
    'slotTableSplit': False,
    'flatRate': 0.20,
    'effectiveRate': 0.20,
    'localTaxNotes': 'New market authorized by voter initiative in 2020. Casinos at licensed horse racetracks. 70% of tax revenue to property tax relief, 30% to compulsive gamblers assistance.',
    'description': '20% of GGR. New market (2020), casinos at licensed horse racetracks.',
    'sourceYear': 2025
}

# --- KENTUCKY ---
# Source: No commercial casinos yet. HHR machines are regulated differently.
# HB 33 proposes 21% commercial casino tax but not yet enacted.
rates['Kentucky'] = {
    'abbrev': 'KY',
    'hasCommercial': False,  # HHR machines are NOT traditional commercial casinos
    'hasTribal': False,
    'rateStructure': 'none',
    'slotTableSplit': False,
    'effectiveRate': 0.0,
    'localTaxNotes': 'Historical Horse Racing (HHR) machines are legal but taxed at ~1.5% of handle (not GGR). HB 33 proposes commercial casino legalization at 21% GGR tax but has not been enacted. Sports betting: 9.75% retail, 14.25% online.',
    'description': 'No commercial casino gaming. HHR slot machines taxed at ~1.5% of handle. Sports betting authorized 2023 (HB 551). Casino legislation (HB 33 at 21%) proposed but not enacted.',
    'sourceYear': 2025
}

# --- ARIZONA ---
rates['Arizona'] = {
    'abbrev': 'AZ',
    'hasCommercial': False,
    'hasTribal': True,
    'rateStructure': 'tribal_compact',
    'slotTableSplit': False,
    'tiers': [
        {'threshold': 0, 'rate': 0.01},
        {'threshold': 25, 'rate': 0.03},
        {'threshold': 75, 'rate': 0.06},
        {'threshold': 100, 'rate': 0.08}
    ],
    'effectiveRate': 0.08,
    'localTaxNotes': 'Tribal gaming only. Revenue sharing under Proposition 202 compacts. Graduated 1-8% depending on class III net win.',
    'description': 'Tribal compacts: graduated revenue sharing 1%-8% of class III gaming device net win. Rates vary by volume.',
    'sourceYear': 2025
}

# ============================================================================
# Update metadata
# ============================================================================
data['metadata']['sourceYear'] = '2025 (verified March 2026)'
data['metadata']['notes'].append(
    'Rates verified against state gaming commission websites, AGA State of the States 2025, and state statutes in March 2026.'
)

# Save
with open('gaming_tax_rates_frontend.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f"Updated {len(rates)} states")

# Print summary of rate structures
from collections import Counter
structs = Counter(v.get('rateStructure', 'unknown') for v in rates.values())
print(f"\nRate structures: {dict(structs)}")

# Print verified rates table
print(f"\n{'State':<20} {'Structure':<20} {'Effective':<10} {'Detail'}")
print("-" * 90)
for state_name in sorted(rates.keys()):
    r = rates[state_name]
    if not r.get('hasCommercial') and r.get('rateStructure') not in ('tribal_compact',):
        continue
    eff = f"{r.get('effectiveRate', 0)*100:.1f}%"
    struct = r.get('rateStructure', 'none')
    detail = ''
    if struct == 'tiered' and 'tiers' in r:
        tiers = r['tiers']
        detail = f"{tiers[0]['rate']*100:.1f}%-{tiers[-1]['rate']*100:.1f}% ({len(tiers)} tiers)"
    elif struct == 'split_game_type':
        detail = f"Slots {r.get('slotsRate',0)*100:.0f}% / Tables {r.get('tableRate',0)*100:.0f}%"
    elif struct == 'split_tiered':
        detail = f"Slots {len(r.get('slotTiers',[]))} tiers, Tables {len(r.get('tableTiers',[]))} tiers"
    elif struct == 'flat':
        detail = f"{(r.get('flatRate') or 0)*100:.2f}%"
    elif struct == 'tribal_compact' and 'tiers' in r:
        tiers = r['tiers']
        detail = f"Compact: {tiers[0]['rate']*100:.0f}%-{tiers[-1]['rate']*100:.0f}%"
    else:
        detail = r.get('description', '')[:60]
    print(f"{state_name:<20} {struct:<20} {eff:<10} {detail}")
