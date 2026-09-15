type Point = { date: string; count: number };

function formatShortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** A minimal, dependency-free bar chart for daily counts — no charting library needed for a single series. */
export default function TrendChart({ data, color = "#3762e0", height = 140 }: { data: Point[]; color?: string; height?: number }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const width = 100;
  const barGap = 0.6;
  const barWidth = data.length > 0 ? width / data.length - barGap : 0;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const barHeight = (d.count / max) * (height - 18);
          const x = i * (barWidth + barGap);
          const y = height - 18 - barHeight;
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={Math.max(barWidth, 0.4)} height={Math.max(barHeight, d.count > 0 ? 1.5 : 0)} rx={0.8} fill={color} opacity={0.85}>
                <title>
                  {formatShortDate(d.date)}: {d.count}
                </title>
              </rect>
            </g>
          );
        })}
        <line x1={0} y1={height - 17} x2={width} y2={height - 17} stroke="#e2e8f0" strokeWidth={0.3} />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{data[0] ? formatShortDate(data[0].date) : ""}</span>
        <span>{data[data.length - 1] ? formatShortDate(data[data.length - 1].date) : ""}</span>
      </div>
    </div>
  );
}
