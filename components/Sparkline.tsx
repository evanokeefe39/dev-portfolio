import { sparklinePoints } from '@/lib/format'

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  stroke?: string
  /** Unique id per instance so the gradient defs don't collide. */
  id: string
}

/** Raw SVG sparkline — no charting library; polyline generated from the JSON series. */
export default function Sparkline({ values, width = 120, height = 34, stroke = '#22d3ee', id }: SparklineProps) {
  const points = sparklinePoints(values, width, height)
  if (!points) return <div className="h-9" aria-hidden />
  const area = `${points} ${width},${height} 0,${height}`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-9 w-full" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
