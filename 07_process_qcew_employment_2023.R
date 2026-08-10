# ============================================================================
# EXTRACT THE FOUR TARGET SECTORS FROM THE REPRODUCIBLE QCEW SATELLITE
# ============================================================================
#
# Script 08a is the single QCEW ingestion and StateIO-mapping step. This
# compatibility script creates the smaller target-sector file used by older
# workflows without reading a second, developer-specific collection of files.
# ============================================================================

library(dplyr)

input_file <- Sys.getenv(
  "GEMS_QCEW_ALL_SECTORS_FILE",
  unset = "employment_all_sectors_2023.csv"
)
output_file <- Sys.getenv(
  "GEMS_QCEW_TARGET_SECTORS_FILE",
  unset = "employment_by_state_2023.csv"
)

if (!file.exists(input_file)) {
  stop("Missing ", input_file, "; run 08a_process_all_qcew_employment.R first")
}

target_sectors <- c("711AS", "713", "721", "722")
employment <- read.csv(input_file, stringsAsFactors = FALSE) %>%
  filter(io_sector %in% target_sectors) %>%
  arrange(state_name, io_sector)

stopifnot(
  nrow(employment) == 200L,
  length(unique(employment$state_name)) == 50L,
  identical(sort(unique(employment$io_sector)), sort(target_sectors))
)

write.csv(employment, output_file, row.names = FALSE)
message("Saved ", nrow(employment), " target-sector rows to ", output_file)
