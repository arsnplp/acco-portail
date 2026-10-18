/** Courbe 12 mois en SVG, sans dépendance. Couleurs = tokens Acco uniquement. */
export function LineChart({ points, labels, height = 140 }: { points: number[]; labels: string[]; height?: number }) {
  const w = 320, h = height, padX = 8, padTop = 12, padBottom = 22;
  const max = Math.max(1, ...points);
  const n = points.length;
  const x = (i: number) => padX + (i * (w - 2 * padX)) / Math.max(1, n - 1);
  const y = (v: number) => padTop + (h - padTop - padBottom) * (1 - v / max);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${d} L${x(n - 1).toFixed(1)},${(h - padBottom).toFixed(1)} L${x(0).toFixed(1)},${(h - padBottom).toFixed(1)} Z`;
  const last = n - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Visites depuis Google sur 12 mois">
      {[0.25, 0.5, 0.75].map((t) => <line key={t} x1={padX} x2={w - padX} y1={y(max * t)} y2={y(max * t)} stroke="var(--border)" strokeDasharray="2 4" />)}
      <path d={area} fill="var(--blue)" opacity="0.12" />
      <path d={d} fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === last ? 4 : 2} fill={i === last ? "var(--title)" : "var(--blue)"} />)}
      <text x={x(last)} y={y(points[last]) - 9} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--title)">{points[last]}</text>
      {labels.map((l, i) => (i % 2 === last % 2 ? <text key={i} x={x(i)} y={h - 6} textAnchor="middle" fontSize="9" fill="var(--text)">{l}</text> : null))}
    </svg>
  );
}
