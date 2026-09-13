export default function WeightChart({ logs }) {
  if (logs.length < 2) return null
  const W = 300, H = 84, pad = 12
  const weights = logs.map(l => parseFloat(l.weight_kg))
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 0.1
  const pts = weights.map((w, i) => [
    pad + (i / (weights.length - 1)) * (W - pad * 2),
    H - pad - ((w - minW) / range) * (H - pad * 2 - 18),
  ])
  const points = pts.map(([x, y]) => `${x},${y}`).join(' ')
  const [lx, ly] = pts[pts.length - 1]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: H, display: 'block', marginBottom: 8 }}
    >
      <polyline
        points={points}
        style={{ fill: 'none', stroke: '#DD8C96', strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' }}
      />
      {pts.map(([x, y], i) => (
        <circle
          key={i} cx={x} cy={y}
          r={i === pts.length - 1 ? 5 : 3.5}
          style={{ fill: i === pts.length - 1 ? '#C86E7A' : '#DD8C96' }}
        />
      ))}
      <text
        x={lx} y={ly - 10}
        style={{ fontSize: 11, fill: '#2E4060', fontFamily: 'Kanit,sans-serif', fontWeight: 600 }}
        textAnchor="middle"
      >
        {weights[weights.length - 1]} kg
      </text>
    </svg>
  )
}
