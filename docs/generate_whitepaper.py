#!/usr/bin/env python3
"""
Generate the GEMS methodology white paper PDF.

Output: webapp/public/GEMS-2026-Methodology.pdf (served by the web app at
<base>/GEMS-2026-Methodology.pdf and linked from the app footer).

Regenerate after editing:  python3 docs/generate_whitepaper.py
Keep the version and content in sync with docs/methodology.md and
webapp/src/brand.js.
"""

import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, HRFlowable, ListFlowable, ListItem, NextPageTemplate,
    PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

# ---------------------------------------------------------------------------
# Brand constants (mirror webapp/src/brand.js)
# ---------------------------------------------------------------------------
PRODUCT_NAME = "GEMS"
PRODUCT_FULL_NAME = "Gaming Economic Modeling System"
MODEL_VERSION = "2026"
DESCRIPTOR = "Casino Economic Impact Model"
PUBLISHER = "GP Consulting"
URL = "https://gamblingpolicy.com/tools/economic-impact/"
EMAIL = "info@gamblingpolicy.com"
CITATION = (
    f"Philander, K. (2026). {PRODUCT_NAME}: {PRODUCT_FULL_NAME} "
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
                textColor=NAVY, spaceBefore=18, spaceAfter=10),
    "h2": style("h2", fontName="Helvetica-Bold", fontSize=12, leading=16,
                textColor=BLUE, spaceBefore=12, spaceAfter=6),
    "abstract": style("abstract", fontSize=10.5, leading=16, leftIndent=24,
                      rightIndent=24, textColor=colors.HexColor("#2d3748")),
    "formula": style("formula", fontName="Courier-Bold", fontSize=11,
                     leading=15, leftIndent=36, textColor=NAVY,
                     spaceBefore=4, spaceAfter=10),
    "caption": style("caption", fontSize=8.5, leading=11, textColor=GRAY),
    "citation": style("citation", fontSize=9.5, leading=14, leftIndent=12,
                      rightIndent=12, textColor=NAVY),
    "reference": style("reference", fontSize=9, leading=13, leftIndent=18,
                       firstLineIndent=-18, spaceAfter=5),
    "toc": style("toc", fontSize=10.5, leading=20, textColor=TEXT),
}

def table(data, widths, header=True):
    t = Table(data, colWidths=widths, hAlign="LEFT")
    cmds = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), TEXT),
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
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    t.setStyle(TableStyle(cmds))
    return t

def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(i, S["body"]), leftIndent=18) for i in items],
        bulletType="bullet", start="•", bulletFontSize=9, leftIndent=18,
    )

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
    canvas.drawString(x, 4.55 * inch, "Dr. Kahlil Philander")
    canvas.setFillColor(LIGHT_BLUE)
    canvas.setFont("Helvetica", 10.5)
    canvas.drawString(x, 4.3 * inch, PUBLISHER)
    canvas.drawString(x, 4.08 * inch, "June 2026")

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
                      f"{PRODUCT_NAME} {MODEL_VERSION} — {PRODUCT_FULL_NAME}")
    canvas.setFont("Helvetica", 9)
    canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 0.36 * inch,
                           "Methodology White Paper")
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
def build():
    doc = BaseDocTemplate(
        os.path.abspath(OUT_PATH), pagesize=letter,
        title=f"{PRODUCT_NAME} {MODEL_VERSION} Methodology White Paper",
        author="Dr. Kahlil Philander", subject=f"{PRODUCT_FULL_NAME} — {DESCRIPTOR}",
        creator=PUBLISHER,
    )
    cover_frame = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN, id="cover")
    body_frame = Frame(MARGIN, 0.85 * inch, PAGE_W - 2 * MARGIN,
                       PAGE_H - 0.85 * inch - 0.95 * inch, id="body")
    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[cover_frame], onPage=draw_cover),
        PageTemplate(id="Body", frames=[body_frame], onPage=draw_body),
    ])

    el = []
    el.append(NextPageTemplate("Body"))
    el.append(PageBreak())

    # --- Abstract ---
    el.append(Paragraph("Abstract", S["h1"]))
    el.append(Paragraph(
        f"{PRODUCT_NAME} ({PRODUCT_FULL_NAME}) is a state-level economic impact model for casino "
        "and gaming operations covering all 50 US states and the District of Columbia. The model "
        "applies Input-Output (IO) analysis under the Industry Technology Assumption, using EPA "
        "State Input-Output tables, BLS Quarterly Census of Employment and Wages data, and "
        "gambling-specific coefficients derived from BEA Detail IO tables. For a given revenue "
        "profile, the model estimates direct, indirect, and induced effects on economic output, "
        "GDP (value added), employment, wages, and tax revenue. This white paper documents the "
        f"modeling framework, data sources, and key methodological decisions of the {MODEL_VERSION} "
        "edition, and describes the model's appropriate uses and limitations.", S["abstract"]))
    el.append(Spacer(1, 8))
    el.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    el.append(Spacer(1, 8))
    el.append(Paragraph("<b>Suggested citation</b>", S["h2"]))
    el.append(Paragraph(CITATION, S["citation"]))
    el.append(Paragraph(
        "When citing results produced by the model, please also state the analysis date and the "
        "inputs used (state, property type, and revenue assumptions), as results depend on "
        "user-supplied inputs.", S["caption"]))

    # --- Contents ---
    el.append(PageBreak())
    el.append(Paragraph("Contents", S["h1"]))
    for i, t in enumerate([
        "Introduction", "Modeling Framework", "Effect Decomposition",
        "Employment Estimation", "Inflation Adjustment", "Gambling-Specific Adjustments",
        "Tax Revenue Estimation", "Data Sources", "Sector and Property-Type Mapping",
        "Limitations and Appropriate Use", "Versioning", "References",
    ], start=1):
        el.append(Paragraph(f"{i}.&nbsp;&nbsp;{t}", S["toc"]))
    el.append(PageBreak())

    # --- 1. Introduction ---
    el.append(Paragraph("1. Introduction", S["h1"]))
    el.append(Paragraph(
        "Casino developments are routinely evaluated on their wider economic contribution: the jobs "
        "they support, the value they add to regional GDP, and the tax revenue they generate. Yet "
        "general-purpose economic multipliers are poorly suited to gaming. Published entertainment "
        "and recreation multipliers blend casinos with golf courses, fitness centers, and amusement "
        "parks — businesses with fundamentally different cost structures and labor intensities.", S["body"]))
    el.append(Paragraph(
        f"{PRODUCT_NAME} addresses this gap. It combines state-specific Input-Output multipliers with "
        "gambling-specific industry coefficients and property-type-specific revenue structures to "
        "produce defensible, state-level estimates of the economic footprint of casino and gaming "
        "operations. The model supports land-based property types (casino hotels, stand-alone "
        "casinos, slot parlors, and bar/restaurant gaming) as well as online casino and sports "
        "betting operations.", S["body"]))
    el.append(Paragraph(
        "For each analysis, the model reports five metrics — gross output, GDP (value added), "
        "employment, wages, and tax revenue — each decomposed into direct, indirect, and induced "
        "components with the implied multipliers.", S["body"]))

    # --- 2. Modeling framework ---
    el.append(Paragraph("2. Modeling Framework", S["h1"]))
    el.append(Paragraph("2.1 Industry Technology Assumption", S["h2"]))
    el.append(Paragraph(
        "The model is built on the Industry Technology Assumption (ITA) framework of Input-Output "
        "economics. The direct requirements matrix is constructed from the Make and Use tables:", S["body"]))
    el.append(Paragraph("A = D × B", S["formula"]))
    el.append(Paragraph(
        "where <b>D</b> is the market share matrix derived from the Make table (the share of each "
        "commodity produced by each industry) and <b>B</b> is the commodity coefficient matrix "
        "derived from the Use table (the amount of each commodity required per dollar of output). "
        "The result <b>A</b> is an industry-by-industry direct requirements matrix.", S["body"]))
    el.append(Paragraph("2.2 Leontief Inverse and Type I Multipliers", S["h2"]))
    el.append(Paragraph("L = (I − A)⁻¹", S["formula"]))
    el.append(Paragraph(
        "The Leontief inverse captures all rounds of inter-industry purchasing. Each column sum "
        "gives the Type I output multiplier — total output generated per dollar of direct output, "
        "including all supplier (indirect) effects.", S["body"]))
    el.append(Paragraph("2.3 Type II Augmentation", S["h2"]))
    el.append(Paragraph(
        "The A matrix is augmented with a household row (labor income coefficients) and household "
        "column (consumer spending patterns). The augmented Leontief inverse yields Type II "
        "multipliers, which additionally capture induced effects from the spending of wages earned "
        "in direct and indirect activity.", S["body"]))

    # --- 3. Effect decomposition ---
    el.append(Paragraph("3. Effect Decomposition", S["h1"]))
    el.append(table([
        ["Effect", "Source", "Example"],
        ["Direct", "The initial economic activity",
         "Casino hires employees, pays wages, generates revenue"],
        ["Indirect", "Supply-chain purchasing",
         "Casino buys food, linens, and equipment from suppliers; suppliers buy from their suppliers"],
        ["Induced", "Household spending",
         "Casino and supplier employees spend wages on housing, groceries, and services"],
    ], [0.9 * inch, 1.9 * inch, 3.9 * inch]))
    el.append(Spacer(1, 10))
    el.append(Paragraph("Effects are decomposed from the multiplier pairs as follows:", S["body"]))
    el.append(Paragraph(
        "Direct output   = revenue<br/>"
        "Indirect output = revenue × (Type I − 1)<br/>"
        "Induced output  = revenue × (Type II − Type I)<br/>"
        "Total output    = revenue × Type II", S["formula"]))
    el.append(Paragraph(
        "The same decomposition applies to GDP, wages, and tax metrics using their respective "
        "multiplier pairs.", S["body"]))

    # --- 4. Employment ---
    el.append(Paragraph("4. Employment Estimation", S["h1"]))
    el.append(Paragraph(
        "Employment is estimated with employment-weighted coefficients rather than output-based "
        "multipliers, because a dollar of indirect or induced GDP generates more or fewer jobs "
        "depending on whether it flows to labor-intensive sectors (restaurants) or capital-intensive "
        "sectors (utilities):", S["body"]))
    el.append(Paragraph("Jobs = GDP_effect × Employment_Coefficient", S["formula"]))
    el.append(table([
        ["Coefficient", "Applies to", "Reflects"],
        ["Emp_Coef", "Direct employment", "Labor intensity of the gaming industry itself"],
        ["Indirect_Emp_Coef", "Indirect employment",
         "Weighted average labor intensity of supplier industries"],
        ["Induced_Emp_Coef", "Induced employment",
         "Weighted average labor intensity of household-spending industries"],
    ], [1.5 * inch, 1.7 * inch, 3.5 * inch]))
    el.append(Spacer(1, 10))
    el.append(Paragraph(
        "Coefficients are expressed as jobs per $1M of value added (GDP), not gross output. Using "
        "gross output as the denominator would double-count intermediate purchases and understate "
        "the jobs-per-dollar ratio. Coefficients are computed from the Leontief inverse weighted by "
        "sector-level employment-to-GDP ratios from QCEW data. When users provide actual employment "
        "or wage figures, the model uses those values for the direct effect and estimates only the "
        "indirect and induced components.", S["body"]))

    # --- 5. Inflation ---
    el.append(Paragraph("5. Inflation Adjustment", S["h1"]))
    el.append(Paragraph(
        "Employment coefficients are calibrated to 2019 dollars (the base year of the IO tables). "
        "Revenue entered in current-year dollars is deflated with the CPI-U annual average before "
        "employment coefficients are applied:", S["body"]))
    el.append(Paragraph(
        "Deflator = CPI_2019 / CPI_current_year<br/>"
        "Jobs = (GDP_current × Deflator) × Employment_Coefficient", S["formula"]))
    el.append(Paragraph(
        "Without this adjustment, nominal revenue growth would be misread as real growth, "
        "overstating employment by the cumulative inflation since the base year.", S["body"]))

    # --- 6. Gambling-specific adjustments ---
    el.append(Paragraph("6. Gambling-Specific Adjustments", S["h1"]))
    el.append(Paragraph(
        "Published IO tables contain only the blended sector 713 (Amusement, Gambling, and "
        "Recreation). The model applies adjustment factors derived from the BEA Detail IO tables "
        "(USEEIOv2.0.1-411) to isolate gambling-specific (NAICS 713200) coefficients:", S["body"]))
    el.append(table([
        ["Coefficient", "Blended 713", "Gambling (713200)", "Ratio"],
        ["Value added", "0.651", "0.577", "0.89"],
        ["Wages", "0.406", "0.255", "0.63"],
        ["TOPI", "0.058", "0.035", "0.61"],
    ], [1.6 * inch, 1.4 * inch, 1.7 * inch, 1.0 * inch]))
    el.append(Spacer(1, 10))
    el.append(Paragraph(
        "These ratios are applied to state-level blended multipliers to produce gambling-specific "
        "direct coefficients. Indirect and induced effects reflect supply-chain and household "
        "spending across other sectors, so no gambling adjustment is applied to those components.", S["body"]))

    # --- 7. Taxes ---
    el.append(Paragraph("7. Tax Revenue Estimation", S["h1"]))
    el.append(Paragraph("The model computes three categories of tax revenue:", S["body"]))
    el.append(Paragraph("7.1 Taxes on Production and Imports (TOPI)", S["h2"]))
    el.append(Paragraph(
        "Derived from the IO tables, TOPI flows through the Leontief inverse like wages and captures "
        "sales, property, excise, and other production-related taxes across all direct, indirect, "
        "and induced activity.", S["body"]))
    el.append(Paragraph("7.2 Gaming Tax", S["h2"]))
    el.append(Paragraph(
        "A state-specific tax on Gross Gaming Revenue (GGR), sourced from state gaming commission "
        "reports and the AGA State of the States. Supported structures:", S["body"]))
    el.append(bullets([
        "<b>Flat rate</b> — a single percentage (e.g., Nevada at 6.75%)",
        "<b>Graduated tiers</b> — increasing rates at revenue thresholds (e.g., Colorado, Iowa)",
        "<b>Split by game type</b> — different rates for slots vs. table games (e.g., Pennsylvania)",
        "<b>Split-tiered</b> — separate graduated schedules for slots and tables (e.g., Illinois)",
    ]))
    el.append(Paragraph("7.3 Payroll and Household Taxes", S["h2"]))
    el.append(Paragraph(
        "Employer-side payroll taxes (FICA, FUTA, SUTA, and state-specific SDI/PFML contributions) "
        "are applied to estimated wages. Household income taxes on supported wages are estimated "
        "via BEA personal current tax ratios (federal, state, and local).", S["body"]))

    # --- 8. Data sources ---
    el.append(Paragraph("8. Data Sources", S["h1"]))
    el.append(table([
        ["Source", "Vintage", "Use"],
        ["EPA State Input-Output (StateIO) models,\nvia the stateior R package", "2019",
         "State multipliers (pre-pandemic year avoids\ndistorted 2020 relationships)"],
        ["BLS Quarterly Census of Employment\nand Wages (QCEW)", "2023 annual\naverages",
         "Employment and wage coefficients"],
        ["BEA Detail IO tables via useeior\n(USEEIOv2.0.1-411)", "2017\nbenchmark",
         "Gambling-specific adjustment factors"],
        ["State gaming commissions,\nAGA State of the States", "Current",
         "Gaming tax schedules"],
        ["BLS CPI-U annual averages", "Current", "Inflation adjustment"],
    ], [2.7 * inch, 1.1 * inch, 2.9 * inch]))
    el.append(Spacer(1, 10))
    el.append(Paragraph(
        "Multipliers vary significantly across states due to differences in economic structure, "
        "supply-chain density, and trade patterns. States with more diversified, self-sufficient "
        "economies tend to have higher multipliers because more supplier spending stays in-state.", S["body"]))

    # --- 9. Mapping ---
    el.append(Paragraph("9. Sector and Property-Type Mapping", S["h1"]))
    el.append(Paragraph(
        "Revenue entered by department is mapped to the corresponding IO sector with state-specific "
        "multipliers:", S["body"]))
    el.append(table([
        ["IO sector", "NAICS", "Casino department"],
        ["711AS", "711, 712", "Other (entertainment, retail)"],
        ["713", "713", "Gaming (GGR)"],
        ["721", "721", "Lodging"],
        ["722", "722", "Food & Beverage"],
    ], [1.3 * inch, 1.3 * inch, 4.1 * inch]))
    el.append(Spacer(1, 10))
    el.append(Paragraph(
        "When total revenue is entered instead, the model applies property-type-specific "
        "multipliers. Each property type carries its own multiplier set reflecting its economic "
        "structure:", S["body"]))
    el.append(table([
        ["NAICS", "Property type", "Typical operations"],
        ["721120", "Casino Hotel", "Full-service resort with gaming, lodging, F&B"],
        ["713210", "Stand-alone Casino", "Gaming facility without hotel"],
        ["713290", "Slot Parlor", "Slot machines / VLTs only"],
        ["722410", "Bar/Restaurant Gaming", "Gaming secondary to food/beverage service"],
        ["—", "Online Casino / Sports Betting", "Remote gaming operations (separate multiplier sets)"],
    ], [0.9 * inch, 2.1 * inch, 3.7 * inch]))

    # --- 10. Limitations ---
    el.append(Paragraph("10. Limitations and Appropriate Use", S["h1"]))
    el.append(bullets([
        "Results are <b>estimates</b> based on average inter-industry relationships; they should be "
        "interpreted as indicative rather than definitive.",
        "State-level analysis captures only impacts within the state boundary; spending that "
        "“leaks” to other states is excluded. This yields conservative estimates of local benefits.",
        "IO models assume fixed production technology and no supply constraints; very large "
        "projects may alter local economic structure in ways the model does not capture.",
        "The model is appropriate for policy analysis, planning, and comparative assessment. It is "
        "<b>not</b> appropriate for precise forecasting, investment decisions without professional "
        "advice, or legal proceedings.",
    ]))

    # --- 11. Versioning ---
    el.append(Paragraph("11. Versioning", S["h1"]))
    el.append(Paragraph(
        f"The model version is the release edition year (e.g., {PRODUCT_NAME} {MODEL_VERSION}). When "
        "a new edition is published — whether from regenerated datasets or methodology updates — "
        "the version is bumped and this document is updated. Reports generated by the calculator "
        "embed the model version and the data vintages used, so results remain traceable.", S["body"]))
    el.append(table([
        ["Version", "Released", "Notes"],
        [f"{PRODUCT_NAME} {MODEL_VERSION}", "2026",
         "Initial release. 2019 EPA StateIO multipliers, 2023 QCEW employment, "
         "USEEIOv2.0.1-411 gambling adjustments."],
    ], [1.2 * inch, 1.0 * inch, 4.5 * inch]))

    # --- References ---
    el.append(Paragraph("12. References", S["h1"]))
    for ref in [
        "American Gaming Association. <i>State of the States</i>. Annual editions.",
        "Ingwersen, W., et al. <i>stateior</i> and <i>useeior</i> R packages. US Environmental "
        "Protection Agency. https://github.com/USEPA/stateior",
        "Leontief, W. (1936). Quantitative input and output relations in the economic systems of "
        "the United States. <i>The Review of Economics and Statistics</i>, 18(3), 105–125.",
        "Miller, R. E., &amp; Blair, P. D. (2009). <i>Input-Output Analysis: Foundations and "
        "Extensions</i> (2nd ed.). Cambridge University Press.",
        "US Bureau of Economic Analysis. Detail Input-Output tables (USEEIOv2.0.1-411).",
        "US Bureau of Labor Statistics. Quarterly Census of Employment and Wages, 2023 annual averages.",
    ]:
        el.append(Paragraph(ref, S["reference"]))

    # --- About / contact ---
    el.append(Spacer(1, 14))
    el.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    el.append(Paragraph("About the Author", S["h1"]))
    el.append(Paragraph(
        "Dr. Kahlil Philander is an economist specializing in the analysis of policy and consumer "
        "behavior in the gaming industry, with nearly 20 years of applied research experience in "
        "economic impact measurement across academia, industry, and government. He is a tenured "
        "Associate Professor at Washington State University's Carson College of Business, holds a "
        "Ph.D. in Hospitality Administration from the University of Nevada, Las Vegas, and an M.A. "
        "in Economics from the University of Toronto. His research portfolio includes 40 "
        "peer-reviewed publications alongside dozens of industry reports.", S["body"]))
    el.append(Paragraph(
        f"For customized economic impact analysis, contact {PUBLISHER} at {EMAIL}.", S["body"]))

    doc.build(el)
    print(f"Wrote {os.path.abspath(OUT_PATH)}")

if __name__ == "__main__":
    build()
