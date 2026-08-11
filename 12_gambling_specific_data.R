# Backward-compatible entry point.
#
# The former version of this script contained a second set of hard-coded
# gambling ratios. There is now one canonical generator: national ratios are
# produced by 13_extract_national_naics_ratios.R and applied by
# generate_complete_multipliers.R.

source("generate_complete_multipliers.R")
