import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell
} from 'recharts';
import { formatNumber } from '../../utils/calculations';
import { ChevronDown } from 'lucide-react';
import { NAVY, EFFECT, HIGHLIGHT, GRID_STROKE } from '../../theme';

export default function StateComparisonChart({ currentState, gamblingData }) {
  const [showAll, setShowAll] = useState(false);

  const { top10Data, allData, nationalAvg, currentStateData } = useMemo(() => {
    const sorted = [...gamblingData]
      .sort((a, b) => b.Emp_Coef - a.Emp_Coef)
      .map(d => ({
        state: d.Abbrev,
        fullName: d.State,
        multiplier: d.Emp_Coef,
        isSelected: d.State === currentState
      }));

    const avg = sorted.reduce((s, d) => s + d.multiplier, 0) / sorted.length;
    const selected = sorted.find(d => d.isSelected);
    const top10 = sorted.slice(0, 10);

    // If selected state isn't in top 10, add it
    if (selected && !top10.find(d => d.isSelected)) {
      top10.push(selected);
      top10.sort((a, b) => b.multiplier - a.multiplier);
    }

    return { top10Data: top10, allData: sorted, nationalAvg: avg, currentStateData: selected };
  }, [gamblingData, currentState]);

  const displayData = showAll ? allData : top10Data;
  const chartHeight = showAll ? Math.max(allData.length * 28, 400) : 380;

  return (
    <div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={displayData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickFormatter={(v) => formatNumber(v, 0)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="state"
            width={36}
            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value) => [formatNumber(value, 1) + ' jobs/$1M GDP', '']}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12
            }}
          />
          <ReferenceLine
            x={nationalAvg}
            stroke={HIGHLIGHT}
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: `Avg: ${formatNumber(nationalAvg, 1)}`,
              position: 'top',
              fill: HIGHLIGHT,
              fontSize: 10,
              fontWeight: 600
            }}
          />
          <Bar dataKey="multiplier" radius={[0, 4, 4, 0]} barSize={showAll ? 16 : 22}>
            {displayData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isSelected ? NAVY : EFFECT.induced}
                stroke={entry.isSelected ? NAVY : 'none'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {currentStateData && (
        <p className="text-xs text-text-muted text-center mt-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary mr-1 align-middle" />
          <span className="font-medium text-text-secondary">{currentState}</span>: {formatNumber(currentStateData.multiplier, 1)} jobs per $1M GDP
          {currentStateData.multiplier > nationalAvg ? ' (above average)' : ' (below average)'}
        </p>
      )}

      <div className="flex justify-center mt-3">
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-primary transition-colors"
        >
          {showAll ? 'Show top 10' : 'Show all 50 states'}
          <ChevronDown size={14} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
}
