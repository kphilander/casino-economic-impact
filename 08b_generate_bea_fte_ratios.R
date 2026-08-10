# ============================================================================
# BUILD 2023 BEA FULL-TIME-EQUIVALENT (FTE) RATIOS FOR STATEIO SECTORS
# ============================================================================
#
# BEA NIPA table 6.4D reports full- and part-time employee jobs by industry;
# table 6.5D reports the corresponding full-time-equivalent employees. This
# script downloads both public series through FRED and calculates:
#
#   FTEs per job = BEA FTE employees / BEA full- and part-time employees
#
# The ratios are national industry estimates. They are applied to the state
# QCEW jobs satellite only to produce a separate estimated-FTE satellite; QCEW
# jobs remain the model's primary employment measure.
#
# Sources:
#   https://www.bea.gov/help/faq/368
#   https://www.bea.gov/data/employment/employment-by-industry
#   https://fred.stlouisfed.org/
#
# Output: fte_ratios_2023.csv
# ============================================================================

library(tidyverse)

fte_year <- 2023L
output_file <- Sys.getenv(
  "GEMS_FTE_RATIO_FILE",
  unset = paste0("fte_ratios_", fte_year, ".csv")
)

# StateIO summary sectors align closely with the detail in NIPA tables 6.4D
# and 6.5D. Government public-administration proxies use the closest civilian
# general-government series. Synthetic housing has no employee satellite.
crosswalk <- tribble(
  ~io_sector, ~bea_industry, ~jobs_series_id, ~fte_series_id, ~mapping_note,
  "111CA", "Farms", "N4205C0A173NBEA", "N4305C0A173NBEA", "Exact BEA summary industry",
  "113FF", "Forestry, fishing, and related activities", "N4206C0A173NBEA", "N4306C0A173NBEA", "Exact BEA summary industry",
  "211", "Oil and gas extraction", "N4208C0A173NBEA", "N4308C0A173NBEA", "Exact BEA summary industry",
  "212", "Mining, except oil and gas", "N4209C0A173NBEA", "N4309C0A173NBEA", "Exact BEA summary industry",
  "213", "Support activities for mining", "N4210C0A173NBEA", "N4310C0A173NBEA", "Exact BEA summary industry",
  "22", "Utilities", "N4211C0A173NBEA", "N4311C0A173NBEA", "Exact BEA summary industry",
  "23", "Construction", "N4212C0A173NBEA", "N4312C0A173NBEA", "Exact BEA summary industry",
  "311FT", "Food and beverage and tobacco products", "N4227C0A173NBEA", "N4327C0A173NBEA", "Exact BEA summary industry",
  "313TT", "Textile mills and textile product mills", "N4228C0A173NBEA", "N4328C0A173NBEA", "Exact BEA summary industry",
  "315AL", "Apparel and leather and allied products", "N4229C0A173NBEA", "N4329C0A173NBEA", "Exact BEA summary industry",
  "321", "Wood products", "N4215C0A173NBEA", "N4315C0A173NBEA", "Exact BEA summary industry",
  "322", "Paper products", "N4230C0A173NBEA", "N4330C0A173NBEA", "Exact BEA summary industry",
  "323", "Printing and related support activities", "N4231C0A173NBEA", "N4331C0A173NBEA", "Exact BEA summary industry",
  "324", "Petroleum and coal products", "N4232C0A173NBEA", "N4332C0A173NBEA", "Exact BEA summary industry",
  "325", "Chemical products", "N4233C0A173NBEA", "N4333C0A173NBEA", "Exact BEA summary industry",
  "326", "Plastics and rubber products", "N4234C0A173NBEA", "N4334C0A173NBEA", "Exact BEA summary industry",
  "327", "Nonmetallic mineral products", "N4216C0A173NBEA", "N4316C0A173NBEA", "Exact BEA summary industry",
  "331", "Primary metals", "N4217C0A173NBEA", "N4317C0A173NBEA", "Exact BEA summary industry",
  "332", "Fabricated metal products", "N4218C0A173NBEA", "N4318C0A173NBEA", "Exact BEA summary industry",
  "333", "Machinery", "N4219C0A173NBEA", "N4319C0A173NBEA", "Exact BEA summary industry",
  "334", "Computer and electronic products", "N4220C0A173NBEA", "N4320C0A173NBEA", "Exact BEA summary industry",
  "335", "Electrical equipment, appliances, and components", "N4221C0A173NBEA", "N4321C0A173NBEA", "Exact BEA summary industry",
  "3361MV", "Motor vehicles, bodies and trailers, and parts", "N4222C0A173NBEA", "N4322C0A173NBEA", "Exact BEA summary industry",
  "3364OT", "Other transportation equipment", "N4223C0A173NBEA", "N4323C0A173NBEA", "Exact BEA summary industry",
  "337", "Furniture and related products", "N4224C0A173NBEA", "N4324C0A173NBEA", "Exact BEA summary industry",
  "339", "Miscellaneous manufacturing", "N4225C0A173NBEA", "N4325C0A173NBEA", "Exact BEA summary industry",
  "42", "Wholesale trade", "N4235C0A173NBEA", "N4335C0A173NBEA", "Exact BEA summary industry",
  "441", "Motor vehicle and parts dealers", "N4239C0A173NBEA", "N4339C0A173NBEA", "Exact BEA summary industry",
  "445", "Food and beverage stores", "N4240C0A173NBEA", "N4340C0A173NBEA", "Exact BEA summary industry",
  "452", "General merchandise stores", "N4241C0A173NBEA", "N4341C0A173NBEA", "2022 NAICS 455 bridge",
  "4A0", "Other retail", "N4242C0A173NBEA", "N4342C0A173NBEA", "BEA other-retail aggregate",
  "481", "Air transportation", "N4244C0A173NBEA", "N4344C0A173NBEA", "Exact BEA summary industry",
  "482", "Rail transportation", "N4245C0A173NBEA", "N4345C0A173NBEA", "Exact BEA summary industry",
  "483", "Water transportation", "N4246C0A173NBEA", "N4346C0A173NBEA", "Exact BEA summary industry",
  "484", "Truck transportation", "N4247C0A173NBEA", "N4347C0A173NBEA", "Exact BEA summary industry",
  "485", "Transit and ground passenger transportation", "N4248C0A173NBEA", "N4348C0A173NBEA", "Exact BEA summary industry",
  "486", "Pipeline transportation", "N4249C0A173NBEA", "N4349C0A173NBEA", "Exact BEA summary industry",
  "487OS", "Other transportation and support activities", "N4250C0A173NBEA", "N4350C0A173NBEA", "Exact BEA summary industry",
  "493", "Warehousing and storage", "N4251C0A173NBEA", "N4351C0A173NBEA", "Exact BEA summary industry",
  "511", "Publishing industries (includes software)", "N4253C0A173NBEA", "N4353C0A173NBEA", "2022 NAICS 513 bridge",
  "512", "Motion picture and sound recording industries", "N4254C0A173NBEA", "N4354C0A173NBEA", "Exact BEA summary industry",
  "513", "Broadcasting and telecommunications", "N4255C0A173NBEA", "N4355C0A173NBEA", "2022 NAICS 516/517 bridge",
  "514", "Information and data processing services", "N4256C0A173NBEA", "N4356C0A173NBEA", "2022 NAICS 518/519 bridge",
  "521CI", "Federal Reserve banks, credit intermediation, and related activities", "N4258C0A173NBEA", "N4358C0A173NBEA", "Exact BEA summary industry",
  "523", "Securities, commodity contracts, and investments", "N4259C0A173NBEA", "N4359C0A173NBEA", "Exact BEA summary industry",
  "524", "Insurance carriers and related activities", "N4260C0A173NBEA", "N4360C0A173NBEA", "Exact BEA summary industry",
  "525", "Funds, trusts, and other financial vehicles", "N4261C0A173NBEA", "N4361C0A173NBEA", "Exact BEA summary industry",
  "ORE", "Real estate", "N4263C0A173NBEA", "N4363C0A173NBEA", "Exact BEA summary industry",
  "532RL", "Rental and leasing services and lessors of intangible assets", "N4264C0A173NBEA", "N4364C0A173NBEA", "Exact BEA summary industry",
  "5411", "Legal services", "N4266C0A173NBEA", "N4366C0A173NBEA", "Exact BEA summary industry",
  "5415", "Computer systems design and related services", "N4267C0A173NBEA", "N4367C0A173NBEA", "Exact BEA summary industry",
  "5412OP", "Miscellaneous professional, scientific, and technical services", "N4268C0A173NBEA", "N4368C0A173NBEA", "BEA residual professional-services aggregate",
  "55", "Management of companies and enterprises", "N4269C0A173NBEA", "N4369C0A173NBEA", "Exact BEA summary industry",
  "561", "Administrative and support services", "N4271C0A173NBEA", "N4371C0A173NBEA", "Exact BEA summary industry",
  "562", "Waste management and remediation services", "N4272C0A173NBEA", "N4372C0A173NBEA", "Exact BEA summary industry",
  "61", "Educational services", "N4273C0A173NBEA", "N4373C0A173NBEA", "Exact BEA summary industry",
  "621", "Ambulatory health care services", "N4275C0A173NBEA", "N4375C0A173NBEA", "Exact BEA summary industry",
  "622", "Hospitals", "N4290C0A173NBEA", "N4390C0A173NBEA", "Exact BEA summary industry",
  "623", "Nursing and residential care facilities", "N4291C0A173NBEA", "N4391C0A173NBEA", "Exact BEA summary industry",
  "624", "Social assistance", "N4292C0A173NBEA", "N4392C0A173NBEA", "Exact BEA summary industry",
  "711AS", "Performing arts, spectator sports, museums, and related activities", "N4294C0A173NBEA", "N4394C0A173NBEA", "Exact BEA summary industry",
  "713", "Amusements, gambling, and recreation industries", "N4295C0A173NBEA", "N4395C0A173NBEA", "Exact BEA summary industry",
  "721", "Accommodation", "N4297C0A173NBEA", "N4397C0A173NBEA", "Exact BEA summary industry",
  "722", "Food services and drinking places", "N4298C0A173NBEA", "N4398C0A173NBEA", "Exact BEA summary industry",
  "81", "Other services, except government", "N4299C0A173NBEA", "N4399C0A173NBEA", "Exact BEA summary industry",
  "GFGD", "Federal general government, civilian", "B4279C0A173NBEA", "B4379C0A173NBEA", "Civilian proxy for QCEW NAICS 928",
  "GFGN", "Federal general government, civilian", "B4279C0A173NBEA", "B4379C0A173NBEA", "Civilian proxy for QCEW NAICS 921-927",
  "GSLG", "State and local general government, other", "B4285C0A173NBEA", "B4385C0A173NBEA", "Noneducation proxy for QCEW NAICS 92",
  "HS", "Housing services", NA_character_, NA_character_, "No employee satellite; explicit zero",
  "GFE", "Federal government enterprises", "B4281C0A173NBEA", "B4381C0A173NBEA", "QCEW satellite is explicit zero",
  "GSLE", "State and local government enterprises", "B4286C0A173NBEA", "B4386C0A173NBEA", "QCEW satellite is explicit zero"
)

stopifnot(nrow(crosswalk) == 71L, n_distinct(crosswalk$io_sector) == 71L)

series_ids <- unique(na.omit(c(crosswalk$jobs_series_id, crosswalk$fte_series_id)))
# FRED's graph CSV endpoint silently truncates wider requests, so keep each
# request below that limit and join the annual series locally.
series_chunks <- split(series_ids, ceiling(seq_along(series_ids) / 10L))

message("Downloading ", length(series_ids), " BEA NIPA series through FRED")
observations <- reduce(lapply(series_chunks, function(ids) {
  url <- paste0(
    "https://fred.stlouisfed.org/graph/fredgraph.csv?id=",
    paste(ids, collapse = ",")
  )
  read.csv(url, check.names = FALSE, stringsAsFactors = FALSE)
}), full_join, by = "observation_date")

year_row <- observations %>%
  filter(observation_date == paste0(fte_year, "-01-01"))
if (nrow(year_row) != 1L) stop("FRED response does not contain ", fte_year)

series_value <- function(series_id) {
  if (is.na(series_id)) return(NA_real_)
  if (!series_id %in% names(year_row)) stop("Missing FRED series: ", series_id)
  as.numeric(year_row[[series_id]][1])
}

ratios <- crosswalk %>%
  rowwise() %>%
  mutate(
    employee_jobs_thousands = series_value(jobs_series_id),
    fte_employees_thousands = series_value(fte_series_id),
    fte_per_job = if_else(
      is.na(employee_jobs_thousands),
      0,
      fte_employees_thousands / employee_jobs_thousands
    ),
    source_year = fte_year,
    source = if_else(
      is.na(jobs_series_id),
      "No employee satellite",
      "BEA NIPA tables 6.4D and 6.5D via FRED"
    )
  ) %>%
  ungroup()

if (any(is.na(ratios$fte_per_job)) ||
    any(ratios$fte_per_job < 0 | ratios$fte_per_job > 1)) {
  stop("Invalid FTE/job ratio; expected every ratio to be between zero and one")
}

write.csv(ratios, output_file, row.names = FALSE, na = "")
message("Saved ", nrow(ratios), " StateIO sector ratios to ", output_file)
message(
  "2023 NAICS 713 ratio: ",
  round(ratios$fte_per_job[ratios$io_sector == "713"], 6)
)
