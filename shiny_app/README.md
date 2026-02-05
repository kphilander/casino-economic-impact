# Casino Economic Impact Calculator - Shiny App

Interactive web application for calculating economic impact of casino gaming revenue.

## Run Locally

```r
# Install required packages
install.packages(c("shiny", "tidyverse", "DT", "plotly"))

# Run the app
shiny::runApp("shiny_app")
```

Or from within the shiny_app directory:
```r
shiny::runApp()
```

## Deploy to shinyapps.io

1. **Create account** at https://www.shinyapps.io/

2. **Install rsconnect**:
```r
install.packages("rsconnect")
```

3. **Configure your account** (get token from shinyapps.io dashboard):
```r
rsconnect::setAccountInfo(
  name = "YOUR_ACCOUNT_NAME",
  token = "YOUR_TOKEN",
  secret = "YOUR_SECRET"
)
```

4. **Deploy**:
```r
rsconnect::deployApp("shiny_app")
```

## Files

- `app.R` - Main Shiny application
- `employment_multipliers_2023.csv` - Pre-computed multiplier data

## Features

- Select from all 50 US states
- Choose industry sector (Gambling, Accommodation, Food Services, Arts/Entertainment)
- Enter gaming revenue (GGR) in millions
- View detailed impact breakdown (Direct, Indirect, Induced)
- Interactive charts showing impact composition
- Compare employment multipliers across all states

## Data Sources

- **IO Tables**: EPA StateIO (2019) - Pre-pandemic economic relationships
- **Employment**: BLS QCEW (2023) - Latest employment data
