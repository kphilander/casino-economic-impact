# ============================================================================
# derive_gaming_topi_share.R
#
# Writes webapp/src/data/fiscalAssumptions.json: the share of the gambling
# stream's direct TOPI that is NOT state gaming (wagering/amusement) tax, so
# the statutory gaming tax can replace, rather than be added to, that part.
#
# Why: BEA records state and local taxes on gaming receipts and admissions
# (Census T11 "amusements" selective sales taxes) as taxes on products within
# TOPI, assigned to the amusement-and-gambling industry. StateIO then gives
# every state the national TOPI intensity. Adding the statutory gaming tax on
# top of the I-O TOPI would therefore count gaming taxes twice.
#
# Estimate: in the BEA 2017 detail supply-use table, industry 713200 (gambling
# except casino hotels) has TOPI of T00TOP (taxes on products, where gaming
# and amusement taxes sit) + T00OTOP (other taxes on production: property
# taxes, flat licenses). The non-gaming share is T00OTOP / (T00TOP + T00OTOP).
# Flat per-device license fees (Census T21) remain inside the retained share;
# non-gaming product taxes inside 713200 are removed with the gaming taxes.
# Both are small relative to GGR taxes.
#
# Sources: BEA, 2017 detail supply-use tables (via useeior
#   Detail_Use_SUT_2017_17sch); BEA GDP by State Concepts and Methods (2025),
#   amusement taxes assigned to "Amusement, gambling, and recreation";
#   Census Government Finance and Employment Classification Manual (2006), T11.
# Usage: Rscript scripts/derive_gaming_topi_share.R
# ============================================================================

suppressPackageStartupMessages(library(jsonlite))

use <- useeior::Detail_Use_SUT_2017_17sch
products   <- use["T00TOP", "713200"]
production <- use["T00OTOP", "713200"]
stopifnot(products > 0, production > 0,
          abs(use["VAPRO", "713200"] - use["VABAS", "713200"] - products) < 1)

share <- production / (products + production)
message(sprintf("713200 (2017): taxes on products %s, other taxes on production %s; non-gaming share %.4f",
                products, production, share))

out <- list(
  `_metadata` = list(
    generatedBy = "scripts/derive_gaming_topi_share.R",
    source = "BEA 2017 detail supply-use table (useeior::Detail_Use_SUT_2017_17sch), industry 713200",
    treatment = paste(
      "Statutory gaming tax replaces the gaming share of the gaming stream's direct TOPI.",
      "Direct taxes on gaming = statutory gaming tax + nonGamingShare x I-O direct TOPI.",
      "Supplier and induced TOPI are unchanged."
    )
  ),
  gamingTopi = list(
    nonGamingShare = round(share, 4),
    taxesOnProducts_M = products,
    otherTaxesOnProduction_M = production,
    note = paste(
      "Share of 713200's TOPI recorded as other taxes on production (property taxes,",
      "licenses) rather than taxes on products, where BEA records amusement and gaming",
      "taxes. StateIO assigns every state the national TOPI intensity, so the embedded",
      "gaming-tax amount is a national average unrelated to the state's own rate."
    ),
    tribal = paste(
      "Tribal casinos pay compact revenue shares rather than state gaming taxes and are",
      "largely exempt from state and local taxes on trust land; for tribal properties the",
      "gaming stream's direct TOPI is replaced entirely by the compact revenue share."
    )
  )
)
writeLines(toJSON(out, pretty = TRUE, auto_unbox = TRUE), "webapp/src/data/fiscalAssumptions.json")
message("Wrote webapp/src/data/fiscalAssumptions.json")
