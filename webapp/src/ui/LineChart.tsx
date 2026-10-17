/** Minimal responsive SVG line chart for one series. */
export function LineChart(props: {
  points: { x: number; y: number }[];
  xLabel: (x: number) => string;
  yLabel: (y: number) => string;
  title: string;
  markX?: number;
}) {
  const { points } = props;
  if (points.length < 2) return null;
  const W = 640;
  const H = 260;
  const pad = { l: 64, r: 40, t: 16, b: 36 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const yMin = Math.min(0, ...ys);
  const yMax = Math.max(...ys) * 1.05 || 1;
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - ((y - yMin) / (yMax - yMin || 1)) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));
  const xTicks = points.filter((_, i) => i % Math.ceil(points.length / 5) === 0 || i === points.length - 1);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.title}>
      {yTicks.map((y) => (
        <g key={y}>
          <line x1={pad.l} x2={W - pad.r} y1={sy(y)} y2={sy(y)} className="grid" />
          <text x={pad.l - 8} y={sy(y)} dy="0.32em" textAnchor="end" className="tick">{props.yLabel(y)}</text>
        </g>
      ))}
      {xTicks.map((p) => (
        <text key={p.x} x={sx(p.x)} y={H - pad.b + 20} textAnchor="middle" className="tick">{props.xLabel(p.x)}</text>
      ))}
      {props.markX != null && props.markX >= x0 && props.markX <= x1 && (
        <line x1={sx(props.markX)} x2={sx(props.markX)} y1={pad.t} y2={H - pad.b} className="mark" />
      )}
      <path d={d} className="line" />
      {points.map((p) => <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={3.5} className="dot" />)}
    </svg>
  );
}
