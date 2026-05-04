import React from 'react'

const fmt = (v) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v ?? '')
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString('ko-KR')
}

const isChartElement = (child, name) => child?.type?.displayName === name || child?.type?.name === name
const getChildren = (children, name) => React.Children.toArray(children).filter((c) => isChartElement(c, name))
const getFirst = (children, name) => getChildren(children, name)[0]
const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0
const colorAt = (fallback = '#ff2d2d') => fallback || '#ff2d2d'

export function ResponsiveContainer({ children, height = 300 }) {
  return (
    <div className="recharts-shim-container" style={{ width: '100%', height, minHeight: height }}>
      {children}
    </div>
  )
}

function AxisLabels({ rows, xKey, x0, y, w, vertical = false }) {
  if (vertical) return null
  const count = Math.max(rows.length, 1)
  return rows.map((d, i) => {
    const x = x0 + (i + 0.5) * (w / count)
    return <text key={`${d[xKey]}-${i}`} x={x} y={y} textAnchor="middle" fontSize="11" fill="var(--text3, #777)">{String(d[xKey] ?? d.name ?? d.label ?? '').slice(0, 16)}</text>
  })
}

export function BarChart({ data = [], children, layout }) {
  const rows = Array.isArray(data) ? data : []
  const barEls = getChildren(children, 'Bar')
  const xAxis = getFirst(children, 'XAxis')
  const yAxis = getFirst(children, 'YAxis')
  const xKey = xAxis?.props?.dataKey || yAxis?.props?.dataKey || 'label'
  const series = barEls.length ? barEls : [{ props: { dataKey: 'value', fill: '#ff2d2d' } }]
  const firstKey = series[0]?.props?.dataKey || 'value'
  const width = 640
  const height = 300
  const pad = { l: layout === 'vertical' ? 135 : 58, r: 30, t: 24, b: layout === 'vertical' ? 30 : 52 }
  const plotW = width - pad.l - pad.r
  const plotH = height - pad.t - pad.b
  const max = Math.max(...rows.flatMap((d) => series.map((s) => num(d[s.props.dataKey]))), 1)

  if (!rows.length) return <div className="recharts-shim-empty">차트 데이터 없음</div>

  if (layout === 'vertical') {
    const rowH = plotH / Math.max(rows.length, 1)
    return (
      <svg className="recharts-shim-svg" viewBox={`0 0 ${width} ${height}`}>
        {[0, .25, .5, .75, 1].map((t) => <line key={t} x1={pad.l + t * plotW} y1={pad.t} x2={pad.l + t * plotW} y2={pad.t + plotH} stroke="rgba(120,120,120,.14)" strokeDasharray="3 4" />)}
        {rows.map((d, i) => {
          const y = pad.t + i * rowH + rowH * .22
          const h = rowH * .46
          const v = num(d[firstKey])
          const bw = (v / max) * plotW
          return (
            <g key={i}>
              <text x={pad.l - 10} y={y + h * .72} textAnchor="end" fontSize="11" fill="var(--text2, #555)" fontWeight="700">{d[xKey] ?? d.category ?? d.label}</text>
              <rect x={pad.l} y={y} width={plotW} height={h} rx="10" fill="rgba(120,120,120,.09)" />
              <rect x={pad.l} y={y} width={bw} height={h} rx="10" fill={colorAt(series[0]?.props?.fill)} />
              <text x={Math.min(pad.l + bw + 8, width - 38)} y={y + h * .72} fontSize="11" fill="var(--text3, #777)" fontWeight="800">{fmt(v)}</text>
            </g>
          )
        })}
      </svg>
    )
  }

  const groupW = plotW / Math.max(rows.length, 1)
  const barW = Math.max(10, (groupW * .64) / Math.max(series.length, 1))
  return (
    <svg className="recharts-shim-svg" viewBox={`0 0 ${width} ${height}`}>
      {[0, .25, .5, .75, 1].map((t) => <line key={t} x1={pad.l} y1={pad.t + plotH - t * plotH} x2={pad.l + plotW} y2={pad.t + plotH - t * plotH} stroke="rgba(120,120,120,.14)" strokeDasharray="3 4" />)}
      {rows.map((d, i) => series.map((s, si) => {
        const key = s.props.dataKey
        const v = num(d[key])
        const h = (v / max) * plotH
        const x = pad.l + i * groupW + groupW * .18 + si * barW
        const y = pad.t + plotH - h
        return <rect key={`${i}-${key}`} x={x} y={y} width={barW * .82} height={h} rx="8" fill={colorAt(s.props.fill || (si ? '#222' : '#ff2d2d'))} />
      }))}
      <AxisLabels rows={rows} xKey={xKey} x0={pad.l} y={pad.t + plotH + 24} w={plotW} />
    </svg>
  )
}

function XYLine({ data = [], children, area = false }) {
  const rows = Array.isArray(data) ? data : []
  const xAxis = getFirst(children, 'XAxis')
  const series = getFirst(children, area ? 'Area' : 'Line') || { props: { dataKey: 'value', stroke: '#ff2d2d' } }
  const xKey = xAxis?.props?.dataKey || 'label'
  const key = series.props.dataKey || 'value'
  const width = 640, height = 300
  const pad = { l: 58, r: 28, t: 24, b: 52 }
  const plotW = width - pad.l - pad.r, plotH = height - pad.t - pad.b
  const max = Math.max(...rows.map((d) => num(d[key])), 1)
  const min = Math.min(...rows.map((d) => num(d[key])), 0)
  const span = max - min || 1
  const xOf = (i) => pad.l + (rows.length === 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW)
  const yOf = (v) => pad.t + plotH - ((num(v) - min) / span) * plotH
  const pts = rows.map((d, i) => `${xOf(i)},${yOf(d[key])}`).join(' ')
  const fillPts = `${pad.l},${pad.t+plotH} ${pts} ${pad.l+plotW},${pad.t+plotH}`
  const stroke = series.props.stroke || '#ff2d2d'
  if (!rows.length) return <div className="recharts-shim-empty">차트 데이터 없음</div>
  return (
    <svg className="recharts-shim-svg" viewBox={`0 0 ${width} ${height}`}>
      {[0, .25, .5, .75, 1].map((t) => <line key={t} x1={pad.l} y1={pad.t + plotH - t * plotH} x2={pad.l + plotW} y2={pad.t + plotH - t * plotH} stroke="rgba(120,120,120,.14)" strokeDasharray="3 4" />)}
      {area && <polygon points={fillPts} fill="rgba(255,45,45,.12)" />}
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {rows.map((d, i) => <g key={i}><circle cx={xOf(i)} cy={yOf(d[key])} r="4" fill="white" stroke={stroke} strokeWidth="2"/><text x={xOf(i)} y={pad.t+plotH+24} textAnchor="middle" fontSize="11" fill="var(--text3,#777)">{d[xKey]}</text></g>)}
    </svg>
  )
}
export function LineChart(props) { return <XYLine {...props} /> }
export function AreaChart(props) { return <XYLine {...props} area /> }

export function ScatterChart({ data = [], children }) {
  const rows = Array.isArray(data) ? data : []
  const xAxis = getFirst(children, 'XAxis')
  const scatter = getFirst(children, 'Scatter') || { props: { dataKey: 'y', fill: '#ff2d2d' } }
  const xKey = xAxis?.props?.dataKey || 'x'
  const yKey = scatter.props.dataKey || 'y'
  const width = 640, height = 300, pad = { l: 58, r: 28, t: 24, b: 52 }
  const plotW = width - pad.l - pad.r, plotH = height - pad.t - pad.b
  const maxX = Math.max(...rows.map((d) => num(d[xKey])), 1)
  const maxY = Math.max(...rows.map((d) => num(d[yKey])), 1)
  if (!rows.length) return <div className="recharts-shim-empty">차트 데이터 없음</div>
  return <svg className="recharts-shim-svg" viewBox={`0 0 ${width} ${height}`}>{rows.map((d,i)=><circle key={i} cx={pad.l + (num(d[xKey])/maxX)*plotW} cy={pad.t+plotH-(num(d[yKey])/maxY)*plotH} r="4" fill={scatter.props.fill || '#ff2d2d'} opacity=".65" />)}</svg>
}

export function XAxis() { return null }
export function YAxis() { return null }
export function Tooltip() { return null }
export function CartesianGrid() { return null }
export function Legend() { return null }
export function Cell() { return null }
export function Bar() { return null }
export function Line() { return null }
export function Area() { return null }
export function Scatter() { return null }

Bar.displayName = 'Bar'
Line.displayName = 'Line'
Area.displayName = 'Area'
XAxis.displayName = 'XAxis'
YAxis.displayName = 'YAxis'
Scatter.displayName = 'Scatter'
