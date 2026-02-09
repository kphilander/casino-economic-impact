import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Building2, DollarSign, Users, TrendingUp, ChevronDown, Calculator, MapPin, Loader2, Presentation } from 'lucide-react';
import multiplierData from './data/multipliers.json';
import { calculateCombinedImpact, formatNumber, formatCurrency, formatJobs } from './utils/calculations';
// Report generators are dynamically imported to reduce initial bundle size
// import { generateReport } from './utils/reportGenerator';
// import { downloadPPTX } from './utils/pptxGenerator';
// import { downloadStarterTemplate } from './utils/starterTemplateGenerator';
// import { fillTemplateAndDownload } from './utils/templateFiller';

const COLORS = {
  direct: '#10b981',
  indirect: '#3b82f6',
  induced: '#8b5cf6',
  gaming: '#ef4444',
  food: '#f97316',
  lodging: '#06b6d4',
  other: '#84cc16'
};

// Metric Card Component
function MetricCard({ icon: Icon, label, value, subtext, color = 'primary' }) {
  const colorClasses = {
    primary: 'from-blue-500 to-blue-600',
    success: 'from-emerald-500 to-emerald-600',
    purple: 'from-purple-500 to-purple-600',
    amber: 'from-amber-500 to-amber-600'
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
          className={`w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-12' : ''}`}
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
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white pr-10"
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

// Results Table Component
function ResultsTable({ results }) {
  const rows = [
    { label: 'Output ($M)', key: 'output', format: (v) => formatNumber(v, 1) },
    { label: 'GDP ($M)', key: 'gdp', format: (v) => formatNumber(v, 1) },
    { label: 'Employment (Jobs)', key: 'employment', format: (v) => formatJobs(v) },
    { label: 'Wages ($M)', key: 'wages', format: (v) => formatNumber(v, 1) }
  ];

  return (
    <div className="overflow-x-auto" role="region" aria-label="Economic impact results">
      <table className="w-full" aria-label="Economic impact breakdown by effect type">
        <caption className="sr-only">Economic impact summary showing direct, indirect, induced effects and multipliers</caption>
        <thead>
          <tr className="border-b border-gray-200">
            <th scope="col" className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Metric</th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-emerald-700">Direct</th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-blue-700">Indirect</th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-purple-700">Induced</th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-gray-900">Total</th>
            <th scope="col" className="text-right py-3 px-4 text-sm font-semibold text-blue-700">Multiplier</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, key, format }) => (
            <tr key={key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              <th scope="row" className="py-3 px-4 text-sm font-medium text-gray-700 text-left">{label}</th>
              <td className="py-3 px-4 text-sm text-right text-emerald-700">{format(results.totals[key].direct)}</td>
              <td className="py-3 px-4 text-sm text-right text-blue-700">{format(results.totals[key].indirect)}</td>
              <td className="py-3 px-4 text-sm text-right text-purple-700">{format(results.totals[key].induced)}</td>
              <td className="py-3 px-4 text-sm text-right font-bold text-gray-900">{format(results.totals[key].total)}</td>
              <td className="py-3 px-4 text-sm text-right text-blue-700 font-medium">
                {formatNumber(results.multipliers[key], 2)}x
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
            fill="#3b82f6"
          >
            {sortedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.isSelected ? '#ef4444' : '#3b82f6'} />
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
          : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 hover:shadow-xl hover:-translate-y-0.5'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Step {stepNum} of {totalSteps}</span>
            <span className="text-sm text-gray-400">{Math.round((stepNum / totalSteps) * 100)}% complete</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
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
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
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

  // Wizard helper state
  const [hasOtherRevenue, setHasOtherRevenue] = useState(false);
  const [hasKnownData, setHasKnownData] = useState(false);

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

  // State options
  const stateOptions = multiplierData.states.map(s => ({ value: s, label: s }));

  // Author info for reports
  const authorInfo = {
    name: 'Dr. Kahlil Simeon-Rose',
    title: 'Principal Consultant',
    institution: 'GP Consulting',
    bio: `Dr. Kahlil Simeon-Rose is an economist and academic specializing in the analysis of policy and consumer behavior in the gaming industry. With nearly 20 years of applied research experience in economic impact measurement across academia, industry, and government, Dr. Simeon-Rose offers a unique blend of technical expertise and policy insight, particularly in contexts involving tourism, entertainment, and community impact.

He currently serves as a tenured Associate Professor at Washington State University's Carson College of Business. His research spans topics such as regional economic forecasting, taxation policy, and the socioeconomic outcomes of the gaming industry. Dr. Simeon-Rose's work has been funded by both government agencies and private-sector clients, and he has led numerous economic impact assessments and market studies for North American and international jurisdictions.

Dr. Simeon-Rose's academic background includes a Ph.D. in Hospitality Administration from the University of Nevada, Las Vegas, with a dissertation centered on the economic impact of tax policy. He also holds an M.A. in Economics from the University of Toronto and a B.Com. in Finance and Economics with honors from the University of British Columbia.

Dr. Simeon-Rose's research portfolio includes 40 peer-reviewed publications in top-tier journals such as Tourism Management, Journal of Policy Modeling, and Journal of Gambling Studies, alongside dozens of industry reports. His commentary has been featured in outlets like CNBC, Financial Times, and Wired magazine.

More information about Dr. Simeon-Rose is available at kahlil.co.`,
    email: 'info@gamblingpolicy.com',
    phone: '',
    customContact: 'For customized economic impact analysis, please contact GP Consulting at info@gamblingpolicy.com'
  };

  // Handle PPTX generation (lazy loaded)
  const handleDownloadPPTX = async () => {
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
          knownData,  // Department-level known data
          propertyType,
          propertyTypeLabel,
          inputMode
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

  // Handle starter template download (lazy loaded)
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
    const totalSteps = 4;

    // Step 1: State Selection, Property Type, and Casino Name
    if (wizardStep === 0) {
      const selectedPropertyType = PROPERTY_TYPE_OPTIONS.find(p => p.value === propertyType);

      return (
        <WizardStep
          stepNum={1}
          totalSteps={totalSteps}
          title="Tell us about your project"
          subtitle="Select the state, property type, and optionally name the casino or project."
          onNext={() => setWizardStep(1)}
          showBack={false}
          canProceed={!!state && !!propertyType}
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
              label="Casino or Project Name (optional)"
              value={casinoName}
              onChange={setCasinoName}
              placeholder="e.g., Bellagio, Proposed Downtown Casino"
              type="text"
              helpText="This will appear on your report cover page"
            />
          </div>
        </WizardStep>
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
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
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
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
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
      );
    }

    // Step 3: Other Revenue Streams
    if (wizardStep === 2) {
      return (
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
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
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
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
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
        <WizardStep
          stepNum={inputMode === 'total' ? 3 : 4}
          totalSteps={inputMode === 'total' ? 3 : totalSteps}
          title="Do you have known property data?"
          subtitle="If you know the actual direct employment or wages, you can enter them for more accurate results."
          onBack={handleBackStep}
          onNext={() => setWizardComplete(true)}
          nextLabel="Calculate Impact"
        >
          <div className="space-y-4">
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setHasKnownData(true)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                  hasKnownData
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
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
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
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
                      label="Direct Employment (Jobs)"
                      value={knownData.gaming?.emp}
                      onChange={(v) => updateKnownData('gaming', 'emp', v)}
                      placeholder="e.g., 500"
                      helpText="Total direct employees at the property"
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
                          label="Employment"
                          value={knownData[key]?.emp}
                          onChange={(v) => updateKnownData(key, 'emp', v)}
                          placeholder="Jobs"
                          helpText="Optional"
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
      );
    }
  }

  // ============================================================
  // DASHBOARD VIEW (after wizard completion)
  // ============================================================
  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
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
          <div className="flex items-center justify-center gap-4 mb-3">
            <h1 className="text-4xl font-bold gradient-text">
              Casino Economic Impact Calculator
            </h1>
          </div>
          <p className="text-gray-700 max-w-2xl mx-auto mb-4">
            Estimate the economic impact of casino operations using Input-Output analysis.
          </p>
          <button
            onClick={handleStartOver}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Start New Analysis
          </button>
        </header>

        <main id="main-content" role="main" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Panel */}
          <aside className="lg:col-span-1 space-y-6" aria-label="Input parameters">
            {/* Report Download Button */}
            {results && (
              <DownloadPPTXButton
                onClick={handleDownloadPPTX}
                isGenerating={isGeneratingPPTX}
              />
            )}

            {/* Location & Analysis Type */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin size={20} className="text-blue-500" />
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
                <DollarSign size={20} className="text-emerald-500" />
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
                  <Calculator size={20} className="text-purple-500" />
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
                          label="Employment"
                          value={knownData[key]?.emp}
                          onChange={(v) => setKnownData(prev => ({
                            ...prev,
                            [key]: { ...prev[key], emp: v }
                          }))}
                          placeholder="Jobs"
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

          </aside>

          {/* Results Panel */}
          <section className="lg:col-span-2 space-y-6" aria-label="Analysis results">
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
                    label="Total Jobs"
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

                {/* Detailed Results Table */}
                <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Economic Impact Summary</h3>
                  <ResultsTable results={results} />
                  {results.hasUserData && (
                    <p className="text-xs text-gray-500 mt-3 italic">
                      Note: Direct employment and/or wages use user-provided values.
                    </p>
                  )}
                </div>

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
                    {state} is highlighted in red.
                  </p>
                  <StateComparisonChart currentState={state} gamblingData={multiplierData.gambling} />
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                <Calculator size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Enter revenue data to calculate economic impact</p>
              </div>
            )}
          </section>
        </main>

        {/* Footer */}
        <footer role="contentinfo" className="mt-12 text-center text-sm text-gray-600">
          <p>
            Casino Economic Impact Calculator |{' '}
            <a href="https://github.com/kphilander/casino-economic-impact" className="text-blue-600 hover:underline">
              GitHub
            </a>
            {' '}| Methodology: Industry Technology Assumption (ITA)
          </p>
        </footer>
      </div>
    </div>
  );
}
