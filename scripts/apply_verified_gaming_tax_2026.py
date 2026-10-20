"""Apply the October 2026 verified corrections to webapp/src/data/gamingTaxRates.json.

Each change below was checked against an official state source (statute,
regulator report or revenue department page) between 2026-10-15 and
2026-10-17, and Oklahoma, Connecticut, Illinois and Pennsylvania again on
2026-10-20; the URL is recorded in the entry's `sources`. Values marked
"inference" are arithmetic on those sources. The displayed descriptions are
then replaced with the plain-language (ASD-STE100) versions in
scripts/gaming_tax_descriptions.json. Run from the repo root:

    python3 -I scripts/apply_verified_gaming_tax_2026.py

Idempotent: re-running produces the same file.
"""
import json

PATH = "webapp/src/data/gamingTaxRates.json"
VERIFIED = "2026-10-17"
REVERIFIED = "2026-10-20"

with open(PATH) as fh:
    data = json.load(fh)
R = data["rates"]


def patch(state, sources, verified=VERIFIED, **fields):
    entry = R[state]
    for key, value in fields.items():
        if value is None:
            entry.pop(key, None)
        else:
            entry[key] = value
    entry["lastVerified"] = verified
    entry["sources"] = sources
    entry["sourceYear"] = 2026


def sub(state, key, **fields):
    entry = R[state][key]
    for k, v in fields.items():
        if v is None:
            entry.pop(k, None)
        else:
            entry[k] = v


# ---------------------------------------------------------------- Nevada
patch("Nevada", ["https://www.leg.state.nv.us/NRS/NRS-463.html"],
      rateStructure="tiered", flatRate=None,
      tiers=[{"threshold": 0, "rate": 0.035}, {"threshold": 0.6, "rate": 0.045},
             {"threshold": 1.608, "rate": 0.0675}],
      effectiveRate=0.0675,
      description="Graduated monthly license fee on gross revenue (NRS 463.370): 3.5% on the first $50,000 per month, 4.5% on $50,000-$134,000, 6.75% above. Thresholds annualized here ($0.6M, $1.608M); large casinos pay ~6.75%.",
      localTaxNotes="No GGR-based county tax. Flat per-device and per-game state and county fees (NRS 463.373-.390), e.g. $250/yr slot excise tax and $10/month county slot fee, are not modeled.")

# ---------------------------------------------------------------- New Jersey
patch("New Jersey", ["https://www.nj.gov/casinos/law/act/docs_article11/cca-article11.pdf",
                     "https://www.nj.gov/oag/ge/docs/Financials/QuarterlyFinRpt2025/AC%20Specific%20Taxes%20and%20Fees%201978-2025.pdf",
                     "https://pub.njleg.gov/Bills/2024/PL25/66_.HTM"],
      flatRate=0.0925, effectiveRate=0.0925,
      description="8% gross revenue tax (N.J.S.A. 5:12-144) plus the Investment Alternative Tax, satisfied at 1.25% when invested through CRDA (5:12-144.1; 2.5% if paid as tax). Effective 9.25%.",
      localTaxNotes="Atlantic City also receives PILOT payments and per-room/parking fees ($3 room fee, $3 parking fee, $2 room surcharge, $2 tourism fee) and the 9% luxury tax; these are not GGR taxes and are not modeled.")
sub("New Jersey", "iGaming", flatRate=0.2225,
    description="19.75% on internet gaming revenue from July 1, 2025 (P.L.2025, c.66; was 15%) plus the 5% statutory IAT satisfied by a 2.5% CRDA investment. Effective ~22.25%. The 8% casino tax does not apply.")
sub("New Jersey", "sportsBetting", flatRate=0.21,
    description="Online sports wagering 19.75% from July 1, 2025 (P.L.2025, c.66; was 13%) plus a 1.25% CRDA tax: ~21%. Retail sports wagering remains 8.5% + 1.25% = 9.75%.")

# ---------------------------------------------------------------- Pennsylvania
patch("Pennsylvania", ["https://www.palegis.us/statutes/consolidated (4 Pa.C.S. 1403, 1405, 1407, 13A62, 13A63, 13B52, 13C62-63)",
                       "Tax Reform Code of 1971, Art. XXV, 72 P.S. 2502 (additional 2% table game tax from Aug 1, 2016; made permanent by Act 25 of 2021)",
                       "https://gamingcontrolboard.pa.gov/sites/default/files/2026-01/012126%20Revenue%20year%20end%202025.pdf",
                       "https://gamingcontrolboard.pa.gov/sites/default/files/2026-04/FY%202025-2026%20Table%20Games%20Monthly%20Report_0.pdf"],
      verified=REVERIFIED, slotsRate=0.504, tableRate=0.16, effectiveRate=0.40,
      description="Category 1-2 slots: 34% state tax + 2% county local share + 5.5% Economic Development and Tourism Fund + 0.5% supplemental + Race Horse Development Fund (18% x racetrack-casino revenue share, capped at 12%; ~8.7% in 2025). PGCB-reported effective slot rate 50.4% (2025). Table games: 12% state tax (4 Pa.C.S. 13A62(a)(1)) + 2% additional state tax (Tax Reform Code 2502) + 2% local share (13A63) = 16%.",
      localTaxNotes="Host municipalities also receive a flat $10M/yr license operation fee (not a % of revenue; not modeled). Category 4 casinos pay exactly 54% on slots (50% + 4% local). Fully automated electronic table games: 12% + 34% (13A62(a)(2)) + 2% state + 2% local = 50%.")
sub("Pennsylvania", "iGaming", slotsRate=0.54, tableRate=0.16,
    description="Online slots 52% state + 2% local = 54% (4 Pa.C.S. 13B52); online table games and poker 14% + 2% = 16%.")
sub("Pennsylvania", "sportsBetting", flatRate=0.36,
    description="34% state + 2% local share on sports wagering revenue (4 Pa.C.S. 13C62-63) = 36%.")

# ---------------------------------------------------------------- Illinois
patch("Illinois", ["https://igb.illinois.gov/casino-gambling/casino-faq.html",
                   "https://ilga.gov/Documents/legislation/ilcs/documents/023000100K13.htm",
                   "230 ILCS 10/12 and 45/25-90 (FindLaw copies)"],
      verified=REVERIFIED,
      localTaxNotes="Admission tax $2 per person for licensees with <=1M admissions in 2004, $3 otherwise (230 ILCS 10/12(a)). The Chicago casino has its own combined state/city schedule (230 ILCS 10/13(a-5)(2)): slots 22.5% to 74.7% and tables 15% to 35% by revenue band; use a custom rate for Chicago.",
      description="Graduated wagering tax on AGR (230 ILCS 10/13(a-5)(1)). Electronic gaming: 15%, 22.5%, 27.5%, 32.5%, 37.5%, 45%, 50% at $25M, $50M, $75M, $100M, $150M, $200M. Table games: 15% to $25M, 20% above.")
sub("Illinois", "sportsBetting",
    tiers=[{"threshold": 0, "rate": 0.2}, {"threshold": 30, "rate": 0.25}, {"threshold": 50, "rate": 0.3},
           {"threshold": 100, "rate": 0.35}, {"threshold": 200, "rate": 0.4}],
    description="From July 1, 2024 (230 ILCS 45/25-90(d)): 20% of AGR to $30M, 25% $30-50M, 30% $50-100M, 35% $100-200M, 40% above $200M, applied separately to online and in-person revenue. Plus 2% on Cook County wagers and, from July 1, 2025, $0.25 per online wager for the first 20M wagers and $0.50 thereafter (not modeled).")

# ---------------------------------------------------------------- Indiana
patch("Indiana", ["https://www.in.gov/igc/files/reports/2025/2025-07-Revenue.pdf",
                  "IC 4-33-13-1.5, 4-33-12-1.5, 4-35-8-1 (FindLaw copies, current to Jan 1, 2026)"],
      tiers=[{"threshold": 0, "rate": 0.10}, {"threshold": 25, "rate": 0.2}, {"threshold": 50, "rate": 0.25},
             {"threshold": 75, "rate": 0.3}, {"threshold": 150, "rate": 0.35}, {"threshold": 600, "rate": 0.4}],
      additionalRate=0.03, effectiveRate=0.30,
      description="Graduated wagering tax on AGR (IC 4-33-13-1.5(a), FY2022+): 10% to $25M, 20%, 25%, 30%, 35%, 40% above $600M. Plus a licensee-specific supplemental wagering tax (IC 4-33-12-1.5; ~2.3-3.5% in 2025, capped at 3.5%), modeled at 3%.",
      localTaxNotes="The $3 admission tax was replaced by the supplemental wagering tax (HEA 1350, 2017). Casinos with prior-year AGR under $75M use a reduced schedule (2.5% on the first $25M, then 10%, 20%, 30-40%). Racinos (IC 4-35-8-1): 25% to $100M, 30% above, on 88% of revenue.")

# ---------------------------------------------------------------- Oklahoma (tribal, 2026-10-20)
# Model Tribal Gaming Compact, 3A O.S. 281, Part 11(A)(2): the bands are per
# tribe per calendar year. Nonhouse-banked table games pay 10% of net win
# under the 2018 supplement (3A O.S. 280.1). The 2020 renewal is automatic
# (Part 15(B)) and kept these rates. Informational only: tribal analyses use
# the revenue share that the user enters.
patch("Oklahoma", ["https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=441417",
                   "https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=482330"],
      verified=REVERIFIED, flatRate=None,
      tiers=[{"threshold": 0, "rate": 0.04}, {"threshold": 10, "rate": 0.05}, {"threshold": 20, "rate": 0.06}],
      tableRate=0.10, effectiveRate=0.06,
      description="No commercial casinos. Tribal gaming under the model compact (3A O.S. 281, Part 11(A)(2)): exclusivity fees of 4% of the first $10M, 5% of the next $10M and 6% above $20M of a tribe's annual adjusted gross revenue from electronic games, and 10% of monthly net win from nonhouse-banked card and table games. About 6% for a large tribe. The compacts renewed automatically on January 1, 2020, at these rates.")

# ---------------------------------------------------------------- Connecticut (tribal, 2026-10-20)
patch("Connecticut", ["https://portal.ct.gov/dcp/-/media/dcp/gaming/compacts-and-documents/mptn-mou-january-1993.pdf",
                      "https://portal.ct.gov/dcp/-/media/dcp/gaming/compacts-and-documents/mohegan-mou-may-1994.pdf",
                      "https://www.cga.ct.gov/2026/sup/chap_229b.htm",
                      "https://data.ct.gov/api/views/imqd-at3c"],
      verified=REVERIFIED,
      description="No commercial casinos. Foxwoods and Mohegan Sun pay 25% of slot machine revenue to the state under their memoranda of understanding (1993, 1994). They pay nothing on table game revenue.")
sub("Connecticut", "iGaming", flatRate=0.20,
    description="20% of online casino gaming GGR from October 2026, the sixth year after the first license (CGS 12-866(b)); 18% before. Offered only by the two tribes, through their online partners.")

# ---------------------------------------------------------------- Iowa
patch("Iowa", ["https://irgc.iowa.gov/news-release/2026-07-17/iowa-casino-and-sports-wagering-tax-revenue-exceeds-331-million-fiscal-year-2026",
               "Iowa Code 99F.11 (2026)"],
      tiers=[{"threshold": 0, "rate": 0.05}, {"threshold": 1, "rate": 0.1}, {"threshold": 3, "rate": 0.22}],
      effectiveRate=0.22,
      description="Graduated tax on AGR (Iowa Code 99F.11): 5% on the first $1M, 10% on the next $2M, 22% above $3M. Racetrack casinos with table games and prior-year AGR of $100M or more pay 24%.",
      localTaxNotes="No rate phase-down was enacted (the 2024 proposal, House Study Bill 719, did not pass). Promotional play is fully excluded from AGR from July 1, 2026 (SF 619). Sports wagering 6.75%.")

# ---------------------------------------------------------------- Michigan
patch("Michigan", ["https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-432-212",
                   "https://legislature.mi.gov/documents/mcl/pdf/MCL-432-213.pdf",
                   "https://sfa.senate.michigan.gov/Publications/OneFAB/2025/OneFAB08-25-2025cs.pdf"],
      flatRate=0.19, additionalRate=0.0125, effectiveRate=0.2025,
      description="Detroit commercial casinos: 8.1% state wagering tax (MCL 432.212(1)) + 10.9% city wagering tax (9.9% + 1%) = 19%, plus the municipal services fee of the greater of 1.25% of AGR or $4M (MCL 432.213). Total ~20.25%.",
      localTaxNotes="Development agreements add payments of 1% for casinos with AGR above $400M (Senate Fiscal Agency, 2025); not modeled. Tribal casinos operate under compacts.")

# ---------------------------------------------------------------- Ohio, Missouri, Kansas, Nebraska
patch("Ohio", ["https://codes.ohio.gov/ohio-revised-code/section-5753.02",
               "https://codes.ohio.gov/ohio-revised-code/section-5753.021",
               "https://codes.ohio.gov/ohio-revised-code/section-5753.03"],
      localTaxNotes="The 33% is distributed 51% counties, 34% school districts, 5% host city, 3% Casino Control Commission, 3% Racing Commission, 2% law enforcement training, 2% problem gambling (ORC 5753.03(D)). Racinos (video lottery terminals) are lottery revenue, not modeled here.")
sub("Ohio", "sportsBetting", flatRate=0.2,
    description="20% of sports gaming receipts from July 4, 2023 (ORC 5753.021, HB 33; was 10%).")

patch("Missouri", ["https://revisor.mo.gov/main/OneSection.aspx?section=313.822",
                   "https://revisor.mo.gov/main/OneSection.aspx?section=313.820",
                   "https://revisor.mo.gov/main/OneSection.aspx?section=III++++39(g)"],
      localTaxNotes="10% of the 21% goes to the home dock city or county. $2 admission fee per person per excursion ($1 state, $1 home dock; RSMo 313.820), not modeled.")
sub("Missouri", "sportsBetting", flatRate=0.1,
    description="10% of AGR for online and retail sports wagering (Mo. Const. Art. III, 39(g)); promotional-credit deduction capped at 25% of cash receipts.")

patch("Kansas", ["https://www.ksrevisor.gov/statutes/chapters/ch74/074_087_0034.html"],
      localTaxNotes="The 27% (K.S.A. 74-8734(h)) is a state share of not less than 22%, plus 2% to the Problem Gambling and Addictions Grant Fund and 3% to the host city and county. State-owned casinos managed by private operators.")

patch("Nebraska", ["https://nebraskalegislature.gov/laws/statutes.php?statute=9-1203",
                   "https://nebraskalegislature.gov/laws/statutes.php?statute=9-1204"],
      localTaxNotes="Initiative Law 2020 No. 431. Distribution (Neb. Rev. Stat. 9-1204): 70% Property Tax Credit Cash Fund, 25% to the county (split with the city inside city limits), 2.5% Compulsive Gamblers Assistance Fund, 2.5% General Fund.")

# ---------------------------------------------------------------- Maryland
patch("Maryland", ["https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gsg&section=9-1A-27",
                   "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gsg&section=9-1E-12",
                   "https://www.mdgaming.com/wp-content/uploads/2025/09/AUGUST-2025-CASINO-REVENUE-DATA.pdf"],
      slotsRate=0.53, tableRate=0.20, effectiveRate=0.45,
      description="Slot (VLT) proceeds are split by statute, with facility-specific operator shares. FY2026 non-operator shares: MGM National Harbor 56%, Live! 51%, Horseshoe Baltimore 53%, Hollywood Perryville 58%, Ocean Downs 47%, Rocky Gap 42%; modeled at 53% (the three large facilities). Table games: 20% (15% Education Trust Fund + 5% local).",
      localTaxNotes="Non-operator slot shares include the Education Trust Fund (27-43%), 6% purse dedication, 5.5% local impact grants, 1% racetrack renewal, 1% lottery agency and 1.5% small/minority/women-owned business fund. Use a custom rate for a specific facility.")
sub("Maryland", "sportsBetting", flatRate=0.2,
    description="Mobile sports wagering 20% from July 1, 2025 (licensee retains 80%; 9-1E-12); retail 15%.")

# ---------------------------------------------------------------- New York
patch("New York", ["https://www.nysenate.gov/legislation/laws/PML/1351",
                   "https://gaming.ny.gov/commercial-casinos",
                   "https://www.osc.ny.gov/files/reports/pdf/sports-wagering-in-new-york.pdf"],
      effectiveRate=0.30,
      description="Upstate commercial casinos: 30% on slots/ETGs and 10% on table games, a temporary reduced rate through June 30, 2031 (PML 1351(1)(b)); statutory base slot rates are 37-45% by region.",
      localTaxNotes="Downstate casinos licensed Dec 15, 2025 at bid rates: Resorts World NYC 56% slots / 30% tables, Hard Rock Metropolitan Park 25% / 10%, Bally's Bronx 30% / 10% (statutory floors 25% / 10%). VLT facilities: education receives 34-50.5% of net win plus 10% to the Lottery.")

# ---------------------------------------------------------------- Rhode Island
patch("Rhode Island", ["https://webserver.rilegislature.gov/Statutes/TITLE42/42-61.2/42-61.2-7.htm",
                       "https://webserver.rilegislature.gov/Statutes/TITLE42/42-61.2/42-61.2-5.1.htm",
                       "https://webserver.rilegislature.gov/Statutes/TITLE42/42-61.2/42-61.2-5.htm",
                       "https://www.oag.ri.gov/reports-financial/LotteryRI2025.pdf"],
      rateStructure="split_game_type", slotTableSplit=True, slotsRate=0.604, tableRate=0.165, effectiveRate=0.55,
      description="State-operated through the RI Lottery at Bally's Lincoln and Bally's Tiverton. VLTs: the state retains the residual after operator, technology-provider and town payments, 60.4% of net terminal income in FY2025. Table games: 15.5% to the state + 1% to the host town.",
      localTaxNotes="Host towns also receive a share of VLT revenue within the operator/town payments.")
sub("Rhode Island", "iGaming", rateStructure="split_game_type", flatRate=None, slotsRate=0.61, tableRate=0.155,
    description="iGaming: 61% of slot revenue (42-61.2-5.1) and 15.5% of table game revenue (42-61.2-5.2) to the state.")
sub("Rhode Island", "sportsBetting", flatRate=0.51,
    description="51% of sports wagering revenue to the state (42-61.2-5); IGT 32%, host facilities 17%.")

# ---------------------------------------------------------------- Delaware
patch("Delaware", ["https://delcode.delaware.gov/title29/c048/sc01/index.html",
                   "https://auditor.delaware.gov/wp-content/uploads/sites/209/2026/02/Delaware-State-Lottery-ACFR-FY25.pdf"],
      slotsRate=0.425, tableRate=0.155, effectiveRate=0.37,
      description="State-operated through the Delaware Lottery at three racinos. VLTs: 42.5% of net proceeds returned to the state after equipment costs (29 Del. C. 4815(b)(3)a; 40.5% for agents meeting the 3% capital-investment test). Table games: 15.5% to the state + 4.5% to purses.",
      localTaxNotes="Purses receive 9.6% (thoroughbred) or 11.35% (harness) of VLT proceeds, not counted as tax here.")
sub("Delaware", "iGaming", flatRate=0.255,
    description="The first $3.75M each year goes to the Lottery Fund; the remainder follows the VLT/table formulas after a 20% vendor fee and admin costs (4815(e)). FY2025 state gross margin ~25.5% of iGaming revenue (inference from the Lottery ACFR).")

# ---------------------------------------------------------------- West Virginia
patch("West Virginia", ["https://code.wvlegislature.gov/29-22A-10/", "https://code.wvlegislature.gov/29-22A-10b/",
                        "https://code.wvlegislature.gov/29-22C-26/", "https://code.wvlegislature.gov/29-22D-16/",
                        "https://code.wvlegislature.gov/29-22E-16/"],
      slotsRate=0.52, effectiveRate=0.47,
      description="Racetrack VLTs: government share of net terminal income above the FY2001 base (most current revenue) ~52% (inference from 29-22A-10b: a 10% surcharge of which 58% to the Excess Lottery Revenue Fund, then ~50% state funds + 2% county); ~45% on the base tier. Table games: 35% of AGR (29-22C-26). iGaming 15%; sports 10%.",
      localTaxNotes="The licensee retains 46.5% of base and 42% of excess net terminal income; purses, breeders and pension funds receive the remainder (not counted as tax). Limited video lottery (bars): 50% of net terminal income.")

# ---------------------------------------------------------------- Massachusetts, Maine
patch("Massachusetts", ["https://malegislature.gov/Laws/GeneralLaws/PartI/TitleII/Chapter23K/Section55",
                        "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleII/Chapter23N/Section14"],
      effectiveRate=0.25,
      description="Category 1 resort casinos (Encore Boston Harbor, MGM Springfield): 25% of GGR (G.L. c.23K 55(a)). Category 2 slots parlor (Plainridge Park): 40% + 9% Race Horse Development Fund = 49%; use a custom rate.")
patch("Maine", ["https://legislature.maine.gov/statutes/8/title8sec1036.html"],
      rateStructure="split_game_type", slotTableSplit=True, slotsRate=0.40, tableRate=0.16, effectiveRate=0.40,
      description="Facility-specific (8 M.R.S. 1036). Hollywood Casino Bangor: 39% of net slot income + 1% of gross for administration, tables 16%. Oxford Casino: 46% of net slot income, tables 16% (use a custom rate). Modeled at Bangor's rates.")

# ---------------------------------------------------------------- Mississippi
patch("Mississippi", ["https://www.dor.ms.gov/business/gaming", "https://peer.ms.gov/sites/default/files/peer_publications/rpt633.pdf"],
      tiers=[{"threshold": 0, "rate": 0.044}, {"threshold": 0.6, "rate": 0.066}, {"threshold": 1.608, "rate": 0.088}],
      additionalRate=0.032, effectiveRate=0.12,
      description="State tax (Miss. Code 75-76-177) 4% / 6% / 8% and local tax (75-76-195) 0.4% / 0.6% / 0.8% on monthly revenue up to $50K, $50-134K and above (annualized: $0.6M, $1.608M), plus a flat 3.2% local tax under local and private laws in most host jurisdictions. Top combined rate 12%.",
      localTaxNotes="The 3.2% local levy applies in most host jurisdictions (e.g. Biloxi, Gulfport, Tunica, Natchez); a few differ.")

# ---------------------------------------------------------------- Louisiana
patch("Louisiana", ["https://legis.la.gov/Legis/Law.aspx?d=85081", "https://legis.la.gov/Legis/Law.aspx?d=84935",
                    "https://legis.la.gov/Legis/Law.aspx?d=1239411"],
      localTaxNotes="Caesars New Orleans (land-based): the greater of 18.5% of gross revenue or $65M per year (R.S. 27:241.1), plus fixed payments; use a custom 18.5% rate. Racetrack slots: 18.5% state tax on net proceeds after the 18% owed to horsemen, plus 4% local (~19.2% of net slot proceeds to government; inference).",
      description="Riverboat casinos: 3.5% license fee + 15% franchise fee + 3% additional = 21.5% of net gaming proceeds (R.S. 27:91).")
sub("Louisiana", "sportsBetting", flatRate=0.215,
    description="Online sports wagering 21.5% of net gaming proceeds (R.S. 27:625(B), Act 298 of 2025; was 15%). Retail 10%.")

# ---------------------------------------------------------------- Florida
patch("Florida", ["https://www.flsenate.gov/Laws/Statutes/2026/551.106",
                  "https://www.flsenate.gov/PublishedContent/Offices/2020-2022/President/Documents/Summaryof2021Compact.pdf"],
      flatRate=0.34, effectiveRate=0.34,
      description="Pari-mutuel facilities with slot machines: 34% of slot revenue (Fla. Stat. 551.106, 2026; 35% through 2025). The Seminole Tribe operates the major casinos under the 2021 compact: revenue share on slots 12% to $2B rising to 25% above $3.5B, on tables 15% to $1B rising to 25% above $2B (enter as a custom rate for a tribal property).",
      localTaxNotes="Compact payments go to state general revenue; pari-mutuel slot taxes go to the state Educational Enhancement Trust Fund.",
      hasSportsBetting=True,
      sportsBetting={"rateStructure": "flat", "flatRate": 0.1375,
                     "description": "Statewide sports betting is offered by the Seminole Tribe (Hard Rock Bet) under the 2021 compact: 13.75% of the Tribe's own net win (10% on pari-mutuel partner brands)."})

# ---------------------------------------------------------------- New Mexico, Montana, Tennessee
patch("New Mexico", ["https://nmlegis.gov/Sessions/23%20Regular/final/SB0336.PDF"],
      flatRate=0.248, effectiveRate=0.248,
      description="Racetrack casinos: gaming tax of 24.8% of net take (Laws 2023, ch. 122) until July 1, 2027, when it reverts to 26%. Racetracks also pay 20% to purses and 1.2% for jockey insurance (not counted as tax). Tribal casinos operate under compacts with revenue sharing of 3-8.5%.")
patch("Montana", ["https://mca.legmt.gov/bills/mca/title_0230/chapter_0050/part_0060/section_0100/0230-0050-0060-0100.html"],
      flatRate=0.15,
      description="No full-scale commercial casinos. Video gambling machines in licensed bars and taverns (up to 20 per location): 15% of gross income, i.e. money played less cash credits paid (MCA 23-5-610).")
sub("Tennessee", "sportsBetting", flatRate=None, handleRate=0.0185, assumedHold=0.095,
    description="1.85% of gross handle (amount wagered) since July 1, 2023, replacing the 20% GGR tax. Converted to a GGR rate with an assumed 9.5% hold (1.85% / 9.5% = 19.5% of GGR); enter a custom rate if the operator's hold differs.")
R["Tennessee"]["description"] = "No commercial or tribal casino gambling. Online sports wagering only, taxed at 1.85% of handle since July 1, 2023."
R["Tennessee"]["lastVerified"] = VERIFIED
R["Tennessee"]["sources"] = ["https://www.tn.gov/content/dam/tn/swac/documents/report/2023/July.pdf"]

# ---------------------------------------------------------------- metadata
meta = data["metadata"]
notes = []
for n in meta["notes"] + [
        "October 2026: 28 states re-verified against statutes and regulator reports (entries carry lastVerified and sources). Flat add-ons on top of a schedule are coded as additionalRate; handle-based taxes as handleRate with an assumedHold.",
        "October 20, 2026: Oklahoma, Connecticut, Illinois and Pennsylvania re-verified. Connecticut online casino gaming is 20% from October 2026. Descriptions are in plain language (ASD-STE100)."]:
    if n not in notes:
        notes.append(n)          # each note once, so re-running changes nothing
meta["notes"] = notes
meta["sourceYear"] = "2026 (28 states re-verified October 2026)"

# ---------------------------------------------------------------- descriptions
# The schedule descriptions that the calculator shows, in ASD-STE100 plain
# language. Applied last so the statutory text above stays the record of
# what was verified.
with open("scripts/gaming_tax_descriptions.json") as fh:
    DESCRIPTIONS = json.load(fh)
for state, by_vertical in DESCRIPTIONS.items():
    for vertical, text in by_vertical.items():
        (R[state] if vertical == "land" else R[state][vertical])["description"] = text

with open(PATH, "w") as fh:
    fh.write(json.dumps(data, indent=2, ensure_ascii=True))
print("verified", sum(1 for v in R.values() if v.get("lastVerified") in (VERIFIED, REVERIFIED)), "states")
