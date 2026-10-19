/** Server-side render of each view for representative analyses. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { loadModel } from '../engine/data';
import { computeScenario, defaultAnalysis, type Analysis } from '../engine/scenario';
import { ResultsView } from './ResultsView';
import { SensitivityView } from './SensitivityView';
import { MethodView } from './MethodView';
import { InputsPanel } from './InputsPanel';
import { CompareView } from './CompareView';

const cases: [string, string, Analysis][] = [
  ['resort by department with modules', 'NV', {
    ...defaultAnalysis(),
    netImpact: { enabled: true, nonResidentShare: 50, recaptureShare: 10 },
    construction: { enabled: true, cost: 300, localShare: 60, years: 2 },
  }],
  ['tribal with a compact revenue share', 'OK', {
    ...defaultAnalysis(), state: 'Oklahoma', ownership: 'tribal',
    revenue: { gaming: 200, food: 20, lodging: null, other: null, total: null },
    gamingTax: { customRate: 0.06, slotSharePct: 70 },
  }],
  ['online sportsbook', 'NJ', {
    ...defaultAnalysis(), state: 'New Jersey', propertyType: 'ONLINE_SPORTSBOOK',
    revenue: { gaming: 150, food: null, lodging: null, other: null, total: null },
  }],
];

describe('views render', () => {
  for (const [name, abbrev, a] of cases) {
    test(name, async () => {
      const model = await loadModel(abbrev);
      const r = computeScenario(a, model)!;
      const results = renderToStaticMarkup(<ResultsView r={r} model={model} />);
      expect(results).toContain('Economic impact');
      expect(results).toContain('All taxes');
      expect(results).toContain('Supplier and induced jobs by industry');
      expect(results).toContain('How the model calculates this');
      expect(results).toContain('Leontief inverse');
      expect(results).toContain('Social Security');
      expect(results).toContain('What these values measure');
      if (r.payrollAdjustment) expect(results).toContain('<strong>Gaming-tax adjustment.</strong>');
      if (a.construction.enabled) expect(results).toContain('Job-years');
      if (a.netImpact.enabled) expect(results).toContain('Net new impact');
      if (a.ownership === 'tribal') expect(results).toContain('Tribal revenue share (compact)');
      expect(renderToStaticMarkup(<SensitivityView analysis={a} model={model} result={r} />)).toContain('Multi-year projection');
      const inputs = renderToStaticMarkup(<InputsPanel analysis={a} update={() => {}} result={r} />);
      expect(inputs).toContain('Annual revenue');
      expect(inputs).toContain('Reset all inputs');
      if (a.propertyType === '721120') expect(inputs).toContain('Total revenue: $');
    });
  }

  test('method and comparison views', async () => {
    const model = await loadModel('PA');
    const method = renderToStaticMarkup(<MethodView model={model} />);
    expect(method).toContain('Multipliers for Pennsylvania');
    expect(method).toContain('TwoRegion_Summary_ValueAdded_2019');
    expect(method).toContain('How the model calculates a result');
    expect(method).toContain('All 71 industries');
    const compare = renderToStaticMarkup(<CompareView scenarios={[]} onAdd={() => {}} onRemove={() => {}} onLoad={() => {}} />);
    expect(compare).toContain('There are no scenarios');
  });
});
