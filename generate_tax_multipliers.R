library(stateior)
library(tidyverse)

my_year <- 2019
target_sectors <- c("711AS", "713", "721", "722")
sector_names <- c(
  "711AS" = "Arts, Entertainment, Recreation",
  "713" = "Amusement, Gambling, Recreation",
  "721" = "Accommodation",
  "722" = "Food Services & Drinking Places"
)

state_names <- c(
  "Alabama", "Alaska", "Arizona", "Arkansas", "California",
  "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
  "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
)
state_abbrevs <- c(
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
)

message("Loading IO data...")
two_region_make <- loadStateIODataFile(paste0("TwoRegion_Summary_Make_", my_year))
two_region_use <- loadStateIODataFile(paste0("TwoRegion_Summary_DomesticUse_", my_year))
two_region_ind_output <- loadStateIODataFile(paste0("TwoRegion_Summary_IndustryOutput_", my_year))
two_region_com_output <- loadStateIODataFile(paste0("TwoRegion_Summary_CommodityOutput_", my_year))
two_region_va <- loadStateIODataFile(paste0("TwoRegion_Summary_ValueAdded_", my_year))
message("Data loaded.")

all_results <- data.frame()

for (i in seq_along(state_names)) {
  state_name <- state_names[i]
  state_abbrev <- state_abbrevs[i]
  state_suffix <- paste0("/US-", state_abbrev)

  tryCatch({
    state_make <- two_region_make[[state_name]]
    state_use <- two_region_use[[state_name]]
    state_ind_output <- two_region_ind_output[[state_name]]
    state_com_output <- two_region_com_output[[state_name]]
    state_va <- two_region_va[[state_name]]

    make_rows <- rownames(state_make)
    make_cols <- colnames(state_make)
    state_ind_rows <- make_rows[grep(paste0(state_suffix, "$"), make_rows)]
    state_com_cols <- make_cols[grep(paste0(state_suffix, "$"), make_cols)]

    use_rows <- rownames(state_use)
    use_cols <- colnames(state_use)
    state_use_rows <- use_rows[grep(paste0(state_suffix, "$"), use_rows)]
    state_use_cols <- use_cols[grep(paste0(state_suffix, "$"), use_cols)]

    non_industry <- c("V001", "V002", "V003")
    state_use_rows <- state_use_rows[!gsub(state_suffix, "", state_use_rows) %in% non_industry]
    state_use_cols <- state_use_cols[!grepl("^F", gsub(state_suffix, "", state_use_cols))]

    state_g <- state_ind_output[grep(paste0(state_suffix, "$"), names(state_ind_output))]
    state_q <- state_com_output[grep(paste0(state_suffix, "$"), names(state_com_output))]

    ind_codes <- gsub(state_suffix, "", state_ind_rows)
    com_codes <- gsub(state_suffix, "", state_com_cols)
    use_com_codes <- gsub(state_suffix, "", state_use_rows)
    use_ind_codes <- gsub(state_suffix, "", state_use_cols)
    names(state_g) <- gsub(state_suffix, "", names(state_g))
    names(state_q) <- gsub(state_suffix, "", names(state_q))

    common_ind <- Reduce(intersect, list(ind_codes, use_ind_codes, names(state_g)))
    common_com <- Reduce(intersect, list(com_codes, use_com_codes, names(state_q)))

    V <- as.matrix(state_make[state_ind_rows, state_com_cols])
    rownames(V) <- ind_codes
    colnames(V) <- com_codes
    V <- V[common_ind, common_com]

    U <- as.matrix(state_use[state_use_rows, state_use_cols])
    rownames(U) <- use_com_codes
    colnames(U) <- use_ind_codes
    U <- U[common_com, common_ind]

    g <- state_g[common_ind]
    q <- state_q[common_com]
    n <- length(common_ind)

    D <- sweep(V, 2, q, "/")
    D[is.na(D)] <- 0
    D[is.infinite(D)] <- 0
    B <- sweep(U, 2, g, "/")
    B[is.na(B)] <- 0
    B[is.infinite(B)] <- 0
    A <- D %*% B

    I_mat <- diag(n)
    L <- solve(I_mat - A)
    type1_output <- colSums(L)
    names(type1_output) <- common_ind

    va_rows <- c(paste0("V001", state_suffix),
                 paste0("V002", state_suffix),
                 paste0("V003", state_suffix))
    va_cols <- paste0(common_ind, state_suffix)
    V001 <- as.numeric(state_va[va_rows[1], va_cols])
    V002 <- as.numeric(state_va[va_rows[2], va_cols])
    V003 <- as.numeric(state_va[va_rows[3], va_cols])
    names(V001) <- names(V002) <- names(V003) <- common_ind

    total_va <- V001 + V002 + V003
    va_coef <- total_va / g
    va_coef[is.na(va_coef)] <- 0
    va_coef[is.infinite(va_coef)] <- 0
    wage_coef <- V001 / g
    wage_coef[is.na(wage_coef)] <- 0
    wage_coef[is.infinite(wage_coef)] <- 0
    tax_coef <- V002 / g
    tax_coef[is.na(tax_coef)] <- 0
    tax_coef[is.infinite(tax_coef)] <- 0

    type1_va <- as.numeric(va_coef %*% L)
    names(type1_va) <- common_ind
    type1_wage <- as.numeric(wage_coef %*% L)
    names(type1_wage) <- common_ind
    type1_tax <- as.numeric(tax_coef %*% L)
    names(type1_tax) <- common_ind

    # Type II
    hh_row <- wage_coef
    pce_col <- paste0("F010", state_suffix)
    if (pce_col %in% colnames(state_use)) {
      pce <- as.numeric(state_use[paste0(common_com, state_suffix), pce_col])
      names(pce) <- common_com
      pce[is.na(pce)] <- 0
    } else {
      pce <- rep(0, length(common_com))
      names(pce) <- common_com
    }
    total_labor <- sum(V001, na.rm = TRUE)
    hh_col_com <- pce / total_labor
    hh_col_com[is.na(hh_col_com)] <- 0
    hh_col_com[is.infinite(hh_col_com)] <- 0
    hh_col <- as.numeric(D %*% hh_col_com)

    A_bar <- matrix(0, n + 1, n + 1)
    A_bar[1:n, 1:n] <- A
    A_bar[n + 1, 1:n] <- hh_row
    A_bar[1:n, n + 1] <- hh_col
    L_type2 <- solve(diag(n + 1) - A_bar)

    type2_output <- colSums(L_type2[1:n, 1:n])
    names(type2_output) <- common_ind
    va_coef_bar <- c(va_coef, 0)
    type2_va <- as.numeric(va_coef_bar %*% L_type2)[1:n]
    names(type2_va) <- common_ind
    wage_coef_bar <- c(wage_coef, 0)
    type2_wage <- as.numeric(wage_coef_bar %*% L_type2)[1:n]
    names(type2_wage) <- common_ind
    tax_coef_bar <- c(tax_coef, 0)
    type2_tax <- as.numeric(tax_coef_bar %*% L_type2)[1:n]
    names(type2_tax) <- common_ind

    for (sector in target_sectors) {
      if (sector %in% common_ind) {
        all_results <- rbind(all_results, data.frame(
          State = state_name,
          Abbrev = state_abbrev,
          Sector = sector,
          Sector_Name = sector_names[sector],
          Direct_VA_Coef = round(va_coef[sector], 6),
          Direct_Wage_Coef = round(wage_coef[sector], 6),
          Direct_Tax_Coef = round(tax_coef[sector], 6),
          Industry_Output_M = round(g[sector] / 1e6, 2),
          Type_I_Output = round(type1_output[sector], 4),
          Type_I_VA = round(type1_va[sector], 4),
          Type_I_Wage = round(type1_wage[sector], 4),
          Type_I_Tax = round(type1_tax[sector], 4),
          Type_II_Output = round(type2_output[sector], 4),
          Type_II_VA = round(type2_va[sector], 4),
          Type_II_Wage = round(type2_wage[sector], 4),
          Type_II_Tax = round(type2_tax[sector], 4),
          stringsAsFactors = FALSE
        ))
      }
    }
    message(sprintf("[%2d/50] %s - OK", i, state_name))
  }, error = function(e) {
    message(sprintf("[%2d/50] %s - ERROR: %s", i, state_name, e$message))
  })
}

write.csv(all_results, "state_multipliers_with_tax.csv", row.names = FALSE)
message("\nSaved ", nrow(all_results), " records to state_multipliers_with_tax.csv")
