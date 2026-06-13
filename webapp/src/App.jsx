import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Building2, DollarSign, Users, TrendingUp, ChevronDown, Calculator, MapPin, Loader2, Presentation, Lock, MessageCircle, Lightbulb, X, Send, Bug, Key, Shield, Calendar, Trash2, Copy, Check, FileDown } from 'lucide-react';
import multiplierData from './data/multipliers.json';
import gamingTaxRatesData from './data/gamingTaxRates.json';
import employmentTaxRatesData from './data/employmentTaxRates.json';
import { ARCHETYPES, ARCHETYPE_LIST, calculateArchetypeEmployment } from './data/archetypes';
import { calculateCombinedImpact, calculateGamingTax, calculatePayrollTax, calculateHouseholdTax, formatNumber, formatCurrency, formatJobs, isOnlinePropertyType } from './utils/calculations';
import {
  validateLicense,
  validateLicenseRemote,
  canDownloadForProperty,
  getLicenseData,
  saveLicenseData,
  addLicensedProperty,
  clearLicenseData
} from './utils/licenseValidator';
import { BRAND, PRODUCT_NAME_VERSIONED, PRODUCT_TITLE, PURCHASING_ENABLED, getSuggestedCitation } from './brand';
import WatermarkOverlay from './components/WatermarkOverlay';
import PremiumModal from './components/PremiumModal';
import WrongPropertyModal from './components/WrongPropertyModal';
import ConfirmPropertyModal from './components/ConfirmPropertyModal';
import PageHeader from './components/PageHeader';
import DashboardMetricCard from './components/dashboard/MetricCard';
import DashboardImpactCompositionChart from './components/dashboard/ImpactCompositionChart';
import DashboardEmploymentChart from './components/dashboard/EmploymentChart';
import DashboardStateComparisonChart from './components/dashboard/StateComparisonChart';
import DashboardMultiplierRadarChart from './components/dashboard/MultiplierRadarChart';
import DashboardResultsTable from './components/dashboard/ResultsTable';
import ImpactFlowChart from './components/dashboard/ImpactFlowChart';
import SectionHeader from './components/dashboard/SectionHeader';
import Toolbar from './components/dashboard/Toolbar';
import ProjectsDrawer from './components/dashboard/ProjectsDrawer';
import ScenarioCompare from './components/dashboard/ScenarioCompare';
import SensitivityPanel from './components/dashboard/SensitivityPanel';
import HeroSummary from './components/dashboard/HeroSummary';
import {
  buildAnalysis, applyAnalysis, buildShareURL, readAnalysisFromURL, clearURLParam,
  loadProjects, saveProject as saveProjectStore, deleteProject as deleteProjectStore,
} from './utils/analysisState';
import { buildResultsCSV, downloadCSV, printReport, slugify } from './utils/exporters';
// Report generators are dynamically imported to reduce initial bundle size
// import { generateReport } from './utils/reportGenerator';
// import { downloadPPTX } from './utils/pptxGenerator';
// import { downloadStarterTemplate } from './utils/starterTemplateGenerator';
// import { fillTemplateAndDownload } from './utils/templateFiller';

const COLORS = {
  direct: '#1a365d',    // GP Navy
  indirect: '#3182ce',  // GP Blue
  induced: '#4299e1',   // GP Light Blue
  gaming: '#1a365d',    // GP Navy
  food: '#2c5282',      // GP Primary Light
  lodging: '#3182ce',   // GP Accent
  other: '#4299e1',     // GP Accent Light
  marketing: '#2c5282', // For online: Marketing/Advertising
  tech: '#3182ce'       // For online: Technology Infrastructure
};

// Metric Card Component
function MetricCard({ icon: Icon, label, value, subtext, color = 'primary', badge }) {
  const colorClasses = {
    primary: 'bg-primary',   // GP Navy gradient
    success: 'bg-accent',   // GP Blue gradient
    purple: 'bg-primary-light',    // Navy to blue
    amber: 'bg-accent'      // GP Blue gradient
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-5 card-hover">
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-lg ${colorClasses[color]} text-white flex-shrink-0`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5 leading-tight">{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
      </div>
      {badge && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {badge}
          </span>
        </div>
      )}
    </div>
  );
}

// Input Field Component
function InputField({ label, value, onChange, placeholder, helpText, type = 'number', prefix, suffix, id }) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');
  const helpId = helpText ? `${inputId}-help` : undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true">{prefix}</span>
        )}
        <input
          id={inputId}
          type={type}
          value={value || ''}
          onChange={(e) => onChange(type === 'number' ? (e.target.value ? parseFloat(e.target.value) : null) : e.target.value)}
          placeholder={placeholder}
          aria-describedby={helpId}
          className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm" aria-hidden="true">{suffix}</span>
        )}
      </div>
      {helpText && <p id={helpId} className="text-xs text-gray-600">{helpText}</p>}
    </div>
  );
}

// Select Field Component
function SelectField({ label, value, onChange, options, helpText, id }) {
  const selectId = id || label.toLowerCase().replace(/\s+/g, '-');
  const helpId = helpText ? `${selectId}-help` : undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={helpId}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all appearance-none bg-white pr-10"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={18} aria-hidden="true" />
      </div>
      {helpText && <p id={helpId} className="text-xs text-gray-600">{helpText}</p>}
    </div>
  );
}

// Definition Tooltip Component — uses fixed positioning to avoid overflow clipping
function DefTooltip({ text, children }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = React.useRef(null);

  const handleEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ x: rect.left, y: rect.top });
    }
    setShow(true);
  };

  return (
    <span
      ref={ref}
      className="relative cursor-help border-b border-dotted border-gray-400"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="fixed w-64 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal text-white shadow-lg"
          style={{ left: pos.x, top: pos.y - 8, transform: 'translateY(-100%)', zIndex: 9999 }}
        >
          {text}
          <span className="absolute top-full left-4 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
}

// Term definitions for tooltips (factory function for online/land-based context)
function getTermDefinitions(isOnline) {
  const entity = isOnline ? 'gaming operation' : 'casino operation';
  const entityShort = isOnline ? 'operator' : 'casino';
  return {
    output: `Total value of goods and services produced across all industries stimulated by the ${entity}, including intermediate goods.`,
    gdp: 'Value added to the economy, calculated as output minus intermediate inputs. Also known as Gross Domestic Product contribution.',
    employment: 'Full-time equivalent (FTE) jobs supported, including part-time jobs converted to full-time equivalents.',
    wages: 'Total compensation of employees, including salaries, wages, and benefits such as employer contributions to pensions and insurance.',
    tax: 'Taxes on production and imports (TOPI) from the IO model, including sales taxes, property taxes, excise taxes, and fees paid by businesses.',
    direct: `The initial economic activity from the ${entity} itself — its own spending, employment, and output.`,
    indirect: `Activity generated in the supply chain — businesses that provide goods and services to the ${entityShort}.`,
    induced: `Activity from household spending — ${entityShort} and supplier employees spending their wages in the local economy.`,
    multiplier: 'The ratio of total impact to direct impact. Shows how much each dollar of direct activity generates across the full economy.'
  };
}
const TERM_DEFINITIONS = getTermDefinitions(false);

// Results Table Component
function ResultsTable({ results, termDefs }) {
  const TERM_DEFINITIONS = termDefs || getTermDefinitions(false);
  const rows = [
    { label: 'Output ($M)', key: 'output', format: (v) => formatNumber(v, 1) },
    { label: 'GDP ($M)', key: 'gdp', format: (v) => formatNumber(v, 1) },
    { label: 'Employment (FTEs)', key: 'employment', format: (v) => formatJobs(v) },
    { label: 'Wages ($M)', key: 'wages', format: (v) => formatNumber(v, 1) },
    { label: 'Tax Revenue ($M)', key: 'tax', format: (v) => formatNumber(v, 1) }
  ];

  return (
    <div className="overflow-x-auto" role="region" aria-label="Economic impact results">
      <table className="w-full" aria-label="Economic impact breakdown by effect type">
        <caption className="sr-only">Economic impact summary showing direct, indirect, induced effects and multipliers</caption>
        <thead>
          <tr className="border-b border-gray-200">
            <th scope="col" className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Metric</th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-primary">
              <DefTooltip text={TERM_DEFINITIONS.direct}>Direct</DefTooltip>
            </th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-accent">
              <DefTooltip text={TERM_DEFINITIONS.indirect}>Indirect</DefTooltip>
            </th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-effect-induced">
              <DefTooltip text={TERM_DEFINITIONS.induced}>Induced</DefTooltip>
            </th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Total</th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-accent">
              <DefTooltip text={TERM_DEFINITIONS.multiplier}>Multiplier</DefTooltip>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, key, format }) => (
            <tr key={key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-700 text-left">
                <DefTooltip text={TERM_DEFINITIONS[key]}>{label}</DefTooltip>
              </th>
              <td className="py-3 px-4 text-sm text-right text-primary">{format(results.totals[key].direct)}</td>
              <td className="py-3 px-4 text-sm text-right text-accent">{format(results.totals[key].indirect)}</td>
              <td className="py-3 px-4 text-sm text-right text-effect-induced">{format(results.totals[key].induced)}</td>
              <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{format(results.totals[key].total)}</td>
              <td className="py-3 px-4 text-sm text-right text-accent font-medium">
                {results.multipliers[key] ? `${formatNumber(results.multipliers[key], 2)}x` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Impact Breakdown Chart
function ImpactBreakdownChart({ results }) {
  const data = [
    {
      name: 'Output',
      Direct: results.totals.output.direct,
      Indirect: results.totals.output.indirect,
      Induced: results.totals.output.induced
    },
    {
      name: 'GDP',
      Direct: results.totals.gdp.direct,
      Indirect: results.totals.gdp.indirect,
      Induced: results.totals.gdp.induced
    },
    {
      name: 'Wages',
      Direct: results.totals.wages.direct,
      Indirect: results.totals.wages.indirect,
      Induced: results.totals.wages.induced
    },
    {
      name: 'Tax',
      Direct: results.totals.tax.direct,
      Indirect: results.totals.tax.indirect,
      Induced: results.totals.tax.induced
    }
  ];

  return (
    <div role="img" aria-label={`Economic impact chart showing Output: $${formatNumber(results.totals.output.total, 1)}M, GDP: $${formatNumber(results.totals.gdp.total, 1)}M, Wages: $${formatNumber(results.totals.wages.total, 1)}M`}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="name" tick={{ fill: '#4b5563' }} />
          <YAxis tick={{ fill: '#4b5563' }} tickFormatter={(v) => `$${v}M`} />
          <Tooltip
            formatter={(value) => [`$${formatNumber(value, 1)}M`, '']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Legend />
          <Bar dataKey="Direct" fill={COLORS.direct} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Indirect" fill={COLORS.indirect} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Induced" fill={COLORS.induced} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Employment Pie Chart
function EmploymentPieChart({ results }) {
  const data = [
    { name: 'Direct', value: results.totals.employment.direct, color: COLORS.direct },
    { name: 'Indirect', value: results.totals.employment.indirect, color: COLORS.indirect },
    { name: 'Induced', value: results.totals.employment.induced, color: COLORS.induced }
  ];

  return (
    <div role="img" aria-label={`Employment distribution: Direct ${formatJobs(results.totals.employment.direct)} jobs, Indirect ${formatJobs(results.totals.employment.indirect)} jobs, Induced ${formatJobs(results.totals.employment.induced)} jobs`}>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [formatJobs(value) + ' jobs', '']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// State Comparison Chart
function StateComparisonChart({ currentState, gamblingData }) {
  const sortedData = useMemo(() => {
    return [...gamblingData]
      .sort((a, b) => b.Emp_Coef - a.Emp_Coef)
      .map(d => ({
        state: d.Abbrev,
        fullName: d.State,
        multiplier: d.Emp_Coef,
        isSelected: d.State === currentState
      }));
  }, [gamblingData, currentState]);

  const currentStateData = sortedData.find(d => d.isSelected);

  return (
    <div role="img" aria-label={`State comparison chart showing employment intensity. ${currentState} has ${formatNumber(currentStateData?.multiplier || 0, 1)} jobs per $1M GDP`}>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={sortedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="state"
            tick={{ fill: '#4b5563', fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fill: '#4b5563' }} domain={[0, 'auto']} />
          <Tooltip
            formatter={(value) => [formatNumber(value, 1), 'Jobs per $1M GDP']}
            labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Bar
            dataKey="multiplier"
            radius={[4, 4, 0, 0]}
            fill="#3182ce"
          >
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.isSelected ? '#1a365d' : '#3182ce'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Revenue Breakdown Table
function RevenueBreakdownTable({ byRevenue }) {
  if (!byRevenue || byRevenue.length <= 1) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Revenue Stream</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Revenue</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Total Output</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Total GDP</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Total Jobs</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Total Wages</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Total Tax</th>
          </tr>
        </thead>
        <tbody>
          {byRevenue.map((r) => (
            <tr key={r.type} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <td className="py-3 px-4 text-sm font-medium text-gray-700">
                <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[r.type] }}></span>
                {r.label}
              </td>
              <td className="py-3 px-4 text-sm text-right">{formatCurrency(r.revenue)}</td>
              <td className="py-3 px-4 text-sm text-right">{formatCurrency(r.output.total)}</td>
              <td className="py-3 px-4 text-sm text-right">{formatCurrency(r.gdp.total)}</td>
              <td className="py-3 px-4 text-sm text-right">{formatJobs(r.employment.total)}</td>
              <td className="py-3 px-4 text-sm text-right">{formatCurrency(r.wages.total)}</td>
              <td className="py-3 px-4 text-sm text-right">{formatCurrency(r.tax.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Download PPTX Button Component
function DownloadPPTXButton({ onClick, isGenerating }) {
  return (
    <button
      onClick={onClick}
      disabled={isGenerating}
      className={`btn w-full py-3.5 px-4 text-[15px] ${isGenerating ? 'btn-secondary' : 'btn-brass'}`}
    >
      {isGenerating ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          Generating PPTX…
        </>
      ) : (
        <>
          <Presentation size={18} />
          Download PPTX Report
        </>
      )}
    </button>
  );
}

// Wizard Step Component
function WizardStep({ stepNum, totalSteps, title, subtitle, children, onBack, onNext, nextLabel = 'Continue', showBack = true, canProceed = true }) {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-start justify-center py-12 px-4">
      <div className="max-w-xl w-full">
        {/* Step indicator pills */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-500 ${
                i + 1 < stepNum ? 'w-2 bg-accent'
                : i + 1 === stepNum ? 'w-10 progress-shimmer'
                : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="wizard-card p-8 sm:p-10">
          {/* Step number badge */}
          <div className="flex items-center gap-3 mb-5">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white text-sm font-bold shadow-md">
              {stepNum}
            </span>
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Step {stepNum} of {totalSteps}</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">{title}</h2>
          {subtitle && <p className="text-gray-500 mb-8 leading-relaxed">{subtitle}</p>}

          <div className="mb-8">
            {children}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-100">
            {showBack && onBack ? (
              <button
                onClick={onBack}
                className="px-5 py-2.5 text-gray-500 hover:text-gray-900 font-medium transition-colors rounded-lg hover:bg-gray-50"
              >
                ← Back
              </button>
            ) : <div />}
            <button
              onClick={onNext}
              disabled={!canProceed}
              className={`px-8 py-3 rounded-xl font-semibold transition-all ${
                canProceed
                  ? 'bg-primary text-white hover:bg-primary-dark shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {nextLabel} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Property type options with descriptions
const PROPERTY_TYPE_OPTIONS = [
  { value: '', label: 'Select property type...', description: '', category: '' },
  // Land-Based
  { value: '721120', label: 'Resort with Hotel & Casino', description: 'Integrated casino-hotel (e.g., Las Vegas Strip properties)', category: 'land' },
  { value: '713210', label: 'Stand-alone Casino', description: 'Traditional casino without integrated hotel', category: 'land' },
  { value: '713290', label: 'Slot Parlors / Bingo Halls', description: 'Limited gaming venues (card rooms, bingo halls)', category: 'land' },
  { value: '722410', label: 'Bars/Restaurants with Slots', description: 'Establishments with gaming as ancillary activity', category: 'land' },
  // Online
  { value: 'ONLINE_CASINO', label: 'Online Casino / iGaming', description: 'Online casino operations (slots, table games, poker)', category: 'online' },
  { value: 'ONLINE_SPORTSBOOK', label: 'Online Sportsbook', description: 'Online sports betting operations', category: 'online' }
];

/**
 * Build a tax config object for calculateGamingTax from a state's tax rate data.
 * For online property types, uses the iGaming or sportsBetting sub-config.
 */
function buildTaxConfig(taxInfo, customRate, slotRevenuePct, propertyType = null) {
  if (!taxInfo) return {};

  // For online types, use the appropriate sub-config
  let effectiveTaxInfo = taxInfo;
  if (isOnlinePropertyType(propertyType)) {
    const isIGaming = propertyType === 'ONLINE_CASINO';
    const onlineConfig = isIGaming ? taxInfo.iGaming : taxInfo.sportsBetting;
    if (onlineConfig) {
      effectiveTaxInfo = onlineConfig;
    } else {
      // State doesn't have this online type legalized
      return {};
    }
  }

  const config = {};
  if (customRate != null && customRate !== '') {
    config.customRate = parseFloat(customRate);
  } else if (effectiveTaxInfo.rateStructure === 'split_tiered' && effectiveTaxInfo.slotTiers && effectiveTaxInfo.tableTiers) {
    config.slotTiers = effectiveTaxInfo.slotTiers;
    config.tableTiers = effectiveTaxInfo.tableTiers;
    config.slotRevenuePct = (slotRevenuePct || 70) / 100;
  } else if (effectiveTaxInfo.rateStructure === 'tiered' && effectiveTaxInfo.tiers) {
    config.tiers = effectiveTaxInfo.tiers;
  } else if (effectiveTaxInfo.rateStructure === 'split_game_type' && effectiveTaxInfo.slotsRate != null && effectiveTaxInfo.tableRate != null) {
    config.slotsRate = effectiveTaxInfo.slotsRate;
    config.tableRate = effectiveTaxInfo.tableRate;
    config.slotRevenuePct = (slotRevenuePct || 70) / 100;
  } else if (effectiveTaxInfo.slotTableSplit && effectiveTaxInfo.slotsRate != null && effectiveTaxInfo.tableRate != null) {
    config.slotsRate = effectiveTaxInfo.slotsRate;
    config.tableRate = effectiveTaxInfo.tableRate;
    config.slotRevenuePct = (slotRevenuePct || 70) / 100;
  } else if (effectiveTaxInfo.flatRate != null) {
    config.flatRate = effectiveTaxInfo.flatRate;
  } else if (effectiveTaxInfo.effectiveRate != null) {
    config.flatRate = effectiveTaxInfo.effectiveRate;
  }
  return config;
}

// Main App Component
export default function App() {
  // Wizard state
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardComplete, setWizardComplete] = useState(false);

  // Input state
  const [state, setState] = useState('Nevada');
  const [casinoName, setCasinoName] = useState('');
  const [propertyType, setPropertyType] = useState('721120'); // Default to Casino Hotel
  const [inputMode, setInputMode] = useState('department'); // 'total' or 'department'
  const [revenues, setRevenues] = useState({
    gaming: 100,
    food: null,
    lodging: null,
    other: null,
    total: null
  });
  // Department-level known data: { gaming: {emp, wages}, food: {...}, lodging: {...}, other: {...} }
  const [knownData, setKnownData] = useState({
    gaming: { emp: null, wages: null },
    food: { emp: null, wages: null },
    lodging: { emp: null, wages: null },
    other: { emp: null, wages: null }
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isGeneratingPPTX, setIsGeneratingPPTX] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [featureSubmitted, setFeatureSubmitted] = useState(false);

  // License/Tier state
  const [userTier, setUserTier] = useState('free'); // 'free' | 'pro'
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [licensedProperties, setLicensedProperties] = useState([]);
  const [showWrongPropertyModal, setShowWrongPropertyModal] = useState(false);
  const [wrongPropertyInfo, setWrongPropertyInfo] = useState(null); // { licensedFor, attempting }
  const [showConfirmPropertyModal, setShowConfirmPropertyModal] = useState(false); // Confirm before tying license to property
  const [purchasedLicense, setPurchasedLicense] = useState(null); // { key, email } — shown once after purchase so the user saves it
  const [licenseKeyCopied, setLicenseKeyCopied] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);

  // Gaming tax state
  const [gamingTaxCustomRate, setGamingTaxCustomRate] = useState(null); // User override rate (0-1)
  const [slotRevenuePct, setSlotRevenuePct] = useState(70); // For split-rate states: % of GGR from slots

  // Wizard helper state
  const [hasOtherRevenue, setHasOtherRevenue] = useState(false);
  const [hasKnownData, setHasKnownData] = useState(false);

  // Revenue Forecaster import state
  const [importedFromForecaster, setImportedFromForecaster] = useState(false);
  const [importedArchetype, setImportedArchetype] = useState(null);

  // Archetype comparison
  const [showArchetypeComparison, setShowArchetypeComparison] = useState(false);
  const [selectedArchetypeKey, setSelectedArchetypeKey] = useState(null);

  // Save / share / compare / sensitivity state
  const [projects, setProjects] = useState([]);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [compareActive, setCompareActive] = useState(false);
  const [scenarios, setScenarios] = useState([]);
  const [showSensitivity, setShowSensitivity] = useState(false);

  // Check for saved license on mount and handle Stripe redirect
  useEffect(() => {
    // Check localStorage for saved license using getLicenseData helper
    const { licenseKey, licensedProperties: savedProperties } = getLicenseData();
    if (licenseKey) {
      const result = validateLicense(licenseKey);
      if (result.valid) {
        setUserTier('pro');
        setLicensedProperties(savedProperties || []);
        // Re-verify the checksum server-side in the background; downgrade only
        // on an explicit rejection (not on network errors, e.g. local dev)
        validateLicenseRemote(licenseKey).then(remote => {
          if (!remote.valid && !remote.networkError) {
            clearLicenseData();
            setUserTier('free');
            setLicensedProperties([]);
          }
        }).catch(() => {});
      } else {
        // License expired or invalid, remove it
        localStorage.removeItem('licenseKey');
        localStorage.removeItem('licensedProperties');
      }
    }

    // Check for Revenue Forecaster import via URL params
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('from') === 'forecaster') {
      const importedState = urlParams.get('state');
      const importedName = urlParams.get('name');
      const importedPropertyType = urlParams.get('propertyType');
      const importedGaming = parseFloat(urlParams.get('gaming')) || null;
      const importedFood = parseFloat(urlParams.get('food')) || null;
      const importedLodging = parseFloat(urlParams.get('lodging')) || null;
      const importedOther = parseFloat(urlParams.get('other')) || null;
      const importedArchetypeKey = urlParams.get('archetype');

      // Pre-fill state
      if (importedState && multiplierData.states.includes(importedState)) {
        setState(importedState);
      }
      if (importedName) setCasinoName(decodeURIComponent(importedName));
      if (importedPropertyType) setPropertyType(importedPropertyType);
      setInputMode('department');

      // Pre-fill revenues
      setRevenues({
        gaming: importedGaming,
        food: importedFood,
        lodging: importedLodging,
        other: importedOther,
        total: null
      });

      // Show non-gaming revenue sections
      if (importedFood || importedLodging || importedOther) {
        setHasOtherRevenue(true);
      }

      // Skip wizard, go directly to dashboard
      setWizardComplete(true);
      setImportedFromForecaster(true);
      setImportedArchetype(importedArchetypeKey);

      // Auto-enable archetype comparison when imported with an archetype key
      if (importedArchetypeKey && ARCHETYPES[importedArchetypeKey]) {
        setSelectedArchetypeKey(importedArchetypeKey);
        setShowArchetypeComparison(true);
      }

      // Clear URL params to avoid re-import on refresh
      window.history.replaceState({}, '', window.location.pathname);
      return; // Skip Stripe redirect handling
    }

    // Helper to restore wizard state from sessionStorage
    const restoreWizardState = () => {
      const savedState = sessionStorage.getItem('wizardState');
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (parsed.wizardComplete) {
            setWizardComplete(true);
            setState(parsed.state || 'Nevada');
            setCasinoName(parsed.casinoName || '');
            setPropertyType(parsed.propertyType || '721120');
            setInputMode(parsed.inputMode || 'department');
            setRevenues(parsed.revenues || { gaming: 100, food: null, lodging: null, other: null, total: null });
            setKnownData(parsed.knownData || { gaming: { emp: null, wages: null }, food: { emp: null, wages: null }, lodging: { emp: null, wages: null }, other: { emp: null, wages: null } });
            setHasOtherRevenue(parsed.hasOtherRevenue || false);
            setHasKnownData(parsed.hasKnownData || false);
          }
        } catch (e) {
          console.error('Failed to restore wizard state:', e);
        }
        sessionStorage.removeItem('wizardState');
      }
    };

    // Check for Stripe redirect (new license purchase)
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const addonSessionId = params.get('addon_session_id');

    if (sessionId) {
      // Restore wizard state first
      restoreWizardState();
      // Verify the Stripe session for new license
      fetch(`/api/verify-session?session_id=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.valid && data.licenseKey) {
            // Save license key
            saveLicenseData(data.licenseKey, []);
            setUserTier('pro');
            setLicensedProperties([]);
            // Show the key so the user can save it — localStorage alone is
            // fragile (cleared cache or a new device loses the license)
            setPurchasedLicense({ key: data.licenseKey, email: data.email });
          }
          // Clear URL params
          window.history.replaceState({}, '', window.location.pathname);
        })
        .catch(() => {
          // API not available (development), clear params
          window.history.replaceState({}, '', window.location.pathname);
        });
    } else if (addonSessionId) {
      // Restore wizard state first
      restoreWizardState();
      // Verify the addon property purchase
      fetch(`/api/verify-session?session_id=${addonSessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.valid) {
            // Get the pending property name from sessionStorage
            const pendingProperty = sessionStorage.getItem('pendingAddonProperty');
            if (pendingProperty) {
              // Add the new property to licensed properties
              const currentProperties = JSON.parse(localStorage.getItem('licensedProperties') || '[]');
              if (!currentProperties.includes(pendingProperty)) {
                currentProperties.push(pendingProperty);
                localStorage.setItem('licensedProperties', JSON.stringify(currentProperties));
                setLicensedProperties(currentProperties);
              }
              // Set the casino name to the newly licensed property
              setCasinoName(pendingProperty);
              sessionStorage.removeItem('pendingAddonProperty');
            }
          }
          // Clear URL params
          window.history.replaceState({}, '', window.location.pathname);
        })
        .catch(() => {
          // API not available (development), clear params
          window.history.replaceState({}, '', window.location.pathname);
        });
    }
  }, []);

  // Load saved projects; restore a shared analysis from the URL (?a=...)
  useEffect(() => {
    setProjects(loadProjects());
    const shared = readAnalysisFromURL();
    if (shared) {
      applyAnalysis(shared, {
        setState, setCasinoName, setPropertyType, setInputMode,
        setRevenues, setKnownData, setGamingTaxCustomRate, setSlotRevenuePct,
      });
      setWizardComplete(true);
      clearURLParam();
    }
  }, []);

  // Calculate results using property-type-specific multipliers
  const isOnline = isOnlinePropertyType(propertyType);
  const results = useMemo(() => {
    return calculateCombinedImpact(
      revenues,
      multiplierData.multipliers,
      multiplierData.gambling,
      state,
      true,  // Use gambling-specific (fallback if no property type)
      knownData,  // Department-level known data object
      null,       // Legacy parameter (not used with new format)
      propertyType || null,
      multiplierData.propertyTypes || null,
      inputMode,
      multiplierData.onlineGaming || null
    );
  }, [revenues, state, knownData, propertyType, inputMode]);

  // Stable serialized analysis for the sensitivity/projection panel so it
  // doesn't recompute its sweeps on every unrelated render.
  const liveAnalysis = useMemo(() => buildAnalysis({
    state, casinoName, propertyType, inputMode, revenues, knownData,
    gamingTaxCustomRate, slotRevenuePct,
  }), [state, casinoName, propertyType, inputMode, revenues, knownData, gamingTaxCustomRate, slotRevenuePct]);

  // Gaming tax calculation (separate from TOPI in IO model)
  const stateTaxConfig = gamingTaxRatesData.rates[state];
  const gamingTaxResult = useMemo(() => {
    // For online types, check if the state has that specific online type legalized
    if (isOnline) {
      const hasOnlineType = propertyType === 'ONLINE_CASINO'
        ? stateTaxConfig?.hasIGaming
        : stateTaxConfig?.hasSportsBetting;
      if (!hasOnlineType && (gamingTaxCustomRate == null || gamingTaxCustomRate === '')) return null;
    } else {
      const hasCommercial = stateTaxConfig && stateTaxConfig.hasCommercial;
      // Allow calculation if state has commercial gaming OR user provided a custom rate
      if (!hasCommercial && (gamingTaxCustomRate == null || gamingTaxCustomRate === '')) return null;
    }
    const ggr = inputMode === 'total' ? (revenues.total || 0) : (revenues.gaming || 0);
    if (ggr <= 0) return null;

    // Build tax config for calculation (passes propertyType for online routing)
    let taxConfig = buildTaxConfig(stateTaxConfig, gamingTaxCustomRate, slotRevenuePct, propertyType);

    const gamingTax = calculateGamingTax(ggr, taxConfig);
    const effectiveRate = ggr > 0 ? gamingTax / ggr : 0;
    return { amount: gamingTax, effectiveRate, ggr };
  }, [revenues, state, inputMode, gamingTaxCustomRate, slotRevenuePct, stateTaxConfig, propertyType, isOnline]);

  // Payroll and household tax calculations
  const stateEmploymentTaxRates = employmentTaxRatesData.states[state];
  const payrollTaxResult = useMemo(() => {
    if (!results || !stateEmploymentTaxRates) return null;
    const federal = employmentTaxRatesData.federal;
    const w = results.totals.wages;
    const e = results.totals.employment;
    return {
      direct: calculatePayrollTax(w.direct, e.direct, stateEmploymentTaxRates, federal),
      indirect: calculatePayrollTax(w.indirect, e.indirect, stateEmploymentTaxRates, federal),
      induced: calculatePayrollTax(w.induced, e.induced, stateEmploymentTaxRates, federal),
      get total() { return this.direct + this.indirect + this.induced; }
    };
  }, [results, state, stateEmploymentTaxRates]);

  const householdTaxResult = useMemo(() => {
    if (!results || !stateEmploymentTaxRates) return null;
    const w = results.totals.wages;
    return {
      direct: calculateHouseholdTax(w.direct, stateEmploymentTaxRates),
      indirect: calculateHouseholdTax(w.indirect, stateEmploymentTaxRates),
      induced: calculateHouseholdTax(w.induced, stateEmploymentTaxRates),
      get total() { return this.direct + this.indirect + this.induced; }
    };
  }, [results, state, stateEmploymentTaxRates]);

  // State options
  const stateOptions = multiplierData.states.map(s => ({ value: s, label: s }));

  // Author info for reports
  const authorInfo = {
    name: 'Dr. Kahlil Philander',
    title: 'Principal Consultant',
    institution: 'GP Consulting',
    bio: `Dr. Kahlil Philander is an economist and academic specializing in the analysis of policy and consumer behavior in the gaming industry. With nearly 20 years of applied research experience in economic impact measurement across academia, industry, and government, Dr. Philander offers a unique blend of technical expertise and policy insight, particularly in contexts involving tourism, entertainment, and community impact.

He currently serves as a tenured Associate Professor at Washington State University's Carson College of Business. His research spans topics such as regional economic forecasting, taxation policy, and the socioeconomic outcomes of the gaming industry. Dr. Philander's work has been funded by both government agencies and private-sector clients, and he has led numerous economic impact assessments and market studies for North American and international jurisdictions.

Dr. Philander's academic background includes a Ph.D. in Hospitality Administration from the University of Nevada, Las Vegas, with a dissertation centered on the economic impact of tax policy. He also holds an M.A. in Economics from the University of Toronto and a B.Com. in Finance and Economics with honors from the University of British Columbia.

Dr. Philander's research portfolio includes 40 peer-reviewed publications in top-tier journals such as Tourism Management, Journal of Policy Modeling, and Journal of Gambling Studies, alongside dozens of industry reports. His commentary has been featured in outlets like CNBC, Financial Times, and Wired magazine.

More information about Dr. Philander is available at kahlil.co.`,
    email: 'info@gamblingpolicy.com',
    phone: '',
    customContact: 'For customized economic impact analysis, please contact GP Consulting at info@gamblingpolicy.com'
  };

  // Handle license upgrade (from PremiumModal)
  const handleLicenseUpgrade = (licenseKey) => {
    setUserTier('pro');
    setShowPremiumModal(false);

    // If there's a casino name, add it as the first licensed property
    if (casinoName && casinoName.trim()) {
      addLicensedProperty(casinoName);
      setLicensedProperties(prev => {
        const { licensedProperties: updated } = getLicenseData();
        return updated;
      });
    }
  };

  // Save wizard state to sessionStorage before Stripe redirect
  const saveWizardState = () => {
    const wizardState = {
      wizardComplete: true,
      state,
      casinoName,
      propertyType,
      inputMode,
      revenues,
      knownData,
      hasOtherRevenue,
      hasKnownData
    };
    sessionStorage.setItem('wizardState', JSON.stringify(wizardState));
  };

  // Handle Stripe purchase
  const handlePurchase = async () => {
    if (!PURCHASING_ENABLED) return;
    setIsPurchasing(true);
    try {
      // Save wizard state before redirect
      saveWizardState();
      const res = await fetch('/api/create-checkout');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Unable to start checkout. Please try again.');
        setIsPurchasing(false);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Unable to connect to payment server. Please try again later.');
      setIsPurchasing(false);
    }
  };

  // Handle PPTX generation (lazy loaded)
  const handleDownloadPPTX = async () => {
    // Check tier before allowing download
    if (userTier !== 'pro') {
      setShowPremiumModal(true);
      return;
    }

    // Check property-tied license
    const { licenseKey } = getLicenseData();
    const propertyCheck = canDownloadForProperty(casinoName, licenseKey, licensedProperties);

    if (!propertyCheck.allowed) {
      if (propertyCheck.reason === 'wrong_property') {
        // Show wrong property modal
        setWrongPropertyInfo({
          licensedFor: propertyCheck.licensedFor,
          attempting: propertyCheck.attempting
        });
        setShowWrongPropertyModal(true);
        return;
      }
      // Other issues (invalid key, etc.)
      setShowPremiumModal(true);
      return;
    }

    // If this is a new license (no properties yet), confirm before tying to property
    if (propertyCheck.isNewLicense && casinoName && casinoName.trim()) {
      setShowConfirmPropertyModal(true);
      return;
    }

    if (!results) return;

    setIsGeneratingPPTX(true);

    try {
      // Dynamic import for code splitting - PPTX generator loaded on demand
      const { downloadPPTX } = await import('./utils/pptxGenerator');
      const propertyTypeLabel = PROPERTY_TYPE_OPTIONS.find(p => p.value === propertyType)?.label || null;
      await downloadPPTX(
        results,
        {
          state,
          casinoName,
          useGamblingSpecific: true,
          revenues,
          knownData,
          propertyType,
          propertyTypeLabel,
          inputMode,
          gamingTaxResult,
          stateTaxConfig,
          payrollTaxResult,
          householdTaxResult
        },
        authorInfo
      );
    } catch (error) {
      console.error('Failed to generate PPTX:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      alert(`Failed to generate PPTX: ${error.message}`);
    } finally {
      setIsGeneratingPPTX(false);
    }
  };

  // Handle confirmed property license (user confirmed tying license to property)
  const handleConfirmPropertyAndDownload = async () => {
    setShowConfirmPropertyModal(false);

    // Tie the license to this property
    addLicensedProperty(casinoName);
    setLicensedProperties(() => {
      const { licensedProperties: updated } = getLicenseData();
      return updated;
    });

    // Now proceed with download
    if (!results) return;

    setIsGeneratingPPTX(true);

    try {
      const { downloadPPTX } = await import('./utils/pptxGenerator');
      const propertyTypeLabel = PROPERTY_TYPE_OPTIONS.find(p => p.value === propertyType)?.label || null;
      await downloadPPTX(
        results,
        {
          state,
          casinoName,
          useGamblingSpecific: true,
          revenues,
          knownData,
          propertyType,
          propertyTypeLabel,
          inputMode,
          gamingTaxResult,
          stateTaxConfig,
          payrollTaxResult,
          householdTaxResult
        },
        authorInfo
      );
    } catch (error) {
      console.error('Failed to generate PPTX:', error);
      alert(`Failed to generate PPTX: ${error.message}`);
    } finally {
      setIsGeneratingPPTX(false);
    }
  };

  // Generate a sample report with fixed demo data so prospective buyers can
  // see the deliverable before purchasing. Watermarked as SAMPLE throughout.
  const handleDownloadSampleReport = async () => {
    setIsGeneratingSample(true);

    try {
      const sampleState = 'Nevada';
      const samplePropertyType = '721120';
      const sampleRevenues = { gaming: 149.4, food: 28.1, lodging: 51.1, other: 31.5, total: null };
      const emptyKnownData = {
        gaming: { emp: null, wages: null },
        food: { emp: null, wages: null },
        lodging: { emp: null, wages: null },
        other: { emp: null, wages: null }
      };

      const sampleResults = calculateCombinedImpact(
        sampleRevenues,
        multiplierData.multipliers,
        multiplierData.gambling,
        sampleState,
        true,
        emptyKnownData,
        null,
        samplePropertyType,
        multiplierData.propertyTypes || null,
        'department',
        multiplierData.onlineGaming || null
      );

      const sampleStateTaxConfig = gamingTaxRatesData.rates[sampleState];
      const sampleTaxConfig = buildTaxConfig(sampleStateTaxConfig, null, 70, samplePropertyType);
      const sampleGamingTax = calculateGamingTax(sampleRevenues.gaming, sampleTaxConfig);
      const sampleGamingTaxResult = {
        amount: sampleGamingTax,
        effectiveRate: sampleGamingTax / sampleRevenues.gaming,
        ggr: sampleRevenues.gaming
      };

      const sampleStateEmpTaxRates = employmentTaxRatesData.states[sampleState];
      const federal = employmentTaxRatesData.federal;
      const w = sampleResults.totals.wages;
      const e = sampleResults.totals.employment;
      const samplePayrollTaxResult = {
        direct: calculatePayrollTax(w.direct, e.direct, sampleStateEmpTaxRates, federal),
        indirect: calculatePayrollTax(w.indirect, e.indirect, sampleStateEmpTaxRates, federal),
        induced: calculatePayrollTax(w.induced, e.induced, sampleStateEmpTaxRates, federal),
        get total() { return this.direct + this.indirect + this.induced; }
      };
      const sampleHouseholdTaxResult = {
        direct: calculateHouseholdTax(w.direct, sampleStateEmpTaxRates),
        indirect: calculateHouseholdTax(w.indirect, sampleStateEmpTaxRates),
        induced: calculateHouseholdTax(w.induced, sampleStateEmpTaxRates),
        get total() { return this.direct + this.indirect + this.induced; }
      };

      const { downloadPPTX } = await import('./utils/pptxGenerator');
      await downloadPPTX(
        sampleResults,
        {
          state: sampleState,
          casinoName: 'Sample Casino Resort',
          useGamblingSpecific: true,
          revenues: sampleRevenues,
          knownData: emptyKnownData,
          propertyType: samplePropertyType,
          propertyTypeLabel: PROPERTY_TYPE_OPTIONS.find(p => p.value === samplePropertyType)?.label || 'Casino Hotel',
          inputMode: 'department',
          gamingTaxResult: sampleGamingTaxResult,
          stateTaxConfig: sampleStateTaxConfig,
          payrollTaxResult: samplePayrollTaxResult,
          householdTaxResult: sampleHouseholdTaxResult,
          isSample: true
        },
        authorInfo
      );
    } catch (error) {
      console.error('Failed to generate sample report:', error);
      alert(`Failed to generate sample report: ${error.message}`);
    } finally {
      setIsGeneratingSample(false);
    }
  };

  // Reset wizard and start over
  const handleStartOver = () => {
    setWizardComplete(false);
    setWizardStep(0);
    setState('Nevada');
    setCasinoName('');
    setPropertyType('721120');
    setInputMode('department');
    setRevenues({ gaming: 100, food: null, lodging: null, other: null, total: null });
    setKnownData({
      gaming: { emp: null, wages: null },
      food: { emp: null, wages: null },
      lodging: { emp: null, wages: null },
      other: { emp: null, wages: null }
    });
    setHasOtherRevenue(false);
    setHasKnownData(false);
  };

  // ---- Save / share / projects / export / scenario comparison ----
  const currentAnalysis = () => buildAnalysis({
    state, casinoName, propertyType, inputMode, revenues, knownData,
    gamingTaxCustomRate, slotRevenuePct,
  });

  const restoreAnalysis = (analysis) => applyAnalysis(analysis, {
    setState, setCasinoName, setPropertyType, setInputMode,
    setRevenues, setKnownData, setGamingTaxCustomRate, setSlotRevenuePct,
  });

  const handleSaveProject = (name) => {
    saveProjectStore(name || casinoName || 'Untitled analysis', currentAnalysis());
    setProjects(loadProjects());
  };

  const handleOpenProject = (project) => {
    restoreAnalysis(project.analysis);
    setProjectsOpen(false);
    setWizardComplete(true);
  };

  const handleDeleteProject = (id) => {
    deleteProjectStore(id);
    setProjects(loadProjects());
  };

  const handleCopyShare = async () => {
    const url = buildShareURL(currentAnalysis());
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this shareable link:', url);
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const exportContext = () => ({
    state, casinoName,
    propertyTypeLabel: PROPERTY_TYPE_OPTIONS.find(p => p.value === propertyType)?.label || null,
    gamingTaxResult, payrollTaxResult, householdTaxResult,
  });

  const handleExportCSV = () => {
    if (!results) return;
    downloadCSV(`${slugify(casinoName, 'gems-analysis')}.csv`, buildResultsCSV(results, exportContext()));
  };

  const handleAddScenario = () => {
    setScenarios(prev => (prev.length >= 4 ? prev : [...prev, {
      id: `s_${Date.now().toString(36)}_${prev.length}`,
      name: casinoName?.trim() || `${state} · ${PROPERTY_TYPE_OPTIONS.find(p => p.value === propertyType)?.label || 'Scenario'}`,
      analysis: currentAnalysis(),
    }]));
  };

  const handleRemoveScenario = (id) => setScenarios(prev => prev.filter(s => s.id !== id));

  const toggleCompare = () => {
    if (!compareActive && scenarios.length === 0 && results) handleAddScenario();
    setCompareActive(a => !a);
  };

  // ============================================================
  // WIZARD VIEW
  // ============================================================
  if (!wizardComplete) {
    const totalSteps = 5;

    // Step 1: State Selection, Property Type, and Casino Name
    if (wizardStep === 0) {
      const selectedPropertyType = PROPERTY_TYPE_OPTIONS.find(p => p.value === propertyType);

      return (
        <>
          <PageHeader />
          <div className="min-h-screen bg-paper">
            <WizardStep
              stepNum={1}
          totalSteps={totalSteps}
          title="Tell us about your project"
          subtitle="Select the state, type of gaming operation, and name your project."
          onNext={() => setWizardStep(1)}
          showBack={false}
          canProceed={!!state && !!propertyType && !!casinoName?.trim()}
        >
          <div className="space-y-4">
            <SelectField
              label="State"
              value={state}
              onChange={setState}
              options={stateOptions}
            />
            <div className="space-y-1">
              <label htmlFor="property-type" className="block text-sm font-medium text-gray-700">Type of Gaming Operation</label>
              <select
                id="property-type"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
              >
                <option value="">Select property type...</option>
                <optgroup label="Land-Based">
                  {PROPERTY_TYPE_OPTIONS.filter(p => p.category === 'land').map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Online">
                  {PROPERTY_TYPE_OPTIONS.filter(p => p.category === 'online').map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </optgroup>
              </select>
              <p className="text-xs text-gray-600">{selectedPropertyType?.description || 'Select the type of gaming establishment for more accurate multipliers'}</p>
            </div>
            <InputField
              label={isOnlinePropertyType(propertyType) ? "Operator or Project Name" : "Casino or Project Name"}
              value={casinoName}
              onChange={setCasinoName}
              placeholder={isOnlinePropertyType(propertyType) ? "e.g., DraftKings, FanDuel, Proposed iGaming Platform" : "e.g., Bellagio, Proposed Downtown Casino"}
              type="text"
              helpText="This will appear on your report. You can change it anytime before downloading."
            />
          </div>
        </WizardStep>
          </div>
        </>
      );
    }

    // Step 2: Revenue Input Mode and Revenue Entry
    if (wizardStep === 1) {
      // Determine if we can skip the "other revenue" step
      const canProceedToNextStep = isOnline
        ? (revenues.gaming > 0 || revenues.total > 0)
        : inputMode === 'total'
          ? revenues.total > 0
          : revenues.gaming > 0;

      // For total mode or online types, skip step 3 (other revenue) and go to step 4 (known data)
      // Online operators have a single revenue stream (GGR); there are no "other revenue streams"
      const handleNextStep = () => {
        if (isOnline || inputMode === 'total') {
          setWizardStep(3); // Skip to known data step
        } else {
          setWizardStep(2); // Go to other revenue step
        }
      };

      return (
        <>
          <PageHeader />
          <div className="min-h-screen bg-paper">
            <WizardStep
              stepNum={2}
              totalSteps={totalSteps}
              title={isOnline ? "Enter gross gaming revenue" : "How would you like to enter revenue?"}
              subtitle={isOnline
                ? "Enter the total GGR for this online operation. Marketing, tech, and other costs are expenses funded by GGR — not separate revenue streams."
                : "Choose whether to enter total property revenue or break it down by department."}
              onBack={() => setWizardStep(0)}
              onNext={handleNextStep}
              canProceed={canProceedToNextStep}
            >
              <div className="space-y-6">
                {isOnline ? (
                  /* Online: single GGR input, no department toggle */
                  <div className="animate-fade-in">
                    <InputField
                      label={propertyType === 'ONLINE_SPORTSBOOK' ? 'Gross Betting Revenue' : 'Gross Gaming Revenue (GGR)'}
                      value={revenues.gaming || revenues.total}
                      onChange={(val) => setRevenues({ ...revenues, gaming: val, total: val })}
                      placeholder="100"
                      prefix="$"
                      suffix="M"
                      helpText={`Total gross ${propertyType === 'ONLINE_SPORTSBOOK' ? 'betting' : 'gaming'} revenue — the single revenue stream for the online operation`}
                    />
                    <p className="mt-3 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                      <strong>Important:</strong> Employment, wages, and supply chain effects apply to the state where the operator's workforce is located — not necessarily where bettors are.
                      If the operator is headquartered elsewhere, most economic impact (except gaming tax) occurs in that state.
                      Enter actual in-state employment and wage data in the next step for the most accurate results.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Land-based: Input Mode Toggle */}
                    <div className="flex gap-4">
                      <button
                        onClick={() => {
                          setInputMode('total');
                          setRevenues({ ...revenues, gaming: null, food: null, lodging: null, other: null, total: revenues.total || 100 });
                        }}
                        className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                          inputMode === 'total'
                        ? 'border-accent bg-accent-soft text-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">Total Property Revenue</div>
                    <div className="text-xs text-gray-500 mt-1">Enter one combined number</div>
                  </button>
                  <button
                    onClick={() => {
                      setInputMode('department');
                      setRevenues({ ...revenues, total: null, gaming: revenues.gaming || 100 });
                    }}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                      inputMode === 'department'
                        ? 'border-accent bg-accent-soft text-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">By Department</div>
                    <div className="text-xs text-gray-500 mt-1">Gaming, F&B, lodging separately</div>
                  </button>
                </div>

                {/* Revenue Input based on mode */}
                {inputMode === 'total' ? (
                  <div className="animate-fade-in">
                    <InputField
                      label="Total Property Revenue"
                      value={revenues.total}
                      onChange={(val) => setRevenues({ ...revenues, total: val })}
                      placeholder="100"
                      prefix="$"
                      suffix="M"
                      helpText={`All revenue from the ${PROPERTY_TYPE_OPTIONS.find(p => p.value === propertyType)?.label || 'property'} will use integrated multipliers`}
                    />
                    <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      <strong>Note:</strong> Total mode applies {propertyType === '721120' ? 'accommodation (hotel)' : 'property-specific'} multipliers to the entire revenue.
                      Use "By Department" if you want gaming revenue analyzed separately with gambling-specific multipliers.
                    </p>
                  </div>
                ) : (
                  <div className="animate-fade-in">
                    <InputField
                      label="Gaming Revenue (GGR)"
                      value={revenues.gaming}
                      onChange={(val) => setRevenues({ ...revenues, gaming: val })}
                      placeholder="100"
                      prefix="$"
                      suffix="M"
                      helpText="Enter gross gaming revenue (win) in millions. Gaming-specific multipliers will be applied."
                    />
                  </div>
                )}
                  </>
                )}
              </div>
            </WizardStep>
          </div>
        </>
      );
    }

    // Step 3: Other Revenue Streams
    if (wizardStep === 2) {
      return (
        <>
          <PageHeader />
          <div className="min-h-screen bg-paper">
            <WizardStep
              stepNum={3}
              totalSteps={totalSteps}
              title={isOnline ? "Do you have other operational revenue?" : "Do you have other revenue streams?"}
              subtitle={isOnline
                ? "Include marketing/advertising, technology infrastructure, or other operational costs treated as separate revenue streams."
                : "Include food & beverage, lodging, or other entertainment revenue if applicable."}
              onBack={() => setWizardStep(1)}
              onNext={() => setWizardStep(3)}
            >
          <div className="space-y-4">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setHasOtherRevenue(true)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  hasOtherRevenue
                    ? 'border-accent bg-accent-soft text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Yes, add more
              </button>
              <button
                onClick={() => {
                  setHasOtherRevenue(false);
                  setRevenues(isOnline
                    ? { ...revenues, marketing: null, tech: null, other: null }
                    : { ...revenues, food: null, lodging: null, other: null });
                }}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  !hasOtherRevenue
                    ? 'border-accent bg-accent-soft text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {isOnline ? 'No, just GGR' : 'No, just gaming'}
              </button>
            </div>

            {hasOtherRevenue && (
              <div className="space-y-4 animate-fade-in">
                {isOnline ? (
                  <>
                    <InputField
                      label="Marketing & Advertising"
                      value={revenues.marketing}
                      onChange={(val) => setRevenues({ ...revenues, marketing: val })}
                      placeholder="0"
                      prefix="$"
                      suffix="M"
                      helpText="Optional — promotional spending, customer acquisition costs"
                    />
                    <InputField
                      label="Technology Infrastructure"
                      value={revenues.tech}
                      onChange={(val) => setRevenues({ ...revenues, tech: val })}
                      placeholder="0"
                      prefix="$"
                      suffix="M"
                      helpText="Optional — platform, servers, payment processing"
                    />
                    <InputField
                      label="Other Operational Revenue"
                      value={revenues.other}
                      onChange={(val) => setRevenues({ ...revenues, other: val })}
                      placeholder="0"
                      prefix="$"
                      suffix="M"
                      helpText="Optional"
                    />
                  </>
                ) : (
                  <>
                    <InputField
                      label="Food & Beverage Revenue"
                      value={revenues.food}
                      onChange={(val) => setRevenues({ ...revenues, food: val })}
                      placeholder="0"
                      prefix="$"
                      suffix="M"
                      helpText="Optional"
                    />
                    <InputField
                      label="Lodging Revenue"
                      value={revenues.lodging}
                      onChange={(val) => setRevenues({ ...revenues, lodging: val })}
                      placeholder="0"
                      prefix="$"
                      suffix="M"
                      helpText="Optional"
                    />
                    <InputField
                      label="Other Entertainment Revenue"
                      value={revenues.other}
                      onChange={(val) => setRevenues({ ...revenues, other: val })}
                      placeholder="0"
                      prefix="$"
                      suffix="M"
                      helpText="Optional"
                    />
                  </>
                )}
              </div>
            )}
              </div>
            </WizardStep>
          </div>
        </>
      );
    }

    // Step 4: Known Property Data
    if (wizardStep === 3) {
      // Handle back navigation: skip step 3 if in total mode
      const handleBackStep = () => {
        if (inputMode === 'total') {
          setWizardStep(1); // Go back to revenue input (skip other revenue step)
        } else {
          setWizardStep(2); // Go back to other revenue step
        }
      };

      // Helper to update known data for a specific department
      const updateKnownData = (dept, field, value) => {
        setKnownData(prev => ({
          ...prev,
          [dept]: { ...prev[dept], [field]: value }
        }));
      };

      // Clear all known data
      const clearKnownData = () => {
        if (isOnline) {
          setKnownData({
            gaming: { emp: null, wages: null },
            marketing: { emp: null, wages: null },
            tech: { emp: null, wages: null },
            other: { emp: null, wages: null }
          });
        } else {
          setKnownData({
            gaming: { emp: null, wages: null },
            food: { emp: null, wages: null },
            lodging: { emp: null, wages: null },
            other: { emp: null, wages: null }
          });
        }
      };

      // Determine which departments have revenue (for showing known data inputs)
      const activeDepartments = inputMode === 'total'
        ? [{ key: 'total', label: isOnline ? 'Operation Total' : 'Property Total' }]
        : isOnline
          ? [
              { key: 'gaming', label: propertyType === 'ONLINE_SPORTSBOOK' ? 'Sports Betting' : 'Online Gaming', revenue: revenues.gaming },
              { key: 'marketing', label: 'Marketing & Advertising', revenue: revenues.marketing },
              { key: 'tech', label: 'Technology Infrastructure', revenue: revenues.tech },
              { key: 'other', label: 'Other', revenue: revenues.other }
            ].filter(d => d.revenue && d.revenue > 0)
          : [
              { key: 'gaming', label: 'Gaming', revenue: revenues.gaming },
              { key: 'food', label: 'Food & Beverage', revenue: revenues.food },
              { key: 'lodging', label: 'Lodging', revenue: revenues.lodging },
              { key: 'other', label: 'Other', revenue: revenues.other }
            ].filter(d => d.revenue && d.revenue > 0);

      return (
        <>
          <PageHeader />
          <div className="min-h-screen bg-paper">
            <WizardStep
              stepNum={inputMode === 'total' ? 3 : 4}
              totalSteps={totalSteps}
              title={isOnline ? "Do you have known operational data?" : "Do you have known property data?"}
              subtitle={isOnline
                ? "If you know actual employment or wages for the online operation, enter them for more accurate direct effects."
                : "If you know the actual direct employment or wages, you can enter them for more accurate results."}
              onBack={handleBackStep}
              onNext={() => setWizardStep(4)}
            >
          <div className="space-y-4">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setHasKnownData(true)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  hasKnownData
                    ? 'border-accent bg-accent-soft text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Yes, I have data
              </button>
              <button
                onClick={() => {
                  setHasKnownData(false);
                  clearKnownData();
                }}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  !hasKnownData
                    ? 'border-accent bg-accent-soft text-primary'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                No, calculate for me
              </button>
            </div>

            {hasKnownData && (
              <div className="space-y-6 animate-fade-in">
                {inputMode === 'total' ? (
                  // Total mode: single set of inputs
                  <div className="space-y-4">
                    <InputField
                      label="Direct Employment (FTEs)"
                      value={knownData.gaming?.emp}
                      onChange={(v) => updateKnownData('gaming', 'emp', v)}
                      placeholder="e.g., 500"
                      helpText={isOnline ? "Full-time equivalent employees in the operation" : "Full-time equivalent employees at the property"}
                    />
                    <InputField
                      label="Direct Wages"
                      value={knownData.gaming?.wages}
                      onChange={(v) => updateKnownData('gaming', 'wages', v)}
                      placeholder="e.g., 25"
                      prefix="$"
                      suffix="M"
                      helpText={isOnline ? "Total direct wages in millions (recommended — online wage estimates are approximate)" : "Total direct wages in millions"}
                    />
                  </div>
                ) : (
                  // Department mode: inputs for each revenue stream
                  activeDepartments.map(({ key, label }) => (
                    <div key={key} className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-700 mb-3">{label}</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <InputField
                          label="FTEs"
                          value={knownData[key]?.emp}
                          onChange={(v) => updateKnownData(key, 'emp', v)}
                          placeholder="FTEs"
                          helpText="Full-time equivalents"
                        />
                        <InputField
                          label="Wages"
                          value={knownData[key]?.wages}
                          onChange={(v) => updateKnownData(key, 'wages', v)}
                          placeholder="$M"
                          prefix="$"
                          suffix="M"
                          helpText="Optional"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
              </div>
            </WizardStep>
          </div>
        </>
      );
    }

    // Step 5: Gaming Tax Rate Confirmation
    if (wizardStep === 4) {
      const taxInfo = gamingTaxRatesData.rates[state];
      // For online types, check if the state has legalized the specific online vertical
      const hasGaming = isOnline
        ? (propertyType === 'ONLINE_CASINO' ? taxInfo?.hasIGaming : taxInfo?.hasSportsBetting)
        : (taxInfo && taxInfo.hasCommercial);
      // For online, use the sub-config (iGaming or sportsBetting) as the display tax info
      const displayTaxInfo = isOnline
        ? (propertyType === 'ONLINE_CASINO' ? taxInfo?.iGaming : taxInfo?.sportsBetting)
        : taxInfo;
      const ggr = inputMode === 'total' ? (revenues.total || 0) : (revenues.gaming || 0);

      // Compute the tax that would apply with current settings
      const computePreviewTax = () => {
        if ((!hasGaming && (gamingTaxCustomRate == null || gamingTaxCustomRate === '')) || ggr <= 0) return { amount: 0, effectiveRate: 0 };
        const config = buildTaxConfig(taxInfo, gamingTaxCustomRate, slotRevenuePct);
        const amount = calculateGamingTax(ggr, config);
        return { amount, effectiveRate: ggr > 0 ? amount / ggr : 0 };
      };
      const preview = computePreviewTax();

      return (
        <>
          <PageHeader />
          <div className="min-h-screen bg-paper">
            <WizardStep
              stepNum={inputMode === 'total' ? 4 : 5}
              totalSteps={totalSteps}
              title={isOnline
                ? (propertyType === 'ONLINE_CASINO' ? 'Confirm iGaming Tax Rate' : 'Confirm Sports Betting Tax Rate')
                : 'Confirm Gaming Tax Rate'}
              subtitle={hasGaming
                ? `Review the ${isOnline ? (propertyType === 'ONLINE_CASINO' ? 'iGaming' : 'sports betting') : 'gaming'} tax rate for ${state}. You can adjust or override it below.`
                : isOnline
                  ? `${state} has not yet authorized ${propertyType === 'ONLINE_CASINO' ? 'iGaming' : 'online sports betting'}. You can enter a custom rate for hypothetical analysis.`
                  : `${state} does not have commercial casino gaming. You can enter a custom rate if applicable.`}
              onBack={() => setWizardStep(3)}
              onNext={() => setWizardComplete(true)}
              nextLabel="Calculate Impact"
            >
              <div className="space-y-6">
                {hasGaming ? (
                  <>
                    {/* State rate summary */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{state} {isOnline ? (propertyType === 'ONLINE_CASINO' ? 'iGaming' : 'Sports Betting') : 'Gaming'} Tax</h4>
                        <span className="text-sm text-gray-500">Source: {(displayTaxInfo || taxInfo)?.sourceYear || '2024'}</span>
                      </div>

                      {isOnline && displayTaxInfo ? (
                        /* Online: show the sub-config rate info */
                        <div>
                          <p className="text-gray-700">
                            <span className="text-2xl font-bold text-primary">
                              {formatNumber((displayTaxInfo.flatRate || displayTaxInfo.effectiveRate || 0) * 100, 2)}%
                            </span>
                            <span className="text-sm ml-2">on {propertyType === 'ONLINE_CASINO' ? 'iGaming GGR' : 'gross betting revenue'}</span>
                          </p>
                          {displayTaxInfo.description && (
                            <p className="text-xs text-gray-500 mt-2">{displayTaxInfo.description}</p>
                          )}
                        </div>
                      ) : taxInfo.rateStructure === 'flat' ? (
                        <p className="text-gray-700">
                          <span className="text-2xl font-bold text-primary">
                            {formatNumber((taxInfo.flatRate || taxInfo.effectiveRate) * 100, 2)}%
                          </span>
                          <span className="text-sm ml-2">flat rate on GGR</span>
                        </p>
                      ) : null}

                      {taxInfo.rateStructure === 'tiered' && taxInfo.tiers && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Graduated tax brackets:</p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-blue-200">
                                <th className="text-left py-1 text-gray-600">GGR Range</th>
                                <th className="text-right py-1 text-gray-600">Rate</th>
                                {ggr > 0 && <th className="text-right py-1 text-gray-600">Tax in Bracket</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {taxInfo.tiers.map((tier, i) => {
                                const nextThreshold = i < taxInfo.tiers.length - 1 ? taxInfo.tiers[i + 1].threshold : Infinity;
                                const isActive = ggr > tier.threshold;
                                const taxableInTier = isActive ? Math.min(ggr, nextThreshold) - tier.threshold : 0;
                                const tierTax = taxableInTier * tier.rate;
                                return (
                                  <tr key={i} className={`border-b border-blue-100 ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                                    <td className="py-1">
                                      ${formatNumber(tier.threshold, 0)}M
                                      {nextThreshold < Infinity ? ` – $${formatNumber(nextThreshold, 0)}M` : '+'}
                                    </td>
                                    <td className="text-right py-1 font-medium">{formatNumber(tier.rate * 100, 1)}%</td>
                                    {ggr > 0 && (
                                      <td className="text-right py-1">
                                        {isActive ? `$${formatNumber(tierTax, 2)}M` : '-'}
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {taxInfo.rateStructure === 'split_tiered' && taxInfo.slotTiers && taxInfo.tableTiers && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Separate graduated brackets for slots and table games:</p>
                          {[{ label: 'Slot Machines', tiers: taxInfo.slotTiers, revShare: ggr * (slotRevenuePct / 100) },
                            { label: 'Table Games', tiers: taxInfo.tableTiers, revShare: ggr * (1 - slotRevenuePct / 100) }
                          ].map(({ label: gameLabel, tiers: gameTiers, revShare }) => (
                            <div key={gameLabel} className="mb-3">
                              <p className="text-xs font-semibold text-gray-700 mb-1">{gameLabel}</p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-blue-200">
                                    <th className="text-left py-1 text-gray-600">GGR Range</th>
                                    <th className="text-right py-1 text-gray-600">Rate</th>
                                    {ggr > 0 && <th className="text-right py-1 text-gray-600">Tax</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {gameTiers.map((tier, i) => {
                                    const nextThreshold = i < gameTiers.length - 1 ? gameTiers[i + 1].threshold : Infinity;
                                    const isActive = revShare > tier.threshold;
                                    const taxableInTier = isActive ? Math.min(revShare, nextThreshold) - tier.threshold : 0;
                                    const tierTax = taxableInTier * tier.rate;
                                    return (
                                      <tr key={i} className={`border-b border-blue-100 ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                                        <td className="py-1">
                                          ${formatNumber(tier.threshold, 0)}M
                                          {nextThreshold < Infinity ? ` – $${formatNumber(nextThreshold, 0)}M` : '+'}
                                        </td>
                                        <td className="text-right py-1 font-medium">{formatNumber(tier.rate * 100, 1)}%</td>
                                        {ggr > 0 && (
                                          <td className="text-right py-1">
                                            {isActive ? `$${formatNumber(tierTax, 2)}M` : '-'}
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}

                      {taxInfo.rateStructure === 'split_game_type' && taxInfo.slotsRate != null && taxInfo.tableRate != null && (
                        <div>
                          <p className="text-gray-700 mb-2">
                            <span className="font-bold text-primary">{formatNumber(taxInfo.slotsRate * 100, 0)}%</span> slots
                            {' / '}
                            <span className="font-bold text-primary">{formatNumber(taxInfo.tableRate * 100, 0)}%</span> table games
                          </p>
                        </div>
                      )}

                      {taxInfo.rateStructure === 'tribal_compact' && (
                        <p className="text-gray-700">
                          Tribal compact state — rates vary by tribe.
                          <span className="block text-sm text-gray-500 mt-1">
                            Estimated effective rate: {formatNumber((taxInfo.effectiveRate || 0) * 100, 1)}%
                          </span>
                        </p>
                      )}

                      {taxInfo.rateStructure === 'state_operated' && (
                        <p className="text-gray-700">
                          State-operated gaming — the state retains a share of revenue.
                          <span className="block text-sm text-gray-500 mt-1">
                            Effective state share: {formatNumber((taxInfo.effectiveRate || 0) * 100, 1)}%
                          </span>
                        </p>
                      )}

                      {(taxInfo.rateStructure === 'split_by_license' || taxInfo.rateStructure === 'split_by_facility') && (
                        <p className="text-gray-700">
                          Rates vary by {taxInfo.rateStructure === 'split_by_license' ? 'license category' : 'facility'}.
                          <span className="block text-sm text-gray-500 mt-1">
                            Estimated effective rate: {formatNumber((taxInfo.effectiveRate || 0) * 100, 1)}%
                          </span>
                        </p>
                      )}

                      {taxInfo.description && (
                        <p className="text-xs text-gray-500 mt-2">{taxInfo.description}</p>
                      )}
                    </div>

                    {/* Slot/table split slider - shown for split_game_type, split_tiered, or legacy slotTableSplit (not for online types) */}
                    {!isOnline && (taxInfo.rateStructure === 'split_game_type' || taxInfo.rateStructure === 'split_tiered' || taxInfo.slotTableSplit) && !(gamingTaxCustomRate != null && gamingTaxCustomRate !== '') && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Slot Revenue Share: {slotRevenuePct}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={slotRevenuePct}
                          onChange={(e) => setSlotRevenuePct(parseInt(e.target.value))}
                          className="w-full accent-[#1a365d]"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>All Tables</span>
                          <span className="font-medium text-primary">
                            Effective: {formatNumber(preview.effectiveRate * 100, 1)}%
                          </span>
                          <span>All Slots</span>
                        </div>
                      </div>
                    )}

                    {/* Local tax notes */}
                    {taxInfo.localTaxNotes && (
                      <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                        <p className="text-xs text-amber-800">
                          <span className="font-semibold">Local taxes:</span> {taxInfo.localTaxNotes}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-600">
                      {isOnline
                        ? `${state} has not yet authorized ${propertyType === 'ONLINE_CASINO' ? 'iGaming' : 'online sports betting'}. Enter a custom rate below for a hypothetical analysis.`
                        : taxInfo?.hasTribal
                          ? `${state} has tribal gaming but no commercial casino GGR tax. Enter a custom rate below if you have a specific compact rate.`
                          : `${state} does not currently have legal casino gaming. Enter a custom rate below for a hypothetical analysis.`}
                    </p>
                  </div>
                )}

                {/* Custom rate override */}
                <div className="border-t border-gray-200 pt-4">
                  <InputField
                    label="Custom Tax Rate Override (%)"
                    value={gamingTaxCustomRate != null && gamingTaxCustomRate !== '' ? gamingTaxCustomRate * 100 : null}
                    onChange={(v) => setGamingTaxCustomRate(v != null && v !== '' ? v / 100 : null)}
                    placeholder="Leave blank to use the state rate above"
                    helpText="Override with a custom percentage (e.g., for tribal compacts, local adjustments, or proposed rates)"
                    id="wizard-custom-tax-rate"
                  />
                </div>

                {/* Preview */}
                {ggr > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Estimated gaming tax on ${formatNumber(ggr, 1)}M GGR:</p>
                        <p className="text-xl font-bold text-primary">${formatNumber(preview.amount, 2)}M</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Effective rate:</p>
                        <p className="text-xl font-bold text-primary">{formatNumber(preview.effectiveRate * 100, 2)}%</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </WizardStep>
          </div>
        </>
      );
    }
  }

  // ============================================================
  // DASHBOARD VIEW (after wizard completion)
  // ============================================================
  return (
    <>
      <PageHeader />
      <div className="min-h-screen bg-paper py-8 px-4 sm:px-6 lg:px-8">
      {/* Watermark for free tier */}
      <WatermarkOverlay show={userTier === 'free'} />

      {/* Premium Modal */}
      <PremiumModal
        isOpen={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        onUpgrade={handleLicenseUpgrade}
        onPurchase={handlePurchase}
        isPurchasing={isPurchasing}
        propertyName={casinoName}
        onDownloadSample={handleDownloadSampleReport}
        isGeneratingSample={isGeneratingSample}
      />

      {/* License Key Modal - shown once after purchase so the user saves the key */}
      {purchasedLicense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-primary rounded-t-2xl px-6 py-5 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Check size={22} className="text-emerald-300" />
                Purchase Complete
              </h2>
              <p className="text-white/90 text-sm mt-1">Your Pro license is now active.</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Your license key</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-sm text-gray-900 break-all">
                    {purchasedLicense.key}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(purchasedLicense.key);
                      setLicenseKeyCopied(true);
                      setTimeout(() => setLicenseKeyCopied(false), 2000);
                    }}
                    className="p-2.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors"
                    aria-label="Copy license key"
                  >
                    {licenseKeyCopied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Save this key somewhere safe.</strong> Your license is stored in this
                browser only — you'll need the key to activate it on another device or after
                clearing your browser data. Lost keys can be recovered at {BRAND.email} with
                your Stripe receipt{purchasedLicense.email ? ` (sent to ${purchasedLicense.email})` : ''}.
              </div>
              <button
                onClick={() => setPurchasedLicense(null)}
                className="w-full py-3 px-4 rounded-xl font-semibold bg-primary hover:bg-primary-dark text-white shadow-lg transition-all"
              >
                I've saved my key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wrong Property Modal */}
      <WrongPropertyModal
        isOpen={showWrongPropertyModal}
        onClose={() => setShowWrongPropertyModal(false)}
        licensedFor={wrongPropertyInfo?.licensedFor}
        attempting={wrongPropertyInfo?.attempting}
        onSwitchProperty={() => {
          // Switch casino name to the licensed property
          setCasinoName(wrongPropertyInfo?.licensedFor || '');
          setShowWrongPropertyModal(false);
        }}
        onAddProperty={async () => {
          // Redirect to Stripe for add-property purchase ($295)
          setShowWrongPropertyModal(false);
          try {
            // Save wizard state and pending property name before redirect
            saveWizardState();
            sessionStorage.setItem('pendingAddonProperty', wrongPropertyInfo?.attempting || casinoName);
            const response = await fetch('/api/create-checkout-addon', { method: 'POST' });
            if (!response.ok) {
              throw new Error('Failed to create checkout session');
            }
            const { url } = await response.json();
            window.location.href = url;
          } catch (error) {
            console.error('Addon checkout error:', error);
            alert('Unable to start checkout. Please try again or contact support.');
          }
        }}
        onEnterNewKey={() => {
          setShowWrongPropertyModal(false);
          setShowPremiumModal(true);
        }}
      />

      {/* Confirm Property Modal - shown before tying license to property */}
      <ConfirmPropertyModal
        isOpen={showConfirmPropertyModal}
        onClose={() => setShowConfirmPropertyModal(false)}
        propertyName={casinoName}
        onConfirm={handleConfirmPropertyAndDownload}
      />

      {/* Saved analyses drawer */}
      <ProjectsDrawer
        open={projectsOpen}
        projects={projects}
        onClose={() => setProjectsOpen(false)}
        onOpenProject={handleOpenProject}
        onDelete={handleDeleteProject}
      />

      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header role="banner" className="text-center mb-10">
          <button
            onClick={handleStartOver}
            className="text-sm text-accent hover:text-primary font-medium"
          >
            ← Start New Analysis
          </button>
        </header>

        {/* Action toolbar: save / open / share / export / compare */}
        <Toolbar
          disabled={!results}
          defaultName={casinoName}
          projectCount={projects.length}
          onSaveProject={handleSaveProject}
          onCopyShare={handleCopyShare}
          shareCopied={shareCopied}
          onOpenProjects={() => setProjectsOpen(true)}
          onExportCSV={handleExportCSV}
          onPrint={printReport}
          compareActive={compareActive}
          onToggleCompare={toggleCompare}
          canCompare={!!results}
        />

        {/* Scenario comparison (full width) */}
        {compareActive && (
          <div className="dash-card p-6 mb-6 animate-fade-in-up">
            <SectionHeader>Scenario Comparison</SectionHeader>
            <p className="text-xs text-text-muted -mt-2 mb-4">
              Capture snapshots of different states, tax rates, or revenue levels and compare their impact side by side. The first scenario is the baseline.
            </p>
            <ScenarioCompare
              scenarios={scenarios}
              onRemove={handleRemoveScenario}
              onAddCurrent={handleAddScenario}
              canAddCurrent={!!results && scenarios.length < 4}
            />
          </div>
        )}

        {/* Revenue Forecaster import banner */}
        {importedFromForecaster && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 mt-0.5">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  Imported from Revenue Forecaster
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Revenue and employment estimates based on {importedArchetype ? importedArchetype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'selected'} archetype benchmarks.
                  You can adjust all values in the input panel.
                </p>
              </div>
            </div>
            <button
              onClick={() => setImportedFromForecaster(false)}
              className="text-emerald-400 hover:text-emerald-600 p-1 flex-shrink-0"
              aria-label="Dismiss import banner"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Archetype Comparison Panel */}
        {results && !isOnlinePropertyType(propertyType) && (
          <div className="bg-accent-soft border border-accent-100 rounded-xl p-4 mb-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600 mt-0.5">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Nevada Gaming Abstract Benchmark
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Compare IO model employment with empirical staffing ratios from the 2024 Gaming Abstract.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowArchetypeComparison(!showArchetypeComparison)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
              >
                {showArchetypeComparison ? 'Hide' : 'Compare'}
                <ChevronDown size={14} className={`transition-transform ${showArchetypeComparison ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showArchetypeComparison && (() => {
              const gamingRev = inputMode === 'total' ? (revenues.total || 0) : (revenues.gaming || 0);
              const archKey = selectedArchetypeKey;
              const arch = archKey ? ARCHETYPES[archKey] : null;
              const archetypeEmp = arch ? calculateArchetypeEmployment(gamingRev, archKey) : 0;
              const ioDirectEmp = results?.totals?.employment?.direct || 0;

              return (
                <div className="mt-4 space-y-3">
                  {/* Archetype Selector */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Operating Archetype</label>
                    <select
                      value={selectedArchetypeKey || ''}
                      onChange={(e) => setSelectedArchetypeKey(e.target.value || null)}
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option value="">Select an archetype...</option>
                      {ARCHETYPE_LIST.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.name}{a.key === importedArchetype ? ' (From Forecaster)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Comparison Table */}
                  {arch && (
                    <div className="bg-white rounded-lg border border-blue-100 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-blue-100">
                            <th className="text-left text-xs font-medium text-gray-500 px-4 py-2">Metric</th>
                            <th className="text-right text-xs font-medium text-primary px-4 py-2">IO Model</th>
                            <th className="text-right text-xs font-medium text-blue-600 px-4 py-2">Archetype</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-blue-50">
                            <td className="text-xs text-gray-600 px-4 py-2">Direct FTEs</td>
                            <td className="text-right text-xs font-semibold text-primary px-4 py-2 font-mono">
                              {formatJobs(ioDirectEmp)}
                            </td>
                            <td className="text-right text-xs font-semibold text-blue-600 px-4 py-2 font-mono">
                              {formatJobs(archetypeEmp)}
                            </td>
                          </tr>
                          <tr className="border-b border-blue-50">
                            <td className="text-xs text-gray-600 px-4 py-2">FTEs per $1M GGR</td>
                            <td className="text-right text-xs text-primary px-4 py-2 font-mono">
                              {gamingRev > 0 ? (ioDirectEmp / gamingRev).toFixed(1) : '-'}
                            </td>
                            <td className="text-right text-xs text-blue-600 px-4 py-2 font-mono">
                              {arch.empPerMillionGGR.toFixed(1)}
                            </td>
                          </tr>
                          <tr>
                            <td className="text-xs text-gray-600 px-4 py-2">Difference</td>
                            <td colSpan={2} className="text-right text-xs px-4 py-2 font-mono">
                              {(() => {
                                const diff = ioDirectEmp - archetypeEmp;
                                const pctDiff = archetypeEmp > 0 ? ((diff / archetypeEmp) * 100) : 0;
                                const color = Math.abs(pctDiff) < 10 ? 'text-gray-500' : diff > 0 ? 'text-amber-600' : 'text-amber-600';
                                return (
                                  <span className={color}>
                                    {diff > 0 ? '+' : ''}{formatJobs(diff)} ({diff > 0 ? '+' : ''}{pctDiff.toFixed(0)}%)
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {arch && (
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      IO model employment is calculated from BEA input-output tables and QCEW data.
                      Archetype benchmarks are empirical averages from the Nevada Gaming Abstract.
                      Differences reflect methodological approach and market specifics.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        <main id="main-content" role="main" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Panel */}
          <aside className="lg:col-span-1 space-y-6" aria-label="Input parameters">
            {/* Report Download Button */}
            {results && (
              userTier === 'pro' ? (
                <DownloadPPTXButton
                  onClick={handleDownloadPPTX}
                  isGenerating={isGeneratingPPTX}
                />
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPremiumModal(true)}
                    className="btn btn-brass w-full py-3.5 px-4 text-[15px]"
                  >
                    <Lock size={18} />
                    Download PPTX Report
                  </button>
                  <button
                    onClick={handleDownloadSampleReport}
                    disabled={isGeneratingSample}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl font-medium border border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-all"
                  >
                    {isGeneratingSample ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Generating sample...
                      </>
                    ) : (
                      <>
                        <FileDown size={16} />
                        Download Sample Report
                      </>
                    )}
                  </button>
                </div>
              )
            )}

            {/* License Info Panel (Pro users) */}
            {userTier === 'pro' && (() => {
              const { licenseKey: savedKey, licensedProperties: savedProps, expiresAt } = getLicenseData();
              return (
                <div className="bg-white rounded-xl shadow-lg p-5">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Shield size={16} className="text-emerald-600" />
                    Pro License
                  </h2>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex items-start gap-2">
                      <Key size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-gray-500 text-xs">License Key</span>
                        <p className="font-mono text-xs text-gray-800 break-all">{savedKey}</p>
                      </div>
                    </div>
                    {expiresAt && (
                      <div className="flex items-start gap-2">
                        <Calendar size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-gray-500 text-xs">Expires</span>
                          <p className="text-gray-800 text-xs">{expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                      </div>
                    )}
                    {savedProps && savedProps.length > 0 && (
                      <div className="flex items-start gap-2">
                        <Building2 size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-gray-500 text-xs">Licensed Properties</span>
                          {savedProps.map((p, i) => (
                            <p key={i} className="text-gray-800 text-xs">{p}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (window.confirm('Remove your license key from this browser? You can re-enter it anytime.')) {
                          clearLicenseData();
                          setUserTier('free');
                          setLicensedProperties([]);
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors mt-1"
                    >
                      <Trash2 size={12} />
                      Remove license from this browser
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Location & Analysis Type */}
            <div className="dash-card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin size={20} className="text-accent" />
                Location & Settings
              </h2>

              <div className="space-y-4">
                <SelectField
                  label="State"
                  value={state}
                  onChange={setState}
                  options={stateOptions}
                />
                <SelectField
                  label="Operation Type"
                  value={propertyType}
                  onChange={setPropertyType}
                  options={PROPERTY_TYPE_OPTIONS.filter(p => p.value).map(p => ({ value: p.value, label: p.label }))}
                  helpText={PROPERTY_TYPE_OPTIONS.find(p => p.value === propertyType)?.description}
                />
                <InputField
                  label={isOnline ? "Platform/Brand Name" : "Casino/Project Name"}
                  value={casinoName}
                  onChange={setCasinoName}
                  placeholder="Optional"
                  type="text"
                  helpText="Appears on report cover"
                />
              </div>
            </div>

            {/* Revenue Streams */}
            <div className="dash-card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign size={20} className="text-accent" />
                Revenue Streams
              </h2>

              <div className="space-y-4">
                <InputField
                  label={isOnline ? (propertyType === 'ONLINE_SPORTSBOOK' ? 'Gross Betting Revenue' : 'Gross Gaming Revenue (GGR)') : 'Gaming Revenue (GGR)'}
                  value={revenues.gaming}
                  onChange={(v) => setRevenues({ ...revenues, gaming: v })}
                  placeholder="100"
                  prefix="$"
                  suffix="M"
                  helpText={isOnline ? 'The single revenue stream for online operations' : 'Gross gaming revenue from casino operations'}
                />

                {!isOnline && (
                  <>
                    <InputField
                      label="Food & Beverage Revenue"
                      value={revenues.food}
                      onChange={(v) => setRevenues({ ...revenues, food: v })}
                      placeholder="Optional"
                      prefix="$"
                      suffix="M"
                      helpText="On-site restaurants, bars, room service"
                    />
                    <InputField
                      label="Lodging Revenue"
                      value={revenues.lodging}
                      onChange={(v) => setRevenues({ ...revenues, lodging: v })}
                      placeholder="Optional"
                      prefix="$"
                      suffix="M"
                      helpText="Hotel room revenue"
                    />
                    <InputField
                      label="Other Revenue"
                      value={revenues.other}
                      onChange={(v) => setRevenues({ ...revenues, other: v })}
                      placeholder="Optional"
                      prefix="$"
                      suffix="M"
                      helpText="Entertainment, spa, retail, etc."
                    />
                  </>
                )}
              </div>
            </div>

            {/* Advanced Options */}
            <div className="dash-card p-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-left"
              >
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calculator size={20} className="text-primary" />
                  {isOnline ? 'Known Operational Data' : 'Known Property Data'}
                </h2>
                <ChevronDown
                  size={20}
                  className={`text-gray-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                />
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    {isOnline ? 'If you have actual operational data, enter it here to override calculated values.' : 'If you have actual property data, enter it here to override calculated values.'}
                  </p>

                  {/* Department-level known data inputs */}
                  {(isOnline ? [
                    { key: 'gaming', label: propertyType === 'ONLINE_SPORTSBOOK' ? 'Sports Betting' : 'Online Gaming', revenue: revenues.gaming }
                  ] : [
                    { key: 'gaming', label: 'Gaming', revenue: revenues.gaming },
                    { key: 'food', label: 'Food & Beverage', revenue: revenues.food },
                    { key: 'lodging', label: 'Lodging', revenue: revenues.lodging },
                    { key: 'other', label: 'Other', revenue: revenues.other }
                  ]).filter(d => d.revenue && d.revenue > 0).map(({ key, label }) => (
                    <div key={key} className="border border-gray-100 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">{label}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <InputField
                          label="FTEs"
                          value={knownData[key]?.emp}
                          onChange={(v) => setKnownData(prev => ({
                            ...prev,
                            [key]: { ...prev[key], emp: v }
                          }))}
                          placeholder="FTEs"
                          id={`known-emp-${key}`}
                        />
                        <InputField
                          label="Wages ($M)"
                          value={knownData[key]?.wages}
                          onChange={(v) => setKnownData(prev => ({
                            ...prev,
                            [key]: { ...prev[key], wages: v }
                          }))}
                          placeholder="$M"
                          id={`known-wages-${key}`}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Show message if no revenue entered */}
                  {!revenues.gaming && !revenues.food && !revenues.lodging && !revenues.marketing && !revenues.tech && !revenues.other && (
                    <p className="text-xs text-gray-400 italic">Enter revenue to add known data for departments.</p>
                  )}
                </div>
              )}
            </div>

            {/* Gaming Tax Rate */}
            <div className="dash-card p-6">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                <DollarSign size={20} className="text-primary" />
                {isOnline ? (propertyType === 'ONLINE_CASINO' ? 'iGaming Tax Rate' : 'Sports Betting Tax Rate') : 'Gaming Tax Rate'}
              </h2>
              <div className="space-y-3">
                {(isOnline
                  ? (propertyType === 'ONLINE_CASINO' ? stateTaxConfig?.hasIGaming : stateTaxConfig?.hasSportsBetting)
                  : stateTaxConfig && stateTaxConfig.hasCommercial) ? (
                  <>
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">{state}:</span>{' '}
                      {isOnline ? (
                        (() => {
                          const onlineTax = propertyType === 'ONLINE_CASINO' ? stateTaxConfig?.iGaming : stateTaxConfig?.sportsBetting;
                          return onlineTax ? (
                            <span>{formatNumber((onlineTax.flatRate || onlineTax.effectiveRate || 0) * 100, 2)}% on {propertyType === 'ONLINE_CASINO' ? 'iGaming GGR' : 'betting revenue'}</span>
                          ) : null;
                        })()
                      ) : stateTaxConfig.rateStructure === 'tiered' ? (
                        <span>Graduated tiers ({formatNumber(stateTaxConfig.tiers[0].rate * 100, 1)}%–{formatNumber(stateTaxConfig.tiers[stateTaxConfig.tiers.length - 1].rate * 100, 1)}%)</span>
                      ) : stateTaxConfig.slotTableSplit ? (
                        <span>{formatNumber(stateTaxConfig.slotsRate * 100, 0)}% slots / {formatNumber(stateTaxConfig.tableRate * 100, 0)}% tables</span>
                      ) : (
                        <span>{formatNumber((stateTaxConfig.flatRate || stateTaxConfig.effectiveRate) * 100, 2)}% flat</span>
                      )}
                    </div>

                    {/* Slot/table split slider for split-rate states (not for online types) */}
                    {!isOnline && (stateTaxConfig.rateStructure === 'split_game_type' || stateTaxConfig.rateStructure === 'split_tiered' || stateTaxConfig.slotTableSplit) && !gamingTaxCustomRate && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Slot Revenue Share: {slotRevenuePct}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={slotRevenuePct}
                          onChange={(e) => setSlotRevenuePct(parseInt(e.target.value))}
                          className="w-full accent-[#1a365d]"
                        />
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>All Tables</span>
                          <span>Effective: {gamingTaxResult ? formatNumber(gamingTaxResult.effectiveRate * 100, 1) : '-'}%</span>
                          <span>All Slots</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    {isOnline
                      ? `${state} has not yet authorized ${propertyType === 'ONLINE_CASINO' ? 'iGaming' : 'online sports betting'}. Enter a proposed tax rate below.`
                      : `${state} does not currently have commercial casino gaming. Enter a proposed tax rate below to estimate gaming tax revenue.`}
                  </div>
                )}

                {/* Custom rate input */}
                <div>
                  <InputField
                    label={(() => {
                      const hasRate = isOnline
                        ? (propertyType === 'ONLINE_CASINO' ? stateTaxConfig?.hasIGaming : stateTaxConfig?.hasSportsBetting)
                        : stateTaxConfig?.hasCommercial;
                      return hasRate ? "Custom Tax Rate Override (%)" : `Proposed ${isOnline ? (propertyType === 'ONLINE_CASINO' ? 'iGaming' : 'Sports Betting') : 'Gaming'} Tax Rate (%)`;
                    })()}
                    value={gamingTaxCustomRate != null ? gamingTaxCustomRate * 100 : null}
                    onChange={(v) => setGamingTaxCustomRate(v != null ? v / 100 : null)}
                    placeholder={(() => {
                      const hasRate = isOnline
                        ? (propertyType === 'ONLINE_CASINO' ? stateTaxConfig?.hasIGaming : stateTaxConfig?.hasSportsBetting)
                        : stateTaxConfig?.hasCommercial;
                      return hasRate ? "Leave blank to use state rate" : "Enter proposed rate (e.g., 25)";
                    })()}
                    helpText={(() => {
                      const hasRate = isOnline
                        ? (propertyType === 'ONLINE_CASINO' ? stateTaxConfig?.hasIGaming : stateTaxConfig?.hasSportsBetting)
                        : stateTaxConfig?.hasCommercial;
                      return hasRate
                        ? "Override the state rate with a custom percentage"
                        : `Enter the proposed tax rate on ${isOnline ? 'gross gaming/betting revenue' : 'gross gaming revenue for a prospective casino'}`;
                    })()
                    }
                    id="custom-tax-rate"
                  />
                </div>
              </div>
            </div>

          </aside>

          {/* Results Panel */}
          <section className={`lg:col-span-2 space-y-6 ${userTier === 'free' ? 'protected-content' : ''}`} aria-label="Analysis results">
            {results ? (
              <>
                {/* Online methodology banner */}
                {isOnline && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 animate-fade-in-up">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600 mt-0.5 flex-shrink-0">
                        <Shield size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          Important: Geographic Limitations for Online Operations
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          <strong>These results assume the operator's workforce and operations are located in {state}.</strong> Online
                          gambling companies often concentrate employees at headquarters (e.g., DraftKings in Massachusetts) while
                          generating GGR across many states. If the operator's staff are primarily located elsewhere,
                          the employment, wage, and supply chain effects shown here would largely occur in that state — not {state}.
                          The gaming tax estimate remains valid as it flows to the state where bettors are located.
                        </p>
                        <p className="text-xs text-amber-600 mt-1.5">
                          Multipliers are estimated from SEC filings (DraftKings, Rush Street Interactive 2024), not BEA IO-derived coefficients.
                          For the most accurate direct effects, enter actual in-state employment and wage data under "Known Operational Data."
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Headline result band */}
                <HeroSummary
                  results={results}
                  state={state}
                  casinoName={casinoName}
                  propertyTypeLabel={PROPERTY_TYPE_OPTIONS.find(p => p.value === propertyType)?.label}
                  isOnline={isOnline}
                />

                {/* Economic Impact Flow (Sankey) */}
                <div className="dash-card p-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                  <SectionHeader>Economic Impact Flow</SectionHeader>
                  <p className="text-xs text-gray-400 -mt-3 mb-3">How revenue ripples through the economy via direct, indirect, and induced effects</p>
                  <ImpactFlowChart results={results} byRevenue={results.byRevenue} />
                </div>

                {/* Economic Impact Summary (primary results table) */}
                <div className="dash-card p-6 animate-fade-in-up" style={{ animationDelay: '75ms' }}>
                  <SectionHeader>Economic Impact Summary</SectionHeader>
                  <DashboardResultsTable results={results} termDefs={getTermDefinitions(isOnline)} />
                  {results.hasUserData && (
                    <p className="text-xs text-gray-500 mt-3 italic">
                      Note: Direct employment and/or wages use user-provided values.
                    </p>
                  )}
                </div>

                {/* Tax Revenue Estimates */}
                {(results.totals.tax.total > 0 || gamingTaxResult || payrollTaxResult || householdTaxResult) && (
                  <div className="dash-card p-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    <SectionHeader>Tax Revenue Estimates</SectionHeader>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tax Type</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-primary">
                              <DefTooltip text={TERM_DEFINITIONS.direct}>Direct</DefTooltip>
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-accent">
                              <DefTooltip text={TERM_DEFINITIONS.indirect}>Indirect</DefTooltip>
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-effect-induced">
                              <DefTooltip text={TERM_DEFINITIONS.induced}>Induced</DefTooltip>
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gamingTaxResult && (
                            <tr className="border-b border-gray-100 hover:bg-gray-50">
                              <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-700 text-left">
                                <DefTooltip text={isOnline
                                  ? "State taxes levied on online gross gaming/betting revenue at statutory rates."
                                  : "State and local taxes levied directly on gross gaming revenue at rates set by statute or compact."}>
                                  {isOnline ? (propertyType === 'ONLINE_SPORTSBOOK' ? 'Sports Betting Tax' : 'iGaming Tax') : 'Gaming Tax (GGR)'}
                                </DefTooltip>
                                <span className="block text-xs text-gray-500">
                                  {formatNumber(gamingTaxResult.effectiveRate * 100, 1)}% effective rate
                                </span>
                              </th>
                              <td className="py-3 px-4 text-sm text-right text-primary">{formatCurrency(gamingTaxResult.amount)}</td>
                              <td className="py-3 px-4 text-sm text-right text-accent">-</td>
                              <td className="py-3 px-4 text-sm text-right text-effect-induced">-</td>
                              <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{formatCurrency(gamingTaxResult.amount)}</td>
                            </tr>
                          )}
                          {results.totals.tax.total > 0 && (
                            <tr className="border-b border-gray-100 hover:bg-gray-50">
                              <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-700 text-left">
                                <DefTooltip text="Taxes on Production and Imports (TOPI) from the IO model — includes sales taxes, property taxes, excise taxes, and business fees paid across the supply chain.">
                                  Taxes on Production
                                </DefTooltip>
                                <span className="block text-xs text-gray-500">TOPI from IO model</span>
                              </th>
                              <td className="py-3 px-4 text-sm text-right text-primary">{formatCurrency(results.totals.tax.direct)}</td>
                              <td className="py-3 px-4 text-sm text-right text-accent">{formatCurrency(results.totals.tax.indirect)}</td>
                              <td className="py-3 px-4 text-sm text-right text-effect-induced">{formatCurrency(results.totals.tax.induced)}</td>
                              <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{formatCurrency(results.totals.tax.total)}</td>
                            </tr>
                          )}
                          {payrollTaxResult && payrollTaxResult.total > 0 && (
                            <tr className="border-b border-gray-100 hover:bg-gray-50">
                              <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-700 text-left">
                                <DefTooltip text="Employer-side payroll taxes: FICA (Social Security + Medicare), FUTA, SUTA, and state SDI/PFML where applicable. Applied to wages using per-employee caps and state-specific rates.">
                                  Payroll Taxes
                                </DefTooltip>
                                <span className="block text-xs text-gray-500">FICA, FUTA, SUTA{stateEmploymentTaxRates?.sdi_employer_rate > 0 ? ', SDI' : ''}{stateEmploymentTaxRates?.pfml_employer_rate > 0 ? ', PFML' : ''}</span>
                              </th>
                              <td className="py-3 px-4 text-sm text-right text-primary">{formatCurrency(payrollTaxResult.direct)}</td>
                              <td className="py-3 px-4 text-sm text-right text-accent">{formatCurrency(payrollTaxResult.indirect)}</td>
                              <td className="py-3 px-4 text-sm text-right text-effect-induced">{formatCurrency(payrollTaxResult.induced)}</td>
                              <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{formatCurrency(payrollTaxResult.total)}</td>
                            </tr>
                          )}
                          {householdTaxResult && householdTaxResult.total > 0 && (
                            <tr className="border-b border-gray-100 hover:bg-gray-50">
                              <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-700 text-left">
                                <DefTooltip text="Federal, state, and local income taxes plus motor vehicle licenses and personal property taxes paid by employee households. Based on BEA personal current tax ratios by state. Does not include real estate or sales taxes (covered under TOPI).">
                                  Household Taxes
                                </DefTooltip>
                                <span className="block text-xs text-gray-500">{formatNumber((stateEmploymentTaxRates?.household_tax_ratio || 0) * 100, 1)}% of wages (BEA ratio)</span>
                              </th>
                              <td className="py-3 px-4 text-sm text-right text-primary">{formatCurrency(householdTaxResult.direct)}</td>
                              <td className="py-3 px-4 text-sm text-right text-accent">{formatCurrency(householdTaxResult.indirect)}</td>
                              <td className="py-3 px-4 text-sm text-right text-effect-induced">{formatCurrency(householdTaxResult.induced)}</td>
                              <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{formatCurrency(householdTaxResult.total)}</td>
                            </tr>
                          )}
                          <tr className="bg-gray-50 border-t border-gray-200">
                            <th scope="row" className="py-3 px-4 text-sm font-bold text-gray-900 text-left">Total Tax Revenue</th>
                            <td className="py-3 px-4 text-sm text-right font-bold text-primary">
                              {formatCurrency((gamingTaxResult?.amount || 0) + results.totals.tax.direct + (payrollTaxResult?.direct || 0) + (householdTaxResult?.direct || 0))}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-bold text-accent">
                              {formatCurrency(results.totals.tax.indirect + (payrollTaxResult?.indirect || 0) + (householdTaxResult?.indirect || 0))}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-bold text-effect-induced">
                              {formatCurrency(results.totals.tax.induced + (payrollTaxResult?.induced || 0) + (householdTaxResult?.induced || 0))}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">
                              {formatCurrency((gamingTaxResult?.amount || 0) + results.totals.tax.total + (payrollTaxResult?.total || 0) + (householdTaxResult?.total || 0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      {isOnline ? (propertyType === 'ONLINE_SPORTSBOOK' ? 'Sports betting tax' : 'iGaming tax') : 'Gaming tax'} is applied to GGR at state-mandated rates.
                      TOPI from the IO model covers sales, property, excise taxes, and business fees.
                      Payroll taxes are employer-side (FICA, FUTA, SUTA) using DOL average rates.
                      Household taxes use BEA personal current tax ratios (income taxes, vehicle licenses, personal property taxes).
                      These four categories are mutually exclusive — no double-counting.
                      {stateTaxConfig?.localTaxNotes && (
                        <span className="block mt-1 italic">Note: {stateTaxConfig.localTaxNotes}</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Revenue Breakdown (if multiple) */}
                {results.byRevenue.length > 1 && (
                  <div className="dash-card p-6 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                    <SectionHeader>Impact by Revenue Stream</SectionHeader>
                    <RevenueBreakdownTable byRevenue={results.byRevenue} />
                  </div>
                )}

                {/* Sensitivity & multi-year projections */}
                <div className="dash-card p-6 animate-fade-in-up" style={{ animationDelay: '175ms' }}>
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <SectionHeader className="mb-0">Sensitivity &amp; Projections</SectionHeader>
                    <button
                      onClick={() => setShowSensitivity(s => !s)}
                      className="flex items-center gap-1 text-xs font-medium text-accent hover:text-primary no-print"
                    >
                      {showSensitivity ? 'Hide' : 'Show'}
                      <ChevronDown size={14} className={`transition-transform ${showSensitivity ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  {showSensitivity ? (
                    <div className="mt-4">
                      <SensitivityPanel analysis={liveAnalysis} />
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted mt-1">
                      See how output, GDP, jobs, and tax revenue respond as revenue or the gaming tax rate
                      varies — and project cumulative impact over 3–10 years.{' '}
                      <button onClick={() => setShowSensitivity(true)} className="text-accent font-medium hover:underline no-print">Open analysis →</button>
                    </p>
                  )}
                </div>

                {/* Charts Row 1: Composition + Employment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="dash-card p-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <SectionHeader>Impact Composition</SectionHeader>
                    <p className="text-xs text-gray-400 -mt-3 mb-3">Hover bars for Direct / Indirect / Induced breakdown</p>
                    <DashboardImpactCompositionChart results={results} />
                  </div>

                  <div className="dash-card p-6 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
                    <SectionHeader>Employment Distribution</SectionHeader>
                    <DashboardEmploymentChart results={results} />
                  </div>
                </div>

                {/* Charts Row 2: Radar + State Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="dash-card p-6 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                    <SectionHeader>Multiplier Profile</SectionHeader>
                    <p className="text-xs text-gray-400 -mt-3 mb-3">{state}'s multiplier strength across economic dimensions</p>
                    <DashboardMultiplierRadarChart
                      results={results}
                      gamblingData={isOnline ? (multiplierData.onlineGaming || []) : multiplierData.gambling}
                      state={state}
                    />
                  </div>

                  <div className="dash-card p-6 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
                    <SectionHeader>State Comparison</SectionHeader>
                    <p className="text-xs text-gray-400 -mt-3 mb-3">Employment intensity (jobs per $1M GDP) — top states</p>
                    <DashboardStateComparisonChart
                      currentState={state}
                      gamblingData={isOnline ? (multiplierData.onlineGaming || []) : multiplierData.gambling}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <TrendingUp size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Enter revenue data to estimate economic impact</p>
              </div>
            )}
          </section>
        </main>

        {/* Footer */}
        <footer role="contentinfo" className="mt-12 text-center text-sm text-gray-600 space-y-1">
          <p>
            {PRODUCT_TITLE} |{' '}
            <a href="https://github.com/kphilander/casino-economic-impact" className="text-accent hover:underline">
              GitHub
            </a>
            {' '}|{' '}
            <a
              href={`${import.meta.env.BASE_URL}GEMS-2026-Methodology.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Methodology White Paper (PDF)
            </a>
            {' '}| Published by {BRAND.publisher}
          </p>
          <p className="text-xs text-gray-400 max-w-3xl mx-auto">
            Suggested citation: {getSuggestedCitation()}
          </p>
          <p>
            <a
              href="https://github.com/kphilander/casino-economic-impact/issues/new?labels=bug&template=bug_report.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-gray-500 hover:text-accent hover:underline"
            >
              <Bug size={13} />
              Report a Bug
            </a>
          </p>
        </footer>
      </div>
      </div>

      {/* Floating "Request a Feature" button */}
      <button
        onClick={() => setShowFeatureModal(true)}
        className="fixed bottom-6 right-6 flex items-center gap-3 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-white shadow-raised transition-all hover:shadow-pop hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 z-50 animate-bounce-subtle"
        title="Request a feature"
      >
        <Lightbulb size={22} className="drop-shadow" />
        Request a Feature
      </button>

      {/* Feature Request Modal */}
      {showFeatureModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowFeatureModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-primary rounded-t-2xl px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Lightbulb size={20} />
                Request a Feature
              </h2>
              <button onClick={() => setShowFeatureModal(false)} className="text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                try {
                  await fetch('/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams(new FormData(form)).toString()
                  });
                  setFeatureSubmitted(true);
                  setTimeout(() => { setShowFeatureModal(false); setFeatureSubmitted(false); }, 2000);
                } catch {
                  alert('Submission failed. Please try again.');
                }
              }}
              className="p-6 space-y-4"
            >
              <input type="hidden" name="form-name" value="feature-request" />
              <p hidden><label>Don't fill this out: <input name="bot-field" /></label></p>

              {featureSubmitted ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-3">&#10003;</div>
                  <p className="text-lg font-semibold text-gray-900">Thank you!</p>
                  <p className="text-sm text-gray-600">Your feedback has been submitted.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="feat-name" className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-gray-400">(optional)</span></label>
                      <input id="feat-name" name="name" type="text" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none" placeholder="Your name" />
                    </div>
                    <div>
                      <label htmlFor="feat-email" className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400">(optional)</span></label>
                      <input id="feat-email" name="email" type="email" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none" placeholder="you@example.com" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="feat-type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select id="feat-type" name="type" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none">
                      <option>Feature Request</option>
                      <option>Data Issue</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="feat-message" className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-red-500">*</span></label>
                    <textarea id="feat-message" name="message" required rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none resize-none" placeholder="Describe the feature you'd like to see, or the issue you've found..." />
                  </div>
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow hover:shadow-lg transition-all"
                  >
                    <Send size={16} />
                    Submit
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
