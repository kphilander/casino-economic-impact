import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Building2, DollarSign, Users, TrendingUp, ChevronDown, Calculator, MapPin, Loader2, Presentation, Lock } from 'lucide-react';
import multiplierData from './data/multipliers.json';
import gamingTaxRatesData from './data/gamingTaxRates.json';
import { calculateCombinedImpact, calculateGamingTax, formatNumber, formatCurrency, formatJobs } from './utils/calculations';
import {
  validateLicense,
  canDownloadForProperty,
  getLicenseData,
  saveLicenseData,
  addLicensedProperty
} from './utils/licenseValidator';
import WatermarkOverlay from './components/WatermarkOverlay';
import PremiumModal from './components/PremiumModal';
import WrongPropertyModal from './components/WrongPropertyModal';
import ConfirmPropertyModal from './components/ConfirmPropertyModal';
import PageHeader from './components/PageHeader';
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
  other: '#4299e1'      // GP Accent Light
};

// Metric Card Component
function MetricCard({ icon: Icon, label, value, subtext, color = 'primary' }) {
  const colorClasses = {
    primary: 'from-[#1a365d] to-[#2c5282]',   // GP Navy gradient
    success: 'from-[#3182ce] to-[#4299e1]',   // GP Blue gradient
    purple: 'from-[#2c5282] to-[#3182ce]',    // Navy to blue
    amber: 'from-[#3182ce] to-[#4299e1]'      // GP Blue gradient
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 card-hover">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]} text-white`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-sm text-gray-600 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtext && <p className="text-xs text-gray-600 mt-1">{subtext}</p>}
        </div>
      </div>
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
          className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3182ce] focus:border-transparent transition-all ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''}`}
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
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#3182ce] focus:border-transparent transition-all appearance-none bg-white pr-10"
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

// Term definitions for tooltips
const TERM_DEFINITIONS = {
  output: 'Total value of goods and services produced across all industries stimulated by the casino operation, including intermediate goods.',
  gdp: 'Value added to the economy, calculated as output minus intermediate inputs. Also known as Gross Domestic Product contribution.',
  employment: 'Full-time equivalent (FTE) jobs supported, including part-time jobs converted to full-time equivalents.',
  wages: 'Total compensation of employees, including salaries, wages, and benefits such as employer contributions to pensions and insurance.',
  tax: 'Taxes on production and imports (TOPI) from the IO model, including sales taxes, property taxes, excise taxes, and fees paid by businesses.',
  direct: 'The initial economic activity from the casino operation itself — its own spending, employment, and output.',
  indirect: 'Activity generated in the supply chain — businesses that provide goods and services to the casino.',
  induced: 'Activity from household spending — casino and supplier employees spending their wages in the local economy.',
  multiplier: 'The ratio of total impact to direct impact. Shows how much each dollar of direct activity generates across the full economy.'
};

// Results Table Component
function ResultsTable({ results }) {
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
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-[#1a365d]">
              <DefTooltip text={TERM_DEFINITIONS.direct}>Direct</DefTooltip>
            </th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-[#3182ce]">
              <DefTooltip text={TERM_DEFINITIONS.indirect}>Indirect</DefTooltip>
            </th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-[#4299e1]">
              <DefTooltip text={TERM_DEFINITIONS.induced}>Induced</DefTooltip>
            </th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Total</th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-[#3182ce]">
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
              <td className="py-3 px-4 text-sm text-right text-[#1a365d]">{format(results.totals[key].direct)}</td>
              <td className="py-3 px-4 text-sm text-right text-[#3182ce]">{format(results.totals[key].indirect)}</td>
              <td className="py-3 px-4 text-sm text-right text-[#4299e1]">{format(results.totals[key].induced)}</td>
              <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{format(results.totals[key].total)}</td>
              <td className="py-3 px-4 text-sm text-right text-[#3182ce] font-medium">
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
      className={`
        flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold
        transition-all duration-200 shadow-lg
        ${isGenerating
          ? 'bg-gray-400 cursor-not-allowed'
          : 'bg-gradient-to-r from-[#1a365d] to-[#3182ce] hover:from-[#152a4d] hover:to-[#2c5282] hover:shadow-xl hover:-translate-y-0.5'
        }
        text-white
      `}
    >
      {isGenerating ? (
        <>
          <Loader2 size={20} className="animate-spin" />
          Generating PPTX...
        </>
      ) : (
        <>
          <Presentation size={20} />
          Download PPTX Report
        </>
      )}
    </button>
  );
}

// Wizard Step Component
function WizardStep({ stepNum, totalSteps, title, subtitle, children, onBack, onNext, nextLabel = 'Continue', showBack = true, canProceed = true }) {
  return (
    <div className="py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Step {stepNum} of {totalSteps}</span>
            <span className="text-sm text-gray-400">{Math.round((stepNum / totalSteps) * 100)}% complete</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3182ce] transition-all duration-300"
              style={{ width: `${(stepNum / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
          {subtitle && <p className="text-gray-500 mb-6">{subtitle}</p>}

          <div className="mb-8">
            {children}
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            {showBack && onBack ? (
              <button
                onClick={onBack}
                className="px-6 py-2.5 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                ← Back
              </button>
            ) : <div />}
            <button
              onClick={onNext}
              disabled={!canProceed}
              className={`px-8 py-2.5 rounded-lg font-medium transition-all ${
                canProceed
                  ? 'bg-[#1a365d] text-white hover:bg-[#152a4d] shadow-lg hover:shadow-xl'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
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
  { value: '', label: 'Select property type...', description: '' },
  { value: '721120', label: 'Resort with Hotel & Casino', description: 'Integrated casino-hotel (e.g., Las Vegas Strip properties)' },
  { value: '713210', label: 'Stand-alone Casino', description: 'Traditional casino without integrated hotel' },
  { value: '713290', label: 'Slot Parlors / Bingo Halls', description: 'Limited gaming venues (card rooms, bingo halls)' },
  { value: '722410', label: 'Bars/Restaurants with Slots', description: 'Establishments with gaming as ancillary activity' }
];

/**
 * Build a tax config object for calculateGamingTax from a state's tax rate data
 */
function buildTaxConfig(taxInfo, customRate, slotRevenuePct) {
  if (!taxInfo) return {};
  const config = {};
  if (customRate != null && customRate !== '') {
    config.customRate = parseFloat(customRate);
  } else if (taxInfo.rateStructure === 'split_tiered' && taxInfo.slotTiers && taxInfo.tableTiers) {
    config.slotTiers = taxInfo.slotTiers;
    config.tableTiers = taxInfo.tableTiers;
    config.slotRevenuePct = (slotRevenuePct || 70) / 100;
  } else if (taxInfo.rateStructure === 'tiered' && taxInfo.tiers) {
    config.tiers = taxInfo.tiers;
  } else if (taxInfo.rateStructure === 'split_game_type' && taxInfo.slotsRate != null && taxInfo.tableRate != null) {
    config.slotsRate = taxInfo.slotsRate;
    config.tableRate = taxInfo.tableRate;
    config.slotRevenuePct = (slotRevenuePct || 70) / 100;
  } else if (taxInfo.slotTableSplit && taxInfo.slotsRate != null && taxInfo.tableRate != null) {
    config.slotsRate = taxInfo.slotsRate;
    config.tableRate = taxInfo.tableRate;
    config.slotRevenuePct = (slotRevenuePct || 70) / 100;
  } else if (taxInfo.flatRate != null) {
    config.flatRate = taxInfo.flatRate;
  } else if (taxInfo.effectiveRate != null) {
    config.flatRate = taxInfo.effectiveRate;
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

  // License/Tier state
  const [userTier, setUserTier] = useState('free'); // 'free' | 'pro'
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [licensedProperties, setLicensedProperties] = useState([]);
  const [showWrongPropertyModal, setShowWrongPropertyModal] = useState(false);
  const [wrongPropertyInfo, setWrongPropertyInfo] = useState(null); // { licensedFor, attempting }
  const [showConfirmPropertyModal, setShowConfirmPropertyModal] = useState(false); // Confirm before tying license to property

  // Gaming tax state
  const [gamingTaxCustomRate, setGamingTaxCustomRate] = useState(null); // User override rate (0-1)
  const [slotRevenuePct, setSlotRevenuePct] = useState(70); // For split-rate states: % of GGR from slots

  // Wizard helper state
  const [hasOtherRevenue, setHasOtherRevenue] = useState(false);
  const [hasKnownData, setHasKnownData] = useState(false);

  // Check for saved license on mount and handle Stripe redirect
  useEffect(() => {
    // Check localStorage for saved license using getLicenseData helper
    const { licenseKey, licensedProperties: savedProperties } = getLicenseData();
    if (licenseKey) {
      const result = validateLicense(licenseKey);
      if (result.valid) {
        setUserTier('pro');
        setLicensedProperties(savedProperties || []);
      } else {
        // License expired or invalid, remove it
        localStorage.removeItem('licenseKey');
        localStorage.removeItem('licensedProperties');
      }
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

  // Calculate results using property-type-specific multipliers
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
      inputMode
    );
  }, [revenues, state, knownData, propertyType, inputMode]);

  // Gaming tax calculation (separate from TOPI in IO model)
  const stateTaxConfig = gamingTaxRatesData.rates[state];
  const gamingTaxResult = useMemo(() => {
    if (!stateTaxConfig || !stateTaxConfig.hasCommercial) return null;
    const ggr = inputMode === 'total' ? (revenues.total || 0) : (revenues.gaming || 0);
    if (ggr <= 0) return null;

    // Build tax config for calculation
    let taxConfig = buildTaxConfig(stateTaxConfig, gamingTaxCustomRate, slotRevenuePct);

    const gamingTax = calculateGamingTax(ggr, taxConfig);
    const effectiveRate = ggr > 0 ? gamingTax / ggr : 0;
    return { amount: gamingTax, effectiveRate, ggr };
  }, [revenues, state, inputMode, gamingTaxCustomRate, slotRevenuePct, stateTaxConfig]);

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
          stateTaxConfig
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
          stateTaxConfig
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
          <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0]">
            <WizardStep
              stepNum={1}
          totalSteps={totalSteps}
          title="Tell us about your project"
          subtitle="Select the state, property type, and name the casino or project."
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
            <SelectField
              label="Property Type"
              value={propertyType}
              onChange={setPropertyType}
              options={PROPERTY_TYPE_OPTIONS.map(p => ({ value: p.value, label: p.label }))}
              helpText={selectedPropertyType?.description || 'Select the type of gaming establishment for more accurate multipliers'}
            />
            <InputField
              label="Casino or Project Name"
              value={casinoName}
              onChange={setCasinoName}
              placeholder="e.g., Bellagio, Proposed Downtown Casino"
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
      const canProceedToNextStep = inputMode === 'total'
        ? revenues.total > 0
        : revenues.gaming > 0;

      // For total mode, skip step 3 (other revenue) and go to step 4 (known data)
      const handleNextStep = () => {
        if (inputMode === 'total') {
          setWizardStep(3); // Skip to known data step
        } else {
          setWizardStep(2); // Go to other revenue step
        }
      };

      return (
        <>
          <PageHeader />
          <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0]">
            <WizardStep
              stepNum={2}
              totalSteps={totalSteps}
              title="How would you like to enter revenue?"
              subtitle="Choose whether to enter total property revenue or break it down by department."
              onBack={() => setWizardStep(0)}
              onNext={handleNextStep}
              canProceed={canProceedToNextStep}
            >
              <div className="space-y-6">
                {/* Input Mode Toggle */}
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setInputMode('total');
                      setRevenues({ ...revenues, gaming: null, food: null, lodging: null, other: null, total: revenues.total || 100 });
                    }}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                      inputMode === 'total'
                    ? 'border-[#3182ce] bg-[#ebf8ff] text-[#1a365d]'
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
                    ? 'border-[#3182ce] bg-[#ebf8ff] text-[#1a365d]'
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
          <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0]">
            <WizardStep
              stepNum={3}
              totalSteps={totalSteps}
              title="Do you have other revenue streams?"
              subtitle="Include food & beverage, lodging, or other entertainment revenue if applicable."
              onBack={() => setWizardStep(1)}
              onNext={() => setWizardStep(3)}
            >
          <div className="space-y-4">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setHasOtherRevenue(true)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  hasOtherRevenue
                    ? 'border-[#3182ce] bg-[#ebf8ff] text-[#1a365d]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                Yes, add more
              </button>
              <button
                onClick={() => {
                  setHasOtherRevenue(false);
                  setRevenues({ ...revenues, food: null, lodging: null, other: null });
                }}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  !hasOtherRevenue
                    ? 'border-[#3182ce] bg-[#ebf8ff] text-[#1a365d]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                No, just gaming
              </button>
            </div>

            {hasOtherRevenue && (
              <div className="space-y-4 animate-fade-in">
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
        setKnownData({
          gaming: { emp: null, wages: null },
          food: { emp: null, wages: null },
          lodging: { emp: null, wages: null },
          other: { emp: null, wages: null }
        });
      };

      // Determine which departments have revenue (for showing known data inputs)
      const activeDepartments = inputMode === 'total'
        ? [{ key: 'total', label: 'Property Total' }]
        : [
            { key: 'gaming', label: 'Gaming', revenue: revenues.gaming },
            { key: 'food', label: 'Food & Beverage', revenue: revenues.food },
            { key: 'lodging', label: 'Lodging', revenue: revenues.lodging },
            { key: 'other', label: 'Other', revenue: revenues.other }
          ].filter(d => d.revenue && d.revenue > 0);

      return (
        <>
          <PageHeader />
          <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0]">
            <WizardStep
              stepNum={inputMode === 'total' ? 3 : 4}
              totalSteps={totalSteps}
              title="Do you have known property data?"
              subtitle="If you know the actual direct employment or wages, you can enter them for more accurate results."
              onBack={handleBackStep}
              onNext={() => setWizardStep(4)}
            >
          <div className="space-y-4">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setHasKnownData(true)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  hasKnownData
                    ? 'border-[#3182ce] bg-[#ebf8ff] text-[#1a365d]'
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
                    ? 'border-[#3182ce] bg-[#ebf8ff] text-[#1a365d]'
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
                      helpText="Full-time equivalent employees at the property"
                    />
                    <InputField
                      label="Direct Wages"
                      value={knownData.gaming?.wages}
                      onChange={(v) => updateKnownData('gaming', 'wages', v)}
                      placeholder="e.g., 25"
                      prefix="$"
                      suffix="M"
                      helpText="Total direct wages in millions"
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
      const hasGaming = taxInfo && taxInfo.hasCommercial;
      const ggr = inputMode === 'total' ? (revenues.total || 0) : (revenues.gaming || 0);

      // Compute the tax that would apply with current settings
      const computePreviewTax = () => {
        if (!hasGaming || ggr <= 0) return { amount: 0, effectiveRate: 0 };
        const config = buildTaxConfig(taxInfo, gamingTaxCustomRate, slotRevenuePct);
        const amount = calculateGamingTax(ggr, config);
        return { amount, effectiveRate: ggr > 0 ? amount / ggr : 0 };
      };
      const preview = computePreviewTax();

      return (
        <>
          <PageHeader />
          <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0]">
            <WizardStep
              stepNum={inputMode === 'total' ? 4 : 5}
              totalSteps={totalSteps}
              title="Confirm Gaming Tax Rate"
              subtitle={hasGaming
                ? `Review the gaming tax rate for ${state}. You can adjust or override it below.`
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
                        <h4 className="font-semibold text-gray-900">{state} Gaming Tax</h4>
                        <span className="text-sm text-gray-500">Source: {taxInfo.sourceYear || '2024'}</span>
                      </div>

                      {taxInfo.rateStructure === 'flat' && (
                        <p className="text-gray-700">
                          <span className="text-2xl font-bold text-[#1a365d]">
                            {formatNumber((taxInfo.flatRate || taxInfo.effectiveRate) * 100, 2)}%
                          </span>
                          <span className="text-sm ml-2">flat rate on GGR</span>
                        </p>
                      )}

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
                            <span className="font-bold text-[#1a365d]">{formatNumber(taxInfo.slotsRate * 100, 0)}%</span> slots
                            {' / '}
                            <span className="font-bold text-[#1a365d]">{formatNumber(taxInfo.tableRate * 100, 0)}%</span> table games
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

                    {/* Slot/table split slider - shown for split_game_type, split_tiered, or legacy slotTableSplit */}
                    {(taxInfo.rateStructure === 'split_game_type' || taxInfo.rateStructure === 'split_tiered' || taxInfo.slotTableSplit) && !(gamingTaxCustomRate != null && gamingTaxCustomRate !== '') && (
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
                          <span className="font-medium text-[#1a365d]">
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
                      {taxInfo?.hasTribal
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
                        <p className="text-xl font-bold text-[#1a365d]">${formatNumber(preview.amount, 2)}M</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Effective rate:</p>
                        <p className="text-xl font-bold text-[#1a365d]">{formatNumber(preview.effectiveRate * 100, 2)}%</p>
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
      <div className="min-h-screen bg-gradient-to-br from-[#f0f4f8] to-[#e2e8f0] py-8 px-4 sm:px-6 lg:px-8">
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
      />

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
            className="text-sm text-[#3182ce] hover:text-[#1a365d] font-medium"
          >
            ← Start New Analysis
          </button>
        </header>

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
                <button
                  onClick={() => setShowPremiumModal(true)}
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-[#1a365d] to-[#3182ce] hover:from-[#152a4d] hover:to-[#2c5282] text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <Lock size={20} />
                  Download PPTX (Pro Feature)
                </button>
              )
            )}

            {/* Location & Analysis Type */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin size={20} className="text-[#3182ce]" />
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
                  label="Property Type"
                  value={propertyType}
                  onChange={setPropertyType}
                  options={PROPERTY_TYPE_OPTIONS.filter(p => p.value).map(p => ({ value: p.value, label: p.label }))}
                  helpText={PROPERTY_TYPE_OPTIONS.find(p => p.value === propertyType)?.description}
                />
                <InputField
                  label="Casino/Project Name"
                  value={casinoName}
                  onChange={setCasinoName}
                  placeholder="Optional"
                  type="text"
                  helpText="Appears on report cover"
                />
              </div>
            </div>

            {/* Revenue Streams */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign size={20} className="text-[#3182ce]" />
                Revenue Streams
              </h2>

              <div className="space-y-4">
                <InputField
                  label="Gaming Revenue (GGR)"
                  value={revenues.gaming}
                  onChange={(v) => setRevenues({ ...revenues, gaming: v })}
                  placeholder="100"
                  prefix="$"
                  suffix="M"
                  helpText="Gross gaming revenue from casino operations"
                />

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
              </div>
            </div>

            {/* Advanced Options */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-left"
              >
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calculator size={20} className="text-[#1a365d]" />
                  Known Property Data
                </h2>
                <ChevronDown
                  size={20}
                  className={`text-gray-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                />
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    If you have actual property data, enter it here to override calculated values.
                  </p>

                  {/* Department-level known data inputs */}
                  {[
                    { key: 'gaming', label: 'Gaming', revenue: revenues.gaming },
                    { key: 'food', label: 'Food & Beverage', revenue: revenues.food },
                    { key: 'lodging', label: 'Lodging', revenue: revenues.lodging },
                    { key: 'other', label: 'Other', revenue: revenues.other }
                  ].filter(d => d.revenue && d.revenue > 0).map(({ key, label }) => (
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
                  {!revenues.gaming && !revenues.food && !revenues.lodging && !revenues.other && (
                    <p className="text-xs text-gray-400 italic">Enter revenue to add known data for departments.</p>
                  )}
                </div>
              )}
            </div>

            {/* Gaming Tax Rate */}
            {stateTaxConfig && stateTaxConfig.hasCommercial && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <DollarSign size={20} className="text-[#1a365d]" />
                  Gaming Tax Rate
                </h2>
                <div className="space-y-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{state}:</span>{' '}
                    {stateTaxConfig.rateStructure === 'tiered' ? (
                      <span>Graduated tiers ({formatNumber(stateTaxConfig.tiers[0].rate * 100, 1)}%–{formatNumber(stateTaxConfig.tiers[stateTaxConfig.tiers.length - 1].rate * 100, 1)}%)</span>
                    ) : stateTaxConfig.slotTableSplit ? (
                      <span>{formatNumber(stateTaxConfig.slotsRate * 100, 0)}% slots / {formatNumber(stateTaxConfig.tableRate * 100, 0)}% tables</span>
                    ) : (
                      <span>{formatNumber((stateTaxConfig.flatRate || stateTaxConfig.effectiveRate) * 100, 2)}% flat</span>
                    )}
                  </div>

                  {/* Slot/table split slider for split-rate states */}
                  {(stateTaxConfig.rateStructure === 'split_game_type' || stateTaxConfig.rateStructure === 'split_tiered' || stateTaxConfig.slotTableSplit) && !gamingTaxCustomRate && (
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

                  {/* Custom rate override */}
                  <div>
                    <InputField
                      label="Custom Tax Rate Override (%)"
                      value={gamingTaxCustomRate != null ? gamingTaxCustomRate * 100 : null}
                      onChange={(v) => setGamingTaxCustomRate(v != null ? v / 100 : null)}
                      placeholder="Leave blank to use state rate"
                      helpText="Override the state rate with a custom percentage (e.g., for tribal compacts or local adjustments)"
                      id="custom-tax-rate"
                    />
                  </div>
                </div>
              </div>
            )}

          </aside>

          {/* Results Panel */}
          <section className={`lg:col-span-2 space-y-6 ${userTier === 'free' ? 'protected-content' : ''}`} aria-label="Analysis results">
            {results ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up">
                  <MetricCard
                    icon={TrendingUp}
                    label="Total Output"
                    value={formatCurrency(results.totals.output.total)}
                    subtext={`${formatNumber(results.multipliers.output, 2)}x multiplier`}
                    color="primary"
                  />
                  <MetricCard
                    icon={DollarSign}
                    label="Total GDP"
                    value={formatCurrency(results.totals.gdp.total)}
                    subtext={`${formatNumber(results.multipliers.gdp, 2)}x multiplier`}
                    color="success"
                  />
                  <MetricCard
                    icon={Users}
                    label="Total FTEs"
                    value={formatJobs(results.totals.employment.total)}
                    subtext={`${formatNumber(results.multipliers.employment, 2)}x multiplier`}
                    color="purple"
                  />
                  <MetricCard
                    icon={Building2}
                    label="Total Wages"
                    value={formatCurrency(results.totals.wages.total)}
                    subtext={`${formatNumber(results.multipliers.wages, 2)}x multiplier`}
                    color="amber"
                  />
                </div>

                {/* Economic Impact Summary (primary results table) */}
                <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in-up" style={{ animationDelay: '75ms' }}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Economic Impact Summary</h3>
                  <ResultsTable results={results} />
                  {results.hasUserData && (
                    <p className="text-xs text-gray-500 mt-3 italic">
                      Note: Direct employment and/or wages use user-provided values.
                    </p>
                  )}
                </div>

                {/* Tax Revenue Estimates */}
                {(results.totals.tax.total > 0 || gamingTaxResult) && (
                  <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Revenue Estimates</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tax Type</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-[#1a365d]">
                              <DefTooltip text={TERM_DEFINITIONS.direct}>Direct</DefTooltip>
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-[#3182ce]">
                              <DefTooltip text={TERM_DEFINITIONS.indirect}>Indirect</DefTooltip>
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-[#4299e1]">
                              <DefTooltip text={TERM_DEFINITIONS.induced}>Induced</DefTooltip>
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gamingTaxResult && (
                            <tr className="border-b border-gray-100 hover:bg-gray-50">
                              <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-700 text-left">
                                <DefTooltip text="State and local taxes levied directly on gross gaming revenue at rates set by statute or compact.">
                                  Gaming Tax (GGR)
                                </DefTooltip>
                                <span className="block text-xs text-gray-500">
                                  {formatNumber(gamingTaxResult.effectiveRate * 100, 1)}% effective rate
                                </span>
                              </th>
                              <td className="py-3 px-4 text-sm text-right text-[#1a365d]">{formatCurrency(gamingTaxResult.amount)}</td>
                              <td className="py-3 px-4 text-sm text-right text-[#3182ce]">-</td>
                              <td className="py-3 px-4 text-sm text-right text-[#4299e1]">-</td>
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
                              <td className="py-3 px-4 text-sm text-right text-[#1a365d]">{formatCurrency(results.totals.tax.direct)}</td>
                              <td className="py-3 px-4 text-sm text-right text-[#3182ce]">{formatCurrency(results.totals.tax.indirect)}</td>
                              <td className="py-3 px-4 text-sm text-right text-[#4299e1]">{formatCurrency(results.totals.tax.induced)}</td>
                              <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{formatCurrency(results.totals.tax.total)}</td>
                            </tr>
                          )}
                          <tr className="bg-gray-50 border-t border-gray-200">
                            <th scope="row" className="py-3 px-4 text-sm font-bold text-gray-900 text-left">Subtotal</th>
                            <td className="py-3 px-4 text-sm text-right font-bold text-[#1a365d]">
                              {formatCurrency((gamingTaxResult?.amount || 0) + results.totals.tax.direct)}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-bold text-[#3182ce]">{formatCurrency(results.totals.tax.indirect)}</td>
                            <td className="py-3 px-4 text-sm text-right font-bold text-[#4299e1]">{formatCurrency(results.totals.tax.induced)}</td>
                            <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">
                              {formatCurrency((gamingTaxResult?.amount || 0) + results.totals.tax.total)}
                            </td>
                          </tr>
                          <tr className="border-b border-gray-100">
                            <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-400 text-left italic">
                              Payroll Taxes
                              <span className="block text-xs text-gray-400">Coming soon</span>
                            </th>
                            <td className="py-3 px-4 text-sm text-right text-gray-300 italic">-</td>
                            <td className="py-3 px-4 text-sm text-right text-gray-300 italic">-</td>
                            <td className="py-3 px-4 text-sm text-right text-gray-300 italic">-</td>
                            <td className="py-3 px-4 text-sm text-right text-gray-300 italic">-</td>
                          </tr>
                          <tr className="border-b border-gray-100">
                            <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-400 text-left italic">
                              Income Taxes
                              <span className="block text-xs text-gray-400">Coming soon</span>
                            </th>
                            <td className="py-3 px-4 text-sm text-right text-gray-300 italic">-</td>
                            <td className="py-3 px-4 text-sm text-right text-gray-300 italic">-</td>
                            <td className="py-3 px-4 text-sm text-right text-gray-300 italic">-</td>
                            <td className="py-3 px-4 text-sm text-right text-gray-300 italic">-</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      Gaming tax is applied directly to gross gaming revenue at state-mandated rates.
                      Taxes on Production (TOPI) are derived from the IO model and include sales taxes, property taxes, excise taxes, and fees paid by businesses across the supply chain.
                      {stateTaxConfig?.localTaxNotes && (
                        <span className="block mt-1 italic">Note: {stateTaxConfig.localTaxNotes}</span>
                      )}
                    </p>
                  </div>
                )}

                {/* Revenue Breakdown (if multiple) */}
                {results.byRevenue.length > 1 && (
                  <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Impact by Revenue Stream</h3>
                    <RevenueBreakdownTable byRevenue={results.byRevenue} />
                  </div>
                )}

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Impact Composition</h3>
                    <ImpactBreakdownChart results={results} />
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment Distribution</h3>
                    <EmploymentPieChart results={results} />
                    <p className="text-center text-sm text-gray-500 mt-2">
                      Total: {formatJobs(results.totals.employment.total)} jobs
                    </p>
                  </div>
                </div>

                {/* State Comparison */}
                <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">State Comparison</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Employment intensity (jobs per $1M GDP) for gambling sector across all states.
                    {state} is highlighted in navy.
                  </p>
                  <StateComparisonChart currentState={state} gamblingData={multiplierData.gambling} />
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
        <footer role="contentinfo" className="mt-12 text-center text-sm text-gray-600">
          <p>
            Casino Economic Impact Model |{' '}
            <a href="https://github.com/kphilander/casino-economic-impact" className="text-[#3182ce] hover:underline">
              GitHub
            </a>
            {' '}| Methodology: Industry Technology Assumption (ITA)
          </p>
        </footer>
      </div>
      </div>
    </>
  );
}
