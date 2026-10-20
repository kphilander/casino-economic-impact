#!/usr/bin/env python3
"""
Generate the GEMS methodology white paper PDF.

Output: webapp/public/GEMS-2026-Methodology.pdf (served by the web app at
<base>/GEMS-2026-Methodology.pdf). The paper describes the model as deployed
in October 2026 and agrees with docs/methodology.md. It is written in
ASD-STE100 Simplified Technical English; technical names, formulas, file
names, statutes and citations keep their usual form.

Regenerate after editing:  python3 docs/generate_whitepaper.py
Keep the version, author and citation in sync with webapp/src/brand.ts, and
the values in sync with docs/methodology.md and the data files that it names.
"""

import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, HRFlowable, KeepTogether, ListFlowable, ListItem, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

# ---------------------------------------------------------------------------
# Brand constants (mirror webapp/src/brand.ts)
# ---------------------------------------------------------------------------
PRODUCT_NAME = "GEMS"
PRODUCT_FULL_NAME = "Gaming Economic Modeling System"
MODEL_VERSION = "2026"
DESCRIPTOR = "Casino Economic Impact Model"
PUBLISHER = "GP Consulting"
URL = "https://gamblingpolicy.com/tools/economic-impact/"
EMAIL = "info@gamblingpolicy.com"
AUTHOR = "Dr. Kahlil Simeon-Rose"
EDITION_DATE = "October 2026"
CITATION = (
    f"Simeon-Rose, K. (2026). {PRODUCT_NAME}: {PRODUCT_FULL_NAME} "
    f"(Version {MODEL_VERSION}) [Computer software]. {PUBLISHER}. {URL}"
)

NAVY = colors.HexColor("#1a365d")
BLUE = colors.HexColor("#3182ce")
LIGHT_BLUE = colors.HexColor("#4299e1")
TEXT = colors.HexColor("#1a2a3a")
GRAY = colors.HexColor("#718096")
LIGHT_BG = colors.HexColor("#f0f4f8")
BORDER = colors.HexColor("#e2e8f0")

PAGE_W, PAGE_H = letter
MARGIN = 0.9 * inch

OUT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "webapp", "public",
    f"{PRODUCT_NAME}-{MODEL_VERSION}-Methodology.pdf",
)

# ---------------------------------------------------------------------------
# Styles
# ---------------------------------------------------------------------------
def style(name, **kw):
    base = dict(fontName="Helvetica", fontSize=10, leading=14.5, textColor=TEXT,
                spaceAfter=8)
    base.update(kw)
    return ParagraphStyle(name, **base)

S = {
    "body": style("body"),
    "h1": style("h1", fontName="Helvetica-Bold", fontSize=16, leading=20,
                textColor=NAVY, spaceBefore=18, spaceAfter=10, keepWithNext=1),
    "h2": style("h2", fontName="Helvetica-Bold", fontSize=12, leading=16,
                textColor=BLUE, spaceBefore=12, spaceAfter=6, keepWithNext=1),
    "abstract": style("abstract", fontSize=10.5, leading=16, leftIndent=24,
                      rightIndent=24, textColor=colors.HexColor("#2d3748")),
    "formula": style("formula", fontName="Courier-Bold", fontSize=10.5,
                     leading=15, leftIndent=36, textColor=NAVY,
                     spaceBefore=4, spaceAfter=10),
    "caption": style("caption", fontSize=8.5, leading=11, textColor=GRAY),
    "citation": style("citation", fontSize=9.5, leading=14, leftIndent=12,
                      rightIndent=12, textColor=NAVY),
    "reference": style("reference", fontSize=9, leading=13, leftIndent=18,
                       firstLineIndent=-18, spaceAfter=5),
    "toc": style("toc", fontSize=10.5, leading=17, textColor=TEXT),
    "cell": style("cell", fontSize=9, leading=12, spaceAfter=0),
    "cellHead": style("cellHead", fontName="Helvetica-Bold", fontSize=9,
                      leading=12, textColor=colors.white, spaceAfter=0),
}

def table(data, widths, header=True):
    # Wrap cells in Paragraphs so long text wraps inside the cell instead of
    # overflowing the page
    wrapped = []
    for r, row in enumerate(data):
        st = S["cellHead"] if (header and r == 0) else S["cell"]
        wrapped.append([Paragraph(str(c).replace("\n", "<br/>"), st) for c in row])
    t = Table(wrapped, colWidths=widths, hAlign="LEFT", splitByRow=1, repeatRows=1 if header else 0)
    cmds = [
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
    ]
    if header:
        cmds += [
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ]
    t.setStyle(TableStyle(cmds))
    return t

def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(i, S["body"]), leftIndent=18) for i in items],
        bulletType="bullet", start="•", bulletFontSize=9, leftIndent=18,
    )

def numbered(items):
    return ListFlowable(
        [ListItem(Paragraph(i, S["body"]), leftIndent=18) for i in items],
        bulletType="1", bulletFontSize=9.5, leftIndent=18,
    )

def body(text):
    return Paragraph(text, S["body"])

def formula(text):
    return Paragraph(text, S["formula"])

def h1(text):
    return Paragraph(text, S["h1"])

def h2(text):
    return Paragraph(text, S["h2"])

# ---------------------------------------------------------------------------
# Page decoration
# ---------------------------------------------------------------------------
def draw_cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)
    # Accent bars
    canvas.setFillColor(BLUE)
    canvas.rect(0, PAGE_H - 0.18 * inch, PAGE_W, 0.18 * inch, stroke=0, fill=1)
    canvas.rect(MARGIN, 4.1 * inch, 0.07 * inch, 3.6 * inch, stroke=0, fill=1)

    x = MARGIN + 0.3 * inch
    canvas.setFillColor(LIGHT_BLUE)
    canvas.setFont("Helvetica-Bold", 13)
    canvas.drawString(x, 7.35 * inch, "METHODOLOGY WHITE PAPER")

    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 52)
    canvas.drawString(x, 6.5 * inch, f"{PRODUCT_NAME} {MODEL_VERSION}")
    canvas.setFont("Helvetica", 22)
    canvas.drawString(x, 6.0 * inch, PRODUCT_FULL_NAME)

    canvas.setFillColor(LIGHT_BLUE)
    canvas.setFont("Helvetica", 14)
    canvas.drawString(x, 5.45 * inch, f"The {DESCRIPTOR}")

    canvas.setStrokeColor(colors.white)
    canvas.setLineWidth(0.7)
    canvas.line(x, 4.95 * inch, x + 2.6 * inch, 4.95 * inch)

    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica", 11.5)
    canvas.drawString(x, 4.55 * inch, AUTHOR)
    canvas.setFillColor(LIGHT_BLUE)
    canvas.setFont("Helvetica", 10.5)
    canvas.drawString(x, 4.3 * inch, PUBLISHER)
    canvas.drawString(x, 4.08 * inch, EDITION_DATE)

    # Footer band
    canvas.setFillColor(colors.HexColor("#152a4d"))
    canvas.rect(0, 0, PAGE_W, 0.75 * inch, stroke=0, fill=1)
    canvas.setFillColor(BLUE)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(MARGIN, 0.42 * inch, "GP CONSULTING")
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(PAGE_W - MARGIN, 0.42 * inch, URL.replace("https://", ""))
    canvas.restoreState()

def draw_body(canvas, doc):
    canvas.saveState()
    # Header
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 0.55 * inch, PAGE_W, 0.55 * inch, stroke=0, fill=1)
    canvas.setFillColor(BLUE)
    canvas.rect(0, PAGE_H - 0.59 * inch, PAGE_W, 0.04 * inch, stroke=0, fill=1)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(MARGIN, PAGE_H - 0.36 * inch,
                      f"{PRODUCT_NAME} {MODEL_VERSION} - {PRODUCT_FULL_NAME}")
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.36 * inch,
                           f"Methodology White Paper, {EDITION_DATE}")
    # Footer
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(MARGIN, 0.6 * inch, PAGE_W - MARGIN, 0.6 * inch)
    canvas.setFillColor(GRAY)
    canvas.setFont("Helvetica", 8.5)
    canvas.drawString(MARGIN, 0.42 * inch, f"© 2026 {PUBLISHER}  |  {EMAIL}")
    canvas.drawRightString(PAGE_W - MARGIN, 0.42 * inch, f"Page {doc.page - 1}")
    canvas.restoreState()

# ---------------------------------------------------------------------------
# Document content
# ---------------------------------------------------------------------------
SECTIONS = [
    "Introduction", "Inputs and results", "Model structure", "Employment",
    "Gaming, online and other revenue", "Validation", "Tax estimates",
    "Optional modules", "Data sources", "References",
]

def build():
    doc = BaseDocTemplate(
        os.path.abspath(OUT_PATH), pagesize=letter,
        title=f"{PRODUCT_NAME} {MODEL_VERSION} Methodology White Paper",
        author=AUTHOR, subject=f"{PRODUCT_FULL_NAME} - {DESCRIPTOR}",
        creator=PUBLISHER,
    )
    cover_frame = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN, id="cover")
    body_frame = Frame(MARGIN, 0.85 * inch, PAGE_W - 2 * MARGIN,
                       PAGE_H - 0.85 * inch - 0.95 * inch, id="body")
    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[cover_frame], onPage=draw_cover),
        PageTemplate(id="Body", frames=[body_frame], onPage=draw_body),
    ])

    W = PAGE_W - 2 * MARGIN
    el = []
    el.append(NextPageTemplate("Body"))
    el.append(PageBreak())

    # --- Abstract -----------------------------------------------------------
    el.append(h1("Abstract"))
    el.append(Paragraph(
        f"{PRODUCT_NAME} ({PRODUCT_FULL_NAME}) is an economic impact model for casino and online "
        "gaming operations in the 50 U.S. states. It uses input-output (I-O) analysis with the "
        "industry technology assumption. Its data are the EPA State Input-Output (StateIO) tables, "
        "BLS QCEW employment and national BEA detail ratios for gambling. For a set of revenue "
        "inputs, the model calculates direct, supplier (indirect) and induced effects. The effects "
        "are on output, GDP (value added), jobs, estimated full-time equivalents (FTEs), labor "
        "income and taxes. The calculator does all calculations in the browser from the published "
        "tables, and tests show that it agrees with the R reference pipeline. This paper describes "
        f"the model as of {EDITION_DATE}. It gives the framework, the data, the validation of direct "
        "jobs against the Economic Census, the tax estimates and the limits of the model.",
        S["abstract"]))
    el.append(Spacer(1, 8))
    el.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    el.append(Spacer(1, 8))
    el.append(Paragraph("<b>Suggested citation</b>", S["h2"]))
    el.append(Paragraph(CITATION, S["citation"]))
    el.append(Paragraph(
        "When you cite results from the model, also give the date of the analysis and the inputs "
        "(state, property type and revenue). The results change with the inputs.", S["caption"]))

    el.append(h1("Contents"))
    for i, t in enumerate(SECTIONS, start=1):
        el.append(Paragraph(f"{i}.&nbsp;&nbsp;{t}", S["toc"]))
    el.append(PageBreak())

    # --- 1. Introduction ----------------------------------------------------
    el.append(h1("1. Introduction"))
    el.append(body(
        "Casino proposals and changes to gaming taxes often include an estimate of economic "
        "impact. The estimate gives the jobs, the GDP and the tax revenue that a property supports. "
        "Most of these estimates use multipliers for broad sectors. For example, sector 713 "
        "includes casinos, golf courses, fitness centers and amusement parks. These businesses "
        "have different costs and different numbers of workers for each dollar of revenue."))
    el.append(body(
        f"{PRODUCT_NAME} puts gambling coefficients into the regional model of each state. "
        "National BEA detail data show how gambling is different from its parent sector. StateIO "
        "gives the supply chain and the trade of each state. You can also enter revenue by "
        "department. Then rooms, food and other revenue use their own sectors."))
    el.append(body(f"{PRODUCT_NAME} {MODEL_VERSION} has these property types:"))
    el.append(bullets([
        "Resort with hotel and casino (casino hotel, NAICS 721120)",
        "Stand-alone casino (NAICS 713210)",
        "Slot parlor or bingo hall (NAICS 713290)",
        "Bar or restaurant with slots (video gaming terminals, NAICS 722410)",
        "Online casino (iGaming) operator",
        "Online sportsbook operator",
    ]))
    el.append(body(
        "A land-based property can have commercial or tribal ownership (Section 5.4). Online "
        "operators are always commercial."))
    el.append(body(
        "Use the model for policy analysis, plans and comparisons. Do not use it for exact "
        "forecasts, for investment decisions without professional advice or in legal proceedings."))

    # --- 2. Inputs and results ----------------------------------------------
    el.append(h1("2. Inputs and results"))
    el.append(h2("2.1 Inputs"))
    el.append(body("You enter these inputs:"))
    el.append(bullets([
        "<b>State.</b> The model uses the I-O tables, the gaming tax schedule and the tax rules of "
        "the state.",
        "<b>Property type and ownership.</b>",
        "<b>Annual revenue.</b> Enter total revenue, or revenue by department: gaming (GGR), "
        "lodging, food and beverage, and entertainment and other. Online operators enter GGR.",
        "<b>Dollar year of the revenue</b> (2019 to 2025).",
        "<b>Gaming tax.</b> The model uses the statutory schedule of the state, or a custom rate "
        "that you enter. For a tribal property, enter the compact revenue share.",
        "<b>Observed jobs and wages</b> (optional). These values replace the modeled direct values.",
        "<b>Optional modules:</b> net new impact and the construction phase (Section 8).",
    ]))
    el.append(h2("2.2 Results"))
    el.append(body("The calculator gives these results:"))
    el.append(table([
        ["Result", "Measure"],
        ["Output", "Gross output of all industries in the state"],
        ["GDP", "Value added: the contribution to gross domestic product"],
        ["Jobs", "Filled jobs, full time and part time, as in QCEW (not FTEs)"],
        ["Estimated FTEs", "Full-time equivalents from BEA ratios, given separately from jobs"],
        ["Labor income", "Employee compensation: cash wages and employer supplements"],
        ["Taxes", "The statutory gaming tax, other taxes on production, and payroll and income "
                  "taxes, for the federal level and the state and local level"],
    ], [1.4 * inch, W - 1.4 * inch]))
    el.append(Spacer(1, 10))
    el.append(body(
        "The calculator gives each result as direct, supplier and induced effects, and as a "
        "total. It also gives supplier and induced jobs by industry, and a 90% range for direct "
        "and total jobs (Section 6.3). For each value, a panel shows how the model calculated it. "
        "The results are estimates from average relations between industries. Use them as "
        "indications, not as exact values."))
    el.append(h2("2.3 Analysis tools"))
    el.append(body("The calculator has these tools:"))
    el.append(bullets([
        "<b>Compare.</b> Put up to four scenarios side by side.",
        "<b>Sensitivity.</b> Change gaming revenue by up to 40% or the gaming tax rate from 0% to "
        "40%. See results for a low, central and high household spending share (Section 3.4). "
        "Make a projection for several years with a growth rate.",
        "<b>Share and save.</b> A share link records all inputs of an analysis. The browser also "
        "keeps a draft and saved projects.",
        "<b>Method.</b> The Method view lists the data files of each result with their checksums. "
        "The footer gives the source commit of the build.",
        "<b>Casino Revenue Forecaster.</b> The forecaster can send its revenue estimates to the "
        "calculator as inputs.",
    ]))

    # --- 3. Model structure -------------------------------------------------
    el.append(h1("3. Model structure"))
    el.append(h2("3.1 Tables"))
    el.append(body(
        "The model uses the two-region StateIO summary tables for 2019, with 71 industries and 73 "
        "commodities. Each table separates the state from the rest of the United States. The model "
        "uses these parts of the in-state block:"))
    el.append(bullets([
        "the Make table V (industries × commodities)",
        "the domestic Use table U (in-state commodities × industries)",
        "industry output g and commodity output q",
        "the value-added components V001 (employee compensation), V002 (taxes on production and "
        "imports, TOPI) and V003 (gross operating surplus)",
        "the personal consumption expenditures (PCE, F010) of the state",
    ]))
    el.append(body(
        "The model keeps the 2019 production structure because the 2020 and 2021 tables show "
        "the effects of the pandemic. Jobs use 2023 data (Section 4). This combination is "
        "deliberate."))
    el.append(body(
        "There are tables for the 50 states only. The model does not include the District of "
        "Columbia, counties or cities. It counts only the effects in the state. Purchases from "
        "other states and imports are leakage, and the model does not count their effects."))
    el.append(h2("3.2 Direct requirements"))
    el.append(formula("D = V diag(q)<super>-1</super>&nbsp;&nbsp;&nbsp;B = U diag(g)<super>-1</super>&nbsp;&nbsp;&nbsp;A = D B"))
    el.append(body(
        "D gives the share of each commodity that each industry makes. B gives the in-state inputs "
        "for each dollar of output of each industry. A is the direct requirements matrix, industry "
        "by industry, under the industry technology assumption."))
    el.append(h2("3.3 Type I model"))
    el.append(formula("L = (I - A)<super>-1</super>"))
    el.append(body(
        "Column j of L gives the in-state output of each industry that $1 of final demand for "
        "industry j causes. It includes all rounds of supplier purchases. The column sum is the "
        "Type I output multiplier."))
    el.append(body(
        "An I-O model has fixed production technology and no supply limits. A very large project "
        "can change the local economy in ways that the model does not show."))
    el.append(h2("3.4 Type II model and the household closure"))
    el.append(body(
        "The Type II model adds households as an industry. A<sub>II</sub> is A with a household row "
        "and a household column, and L<sub>II</sub> is its inverse. The household row is employee "
        "compensation for each dollar of output (V001 ÷ g). The household column gives the in-state "
        "purchases of households for each dollar of compensation:"))
    el.append(formula("household column = D (θ × PCE<sub>in-state</sub> ÷ PCE<sub>all</sub>)"
                      "<br/>L<sub>II</sub> = (I - A<sub>II</sub>)<super>-1</super>"))
    el.append(body(
        "PCE<sub>in-state</sub> is the consumption of commodities from in-state suppliers. "
        "PCE<sub>all</sub> also includes purchases from other states and imports. θ is the share of "
        "each dollar of compensation that households spend. Script 08c_household_spending.R "
        "calculates θ for each state:"))
    el.append(formula("θ = c × (1 - b × (T<sub>employer</sub> + T<sub>employee</sub> + T<sub>income</sub>) ÷ W)"))
    el.append(bullets([
        "c = 0.902 is personal consumption expenditures divided by disposable personal income in "
        "2023 (BEA NIPA Table 2.1, FRED series PCECA and A067RC1A027NBEA).",
        "b = 0.806 is the cash wage for each dollar of compensation in all private industries "
        "(Section 7.4).",
        "W is the average 2023 QCEW private wage of the state.",
        "T<sub>employer</sub>, T<sub>employee</sub> and T<sub>income</sub> are the employer payroll "
        "taxes, the employee Social Security and Medicare taxes and the income taxes at W. The "
        "model uses its own tax rules (Section 7). Thus households spend only the income that "
        "remains after the taxes that the model counts.",
    ]))
    el.append(body(
        "Across the states, θ is 0.64 to 0.73 (median 0.70). Approximately 70% of household "
        "purchases go to in-state suppliers. Thus households spend a median of $0.48 in the state "
        "for each dollar of compensation. The Sensitivity view also gives results for a low θ "
        "(c = 0.819, the lowest annual value since 2000, in 2020) and a high θ (c = 1)."))
    el.append(body(
        "Before October 2026, the household column was in-state PCE divided by total "
        "compensation. That closure spent a median of $0.90 in the state for each dollar of "
        "compensation, and up to $1.20 in Florida. It gave wages the credit for consumption that "
        "transfers and property income pay for. The change decreased the Type II output "
        "multipliers of 713, 721 and 722 by approximately 20%, and total jobs by 12% to 16%. "
        "Type I values did not change."))
    el.append(h2("3.5 Effects"))
    el.append(body(
        "For revenue R to industry j, and a coefficient c<sub>i</sub> for each dollar of output of "
        "industry i, the effects are:"))
    el.append(formula(
        "direct&nbsp;&nbsp;&nbsp;= R × c<sub>j</sub><br/>"
        "supplier = R × Σ<sub>i</sub> c<sub>i</sub> (L<sub>ij</sub> - δ<sub>ij</sub>)<br/>"
        "induced&nbsp;&nbsp;= R × Σ<sub>i</sub> c<sub>i</sub> (L<sub>II,ij</sub> - L<sub>ij</sub>)"))
    el.append(body(
        "For output, each coefficient is 1. Thus supplier output = R × (Type I multiplier - 1), "
        "and induced output = R × (Type II multiplier - Type I multiplier). The same equations "
        "give GDP, labor income, TOPI, jobs and FTEs with their coefficients. The model keeps each "
        "effect by the industry in which it occurs."))
    el.append(table([
        ["Effect", "Source", "Example"],
        ["Direct", "The activity of the property",
         "The casino employs staff and pays labor income."],
        ["Supplier (indirect)", "The in-state purchases of the property and of its suppliers",
         "The casino buys food, linen and equipment. Its suppliers buy their inputs."],
        ["Induced", "The in-state purchases of households from labor income",
         "Casino and supplier employees buy housing, food and services."],
    ], [1.3 * inch, 2.3 * inch, W - 3.6 * inch]))
    el.append(Spacer(1, 10))
    el.append(h2("3.6 Calculation in the browser"))
    el.append(body(
        "The calculator does all calculations in the browser. The script "
        "scripts/export_state_io.R writes the in-state tables of each state to a data file. The "
        "file contains only table values and no multipliers. The engine (webapp/src/engine/io.ts) "
        "calculates D, B, A, the Type I and Type II inverses and all coefficients. The R pipeline "
        "(08_state_multipliers_2023.R) does the same calculations. Automated tests make sure that "
        "the engine gives every value in the R output files, to the decimals of those files."))

    # --- 4. Employment ------------------------------------------------------
    el.append(h1("4. Employment"))
    el.append(h2("4.1 Jobs"))
    el.append(body("Jobs come from a 2023 employment satellite:"))
    el.append(formula("jobs<sub>i</sub> = (jobs per $1M of output)<sub>i</sub> × output<sub>i</sub> in each round"))
    el.append(body(
        "Jobs per $1M of output are 2023 QCEW jobs divided by 2023 StateIO output, for each of the "
        "71 industries. The direct round is the revenue. The supplier and induced rounds are the "
        "output of each industry from L and L<sub>II</sub>. Thus supplier and induced jobs occur in the "
        "industries that get the purchases."))
    el.append(body(
        "QCEW counts filled jobs: full time, part time, temporary and permanent. A person with two "
        "jobs counts two times. QCEW has no data for hours. Thus jobs are the primary employment "
        "measure of GEMS. Owner-occupied housing (HS) and government enterprises (GFE, GSLE) have "
        "no QCEW measure, so their job coefficients are zero."))
    el.append(body(
        "StateIO gives each sector national coefficients for value added, compensation and TOPI. "
        "Thus the differences between states in labor intensity come from jobs for each dollar "
        "of output."))
    el.append(h2("4.2 Estimated FTEs"))
    el.append(body(
        "BEA NIPA Tables 6.4D and 6.5D give full-time and part-time employees and full-time "
        "equivalents by industry. Script 08b calculates the FTEs for each job in each of the 71 "
        "industries for 2023. The data include the BEA revisions of September 2026. The model "
        "multiplies the jobs of each industry by its ratio. The results are estimates, not "
        "reported hours, and the calculator labels them as estimated FTEs."))
    el.append(h2("4.3 Dollar year"))
    el.append(body(
        "All dollar results are in the dollars of the revenue that you enter. The dollar "
        "multipliers are ratios, so the model does not deflate dollar results. Jobs are "
        "different, because the jobs coefficients are for each $1M of 2023 output. Thus the model "
        "changes the output of each round to 2023 dollars before it calculates jobs:"))
    el.append(formula("jobs = output × (CPI<sub>2023</sub> ÷ CPI<sub>dollar year</sub>) × jobs per $1M"))
    el.append(body(
        "The dollar year is an input. The default is the latest year with a complete BLS CPI-U "
        "annual average (2025). The model uses annual averages only."))

    # --- 5. Gaming, online and other revenue ---------------------------------
    el.append(h1("5. Gaming, online and other revenue"))
    el.append(h2("5.1 Gambling coefficients"))
    el.append(body(
        "The StateIO summary tables have only sector 713 (amusement, gambling and recreation). "
        "GEMS changes the 713 response of each state with national ratios. The ratios compare the "
        "detail industry 713200 (gambling industries) with the 713 parent, weighted by output, in "
        "USEEIO v2.0.1-411. The useeior package builds this model from BEA detail tables."))
    el.append(table([
        ["Component", "Ratio of gambling to the 713 parent"],
        ["Direct value added", "1.008"],
        ["Direct employee compensation", "0.863"],
        ["Direct TOPI", "0.609"],
        ["Direct jobs for each dollar of output", "0.540"],
        ["Supplier and induced output", "0.967"],
        ["Supplier and induced value added", "0.993"],
        ["Supplier and induced compensation", "1.047"],
        ["Supplier and induced TOPI", "0.940"],
    ], [3.8 * inch, 2.4 * inch]))
    el.append(Spacer(1, 10))
    el.append(body(
        "The ratios multiply the direct effect and the supplier and induced increments of each "
        "metric. USEEIO is a Type I model. Thus the model uses the supplier ratios for the induced "
        "increments too. Supplier and induced jobs change with value added, because the jobs for "
        "each dollar of supplier or induced GDP stay at the 713 values. Thus these jobs keep the "
        "industry distribution of 713."))
    el.append(h2("5.2 Online operators"))
    el.append(body(
        "Online casino and sportsbook operators use the gambling response with operator ratios. "
        "The ratios come from the 2024 SEC filings of DraftKings, Rush Street Interactive and "
        "Flutter (script 14_online_gambling_multipliers.R). Each value is a ratio to the gambling "
        "response:"))
    el.append(table([
        ["Component", "Ratio"],
        ["Direct value added", "0.90"],
        ["Direct labor income", "0.55"],
        ["Direct TOPI", "1.00"],
        ["Direct jobs for each dollar of value added", "0.23"],
        ["Supplier and induced output and value added", "0.85"],
        ["Supplier and induced labor income", "0.80"],
        ["Supplier and induced TOPI", "0.90"],
    ], [3.8 * inch, 2.4 * inch]))
    el.append(Spacer(1, 10))
    el.append(body(
        "Direct FTEs use the FTE ratio of computer systems design (5415). The online values are "
        "approximations from a small number of operators."))
    el.append(h2("5.3 Departments and property types"))
    el.append(body("Each department uses one model sector:"))
    el.append(table([
        ["Department", "Model sector"],
        ["Gaming (GGR)", "Gambling coefficients (713 with the ratios of Section 5.1)"],
        ["Lodging", "721 Accommodation"],
        ["Food and beverage", "722 Food services and drinking places"],
        ["Entertainment and other", "711AS Performing arts, spectator sports, museums"],
    ], [1.9 * inch, W - 1.9 * inch]))
    el.append(Spacer(1, 10))
    el.append(body(
        "In total-revenue mode, all revenue uses the gambling coefficients. This is an "
        "approximation if much of the revenue comes from rooms, food or other services. In "
        "department mode, each department uses its own sector. The four land-based property "
        "types are labels, and they use the same gambling coefficients."))
    el.append(body(
        "The gaming tax is a tax on GGR. Thus the model calculates the gaming tax only when you "
        "enter GGR by department, or for an online operator. In total-revenue mode, a rate that you "
        "enter changes only the gaming-tax adjustment of direct labor income (Section 6.4)."))
    el.append(h2("5.4 Tribal properties"))
    el.append(body(
        "Tribal gaming pays compact revenue shares, not state gaming taxes. Tribal properties on "
        "trust land also pay few state and local taxes. For a tribal property, the model replaces "
        "all direct TOPI of the gaming stream with the revenue share that you enter. BEA records "
        "tribal gaming as a government enterprise, outside the private gambling industry. In "
        "QCEW, cells with mostly tribal casinos agree with the gambling coefficient (ratio 1.00 "
        "for jobs for each wage dollar)."))

    # --- 6. Validation ------------------------------------------------------
    el.append(h1("6. Validation"))
    el.append(body(
        "Direct jobs are the only employment value with an observed benchmark that is not "
        "circular. GEMS compares its gambling coefficient with two administrative benchmarks, "
        "state by state, for casino property types (NAICS 713210, 713290 and 721120). The "
        "replication is in the repository kphilander/casino-io-validation, which is private "
        "until publication."))
    el.append(h2("6.1 QCEW: jobs for each wage dollar"))
    el.append(body(
        "For 2023 cells with at least 50 jobs, the coefficient looks short. The geometric-mean "
        "ratios of model to observed are 0.71 for stand-alone casinos, 0.84 for casino hotels and "
        "0.90 for slot parlors. This test must change model compensation to QCEW-comparable "
        "wages by industry (Section 7.4). Without this change, the shortfall is approximately two "
        "times larger."))
    el.append(h2("6.2 Economic Census: jobs and payroll for each revenue dollar"))
    el.append(body(
        "The 2022 Economic Census records receipts, so it can separate jobs for each dollar of "
        "output from compensation for each dollar of output."))
    el.append(bullets([
        "Jobs for each revenue dollar show no bias. The ratios are 0.94, 1.06 and 0.96 "
        "(p > 0.5).",
        "The payroll share of revenue is 18% to 53% too high. The observed share decreases when "
        "the effective gaming tax of the state increases.",
        "Thus the QCEW shortfall is an overstatement of compensation, not a shortage of jobs. "
        "Census and QCEW jobs for each payroll dollar are different by only 2% to 4%.",
    ]))
    el.append(body(
        "The sum of the jobs in all states with disclosed data gives a different result. The "
        "gambling coefficient gives 14% fewer jobs than observed, and 22% fewer for casino hotels. "
        "The cause is the weight of Nevada. Nevada has half of the casino-hotel jobs and a ratio "
        "of 0.62, because gaming is only 40% of its casino-hotel receipts."))
    el.append(body(
        "The Census product lines let the model use department mode. With department mode, the "
        "sum for casino hotels in 17 states increases from 0.77 to 0.97 of observed jobs, and "
        "Nevada increases to 0.89. Thus, for a property with much non-gaming revenue, use "
        "department mode."))
    el.append(h2("6.3 Predictive ranges"))
    el.append(body(
        "GEMS applies no adjustment to direct jobs. For land-based commercial casinos, it gives a "
        "90% predictive range for direct and total jobs (webapp/src/data/jobsRange.json). The "
        "range is the 5th to 95th percentile of a lognormal distribution. The distribution has "
        "the dispersion of the Census residuals across states."))
    el.append(table([
        ["Property type", "Cells", "Model ÷ Census jobs for each revenue dollar", "90% range (× coefficient)"],
        ["Stand-alone casino (713210)", "15", "0.94 (p = 0.56)", "0.56 to 2.01"],
        ["Slot parlor or bingo hall (713290)", "22", "1.06 (p = 0.65)", "0.33 to 2.70"],
        ["Casino hotel (721120)", "19", "0.96 (p = 0.60)", "0.59 to 1.83"],
    ], [2.2 * inch, 0.6 * inch, 2.1 * inch, W - 4.9 * inch]))
    el.append(Spacer(1, 10))
    el.append(bullets([
        "In total-revenue mode, the range of the property type applies. In department mode, only "
        "the gaming stream has a range. It uses the stand-alone casino range (the slot parlor "
        "range for slot parlors).",
        "There is no range for bars and restaurants with slots, for tribal properties, for online "
        "operators or for jobs that you enter. These cases have no benchmark.",
        "Supplier and induced jobs have no observed benchmark. They enter the range as modeled.",
    ]))
    el.append(h2("6.4 Gaming-tax adjustment of direct labor income"))
    el.append(body(
        "Casino revenue includes the gaming tax. Thus a higher tax leaves a smaller share of "
        "revenue for labor. StateIO gives every state the national value-added composition of the "
        "sector, so the coefficient cannot show this. GEMS adjusts the direct compensation of "
        "land-based gaming revenue for the effective gaming tax rate τ:"))
    el.append(formula("adjusted direct compensation = model direct compensation × exp(-b τ)"))
    el.append(bullets([
        "b = 0.916 (SE 0.333, 95% CI 0.22 to 1.61, p = 0.012). It is the slope of a regression of "
        "log(model ÷ observed payroll share of revenue) on τ.",
        "The sample is 23 Economic Census cells of stand-alone casinos and casino hotels in states "
        "with commercial casinos, each with at least 50 employees.",
        "The intercept (-0.024, p = 0.81) is not different from zero. Thus the adjustment starts "
        "at τ = 0, where the coefficient has no bias.",
        "In leave-one-out prediction, the mean absolute log error of the payroll share decreases "
        "from 0.26 to 0.147.",
    ]))
    el.append(body(
        "The adjustment changes direct labor income only. Direct jobs and direct value added do "
        "not change. Lower labor income gives lower cash wages, lower payroll and income taxes and "
        "lower induced effects. Wages that you enter replace the adjusted value. The adjustment "
        "does not apply to online operators or to lodging, food and other revenue."))
    el.append(h2("6.5 Convergent validity of the multipliers"))
    el.append(body(
        "Supplier and induced effects have no observed benchmark. No agency measures them, and "
        "published total-impact figures are themselves model output. The only valid check is "
        "convergent validity with an independent model. BEA RIMS II regionalizes the national table "
        "with location quotients. StateIO uses estimates of trade between states."))
    el.append(body(
        "The validation repository rebuilds the GEMS national table with simple location quotients. The rebuild gives the "
        "RIMS II Type I output multipliers of four non-gaming industries in 50 states. The median ratio is "
        "1.00 and the mean absolute difference is 5%. With the GEMS household closure, the rebuild "
        "also gives the RIMS II Type II values (median ratio 0.99)."))
    el.append(body(
        "For those four industries, the GEMS Type I output multipliers are 0.89 of RIMS II, and the "
        "Type II multipliers are 0.82. For 713, 721 and 722, the GEMS Type I multipliers are 11% to "
        "13% below the rebuild. Thus the difference comes from the regionalization: StateIO keeps "
        "less of each round in the state. This check also found the problem with the earlier "
        "household closure (Section 3.4)."))

    # --- 7. Tax estimates ---------------------------------------------------
    el.append(h1("7. Tax estimates"))
    el.append(body(
        "Each tax line has one level of government: federal, or state and local. The lines do not "
        "overlap, so the total is their sum."))
    el.append(h2("7.1 Taxes on production and the statutory gaming tax"))
    el.append(body(
        "TOPI come from the I-O tables and go through the Leontief inverse. They include sales, "
        "property, excise, license and gross-receipts taxes of the property and its supply chain. "
        "BEA records state and local taxes on gaming receipts as taxes on products, as part of TOPI. "
        "StateIO gives all states the national TOPI of sector 713. If the model added the statutory "
        "gaming tax to this TOPI, it would count gaming taxes two times. Thus the statutory gaming "
        "tax replaces the gaming part of the direct TOPI of the gaming stream:"))
    el.append(formula("direct taxes on gaming = statutory gaming tax<br/>"
                      "&nbsp;&nbsp;+ nonGamingShare × I-O direct TOPI of the gaming stream"))
    el.append(body(
        "nonGamingShare = 0.346 is the share of other taxes on production (property taxes and "
        "licenses) in the TOPI of detail industry 713200. It is $737M of $2,130M in the 2017 BEA "
        "detail supply-use table. Supplier and induced TOPI do not change."))
    el.append(body(
        "The schedules are in webapp/src/data/gamingTaxRates.json. There are 26 state schedules "
        "for commercial casinos, 7 for iGaming and 34 for sports betting. 26 state entries record "
        "a verification against statutes and regulator reports in October 2026, with their "
        "sources. The model supports these structures:"))
    el.append(bullets([
        "a flat rate",
        "graduated tiers",
        "different rates for slots and table games, with a slot share that you can change",
        "separate graduated schedules for slots and table games",
        "a flat addition to any schedule, for example the city wagering tax of Detroit",
        "a tax on handle, which the model changes to a GGR rate with a stated hold",
    ]))
    el.append(h2("7.2 Payroll taxes"))
    el.append(body("The model includes these payroll taxes:"))
    el.append(bullets([
        "<b>Federal:</b> employer and employee Social Security (6.2% each, up to the wage cap of "
        "$184,500) and Medicare (1.45% each). FUTA is 0.6% of the first $7,000. The employer "
        "withholds the employee taxes from wages. They are federal revenue.",
        "<b>State:</b> unemployment insurance at the average employer rate of the state, up to its "
        "wage base, and employer SDI and paid-leave contributions where they exist. The model "
        "does not include employee SDI or paid-leave contributions.",
    ]))
    el.append(body(
        "The model calculates the taxes for each job at the average cash wage of each effect. "
        "Then it multiplies them by the number of jobs."))
    el.append(h2("7.3 Household income taxes"))
    el.append(body(
        "The model taxes the average wage of each effect as the income of a single filer with no "
        "dependents. It uses the 2025 federal and state schedules, and a typical local wage tax "
        "where local income taxes are common. The federal standard deduction is $15,750 "
        "(P.L. 119-21). State schedules include phase-outs, recaptures and deductions for federal "
        "tax."))
    el.append(body(
        "The script scripts/build_income_tax_tables.py makes the tables from "
        "data/income_tax_parameters_2025.json, with 1,337 self-checks. The model does not include "
        "household composition, refundable credits (EITC), itemized deductions or the federal "
        "deductions for tips and overtime (2025 to 2028)."))
    el.append(h2("7.4 Wage basis"))
    el.append(body(
        "StateIO V001 is BEA employee compensation. QCEW wages are lower for two reasons. First, "
        "compensation includes employer supplements. Second, BEA adds income that QCEW does not "
        "record, for example tips. These additions are large in gaming, lodging and food service, "
        "and they are not a tax base. The model changes compensation to QCEW-comparable cash wages "
        "by industry (webapp/src/data/wageBasis.json):"))
    el.append(table([
        ["Sector", "QCEW private wages ÷ BEA compensation, 2023"],
        ["713 Amusements, gambling and recreation", "0.698"],
        ["721 Accommodation", "0.757"],
        ["722 Food services and drinking places", "0.738"],
        ["711-712 Arts and entertainment", "0.834"],
        ["23 Construction", "0.821"],
        ["All private industries (supplier and induced effects, online operators)", "0.806"],
    ], [4.3 * inch, W - 4.3 * inch]))
    el.append(Spacer(1, 10))
    el.append(body(
        "Payroll and income taxes use cash wages. If you enter payroll, the model uses it as cash "
        "wages. It changes the payroll to compensation with the same shares."))

    # --- 8. Optional modules ------------------------------------------------
    el.append(h1("8. Optional modules"))
    el.append(h2("8.1 Net new impact"))
    el.append(body(
        "The headline results are a gross economic contribution, not a measure of welfare. "
        "Without this module, they include no displacement of other activity. The net-impact "
        "module gives the new activity that the property brings to the state:"))
    el.append(formula("net share = non-resident share + resident share × recapture share"))
    el.append(body(
        "The recapture share is the part of resident gaming expenditure that would go out of the "
        "state without the property. An example is play at casinos across the border. The model treats the "
        "remainder of resident expenditure as a transfer from other local businesses. Output, GDP, "
        "jobs and labor income change with the net share. Tax estimates stay gross. Neither result "
        "includes social costs."))
    el.append(h2("8.2 Construction phase"))
    el.append(body(
        "This module gives the one-time effect of the construction or expansion of a property. It "
        "uses the StateIO construction sector (23) of the state. The inputs are the construction "
        "cost, the share spent in the state and the construction period. The share spent in the "
        "state does not include land, gaming equipment or purchases from other states. Jobs are "
        "job-years for the period, and the module also gives the average jobs for each year. The "
        "calculator shows construction effects separately from the effects of operations."))

    # --- 9. Data sources ----------------------------------------------------
    el.append(h1("9. Data sources"))
    el.append(body("The model uses these data:"))
    el.append(table([
        ["Source", "Vintage", "Use"],
        ["EPA State Input-Output (StateIO) tables, stateior R package", "2019, 2023",
         "2019 production structure, and 2023 output for the jobs satellite"],
        ["BLS Quarterly Census of Employment and Wages (QCEW)", "2023",
         "Jobs for the employment satellite, average wages and validation"],
        ["BEA NIPA Tables 6.4D and 6.5D (FRED)", "2023", "FTEs for each job by industry"],
        ["BEA NIPA Table 2.1 (FRED: PCECA, A067RC1A027NBEA)", "2000-2023",
         "Household spending share (Section 3.4)"],
        ["BEA NIPA Tables 6.2D and 6.3D (FRED) and QCEW wages", "2023",
         "Wage basis by industry (Section 7.4)"],
        ["BEA detail tables in USEEIO v2.0.1-411 (useeior R package)", "2017",
         "Gambling ratios and the non-gaming share of gambling TOPI"],
        ["State statutes, regulator reports, AGA State of the States", "2025-2026",
         "Gaming tax schedules"],
        ["IRS Rev. Proc. 2024-40, P.L. 119-21, state 2025 instructions", "2025",
         "Income tax tables"],
        ["BLS CPI-U annual averages", "2019-2025", "Dollar year of revenue"],
        ["U.S. Census Bureau, 2022 Economic Census", "2022",
         "Validation of direct jobs, predictive ranges and the gaming-tax adjustment"],
        ["SEC filings of DraftKings, Rush Street Interactive and Flutter", "2024",
         "Online operator ratios"],
    ], [2.9 * inch, 0.9 * inch, W - 3.8 * inch]))
    el.append(Spacer(1, 10))
    el.append(body(
        "Multipliers are different in each state because of the structure of the economy, the "
        "supply chain and trade. A state with a more diversified economy has larger multipliers, "
        "because more purchases stay in the state."))

    # --- 10. References -----------------------------------------------------
    el.append(h1("10. References"))
    for ref in [
        "American Gaming Association. <i>State of the States</i>. Annual editions.",
        "Ingwersen, W. W., Li, M., Young, B., Vendries, J., &amp; Birney, C. (2022). USEEIO v2.0, "
        "the US environmentally-extended input-output model v2.0. <i>Scientific Data</i>, 9(1), 194.",
        "Leontief, W. (1936). Quantitative input and output relations in the economic systems of "
        "the United States. <i>The Review of Economics and Statistics</i>, 18(3), 105-125.",
        "Li, M., Ferreira, J. P., Court, C. D., et al. (2023). StateIO: open source economic "
        "input-output models for the 50 states of the United States of America. "
        "<i>International Regional Science Review</i>, 46(4), 428-481.",
        "Miller, R. E., &amp; Blair, P. D. (2009). <i>Input-Output Analysis: Foundations and "
        "Extensions</i> (2nd ed.). Cambridge University Press.",
        "U.S. Bureau of Economic Analysis. National Income and Product Accounts, Tables 2.1, 6.2D, "
        "6.3D, 6.4D and 6.5D.",
        "U.S. Bureau of Economic Analysis. Regional Input-Output Modeling System (RIMS II) User's "
        "Guide.",
        "U.S. Bureau of Labor Statistics. Quarterly Census of Employment and Wages, 2023 annual "
        "averages.",
        "U.S. Census Bureau. Economic Census: Summary Statistics for the U.S., States, and Selected "
        "Geographies: 2022.",
        "U.S. Environmental Protection Agency. stateior and useeior R packages. "
        "https://github.com/USEPA/stateior",
    ]:
        el.append(Paragraph(ref, S["reference"]))

    # --- About / contact ----------------------------------------------------
    el.append(Spacer(1, 14))
    el.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    el.append(h1("About the author"))
    el.append(body(
        f"{AUTHOR} is an economist. His work is the analysis of policy and of consumer behavior in "
        "the gaming industry. He has almost 20 years of applied research in the measurement of "
        "economic impact, in academia, industry and government. He is a tenured Associate "
        "Professor at the Carson College of Business, Washington State University."))
    el.append(body(
        "He has a Ph.D. "
        "in Hospitality Administration from the University of Nevada, Las Vegas, and an M.A. in "
        "Economics from the University of Toronto. His research includes 40 peer-reviewed "
        "publications and many industry reports."))
    el.append(body(
        f"For a custom economic impact analysis, contact {PUBLISHER} at {EMAIL}."))

    doc.build(el)
    print(f"Wrote {os.path.abspath(OUT_PATH)}")

if __name__ == "__main__":
    build()
