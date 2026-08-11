# ============================================================================
# BUILD THE 2023 QCEW EMPLOYMENT SATELLITE FOR ALL STATEIO SUMMARY SECTORS
# ============================================================================
#
# Source: BLS QCEW 2023 annual singlefile
#   https://data.bls.gov/cew/data/files/2023/csv/2023_annual_singlefile.zip
#
# The script uses exact annual NAICS aggregates, not a prefix match over
# detailed rows. This prevents double counting. Private ownership supplies the
# commodity-industry sectors. Public-administration ownership supplies limited
# government proxies. StateIO's synthetic housing and government-enterprise
# sectors have no defensible QCEW equivalent and are explicitly assigned zero.
#
# Output: employment_all_sectors_2023.csv (50 states x 71 sectors)
# ============================================================================

library(data.table)

qcew_year <- 2023L
qcew_url <- paste0(
  "https://data.bls.gov/cew/data/files/", qcew_year,
  "/csv/", qcew_year, "_annual_singlefile.zip"
)
qcew_zip <- Sys.getenv(
  "GEMS_QCEW_SINGLEFILE_ZIP",
  unset = paste0(qcew_year, "_annual_singlefile.zip")
)
output_file <- Sys.getenv(
  "GEMS_QCEW_ALL_SECTORS_FILE",
  unset = paste0("employment_all_sectors_", qcew_year, ".csv")
)

if (!file.exists(qcew_zip)) {
  message("Downloading official BLS QCEW annual singlefile...")
  download.file(qcew_url, qcew_zip, mode = "wb", quiet = FALSE)
}

zip_members <- unzip(qcew_zip, list = TRUE)$Name
csv_member <- zip_members[grepl("annual[._]singlefile\\.csv$", zip_members)]
if (length(csv_member) != 1L) {
  stop("Expected one annual_singlefile.csv member in ", qcew_zip)
}

message("Reading state-level records from ", qcew_zip)
read_command <- paste(
  "unzip -p", shQuote(qcew_zip), shQuote(csv_member)
)
qcew <- fread(
  cmd = read_command,
  select = c(
    "area_fips", "own_code", "industry_code",
    "annual_avg_emplvl", "total_annual_wages"
  ),
  colClasses = list(character = c("area_fips", "industry_code"))
)

state_names <- c(
  "01" = "Alabama", "02" = "Alaska", "04" = "Arizona",
  "05" = "Arkansas", "06" = "California", "08" = "Colorado",
  "09" = "Connecticut", "10" = "Delaware", "12" = "Florida",
  "13" = "Georgia", "15" = "Hawaii", "16" = "Idaho",
  "17" = "Illinois", "18" = "Indiana", "19" = "Iowa",
  "20" = "Kansas", "21" = "Kentucky", "22" = "Louisiana",
  "23" = "Maine", "24" = "Maryland", "25" = "Massachusetts",
  "26" = "Michigan", "27" = "Minnesota", "28" = "Mississippi",
  "29" = "Missouri", "30" = "Montana", "31" = "Nebraska",
  "32" = "Nevada", "33" = "New Hampshire", "34" = "New Jersey",
  "35" = "New Mexico", "36" = "New York", "37" = "North Carolina",
  "38" = "North Dakota", "39" = "Ohio", "40" = "Oklahoma",
  "41" = "Oregon", "42" = "Pennsylvania", "44" = "Rhode Island",
  "45" = "South Carolina", "46" = "South Dakota",
  "47" = "Tennessee", "48" = "Texas", "49" = "Utah",
  "50" = "Vermont", "51" = "Virginia", "53" = "Washington",
  "54" = "West Virginia", "55" = "Wisconsin", "56" = "Wyoming"
)
state_abbrevs <- setNames(state.abb, state.name)

qcew <- qcew[
  substr(area_fips, 1L, 2L) %in% names(state_names) &
    grepl("000$", area_fips)
]
qcew[, annual_avg_emplvl := as.numeric(annual_avg_emplvl)]
qcew[, total_annual_wages := as.numeric(total_annual_wages)]

# Exact 2022-NAICS aggregates used in the 2023 file, mapped to the 2017 BEA
# Summary schema used by StateIO. The 2022 changes affecting retail and
# information are bridged explicitly (455, 513, and 516).
private_codes <- list(
  "111CA" = c("111", "112"),
  "113FF" = c("113", "114", "115"),
  "211" = "211", "212" = "212", "213" = "213",
  "22" = "22", "23" = "23",
  "311FT" = c("311", "312"),
  "313TT" = c("313", "314"),
  "315AL" = c("315", "316"),
  "321" = "321", "322" = "322", "323" = "323",
  "324" = "324", "325" = "325", "326" = "326",
  "327" = "327", "331" = "331", "332" = "332",
  "333" = "333", "334" = "334", "335" = "335",
  "3361MV" = c("3361", "3362", "3363"),
  "3364OT" = c("3364", "3365", "3366", "3369"),
  "337" = "337", "339" = "339", "42" = "42",
  "441" = "441", "445" = "445", "452" = "455",
  "4A0" = c("444", "449", "456", "457", "458", "459"),
  "481" = "481", "482" = "482", "483" = "483",
  "484" = "484", "485" = "485", "486" = "486",
  "487OS" = c("487", "488", "491", "492"), "493" = "493",
  "511" = "513", "512" = "512", "513" = c("516", "517"),
  "514" = c("518", "519"),
  "521CI" = c("521", "522"), "523" = "523", "524" = "524",
  "525" = "525", "ORE" = "531", "532RL" = c("532", "533"),
  "5411" = "5411", "5415" = "5415",
  "5412OP" = c("5412", "5413", "5414", "5416", "5417", "5418", "5419"),
  "55" = "55", "561" = "561", "562" = "562", "61" = "61",
  "621" = "621", "622" = "622", "623" = "623", "624" = "624",
  "711AS" = c("711", "712"), "713" = "713",
  "721" = "721", "722" = "722", "81" = "81"
)

private_map <- rbindlist(lapply(names(private_codes), function(io_sector) {
  data.table(io_sector = io_sector, industry_code = private_codes[[io_sector]])
}))

private_employment <- merge(
  qcew[own_code == 5L],
  private_map,
  by = "industry_code",
  allow.cartesian = TRUE
)[, .(
  employment = sum(annual_avg_emplvl, na.rm = TRUE),
  total_wages = sum(total_annual_wages, na.rm = TRUE)
), by = .(area_fips, io_sector)]

aggregate_government <- function(ownership, codes, io_sector) {
  qcew[
    own_code %in% ownership & industry_code %in% codes,
    .(
      employment = sum(annual_avg_emplvl, na.rm = TRUE),
      total_wages = sum(total_annual_wages, na.rm = TRUE)
    ),
    by = area_fips
  ][, io_sector := io_sector]
}

# QCEW excludes uniformed military personnel and does not distinguish the
# synthetic StateIO enterprise sectors. These are therefore limited proxies,
# not a claim of complete government employment coverage.
government_employment <- rbindlist(list(
  aggregate_government(1L, "928", "GFGD"),
  aggregate_government(1L, as.character(921:927), "GFGN"),
  aggregate_government(c(2L, 3L), "92", "GSLG")
), fill = TRUE)

employment <- rbindlist(
  list(private_employment, government_employment),
  use.names = TRUE,
  fill = TRUE
)[, .(
  employment = sum(employment, na.rm = TRUE),
  total_wages = sum(total_wages, na.rm = TRUE)
), by = .(area_fips, io_sector)]

all_sectors <- c(names(private_codes), "GFGD", "GFGN", "GSLG",
                 "HS", "GFE", "GSLE")
expected_rows <- CJ(
  area_fips = paste0(names(state_names), "000"),
  io_sector = all_sectors,
  unique = TRUE
)
employment <- merge(
  expected_rows,
  employment,
  by = c("area_fips", "io_sector"),
  all.x = TRUE
)
employment[is.na(employment), `:=`(employment = 0, total_wages = 0)]

employment[, state_name := unname(state_names[substr(area_fips, 1L, 2L)])]
employment[, state_abbrev := unname(state_abbrevs[state_name])]
employment[, avg_wage := fifelse(
  employment > 0, total_wages / employment, NA_real_
)]
employment[, employment_source := fifelse(
  io_sector %in% c("HS", "GFE", "GSLE"),
  "No QCEW-compatible satellite; explicit zero",
  fifelse(
    io_sector %in% c("GFGD", "GFGN", "GSLG"),
    "BLS QCEW public-administration ownership proxy",
    "BLS QCEW private ownership"
  )
)]

employment <- employment[
  order(state_name, io_sector),
  .(
    state_name, state_abbrev, io_sector, employment,
    total_wages, avg_wage, employment_source
  )
]

stopifnot(
  uniqueN(employment$state_name) == 50L,
  uniqueN(employment$io_sector) == 71L,
  nrow(employment) == 50L * 71L,
  all(employment[io_sector %in% c("HS", "GFE", "GSLE"), employment] == 0)
)

write.csv(employment, output_file, row.names = FALSE)

message("Saved ", nrow(employment), " state-sector rows to ", output_file)
message("Employment measure: annual-average filled jobs (not FTEs)")
message("Explicit zero-satellite sectors: HS, GFE, GSLE")
