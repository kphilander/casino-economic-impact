#!/usr/bin/env python3
"""Build wage-grid income tax lookup tables for the web app.

Reads  data/income_tax_parameters_2025.json   (verified 2025 parameter file; provenance record)
Writes webapp/src/data/incomeTaxRates.json    (federal, state and local income tax at each wage)

Scope: tax year 2025, single filer, no dependents, under 65, full-year resident, income = wages only.
Wages are treated as federal AGI.

Run from the repo root:  python3 -I scripts/build_income_tax_tables.py
Python 3 standard library only. Exits non-zero if any self-check fails (output is not written then).
"""
import json
import math
import os
import re
import sys
from decimal import Decimal, ROUND_HALF_UP

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARAMS_REL = "data/income_tax_parameters_2025.json"
OUT_REL = "webapp/src/data/incomeTaxRates.json"
PARAMS = os.path.join(ROOT, PARAMS_REL)
OUT = os.path.join(ROOT, OUT_REL)

GRID_MIN, GRID_MAX, GRID_STEP = 0, 250000, 1000
TOL = 2.00  # dollars; formula-vs-table rounding tolerance for self-checks


# ----------------------------------------------------------------------------- helpers
def bracket_tax(ti, brackets):
    """Tax on taxable income `ti` under a list of {"min", "rate"} brackets (min = lower bound)."""
    if ti <= 0:
        return 0.0
    tax = 0.0
    for i, b in enumerate(brackets):
        hi = brackets[i + 1]["min"] if i + 1 < len(brackets) else math.inf
        if ti > b["min"]:
            tax += (min(ti, hi) - b["min"]) * b["rate"]
    return tax


def cents(x):
    return float(Decimal(repr(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def find(lst, applies_prefix):
    """Return the structured rule whose 'applies_to' starts with the given text."""
    for e in lst:
        if e.get("applies_to", "").startswith(applies_prefix):
            return e
    raise KeyError(applies_prefix)


# ----------------------------------------------------------------------------- federal
def federal_tax(w, fed):
    return bracket_tax(max(0.0, w - fed["standard_deduction"]), fed["brackets"])


# ----------------------------------------------------------------------------- states
# Each function: (w, p, fed_tax) -> (tax, components). `p` is the state's entry in the parameter file.
# Components carry intermediate values so the self-checks can test them against the file's reference values.

def generic(w, p, fed_tax=None, ti_override=None):
    sd, pe, cr = p["standard_deduction"], p["personal_exemption"], p["personal_exemption_credit"]
    ti = max(0.0, w - sd - pe) if ti_override is None else ti_override
    gross = bracket_tax(ti, p["brackets"])
    tax = max(0.0, gross - cr)
    return tax, {"ti": ti, "gross": gross, "tax": tax}


GENERIC_METHOD = {
    "federal_agi": "Wages - standard deduction - personal exemption, single-filer brackets",
    "federal_taxable_income": "Wages - standard deduction embedded in the starting point, single-filer brackets",
    "state_defined": "State gross income = wages; minus standard deduction and exemption; single-filer brackets",
}


def none_state(w, p, fed_tax):
    return 0.0, {"tax": 0.0}


def alabama(w, p, fed_tax):
    ph = find(p["phaseouts"], "standard_deduction")["params"]
    if w <= ph["full_until_agi"]:
        sd = ph["max"]
    else:
        sd = max(ph["min"], ph["max"] - ph["step_reduction"] * (math.floor((w - (ph["full_until_agi"] + 1)) / ph["step_agi"]) + 1))
    # Federal income tax deduction (Form 40 line 12), uncapped for individuals: actual 2025 federal liability.
    ti = max(0.0, w - sd - fed_tax - p["personal_exemption"])
    tax = bracket_tax(ti, p["brackets"])
    return tax, {"standard_deduction": sd, "federal_deduction": fed_tax, "ti": ti, "tax": tax}


# Arkansas DFA "2025 Indexed Tax Brackets" (2025_TaxBrackets.pdf): tax = rate x NTI - adjustment.
AR_MAIN = [  # (NTI upper bound inclusive, rate, minus-adjustment)
    (5599, 0.0, 0.0), (11199, 0.02, 111.98), (15999, 0.03, 223.97), (26399, 0.034, 287.97), (94700, 0.039, 419.96)]
# Arkansas 2025 Low Income Tax Table, Single (Filing Status 1), AGI rows (2025_TaxTables.pdf, Rev 12/12/2025).
AR_LOW_INCOME = [(14643, 0), (14700, 29), (14800, 33)] + [(14900 + 100 * k, 40 + 7 * k) for k in range(27)]  # ... (17500, 222)


def arkansas(w, p, fed_tax):
    alt = p["alt_brackets"]
    atc = find(p["phaseouts"], "Additional Tax Credit")["params"]
    low = find(p["phaseouts"], "Low Income Tax Table")["params"]
    if w <= low["table_agi_max"]:
        nti = w  # low-income table has the standard deduction built in; line 27 = 0 so line 28 = AGI
        gross = next(t for ub, t in AR_LOW_INCOME if w <= ub)
    else:
        nti = max(0.0, w - p["standard_deduction"])
        if nti <= AR_MAIN[-1][0]:
            ub, rate, adj = next(r for r in AR_MAIN if nti <= r[0])
            gross = max(0.0, rate * nti - adj)
        elif nti <= 97800:  # alt_brackets[0]: recapture band, adjustment falls $10 per $100 band
            adj = alt[0]["bracket_adjustment"] - 10 * math.floor((nti - 94701) / 100)
            gross = 0.039 * nti - adj
        elif nti <= 100000:  # alt_brackets[1]
            gross = 0.039 * nti - alt[1]["bracket_adjustment"]
        else:  # alt_brackets[2]: $3,809 + 3.9% of the excess over $100,000
            gross = 0.039 * nti - alt[2]["bracket_adjustment"]
    if nti <= atc["full_credit_nti_max"]:
        credit_atc = atc["max_credit"]
    elif nti < atc["zero_at_nti"]:
        credit_atc = atc["max_credit"] - atc["step_dollars"] * math.ceil((nti - atc["full_credit_nti_max"]) / atc["step_width"])
    else:
        credit_atc = 0
    tax = max(0.0, gross - p["personal_exemption_credit"] - credit_atc)
    return tax, {"nti": nti, "gross": gross, "additional_tax_credit": credit_atc, "tax": tax}


def connecticut(w, p, fed_tax):
    ex_p = find(p["phaseouts"], "Personal exemption")["params"]
    ad_p = find(p["phaseouts"], "2% tax rate phase-out")["params"]
    rc_p = find(p["phaseouts"], "Tax recapture")["params"]
    tbl = find(p["phaseouts"], "Personal tax credit")["params"]["table_ct_agi_upper_to_decimal"]
    agi = w
    ex = ex_p["max"] if agi <= ex_p["threshold"] else max(0, ex_p["max"] - ex_p["reduction_per_step"] * math.ceil((agi - ex_p["threshold"]) / ex_p["step"]))
    ti = max(0.0, agi - ex)
    base = bracket_tax(ti, p["brackets"])  # Table B
    addback = 0 if agi <= ad_p["threshold"] else min(ad_p["max"], ad_p["amount_per_step"] * math.ceil((agi - ad_p["threshold"]) / ad_p["step"]))  # Table C
    # Table D (single), per the file's formula text
    if agi <= 105000:
        recap = 0
    elif agi <= 200000:
        recap = min(250, 25 * math.ceil((agi - 105000) / 5000))
    elif agi <= 500000:
        recap = min(2950, 250 + 90 * math.ceil((agi - 200000) / 5000))
    else:
        recap = min(3400, 2950 + 50 * math.ceil((agi - 500000) / 5000))
    if agi <= 15000:
        dec = 0.0  # tax is zero anyway (exemption covers all income)
    else:
        dec = next((d for ub, d in tbl if agi <= ub), 0.0)  # Table E
    tax = (base + addback + recap) * (1 - dec)
    return tax, {"exemption": ex, "ti": ti, "addback": addback, "recapture": recap, "credit_decimal": dec, "tax": tax}


def iowa(w, p, fed_tax):
    ph = find(p["phaseouts"], "low_income")["params"]
    tax, c = generic(w, p)
    if w <= ph["threshold_under_65"]:
        tax = 0.0
    else:  # single-filer tax reduction worksheet: tax <= income base - $9,000 (income base = wages here)
        tax = min(tax, w - ph["threshold_under_65"])
    c["tax"] = tax
    return tax, c


def illinois(w, p, fed_tax):
    ph = find(p["phaseouts"], "personal_exemption")["params"]
    ex = ph["amount"] if w <= ph["agi_cliff_single"] else 0
    ti = max(0.0, w - ex)
    tax = bracket_tax(ti, p["brackets"])
    return tax, {"exemption": ex, "ti": ti, "tax": tax}


def kentucky(w, p, fed_tax):
    bands = find(p["phaseouts"], "Family Size Tax Credit")["params"]["bands"]
    tax, c = generic(w, p)
    pct = next((v for ub, v in bands if w <= ub), 0.0)
    c["family_size_credit_pct"] = pct
    tax = tax * (1 - pct)
    c["tax"] = tax
    return tax, c


def massachusetts(w, p, fed_tax):
    od = p["other_deductions"][0]["params"]
    lic = find(p["phaseouts"], "tax_liability")["params"]
    fica = min(od["private_sector_rate_on_wages"] * w, od["cap_per_person"])
    ti = max(0.0, w - fica - p["personal_exemption"])
    regular = bracket_tax(ti, p["brackets"])
    ma_agi = w  # Form 1 line 27 worksheet: 5.0% income less Schedule Y deductions = wages here
    if ma_agi <= lic["no_tax_status_threshold_single"]:
        tax = 0.0
    elif ma_agi <= lic["lic_upper_limit_single"]:
        tax = min(regular, lic["lic_rate"] * (ma_agi - lic["no_tax_status_threshold_single"]))
    else:
        tax = regular
    return tax, {"fica_deduction": fica, "ti": ti, "tax": tax}


def maryland(w, p, fed_tax):
    ph = find(p["phaseouts"], "Personal exemption")["params"]
    ex = next((v for ub, v in ph["table_fagi_upper_to_exemption"] if w <= ub), ph["above_150000"])
    ti = max(0.0, w - p["standard_deduction"] - ex)
    tax = bracket_tax(ti, p["brackets"])
    return tax, {"exemption": ex, "ti": ti, "tax": tax}


def maine(w, p, fed_tax):
    sd_p = find(p["phaseouts"], "standard_deduction")["params"]
    ex_p = find(p["phaseouts"], "personal_exemption")["params"]
    def phase(base, thr, rng):
        if w <= thr:
            return base
        return base * (1 - min(1.0, round((w - thr) / rng, 4)))
    sd = phase(sd_p["base_single"], sd_p["threshold_single"], sd_p["range_single"])
    ex = phase(ex_p["base"], ex_p["threshold_single"], ex_p["range_single"])
    ti = max(0.0, w - sd - ex)
    tax = bracket_tax(ti, p["brackets"])
    return tax, {"standard_deduction": sd, "exemption": ex, "ti": ti, "tax": tax}


def minnesota(w, p, fed_tax):
    ph = find(p["phaseouts"], "standard_deduction")["params"]
    sd = p["standard_deduction"]
    if w > ph["threshold1"]:
        red = ph["rate1"] * (min(w, ph["threshold2"]) - ph["threshold1"]) + ph["rate2"] * max(0.0, w - ph["threshold2"])
        sd -= min(red, ph["max_reduction_share"] * sd)
    ti = max(0.0, w - sd)
    tax = bracket_tax(ti, p["brackets"])
    return tax, {"standard_deduction": sd, "ti": ti, "tax": tax}


def missouri(w, p, fed_tax):
    fd = p["federal_tax_deduction"]
    pct = next(r["pct"] for r in fd["pct_by_agi"] if r["agi_max"] is None or w <= r["agi_max"])
    ded = min(fd["cap"], fed_tax * pct)
    ti = max(0.0, w - ded - p["standard_deduction"])
    tax = bracket_tax(ti, p["brackets"])
    return tax, {"federal_deduction": ded, "ti": ti, "tax": tax}


def nebraska(w, p, fed_tax):
    tax, c = generic(w, p)
    # 1040N line 35 limit (Schedule I net adjustments < $5,000): NE tax <= federal tax before credits
    tax = min(tax, fed_tax)
    c["tax"] = tax
    return tax, c


def new_jersey(w, p, fed_tax):
    ph = find(p["phaseouts"], "Low-income exemption")["params"]
    if w <= ph["single_threshold_gross_income"]:
        return 0.0, {"tax": 0.0}
    return generic(w, p)


def new_mexico(w, p, fed_tax):
    ph = find(p["phaseouts"], "low_and_middle_income_exemption")["params"]
    if w <= ph["eligibility_ceiling_fagi_single"]:
        lmie = max(0.0, ph["max_per_exemption"] - ph["phaseout_rate_single"] * max(0.0, w - ph["phaseout_start_single"]))
    else:
        lmie = 0.0
    ti = max(0.0, w - p["standard_deduction"] - lmie)
    tax = bracket_tax(ti, p["brackets"])
    return tax, {"lmie": lmie, "ti": ti, "tax": tax}


# New York IT-201-I (2025) p.36, Tax computation worksheet 8 (single; NY AGI > $215,400 and TI $215,400-$1,077,550).
# Not in the parameter file (whose notes stop at worksheet 7); needed because the grid runs to $250,000.
NY_WS8_RECAPTURE_BASE = 568
NY_WS8_INCREMENTAL_BENEFIT = 1831


def new_york(w, p, fed_tax):
    rc = p["recapture"]
    hc = find(p["phaseouts"], "NYS household credit")["params"]
    agi = w
    ti = max(0.0, agi - p["standard_deduction"])
    s = bracket_tax(ti, p["brackets"])
    if agi <= rc["threshold_ny_agi"]:
        tax = s
    elif ti <= 215400:  # worksheet 7
        frac = min(1.0, round((agi - rc["threshold_ny_agi"]) / rc["phase_in_width"], 4))
        tax = s + (rc["flat_rate_if_taxable_income_le_215400"] * ti - s) * frac
    elif ti <= 1077550:  # worksheet 8
        frac = round(min(agi - 215400, 50000) / 50000, 4)
        tax = s + NY_WS8_RECAPTURE_BASE + NY_WS8_INCREMENTAL_BENEFIT * frac
    else:
        raise ValueError("NY worksheets 9-11 not implemented (TI > $1,077,550)")
    credit = next((c for ub, c in hc["table_fagi_upper_to_credit"] if agi <= ub), hc["above_28000"])
    tax_after = max(0.0, tax - credit)
    return tax_after, {"ti": ti, "schedule_tax": s, "household_credit": credit, "tax": tax_after}


def ny_nyc_tax_before_credits(ti, p):
    """Parameter-consistency helper only: NYC resident tax is NOT applied in the output."""
    return bracket_tax(ti, p["nyc_resident_brackets"]["brackets"])


def ohio(w, p, fed_tax):
    sched = find(p["phaseouts"], "tax_schedule_base_amount")["params"]
    tiers = find(p["phaseouts"], "personal_exemption")["params"]["tiers"]
    cr = find(p["phaseouts"], "exemption_credit")["params"]
    magi = w
    ex = next(t["amount"] for t in tiers if t["magi_max"] is None or magi <= t["magi_max"])
    ti = max(0.0, magi - ex)
    if ti <= sched["zero_bracket_top"]:
        gross = 0.0
    elif ti <= 100000:
        gross = sched["base_tax_at_26050"] + sched["rate_2"] * (ti - sched["zero_bracket_top"])
    else:
        gross = sched["base_tax_at_100000"] + sched["rate_3"] * (ti - 100000)
    credit = cr["credit_per_exemption"] if (magi - ex) < cr["magi_less_exemptions_below"] else 0
    tax = max(0.0, gross - credit)
    return tax, {"exemption": ex, "ti": ti, "gross": gross, "exemption_credit": credit, "tax": tax}


def oregon(w, p, fed_tax):
    fd = p["federal_tax_deduction"]
    cliff = find(p["phaseouts"], "personal_exemption_credit")["params"]
    cap = next(r["max_subtraction"] for r in fd["phaseout"] if r["agi_max"] is None or w < r["agi_max"])
    sub = min(fed_tax, cap)
    ti = max(0.0, w - sub - p["standard_deduction"])
    gross = bracket_tax(ti, p["brackets"])
    credit = cliff["credit_per_exemption"] if w <= cliff["agi_cliff_single"] else 0
    tax = max(0.0, gross - credit)
    return tax, {"federal_subtraction": sub, "ti": ti, "exemption_credit": credit, "tax": tax}


def pennsylvania(w, p, fed_tax):
    tbl = find(p["phaseouts"], "Tax Forgiveness")["params"]["table_eligibility_income_upper_to_pct_forgiven"]
    gross = bracket_tax(w, p["brackets"])
    pct = next((v for ub, v in tbl if w <= ub), 0.0)
    tax = gross * (1 - pct)
    return tax, {"forgiveness_pct": pct, "tax": tax}


def utah(w, p, fed_tax):
    ph = find(p["phaseouts"], "taxpayer_tax_credit")["params"]
    qe = find(p["phaseouts"], "qualified_exempt_taxpayer")["params"]
    uti = w
    gross = bracket_tax(uti, p["brackets"])
    credit = max(0.0, ph["credit_rate"] * ph["federal_standard_deduction_single_2025"] - ph["phaseout_rate"] * max(0.0, uti - ph["base_phaseout_single"]))
    tax = 0.0 if w <= qe["threshold_single"] else max(0.0, gross - credit)
    return tax, {"credit": credit, "tax": tax}


def vermont(w, p, fed_tax):
    tax, c = generic(w, p)
    if w > 150000:  # IN-111: tax is the greater of schedule tax or 3% of federal AGI when FAGI > $150,000
        tax = max(tax, 0.03 * w)
    c["tax"] = tax
    return tax, c


def virginia(w, p, fed_tax):
    if w < 11950:  # filing threshold VAGI $11,950 single: no tax below it (2025 Form 760 instructions)
        return 0.0, {"tax": 0.0}
    return generic(w, p)


def west_virginia(w, p, fed_tax):
    lie = find(p["phaseouts"], "Low-Income Earned Income Exclusion")["params"]
    ftc = find(p["phaseouts"], "Family Tax Credit")["params"]
    excl = min(w, lie["max_exclusion"]) if w <= lie["fagi_max"] else 0.0
    ti = max(0.0, w - excl - p["personal_exemption"])
    gross = bracket_tax(ti, p["brackets"])
    if w <= ftc["full_credit_mfagi_max"]:
        pct = 1.0
    elif w > ftc["zero_above_mfagi"]:
        pct = 0.0
    else:
        pct = 1.0 - ftc["step_pct"] * math.ceil((w - ftc["full_credit_mfagi_max"]) / ftc["step_width"])
    tax = gross * (1 - pct)
    return tax, {"ti": ti, "family_tax_credit_pct": pct, "tax": tax}


def wisconsin_sd_exact(x, ph):
    return max(0.0, ph["max_deduction"] - ph["phaseout_rate"] * max(0.0, x - ph["phaseout_start"]))


def wisconsin(w, p, fed_tax):
    ph = find(p["phaseouts"], "standard_deduction")["params"]
    mid = math.floor(w / 500) * 500 + 250  # official 2025 Standard Deduction Table: $500 rows, value at row midpoint
    sd = float(Decimal(repr(wisconsin_sd_exact(mid, ph))).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    ti = max(0.0, w - sd - p["personal_exemption"])
    tax = bracket_tax(ti, p["brackets"])
    return tax, {"standard_deduction": sd, "standard_deduction_exact": wisconsin_sd_exact(w, ph), "ti": ti, "tax": tax}


SPECIAL = {
    "Alabama": (alabama, "AL AGI = wages; standard deduction $3,000 stepping down $25 per $500 of AGI to $2,500 (AGI $26,000-$35,500); uncapped deduction for 2025 federal income tax; $1,500 exemption; 2%/4%/5% brackets"),
    "Arkansas": (arkansas, "AGI <= $17,500: 2025 Low Income Tax Table (single); otherwise NTI = wages - $2,470 and DFA rate-minus-adjustment formulas incl. the $94,701-$97,800 recapture band and >$100k rule; minus $29 personal credit and $60-to-$0 Additional Tax Credit (NTI <= $27,600)"),
    "Connecticut": (connecticut, "CT AGI = wages; $15,000 exemption phased out $1,000 per $1,000 over $30,000 (Table A); Table B schedule + 2% add-back (Table C) + recapture (Table D); times (1 - Table E personal credit decimal). Property tax credit (needs property tax paid) not applied"),
    "Iowa": (iowa, "Federal taxable income (wages - $15,750) x 3.8% - $40 credit; single low-income $9,000 exemption/tax reduction worksheet applied; federal Schedule 1-A deductions not applied"),
    "Illinois": (illinois, "(Wages - $2,850 exemption, denied if AGI > $250,000) x 4.95%"),
    "Kentucky": (kentucky, "(Wages - $3,270) x 4%, reduced by the Family Size Tax Credit (family size 1; 100% at MGI <= $15,650 to 0% above $20,815)"),
    "Massachusetts": (massachusetts, "Wages - FICA deduction (min(7.65% of wages, $2,000)) - $4,400 exemption, x 5% (9% above $1,083,150); No Tax Status at MA AGI <= $8,000; Limited Income Credit cap 10% x (MA AGI - $8,000) to $14,000. Optional renter deduction not applied"),
    "Maryland": (maryland, "Wages - $3,350 standard deduction - exemption ($3,200; $1,600 FAGI $100k-$125k; $800 to $150k; $0 above), Schedule I brackets. County tax is in 'local'"),
    "Maine": (maine, "Wages - standard deduction ($15,000, phased out above Maine AGI $100,000 over $75,000) - $5,150 exemption (phase-out above $333,450, outside the grid), 5.8%/6.75%/7.15% brackets"),
    "Minnesota": (minnesota, "Wages - $14,950 standard deduction (3%/10% phase-out above AGI $238,950), single brackets"),
    "Missouri": (missouri, "MO AGI = wages; minus federal income tax deduction (35%/25%/15%/5%/0% of 2025 federal tax by MO AGI, cap $5,000) and $15,750 standard deduction; single brackets"),
    "Nebraska": (nebraska, "Wages - $8,600, single brackets, minus $171 exemption credit; capped at federal tax before credits (1040N line 35 limit)"),
    "New Jersey": (new_jersey, "NJ gross income = wages; no tax at or below $10,000; else (wages - $1,000) on the Table A single schedule"),
    "New Mexico": (new_mexico, "Wages - $15,750 federal standard deduction - low- and middle-income exemption ($2,500 less 15% of FAGI over $20,000, FAGI <= $36,667), 2025 brackets"),
    "New York": (new_york, "Wages - $8,000, NYS rate schedule; tax-benefit recapture (worksheet 7 above NY AGI $107,650; worksheet 8 above TI $215,400); minus NYS household credit (FAGI <= $28,000). NYC/Yonkers tax not applied (see 'local')"),
    "Ohio": (ohio, "Exemption $2,400/$2,150/$1,900 by MAGI; TI = wages - exemption; $0 to $26,050, $342.00 + 2.75% over $26,050, $2,394.32 + 3.125% over $100,000; minus $20 exemption credit if MAGI less exemption < $30,000"),
    "Oregon": (oregon, "Wages - federal income tax subtraction (cap $8,500, phased out at AGI $125k-$145k) - $2,835 standard deduction, 2025 brackets; minus $256 exemption credit only if federal AGI <= $100,000"),
    "Pennsylvania": (pennsylvania, "Wages x 3.07%; Tax Forgiveness (Schedule SP) by eligibility income up to $8,750"),
    "Utah": (utah, "Wages x 4.5% minus taxpayer credit (6% x $15,750 = $945, less 1.3% of income over $18,213); $0 if FAGI <= $15,750"),
    "Vermont": (vermont, "Wages - $7,650 - $5,300, 2025 brackets; greater of that or 3% of FAGI when FAGI > $150,000"),
    "Virginia": (virginia, "No tax below the $11,950 VAGI filing threshold; else wages - $8,750 - $930, 2%/3%/5%/5.75% brackets"),
    "West Virginia": (west_virginia, "Wages - low-income earned income exclusion (FAGI <= $10,000) - $2,000 exemption, 2025 brackets; reduced by the Family Tax Credit (family size 1, to $18,350)"),
    "Wisconsin": (wisconsin, "Wages - sliding standard deduction (2025 table: $13,560 less 12% of income over $19,549, evaluated at $500-row midpoints) - $700 exemption, 2025 Act 15 brackets"),
}

EXTRA_METHOD = {  # rules in the file that are not applied, with the reason, appended to the method string
    "Arizona": "flat 2.5% on wages - $15,750; Family Income Tax Credit (AZ income <= $10,000) has no effect because tax is already $0 there",
    "California": "plus $153 exemption credit; credit limitation starts above FAGI $252,203 (outside the grid); renter's credit not applied",
    "Colorado": "flat 4.4% on federal taxable income (wages - $15,750); standard-deduction add-back applies only above AGI $300,000 (outside the grid)",
    "Delaware": "minus $110 personal credit (nonrefundable)",
    "District of Columbia": "DC-defined $15,000 standard deduction",
    "Georgia": "flat 5.19% on wages - $12,000; Low Income Credit (FAGI < $20,000) not applied because its amount table is not in the parameter file",
    "Hawaii": "Act 46 brackets; refundable food/excise and renter credits not applied",
    "Idaho": "5.3% above a $4,811 zero band on wages - $15,750; $10 Permanent Building Fund tax and refundable Food Tax Credit not applied",
    "Indiana": "flat 3.0% on wages - $1,000; county tax is in 'local' (statutory rate applied to wages)",
    "Kansas": "5.2%/5.58% on wages - $3,605 - $9,160",
    "Louisiana": "flat 3% on wages - $12,500",
    "Michigan": "flat 4.25% on wages - $5,800; city income taxes are in 'local'",
    "Mississippi": "0% on the first $10,000 of taxable income and 4.4% above, on wages - $2,300 - $6,000",
    "Montana": "4.7%/5.9% on wages - $15,750",
    "North Carolina": "flat 4.25% on wages - $12,750",
    "North Dakota": "0%/1.95%/2.5% on wages - $15,750",
    "Oklahoma": "on wages - $6,350 - $1,000; special 65+ exemption irrelevant",
    "Rhode Island": "standard deduction/exemption phase-out starts above modified AGI $254,250 (outside the grid)",
    "South Carolina": "0%/3%/6% on wages - $15,000 (SC decoupled from the $750 OBBBA increase)",
}


# ----------------------------------------------------------------------------- self-checks
class Checks:
    def __init__(self):
        self.n = 0
        self.fail = []

    def eq(self, label, got, want, tol=TOL):
        self.n += 1
        if got is None or abs(got - want) > tol:
            self.fail.append(f"{label}: got {got!r}, expected {want!r} (tol {tol})")


def wage_from_key(k):
    m = re.match(r"^(?:value_at|credit_value_at|net_tax_at)_(\d+)(k)?(?:_wages)?$", k)
    if not m:
        return None
    return int(m.group(1)) * (1000 if m.group(2) else 1)


# Which computed component each reference value in the parameter file describes.
# Key: (state, top-level key, index or None). Any reference value found outside this map fails the build.
REF_COMPONENT = {
    ("Connecticut", "phaseouts", 0): "exemption",
    ("Connecticut", "phaseouts", 1): "addback",
    ("Connecticut", "phaseouts", 2): "recapture",
    ("Connecticut", "phaseouts", 3): "credit_decimal",
    ("Maine", "phaseouts", 0): "standard_deduction",
    ("Maine", "phaseouts", 1): "exemption",
    ("Maryland", "phaseouts", 0): "exemption",
    ("Massachusetts", "other_deductions", 0): "fica_deduction",
    ("New Mexico", "phaseouts", 0): "lmie",
    ("New York", "phaseouts", 0): "household_credit",
    ("New York", "recapture", None): "tax",
    ("New York", "nyc_resident_brackets", None): "nyc_tax_before_credits",
    ("Utah", "phaseouts", 0): {"credit_value_at": "credit", "net_tax_at": "tax"},
    ("Wisconsin", "phaseouts", 0): {"table_values": "standard_deduction", "exact_formula_values": "standard_deduction_exact"},
}


def collect_reference_values(states):
    """Walk the parameter file and return [(state, top, idx, refkey, wage, value)] for every reference value."""
    out = []

    def walk(state, top, idx, obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                wg = wage_from_key(k)
                if wg is not None and isinstance(v, (int, float)):
                    out.append((state, top, idx, k, wg, float(v)))
                elif k in ("table_values", "exact_formula_values", "example_tax_before_credits") and isinstance(v, dict):
                    for wk, val in v.items():
                        out.append((state, top, idx, k, int(wk), float(val)))
                elif re.match(r"^example_(\d+)k_wages$", k) and isinstance(v, str):
                    m = re.search(r"\btax ([\d,]+\.\d+)\s*$", v)
                    out.append((state, top, idx, k, int(re.match(r"^example_(\d+)k", k).group(1)) * 1000,
                                float(m.group(1).replace(",", "")) if m else float("nan")))
                else:
                    walk(state, top, idx, v)
        elif isinstance(obj, list):
            for v in obj:
                walk(state, top, idx, v)

    for st, p in states.items():
        for top, val in p.items():
            if isinstance(val, list):
                for i, e in enumerate(val):
                    walk(st, top, i, e)
            elif isinstance(val, dict):
                walk(st, top, None, val)
    return out


# Independent hand-checked spot values (wage -> expected state income tax). Each value was computed by hand
# from the official 2025 schedule in its published "base amount + rate x excess" form, not with bracket_tax().
HAND_CHECKS = {
    # FTB 2025 California Tax Rate Schedules, Schedule X; 2025 Form 540 booklet ($5,706 std ded, $153 credit).
    "California": {25000: 122.09,     # TI 19,294: 110.79 + 2% x 8,215 - 153
                   50000: 1039.53,    # TI 44,294: 1,022.01 + 6% x 2,842 - 153
                   75000: 2774.57,    # TI 69,294: 1,987.41 + 8% x 11,752 - 153
                   150000: 9704.98},  # TI 144,294: 3,201.97 + 9.3% x 71,570 - 153
    # IT-201-I (2025) NYS tax rate schedule p.33, worksheets 7/8 pp.36, household credit table 1.
    "New York": {25000: 730.50,       # TI 17,000: 600 + 5.5% x 3,100 = 770.50, less $40 household credit
                 60000: 2695.50,      # TI 52,000: 600 + 5.5% x 38,100
                 100000: 4952.00,     # TI 92,000: 4,271 + 6% x 11,350 (AGI <= 107,650, no recapture)
                 140000: 7719.50,     # ws 7: S = 7,352; 6% x 132,000 = 7,920; frac 0.6470 -> 7,352 + 568 x 0.647
                 240000: 14961.95},   # ws 8: S = 12,356 + 6.85% x 16,600 = 13,493.10; + 568 + 1,831 x 0.4920
    # 2025 Ohio IT 1040 booklet p.18 brackets; exemption tiers; $20 exemption credit (R.C. 5747.022).
    "Ohio": {30000: 364.63,           # TI 27,600: 342 + 2.75% x 1,550 = 384.63, less $20 (27,600 < 30,000)
             60000: 1216.50,          # exemption 2,150; TI 57,850: 342 + 2.75% x 31,800
             90000: 2048.38,          # exemption 1,900; TI 88,100: 342 + 2.75% x 62,050
             150000: 3897.45},        # TI 148,100: 2,394.32 + 3.125% x 48,100
    # 2025 PA-40 IN: 3.07%; Schedule SP eligibility income table 1 (unmarried, no dependents).
    "Pennsylvania": {7000: 42.98,     # 214.90 x (1 - 80% forgiven)
                     25000: 767.50, 60000: 1842.00, 90000: 2763.00},
    # 2025 IL-1040 instructions: 4.95%, $2,850 exemption.
    "Illinois": {25000: 1096.43, 90000: 4313.93, 250000: 12233.93},   # (w - 2,850) x 4.95%
    # 2025 NJ-1040 instructions Table A (subtraction method), $1,000 exemption, $10,000 threshold.
    "New Jersey": {10000: 0.00,
                   25000: 350.00,     # TI 24,000 x .0175 - 70
                   40000: 682.50,     # TI 39,000 x .035 - 682.50
                   60000: 1767.25,    # TI 59,000 x .05525 - 1,492.50
                   90000: 3543.05},   # TI 89,000 x .0637 - 2,126.25
    # 2025 MI-1040 book: 4.25%, $5,800 exemption.
    "Michigan": {25000: 816.00, 60000: 2303.50, 90000: 3578.50},
    # 2025 IT-40: 3% of (AGI - $1,000).
    "Indiana": {25000: 720.00, 60000: 1770.00, 90000: 2670.00},
    # 2025 Form 80-100 instructions: 0% on first $10,000 of TI, 4.4% above; $2,300 + $6,000.
    "Mississippi": {15000: 0.00, 25000: 294.80, 60000: 1834.80, 90000: 3154.80},
    # 2025 IT-540: (FAGI - $12,500) x 3%.
    "Louisiana": {10000: 0.00, 25000: 375.00, 60000: 1425.00, 90000: 2325.00},
    # Nevada: no individual income tax.
    "Nevada": {25000: 0.00, 60000: 0.00, 250000: 0.00},
    # MD 2025 Resident Booklet, Tax Rate Schedule I and Exemption Amount Chart; $3,350 standard deduction.
    "Maryland": {25000: 823.88,       # TI 18,450: 90 + 4.75% x 15,450
                 60000: 2486.38,      # TI 53,450: 90 + 4.75% x 50,450
                 110000: 4950.00,     # exemption 1,600; TI 105,050: 4,697.50 + 5% x 5,050
                 140000: 6517.13,     # exemption 800; TI 135,850: 5,947.50 + 5.25% x 10,850
                 160000: 7625.75},    # exemption 0; TI 156,650: 7,260 + 5.5% x 6,650
    # 2025 MA Form 1 instructions: 5%, $4,400 exemption, line 11 FICA deduction (<= $2,000), NTS/LIC worksheet.
    "Massachusetts": {8000: 0.00,     # No Tax Status
                      9000: 100.00,   # LIC: min(5% x 3,911.50 = 195.58, 10% x 1,000)
                      20000: 703.50,  # 5% x (20,000 - 1,530 - 4,400)
                      40000: 1680.00, 90000: 4180.00},
    # Additional spot values for states with structured rules (same method).
    "Connecticut": {40000: 1192.50,   # TI 35,000: (200 + 4.5% x 25,000) x (1 - .10)
                    80000: 3775.00,   # 2,000 + 5.5% x 30,000 + 125 add-back
                    120000: 6275.00}, # 4,750 + 6% x 20,000 + 250 add-back + 75 recapture
    "Oregon": {40000: 2452.18},       # fed tax 2,671.50; TI 34,493.50; 209 + 452.25 + 8.75% x 23,393.50 - 256
    "Arkansas": {16000: 28.00,        # low-income table $117 - $29 - $60
                 40000: 1014.71},     # NTI 37,530 x 3.9% - 419.96 - 29
    "Alabama": {40000: 1626.43},      # TI 40,000 - 2,500 - 2,671.50 - 1,500 = 33,328.50: 110 + 5% x 30,328.50
    "Missouri": {40000: 932.42},      # fed ded 25% x 2,671.50; TI 23,582.13: 256.04 + 4.7% x 14,391.13
    "Wisconsin": {40000: 1109.74},    # SD 11,076; TI 28,224: 3.5% x 14,680 + 4.4% x 13,544
    "Utah": {40000: 1138.23},
    # 2025 Form 760 instructions: VAGI filing threshold $11,950; schedule $720 + 5.75% over $17,000.
    "Virginia": {11000: 0.00, 12000: 46.40,    # TI 2,320 x 2%
                 40000: 1485.90},              # TI 30,320: 720 + 5.75% x 13,320
    # 2025 Form 740 packet: 4%, $3,270; Schedule ITC family size 1 (MGI 20,000 -> 20% credit).
    "Kentucky": {20000: 535.36, 40000: 1469.20},
    # WV 2025 Rate Schedule I ($666 + 3.33% over $25,000); Family Tax Credit 50% at FAGI 17,000.
    "West Virginia": {17000: 185.00, 40000: 1098.90},
    # NE 2025 Tax Calculation Schedule; $171 credit; 1040N line 35 federal-tax limit binds at $16,000 (fed $25).
    "Nebraska": {16000: 25.00, 40000: 998.03},
    # AR DFA 2025 brackets; Additional Tax Credit table ($60 at NTI 25,530; $5 at NTI 27,530).
    "Arkansas_extra": {28000: 491.05, 30000: 619.71},
    # OR-40 2025 Chart S ($4,065 + 8.75% over $50,000): AGI 101,000 -> $8,500 subtraction cap, no exemption credit.
    "Oregon_extra": {101000: 7535.69},
    # MN 2025 M1 rate schedule ($13,996.80 + 9.85% over $198,630); SD reduced 3% x 11,050 at AGI 250,000.
    "Minnesota": {250000: 17616.82},
    # AL 2025 Form 40: SD $2,775 at AGI 30,000; fed tax 1,471.50; TI 24,253.50: 110 + 5% x 21,253.50.
    "Alabama_extra": {30000: 1172.68},
    # NM 2025 PIT-1: LMIE $1,000 at FAGI 30,000; TI 13,250: $82.50 + 3.2% x 7,750.
    "New Mexico": {30000: 330.50},
    # DE 2025 PIT-RES: TI 36,750: 66 + 195 + 480 + 260 + 5.55% x 11,750 - 110.
    "Delaware": {40000: 1543.13},
}
FEDERAL_HAND_CHECKS = {  # Rev. Proc. 2024-40 Table 3 base amounts; 2025 standard deduction $15,750 (OBBBA)
    25000: 925.00, 40000: 2671.50, 60000: 5071.50, 90000: 11249.00, 120000: 17867.00}
OH_659 = 659.63  # 2025 Ohio check value at $40,000 wages (parameter file notes): TI 37,600: 342 + 2.75% x 11,550


def compute(state, p, w, fed):
    if not p["has_wage_income_tax"]:
        return none_state(w, p, 0.0)
    ft = federal_tax(w, fed)
    if state in SPECIAL:
        return SPECIAL[state][0](w, p, ft)
    return generic(w, p, ft)


def method_for(state, p):
    if not p["has_wage_income_tax"]:
        return "No individual income tax on wages; all zeros"
    if state in SPECIAL:
        m = SPECIAL[state][1]
    else:
        m = GENERIC_METHOD[p["starts_from"]]
        if p["personal_exemption_credit"]:
            m += f", minus ${p['personal_exemption_credit']:g} exemption credit"
    if state in EXTRA_METHOD:
        m += "; " + EXTRA_METHOD[state]
    return m


def main():
    with open(PARAMS) as f:
        params = json.load(f)
    fed = params["federal"]
    states = params["states"]
    ck = Checks()

    # 1. Reference values embedded in the parameter file.
    refs = collect_reference_values(states)
    for st, top, idx, k, wg, val in refs:
        comp = REF_COMPONENT.get((st, top, idx))
        if isinstance(comp, dict):
            comp = next((c for pre, c in comp.items() if k.startswith(pre)), None)
        label = f"ref {st}.{top}{'' if idx is None else f'[{idx}]'}.{k}@{wg}"
        if comp is None:
            ck.fail.append(f"{label}: no component mapping for this reference value")
            continue
        if comp == "nyc_tax_before_credits":
            ti = max(0.0, wg - states[st]["standard_deduction"])
            ck.eq(label, ny_nyc_tax_before_credits(ti, states[st]), val)
            continue
        _, c = compute(st, states[st], wg, fed)
        # tax amounts: formula-vs-table tolerance; deductions/credits: cents; rates/decimals: exact
        tol = TOL if comp == "tax" else (1e-9 if comp == "credit_decimal" else 0.01)
        ck.eq(label, c.get(comp), val, tol=tol)
    _, c = compute("Ohio", states["Ohio"], 40000, fed)
    ck.eq("ref Ohio notes $659.63 @40000", c["tax"], OH_659)

    # 2. Independent hand checks.
    for key, pts in HAND_CHECKS.items():
        st = key.replace("_extra", "")
        for wg, want in pts.items():
            ck.eq(f"hand {st}@{wg}", compute(st, states[st], wg, fed)[0], want)
    for wg, want in FEDERAL_HAND_CHECKS.items():
        ck.eq(f"hand federal@{wg}", federal_tax(wg, fed), want)

    # 3. Internal consistency: Arkansas DFA formulas vs the file's bracket list (within $0.13).
    for nti in range(5600, 94701, 100):
        ub, rate, adj = next(r for r in AR_MAIN if nti <= r[0])
        ck.eq(f"AR formula vs brackets @NTI {nti}", rate * nti - adj, bracket_tax(nti, states["Arkansas"]["brackets"]), tol=0.13)
    ck.eq("AR low-income table row 17,401-17,500", AR_LOW_INCOME[-1][1], 222, tol=0)
    ck.eq("AR low-income table last AGI", AR_LOW_INCOME[-1][0], states["Arkansas"]["phaseouts"][1]["params"]["table_agi_max"], tol=0)
    ck.eq("NY ws8 base = 6% x 215,400 - S(215,400)", NY_WS8_RECAPTURE_BASE, 0.06 * 215400 - bracket_tax(215400, states["New York"]["brackets"]), tol=1)
    ck.eq("NY ws8 benefit = 0.85% x 215,400", NY_WS8_INCREMENTAL_BENEFIT, (0.0685 - 0.06) * 215400, tol=1)

    # 4. Build the grid.
    wages = list(range(GRID_MIN, GRID_MAX + 1, GRID_STEP))
    fed_arr = [cents(federal_tax(w, fed)) for w in wages]
    out_states = {}
    for st, p in states.items():
        arr = [cents(compute(st, p, w, fed)[0]) for w in wages]
        rate = p["typical_local_income_tax_rate"]
        loc = [cents(w * rate) for w in wages]
        out_states[st] = {"abbrev": p["abbrev"], "state": arr, "local": loc, "method": method_for(st, p), "verified": p["verified"]}

    # 5. Structural checks.
    ck.eq("grid length", len(wages), 251, tol=0)
    ck.eq("state count (50 + DC)", len(out_states), 51, tol=0)
    for st, o in out_states.items():
        for key in ("state", "local"):
            a = o[key]
            ck.n += 1
            if len(a) != len(wages) or any((not math.isfinite(x)) or x < 0 for x in a):
                ck.fail.append(f"{st}.{key}: wrong length or negative/non-finite values")
            ck.n += 1
            bad = [wages[i] for i in range(1, len(a)) if a[i] < a[i - 1] - 0.005]
            if bad:
                ck.fail.append(f"{st}.{key}: decreases with wages at {bad[:5]}")
        ck.n += 1
        if not states[st]["has_wage_income_tax"] and any(o["state"]):
            ck.fail.append(f"{st}: no-tax state has nonzero tax")
        ck.n += 1
        if o["state"][-1] > 0.15 * GRID_MAX:
            ck.fail.append(f"{st}: implausible tax at ${GRID_MAX}")

    print(f"build_income_tax_tables: {len(refs) + 1} parameter-file reference values, "
          f"{sum(len(v) for v in HAND_CHECKS.values()) + len(FEDERAL_HAND_CHECKS)} hand-checked spot values, "
          f"{ck.n} checks in total")
    if ck.fail:
        print(f"FAILED {len(ck.fail)} of {ck.n} checks:")
        for f_ in ck.fail:
            print("  - " + f_)
        sys.exit(1)

    doc = {
        "_metadata": {
            "taxYear": 2025,
            "filing": "single, no dependents, wages only, under 65",
            "generatedBy": "scripts/build_income_tax_tables.py",
            "source": PARAMS_REL,
            "excluded": [
                "EITC and other refundable credits (state EITCs, renter/property-tax/sales-tax/food credits, Oregon kicker)",
                "federal tips, overtime, car-loan-interest and senior deductions (Schedule 1-A) and state counterparts",
                "conditional deductions/credits (MA renter deduction, CT property tax credit, CA renter's credit, IN renter's deduction)",
                "NYC/Yonkers resident tax schedules (local stands in for local taxes)",
                "payroll taxes (FICA, CA SDI, WA Cares, MA PFML, OR transit tax) and flat per-head local levies",
                "Idaho $10 Permanent Building Fund tax",
            ],
            "notes": [
                "state[i] and local[i] are dollars of tax at wage w = wageGrid.min + i * wageGrid.step; wages are treated as federal AGI.",
                "federal.tax = 2025 single brackets (Rev. Proc. 2024-40) applied to max(0, w - 15,750) (OBBBA standard deduction); it feeds the AL, MO and OR federal-tax deductions and the NE federal-tax cap.",
                "Taxes are computed from the rate formulas, not the official tax tables, except the Arkansas low-income table and the Wisconsin standard deduction table; formula and table differ by a few dollars at most.",
                "local[i] = w x typical_local_income_tax_rate from the parameter file: Tax Foundation statewide average effective rates (% of AGI) for AL, IA, KY, MD, MI, MO, NY, OH, PA; population-weighted statutory county rate for IN; 0 elsewhere.",
                "New York tax above taxable income $215,400 uses IT-201-I (2025) worksheet 8 constants ($568 recapture base, $1,831 incremental benefit), which are hard-coded in the generator rather than taken from the parameter file.",
            ],
        },
        "wageGrid": {"min": GRID_MIN, "max": GRID_MAX, "step": GRID_STEP},
        "federal": {"tax": fed_arr},
        "states": out_states,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    text = json.dumps(doc, indent=1)
    # keep each numeric array on one line so the file stays readable and diffs stay small
    text = re.sub(r"\[\s+(-?[\d.]+(?:,\s+-?[\d.]+)*)\s+\]",
                  lambda m: "[" + ",".join(x.strip() for x in m.group(1).split(",")) + "]", text)
    with open(OUT, "w") as f:
        f.write(text + "\n")
    print(f"all {ck.n} checks passed; wrote {OUT_REL} ({len(out_states)} jurisdictions x {len(wages)} wages)")


if __name__ == "__main__":
    main()
