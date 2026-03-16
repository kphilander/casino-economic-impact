import React, { useMemo } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { formatNumber } from '../../utils/calculations';

export default function MultiplierRadarChart({ results, gamblingData, state }) {
  // Compute national averages from gambling data for comparison
  const { radarData, hasAverage } = useMemo(() => {
    const multipliers = results.multipliers;
    const taxMult = results.totals.tax.direct > 0
      ? results.totals.tax.total / results.totals.tax.direct
      : 1;

    // Calculate national averages if we have gambling data
    let avgOutput = 0, avgGdp = 0, avgEmp = 0, avgWage = 0;
    let count = 0;
    if (gamblingData && gamblingData.length > 0) {
      for (const d of gamblingData) {
        if (d.Type_II_Output && d.Direct_VA_Coef > 0) {
          avgOutput += d.Type_II_Output;
          avgGdp += d.Type_II_VA / d.Direct_VA_Coef;
          if (d.Direct_Wage_Coef > 0) avgWage += d.Type_II_Wage / d.Direct_Wage_Coef;
          count++;
        }
      }
      if (count > 0) {
        avgOutput /= count;
        avgGdp /= count;
        avgWage /= count;
      }
    }

    const data = [
      { metric: 'Output', value: multipliers.output || 0, average: avgOutput || 0 },
      { metric: 'GDP', value: multipliers.gdp || 0, average: avgGdp || 0 },
      { metric: 'Employment', value: multipliers.employment || 0, average: 0 },
      { metric: 'Wages', value: multipliers.wages || 0, average: avgWage || 0 },
      { metric: 'Tax', value: taxMult, average: 0 },
    ];

    return { radarData: data, hasAverage: count > 0 };
  }, [results, gamblingData]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
        />
        <PolarRadiusAxis
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          tickFormatter={(v) => `${v.toFixed(1)}x`}
          axisLine={false}
        />
        <Radar
          name={state}
          dataKey="value"
          stroke="#1a365d"
          fill="#1a365d"
          fillOpacity={0.15}
          strokeWidth={2}
          dot={{ r: 4, fill: '#1a365d', stroke: '#fff', strokeWidth: 1.5 }}
        />
        {hasAverage && (
          <Radar
            name="National Avg"
            dataKey="average"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.05}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        )}
        <Tooltip
          formatter={(value, name) => [`${formatNumber(value, 2)}x`, name]}
          contentStyle={{
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontSize: 12
          }}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
