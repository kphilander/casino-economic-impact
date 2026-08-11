# Offline provenance checks for the national detailed-industry ratios used to
# adapt StateIO parent-sector multipliers. This test intentionally consumes the
# versioned generator outputs rather than rebuilding USEEIO from the network.

file_arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
script_path <- normalizePath(sub("^--file=", "", file_arg[[1]]))
repo_root <- dirname(dirname(script_path))

detail <- read.csv(
  file.path(repo_root, "bea_detail_coefficients.csv"),
  stringsAsFactors = FALSE,
  check.names = FALSE
)
parents <- read.csv(
  file.path(repo_root, "blended_parent_coefficients.csv"),
  stringsAsFactors = FALSE,
  check.names = FALSE
)
ratios <- read.csv(
  file.path(repo_root, "national_naics_ratios.csv"),
  stringsAsFactors = FALSE,
  check.names = FALSE
)

assert_close <- function(actual, expected, label, tolerance = 1e-12) {
  if (length(actual) != length(expected) ||
      any(!is.finite(actual)) ||
      any(!is.finite(expected)) ||
      any(abs(actual - expected) > tolerance)) {
    stop(
      sprintf(
        "%s mismatch: actual=%s expected=%s",
        label,
        paste(format(actual, digits = 16), collapse = ", "),
        paste(format(expected, digits = 16), collapse = ", ")
      ),
      call. = FALSE
    )
  }
}

required_detail <- c(
  "713100/US", "713200/US", "713900/US",
  "721000/US", "722110/US", "722A00/US"
)
stopifnot(
  identical(sort(detail$bea_code), sort(required_detail)),
  nrow(parents) == 3L,
  nrow(ratios) == 4L,
  !anyDuplicated(ratios$property_type)
)

weighted_parent <- function(codes, field) {
  rows <- detail[match(codes, detail$bea_code), ]
  weighted.mean(rows[[field]], rows$output_M)
}

expected_parents <- data.frame(
  parent_sector = c(713L, 721L, 722L),
  va_blended = c(
    weighted_parent(c("713100/US", "713200/US", "713900/US"), "va_direct"),
    detail$va_direct[detail$bea_code == "721000/US"],
    weighted_parent(c("722110/US", "722A00/US"), "va_direct")
  ),
  wage_blended = c(
    weighted_parent(c("713100/US", "713200/US", "713900/US"), "wage_direct"),
    detail$wage_direct[detail$bea_code == "721000/US"],
    weighted_parent(c("722110/US", "722A00/US"), "wage_direct")
  ),
  topi_blended = c(
    weighted_parent(c("713100/US", "713200/US", "713900/US"), "topi_direct"),
    detail$topi_direct[detail$bea_code == "721000/US"],
    weighted_parent(c("722110/US", "722A00/US"), "topi_direct")
  ),
  emp_blended_perM = c(
    weighted_parent(c("713100/US", "713200/US", "713900/US"), "emp_direct_perM"),
    detail$emp_direct_perM[detail$bea_code == "721000/US"],
    weighted_parent(c("722110/US", "722A00/US"), "emp_direct_perM")
  ),
  type_i_blended = c(
    weighted_parent(c("713100/US", "713200/US", "713900/US"), "type_i_output"),
    detail$type_i_output[detail$bea_code == "721000/US"],
    weighted_parent(c("722110/US", "722A00/US"), "type_i_output")
  ),
  type_i_va_blended = c(
    weighted_parent(c("713100/US", "713200/US", "713900/US"), "type_i_va"),
    detail$type_i_va[detail$bea_code == "721000/US"],
    weighted_parent(c("722110/US", "722A00/US"), "type_i_va")
  ),
  type_i_wage_blended = c(
    weighted_parent(c("713100/US", "713200/US", "713900/US"), "type_i_wage"),
    detail$type_i_wage[detail$bea_code == "721000/US"],
    weighted_parent(c("722110/US", "722A00/US"), "type_i_wage")
  ),
  type_i_topi_blended = c(
    weighted_parent(c("713100/US", "713200/US", "713900/US"), "type_i_topi"),
    detail$type_i_topi[detail$bea_code == "721000/US"],
    weighted_parent(c("722110/US", "722A00/US"), "type_i_topi")
  )
)

parents <- parents[match(expected_parents$parent_sector, parents$parent_sector), ]
for (field in setdiff(names(expected_parents), "parent_sector")) {
  assert_close(parents[[field]], expected_parents[[field]], paste("parent", field))
}

mapping <- data.frame(
  property_type = c(721120L, 713210L, 713290L, 722410L),
  bea_proxy = c("721000/US", "713200/US", "713200/US", "722A00/US"),
  parent_io_sector = c(721L, 713L, 713L, 722L)
)

ratios <- ratios[match(mapping$property_type, ratios$property_type), ]
stopifnot(
  identical(ratios$bea_proxy, mapping$bea_proxy),
  identical(ratios$parent_io_sector, mapping$parent_io_sector),
  identical(
    ratios$calibration_role,
    c("comparison_only", "canonical_gambling",
      "canonical_gambling", "comparison_only")
  )
)

proxy <- detail[match(mapping$bea_proxy, detail$bea_code), ]
parent <- parents[match(mapping$parent_io_sector, parents$parent_sector), ]

assert_close(ratios$va_ratio, proxy$va_direct / parent$va_blended, "VA ratios")
assert_close(ratios$wage_ratio, proxy$wage_direct / parent$wage_blended, "compensation ratios")
assert_close(ratios$topi_ratio, proxy$topi_direct / parent$topi_blended, "TOPI ratios")
assert_close(ratios$emp_ratio, proxy$emp_direct_perM / parent$emp_blended_perM, "jobs ratios")
assert_close(
  ratios$emp_va_ratio,
  (proxy$emp_direct_perM / proxy$va_direct) /
    (parent$emp_blended_perM / parent$va_blended),
  "jobs/value-added ratios"
)
assert_close(
  ratios$type_i_output_ratio,
  proxy$type_i_output / parent$type_i_blended,
  "Type I output ratios"
)
assert_close(
  ratios$output_indirect_ratio,
  (proxy$type_i_output - 1) / (parent$type_i_blended - 1),
  "indirect output ratios"
)
assert_close(
  ratios$va_indirect_ratio,
  (proxy$type_i_va - proxy$va_direct) /
    (parent$type_i_va_blended - parent$va_blended),
  "indirect VA ratios"
)
assert_close(
  ratios$wage_indirect_ratio,
  (proxy$type_i_wage - proxy$wage_direct) /
    (parent$type_i_wage_blended - parent$wage_blended),
  "indirect compensation ratios"
)
assert_close(
  ratios$topi_indirect_ratio,
  (proxy$type_i_topi - proxy$topi_direct) /
    (parent$type_i_topi_blended - parent$topi_blended),
  "indirect TOPI ratios"
)

# The two labels share a BEA proxy by construction. A future distinct estimate
# must change the source mapping rather than silently editing one deployed row.
casino_ratio <- ratios[ratios$property_type == 713210L, ]
slot_ratio <- ratios[ratios$property_type == 713290L, ]
ratio_fields <- setdiff(names(ratios), c("property_type", "property_label"))
stopifnot(identical(as.list(casino_ratio[1, ratio_fields]),
                    as.list(slot_ratio[1, ratio_fields])))

message("USEEIO provenance checks passed for 6 detail sectors and 4 property mappings.")
