# ============================================================================
# CASINO ECONOMIC IMPACT CALCULATOR - Shiny App
# ============================================================================

library(shiny)
library(tidyverse)
library(DT)
library(plotly)

# ============================================================================
# LOAD DATA
# ============================================================================

# Load multiplier data (adjust path for deployment)
if (file.exists("employment_multipliers_2023.csv")) {
  MULTIPLIER_DATA <- read.csv("employment_multipliers_2023.csv", stringsAsFactors = FALSE)
} else if (file.exists("../employment_multipliers_2023.csv")) {
  MULTIPLIER_DATA <- read.csv("../employment_multipliers_2023.csv", stringsAsFactors = FALSE)
} else {
  stop("Multiplier data file not found")
}

# Sector reference
SECTORS <- data.frame(
  code = c("711AS", "713", "721", "722"),
  name = c(
    "Arts, Entertainment, Recreation",
    "Amusement, Gambling, Recreation",
    "Accommodation",
    "Food Services & Drinking Places"
  ),
  stringsAsFactors = FALSE
)

# Get unique states
STATES <- sort(unique(MULTIPLIER_DATA$State))

# ============================================================================
# IMPACT CALCULATION FUNCTION
# ============================================================================

calculate_impact <- function(revenue, sector, state, data) {

  state_data <- data %>%
    filter(State == state, Sector == sector)

  if (nrow(state_data) == 0) return(NULL)

  # Extract multipliers and coefficients
  type1_output <- state_data$Type_I_Output
  type2_output <- state_data$Type_II_Output
  type1_va <- state_data$Type_I_VA
  type2_va <- state_data$Type_II_VA
  type1_wage <- state_data$Type_I_Wage
  type2_wage <- state_data$Type_II_Wage
  type1_emp_mult <- state_data$Type_I_Emp_Mult
  type2_emp_mult <- state_data$Type_II_Emp_Mult
  va_coef <- state_data$Direct_VA_Coef
  wage_coef <- state_data$Direct_Wage_Coef
  emp_coef <- state_data$Emp_Coef

  # Output impacts
  output_direct <- revenue
  output_indirect <- revenue * (type1_output - 1)
  output_induced <- revenue * (type2_output - type1_output)
  output_total <- revenue * type2_output

  # GDP impacts
  gdp_direct <- revenue * va_coef
  gdp_type1_total <- revenue * type1_va
  gdp_type2_total <- revenue * type2_va
  gdp_indirect <- gdp_type1_total - gdp_direct
  gdp_induced <- gdp_type2_total - gdp_type1_total
  gdp_total <- gdp_type2_total

  # Employment impacts
  emp_direct <- gdp_direct * emp_coef
  emp_indirect <- emp_direct * (type1_emp_mult - 1)
  emp_induced <- emp_direct * (type2_emp_mult - type1_emp_mult)
  emp_total <- emp_direct * type2_emp_mult

  # Wage impacts
  wage_direct <- revenue * wage_coef
  wage_type1_total <- revenue * type1_wage
  wage_type2_total <- revenue * type2_wage
  wage_indirect <- wage_type1_total - wage_direct
  wage_induced <- wage_type2_total - wage_type1_total
  wage_total <- wage_type2_total

  # Build results table
  data.frame(
    Metric = c("Output ($M)", "GDP ($M)", "Employment (Jobs)", "Wages ($M)"),
    Direct = c(
      round(output_direct, 2),
      round(gdp_direct, 2),
      round(emp_direct, 0),
      round(wage_direct, 2)
    ),
    Indirect = c(
      round(output_indirect, 2),
      round(gdp_indirect, 2),
      round(emp_indirect, 0),
      round(wage_indirect, 2)
    ),
    Induced = c(
      round(output_induced, 2),
      round(gdp_induced, 2),
      round(emp_induced, 0),
      round(wage_induced, 2)
    ),
    Total = c(
      round(output_total, 2),
      round(gdp_total, 2),
      round(emp_total, 0),
      round(wage_total, 2)
    ),
    Multiplier = c(
      round(type2_output, 3),
      round(type2_va / va_coef, 3),
      round(type2_emp_mult, 3),
      round(type2_wage / wage_coef, 3)
    ),
    stringsAsFactors = FALSE
  )
}

# ============================================================================
# UI
# ============================================================================

ui <- fluidPage(

  # Custom CSS
  tags$head(
    tags$style(HTML("
      .main-header {
        background-color: #2c3e50;
        color: white;
        padding: 20px;
        margin-bottom: 20px;
        border-radius: 5px;
      }
      .main-header h1 {
        margin: 0;
        font-size: 28px;
      }
      .main-header p {
        margin: 5px 0 0 0;
        opacity: 0.8;
      }
      .results-box {
        background-color: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 5px;
        padding: 15px;
        margin-top: 15px;
      }
      .metric-card {
        background: white;
        border-radius: 8px;
        padding: 15px;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 15px;
      }
      .metric-value {
        font-size: 28px;
        font-weight: bold;
        color: #2c3e50;
      }
      .metric-label {
        font-size: 14px;
        color: #6c757d;
      }
      .info-text {
        font-size: 12px;
        color: #6c757d;
        margin-top: 10px;
      }
    "))
  ),

  # Header
  div(class = "main-header",
      h1("Casino Economic Impact Calculator"),
      p("Estimate the economic impact of casino gaming revenue across US states")
  ),

  # Main layout
  fluidRow(

    # Left panel - Inputs
    column(4,
           wellPanel(
             h4("Input Parameters"),

             selectInput("state", "State:",
                         choices = STATES,
                         selected = "Nevada"),

             selectInput("sector", "Industry Sector:",
                         choices = setNames(SECTORS$code, SECTORS$name),
                         selected = "713"),

             numericInput("revenue", "Gaming Revenue (GGR) in $M:",
                          value = 100,
                          min = 0.1,
                          max = 100000,
                          step = 10),

             hr(),

             actionButton("calculate", "Calculate Impact",
                          class = "btn-primary btn-block",
                          style = "font-size: 16px; padding: 10px;"),

             div(class = "info-text",
                 p("Data Sources:"),
                 tags$ul(
                   tags$li("IO Tables: EPA StateIO (2019)"),
                   tags$li("Employment: BLS QCEW (2023)")
                 )
             )
           )
    ),

    # Right panel - Results
    column(8,

           # Summary cards
           conditionalPanel(
             condition = "output.hasResults",
             fluidRow(
               column(3,
                      div(class = "metric-card",
                          div(class = "metric-value", textOutput("totalOutput")),
                          div(class = "metric-label", "Total Output ($M)")
                      )
               ),
               column(3,
                      div(class = "metric-card",
                          div(class = "metric-value", textOutput("totalGDP")),
                          div(class = "metric-label", "Total GDP ($M)")
                      )
               ),
               column(3,
                      div(class = "metric-card",
                          div(class = "metric-value", textOutput("totalJobs")),
                          div(class = "metric-label", "Total Jobs")
                      )
               ),
               column(3,
                      div(class = "metric-card",
                          div(class = "metric-value", textOutput("totalWages")),
                          div(class = "metric-label", "Total Wages ($M)")
                      )
               )
             )
           ),

           # Detailed results table
           div(class = "results-box",
               h4("Detailed Impact Results"),
               DTOutput("resultsTable")
           ),

           # Visualization
           div(class = "results-box",
               h4("Impact Breakdown"),
               plotlyOutput("impactChart", height = "300px")
           ),

           # State comparison
           div(class = "results-box",
               h4("Compare Across States"),
               p("Employment multiplier for selected sector across all states:"),
               plotlyOutput("stateComparison", height = "400px")
           )
    )
  ),

  # Footer
  hr(),
  div(style = "text-align: center; color: #6c757d; padding: 10px;",
      p("Casino Economic Impact Model | ",
        a("GitHub", href = "https://github.com/kphilander/casino-economic-impact", target = "_blank"),
        " | Methodology: Industry Technology Assumption (ITA)")
  )
)

# ============================================================================
# SERVER
# ============================================================================

server <- function(input, output, session) {

  # Reactive: Calculate impact when button is clicked
  impact_results <- eventReactive(input$calculate, {
    calculate_impact(input$revenue, input$sector, input$state, MULTIPLIER_DATA)
  }, ignoreNULL = FALSE)

  # Initial calculation on load
  observe({
    if (input$calculate == 0) {
      # Trigger initial calculation
      shinyjs::click("calculate")
    }
  })

  # Check if results exist
  output$hasResults <- reactive({
    !is.null(impact_results())
  })
  outputOptions(output, "hasResults", suspendWhenHidden = FALSE)

  # Summary metrics
  output$totalOutput <- renderText({
    req(impact_results())
    format(impact_results()$Total[1], big.mark = ",", nsmall = 1)
  })

  output$totalGDP <- renderText({
    req(impact_results())
    format(impact_results()$Total[2], big.mark = ",", nsmall = 1)
  })

  output$totalJobs <- renderText({
    req(impact_results())
    format(impact_results()$Total[3], big.mark = ",")
  })

  output$totalWages <- renderText({
    req(impact_results())
    format(impact_results()$Total[4], big.mark = ",", nsmall = 1)
  })

  # Results table
  output$resultsTable <- renderDT({
    req(impact_results())
    datatable(
      impact_results(),
      options = list(
        dom = 't',
        ordering = FALSE,
        columnDefs = list(
          list(className = 'dt-right', targets = 1:5)
        )
      ),
      rownames = FALSE
    ) %>%
      formatStyle(columns = c("Total"), fontWeight = "bold") %>%
      formatStyle(columns = c("Multiplier"), color = "#007bff")
  })

  # Impact breakdown chart
  output$impactChart <- renderPlotly({
    req(impact_results())

    results <- impact_results()

    # Prepare data for stacked bar chart
    chart_data <- data.frame(
      Metric = rep(c("Output", "GDP", "Employment", "Wages"), each = 3),
      Type = rep(c("Direct", "Indirect", "Induced"), 4),
      Value = c(
        results$Direct[1], results$Indirect[1], results$Induced[1],
        results$Direct[2], results$Indirect[2], results$Induced[2],
        results$Direct[3], results$Indirect[3], results$Induced[3],
        results$Direct[4], results$Indirect[4], results$Induced[4]
      )
    )

    chart_data$Type <- factor(chart_data$Type, levels = c("Induced", "Indirect", "Direct"))
    chart_data$Metric <- factor(chart_data$Metric, levels = c("Output", "GDP", "Employment", "Wages"))

    colors <- c("Direct" = "#2ecc71", "Indirect" = "#3498db", "Induced" = "#9b59b6")

    plot_ly(chart_data, x = ~Metric, y = ~Value, color = ~Type, colors = colors,
            type = "bar", text = ~round(Value, 0), textposition = "inside") %>%
      layout(
        barmode = "stack",
        xaxis = list(title = ""),
        yaxis = list(title = "Value"),
        legend = list(orientation = "h", y = -0.2),
        margin = list(b = 80)
      )
  })

  # State comparison chart
  output$stateComparison <- renderPlotly({
    req(input$sector)

    comparison_data <- MULTIPLIER_DATA %>%
      filter(Sector == input$sector) %>%
      arrange(desc(Type_II_Emp_Mult)) %>%
      mutate(
        highlight = ifelse(State == input$state, "Selected", "Other"),
        State = factor(State, levels = State)
      )

    colors <- c("Selected" = "#e74c3c", "Other" = "#3498db")

    plot_ly(comparison_data, x = ~State, y = ~Type_II_Emp_Mult, color = ~highlight,
            colors = colors, type = "bar",
            text = ~paste0(State, ": ", round(Type_II_Emp_Mult, 2)),
            hoverinfo = "text") %>%
      layout(
        xaxis = list(title = "", tickangle = -45, tickfont = list(size = 10)),
        yaxis = list(title = "Type II Employment Multiplier"),
        showlegend = FALSE,
        margin = list(b = 120)
      )
  })
}

# ============================================================================
# RUN APP
# ============================================================================

shinyApp(ui = ui, server = server)
