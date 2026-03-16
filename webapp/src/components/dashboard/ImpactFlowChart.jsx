import React from 'react';
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../../utils/calculations';

const NODE_COLORS = {
  0: '#1a365d',  // Revenue
  1: '#1a365d',  // Direct
  2: '#3182ce',  // Indirect
  3: '#4299e1',  // Induced
  4: '#2c5282',  // Output
  5: '#3182ce',  // GDP
  6: '#4299e1',  // Jobs
  7: '#63b3ed',  // Wages
};

const NODE_LABELS = {
  0: 'Revenue',
  1: 'Direct',
  2: 'Indirect',
  3: 'Induced',
  4: 'Output',
  5: 'GDP',
  6: 'Employment',
  7: 'Wages',
};

function SankeyNode({ x, y, width, height, index }) {
  const color = NODE_COLORS[index] || '#94a3b8';
  const label = NODE_LABELS[index] || '';
  const isLeft = index === 0;
  const isMiddle = index >= 1 && index <= 3;
  const isRight = index >= 4;

  // Position labels: left of left nodes, above middle nodes, right of right nodes
  let textX, textY, anchor;
  if (isLeft) {
    textX = x - 8;
    textY = y + height / 2;
    anchor = 'end';
  } else if (isMiddle) {
    textX = x + width / 2;
    textY = y - 10;
    anchor = 'middle';
  } else {
    textX = x + width + 8;
    textY = y + height / 2;
    anchor = 'start';
  }

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        rx={4}
        ry={4}
      />
      <text
        x={textX}
        y={textY}
        textAnchor={anchor}
        dominantBaseline={isMiddle ? 'auto' : 'central'}
        fill={isMiddle ? color : '#374151'}
        fontSize={isMiddle ? 13 : 12}
        fontWeight={700}
      >
        {label}
      </text>
    </g>
  );
}

function SankeyLink({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload }) {
  const sourceColor = NODE_COLORS[payload.source] || '#94a3b8';

  return (
    <path
      d={`
        M${sourceX},${sourceY}
        C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
      `}
      fill="none"
      stroke={sourceColor}
      strokeWidth={linkWidth}
      strokeOpacity={0.18}
      className="transition-all duration-200 hover:!stroke-opacity-50"
      style={{ cursor: 'pointer' }}
    />
  );
}

export default function ImpactFlowChart({ results }) {
  const d = results.totals;

  const nodes = [
    { name: 'Revenue' },
    { name: 'Direct' },
    { name: 'Indirect' },
    { name: 'Induced' },
    { name: 'Output' },
    { name: 'GDP' },
    { name: 'Employment' },
    { name: 'Wages' },
  ];

  const empScale = d.wages.total > 0 ? d.output.direct * 0.15 / Math.max(d.wages.total, 1) : 1;

  const links = [
    { source: 0, target: 1, value: Math.max(d.output.direct, 0.1) },
    { source: 0, target: 2, value: Math.max(d.output.indirect, 0.1) },
    { source: 0, target: 3, value: Math.max(d.output.induced, 0.1) },

    { source: 1, target: 4, value: Math.max(d.output.direct * 0.4, 0.1) },
    { source: 1, target: 5, value: Math.max(d.gdp.direct * 0.4, 0.1) },
    { source: 1, target: 6, value: Math.max(d.wages.direct * 0.3 * empScale, 0.1) },
    { source: 1, target: 7, value: Math.max(d.wages.direct * 0.3, 0.1) },

    { source: 2, target: 4, value: Math.max(d.output.indirect * 0.4, 0.1) },
    { source: 2, target: 5, value: Math.max(d.gdp.indirect * 0.4, 0.1) },
    { source: 2, target: 6, value: Math.max(d.wages.indirect * 0.3 * empScale, 0.1) },
    { source: 2, target: 7, value: Math.max(d.wages.indirect * 0.3, 0.1) },

    { source: 3, target: 4, value: Math.max(d.output.induced * 0.4, 0.1) },
    { source: 3, target: 5, value: Math.max(d.gdp.induced * 0.4, 0.1) },
    { source: 3, target: 6, value: Math.max(d.wages.induced * 0.3 * empScale, 0.1) },
    { source: 3, target: 7, value: Math.max(d.wages.induced * 0.3, 0.1) },
  ];

  return (
    <div>
      <ResponsiveContainer width="100%" height={380}>
        <Sankey
          data={{ nodes, links }}
          node={<SankeyNode />}
          link={<SankeyLink />}
          nodePadding={36}
          nodeWidth={12}
          margin={{ top: 24, right: 90, left: 90, bottom: 10 }}
          iterations={64}
        >
          <Tooltip
            formatter={(value) => [formatCurrency(value), '']}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              fontSize: 12
            }}
          />
        </Sankey>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 mt-1">
        {[
          { label: 'Direct', color: '#1a365d' },
          { label: 'Indirect', color: '#3182ce' },
          { label: 'Induced', color: '#4299e1' }
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
