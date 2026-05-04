import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import '../styles/SustainPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const fallback = {
  stats: { min: 6, q25: 30, median: 108, mean: 146, q75: 240, max: 768 },
  dataScale: { snapshots: 872191, events: 34964, videos: 17884, reentries: 17080 },
  categoryDuration: [
    { category: 'Education', duration: 210, score: 0.86 },
    { category: 'News', duration: 168, score: 0.79 },
    { category: 'Lifestyle', duration: 132, score: 0.71 },
    { category: 'Music', duration: 96, score: 0.64 },
    { category: 'Entertainment', duration: 82, score: 0.58 },
  ],
  featureImportance: [
    { feature: 'view_growth_24h', value: 31 },
    { feature: 'like_count', value: 23 },
    { feature: 'comment_count', value: 18 },
    { feature: 'category', value: 16 },
    { feature: 'entry_rank', value: 12 },
  ],
  videos: [
    { title: 'Education trend explainer', category: 'Education', duration: 240, score: 0.88, pred: 'long' },
    { title: 'Breaking news summary', category: 'News', duration: 192, score: 0.81, pred: 'long' },
    { title: 'Lifestyle routine vlog', category: 'Lifestyle', duration: 132, score: 0.72, pred: 'normal' },
    { title: 'Music challenge clip', category: 'Music', duration: 96, score: 0.65, pred: 'normal' },
    { title: 'Entertainment shorts highlight', category: 'Entertainment', duration: 54, score: 0.42, pred: 'short' },
    { title: 'Sports match reaction', category: 'Sports', duration: 72, score: 0.49, pred: 'short' },
  ],
  clusters: [
    { id: 'C0', name: '단기 폭발형', duration: 48, score: 0.42, ratio: 27, x: 24, y: 70 },
    { id: 'C1', name: '일반 유지형', duration: 108, score: 0.61, ratio: 34, x: 48, y: 48 },
    { id: 'C2', name: '장기 지속형', duration: 240, score: 0.86, ratio: 24, x: 76, y: 30 },
    { id: 'C3', name: '재진입형', duration: 168, score: 0.74, ratio: 15, x: 64, y: 66 },
  ],
}

const featureNameMap = {
  view_growth_24h: '조회수 증가율',
  view_growth: '조회수 증가율',
  views_growth: '조회수 증가율',
  entry_rank: '진입 순위',
  rank: '진입 순위',
  comment_count: '댓글 반응',
  comments: '댓글 반응',
  like_count: '좋아요 비율',
  like_ratio: '좋아요 비율',
  category: '카테고리',
}

function toPercentValue(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n <= 1 ? Math.round(n * 100) : Math.round(n)
}

function normalizeFeatureImportance(items) {
  const source = Array.isArray(items) ? items : []
  const mapped = source.map((item, index) => {
    const rawName = item.feature || item.name || item.key || item.column || `feature_${index + 1}`
    const rawValue = item.value ?? item.importance ?? item.gain ?? item.score ?? item.weight ?? 0
    return {
      feature: featureNameMap[rawName] || rawName,
      value: toPercentValue(rawValue),
    }
  }).filter(item => item.value > 0)

  const total = mapped.reduce((sum, item) => sum + item.value, 0)
  if (!mapped.length || total <= 0) return fallback.featureImportance

  // 값 합이 100을 크게 벗어나면 보기 좋게 100 기준으로 재정규화
  if (total > 0 && (total < 95 || total > 105)) {
    return mapped.map(item => ({
      ...item,
      value: Math.max(1, Math.round((item.value / total) * 100)),
    }))
  }
  return mapped
}

function normalizeVideos(items) {
  const source = Array.isArray(items) ? items : []
  const mapped = source.map((video, index) => {
    const score = Number(video.score ?? video.probability ?? video.prediction_probability ?? 0)
    const duration = Number(video.duration ?? video.duration_h ?? video.trending_duration_h ?? 0)
    const rawPred = String(video.pred ?? video.prediction ?? video.prediction_label ?? '').toLowerCase()
    let pred = 'normal'
    if (rawPred.includes('long') || rawPred.includes('장기') || score >= 0.7) pred = 'long'
    else if (rawPred.includes('short') || rawPred.includes('단기') || score < 0.5) pred = 'short'
    return {
      title: video.title || video.video_title || `Trending Video ${index + 1}`,
      category: video.category || video.category_group || 'Unknown',
      duration: Number.isFinite(duration) && duration > 0 ? duration : fallback.videos[index % fallback.videos.length].duration,
      score: Number.isFinite(score) && score > 0 ? score : fallback.videos[index % fallback.videos.length].score,
      pred,
    }
  })
  return mapped.length ? mapped : fallback.videos
}

function normalizeCategories(items) {
  const source = Array.isArray(items) ? items : []
  const mapped = source.map(item => ({
    category: item.category || item.name || 'Unknown',
    duration: Number(item.duration ?? item.median_duration_h ?? item.avg_duration_h ?? item.duration_h ?? 0),
    score: Number(item.score ?? item.long_rate ?? item.probability ?? 0),
  })).filter(item => item.category && item.duration > 0)
  return mapped.length ? mapped : fallback.categoryDuration
}

function normalizeClusters(items) {
  const source = Array.isArray(items) ? items : []
  const mapped = source.map((cluster, index) => ({
    id: cluster.id || `C${index}`,
    name: cluster.name || cluster.type || `Cluster ${index}`,
    duration: Number(cluster.duration ?? cluster.avg_duration_h ?? 0),
    score: Number(cluster.score ?? cluster.long_rate ?? 0),
    ratio: Number(cluster.ratio ?? cluster.count ?? 0),
    x: Number(cluster.x ?? 20 + index * 18),
    y: Number(cluster.y ?? 70 - index * 10),
  }))
  return mapped.length ? mapped : fallback.clusters
}

function normalizeData(json) {
  if (!json || typeof json !== 'object') return fallback

  const summary = json.summary || {}
  const stats = json.stats || {}
  const dataScale = json.dataScale || json.data_scale || {}

  return {
    ...fallback,
    ...json,
    stats: {
      ...fallback.stats,
      ...stats,
      median: Number(stats.median ?? summary.median_duration_h ?? fallback.stats.median),
      mean: Number(stats.mean ?? summary.mean_duration_h ?? fallback.stats.mean),
    },
    dataScale: {
      ...fallback.dataScale,
      ...dataScale,
      snapshots: Number(dataScale.snapshots ?? summary.snapshots ?? fallback.dataScale.snapshots),
      events: Number(dataScale.events ?? summary.events ?? fallback.dataScale.events),
      videos: Number(dataScale.videos ?? summary.unique_videos ?? fallback.dataScale.videos),
      reentries: Number(dataScale.reentries ?? summary.reentry_events ?? fallback.dataScale.reentries),
    },
    categoryDuration: normalizeCategories(json.categoryDuration || json.category_duration || json.categories),
    featureImportance: normalizeFeatureImportance(json.featureImportance || json.feature_importance || json.features),
    videos: normalizeVideos(json.videos || json.items),
    clusters: normalizeClusters(json.clusters),
  }
}

function BarList({ data, labelKey, valueKey, suffix = '' }) {
  const max = Math.max(...data.map(item => Number(item[valueKey]) || 0), 1)
  return (
    <div className="sustain-bars">
      {data.map((item, idx) => {
        const value = Number(item[valueKey]) || 0
        return (
          <div className="sustain-bar-row" key={`${item[labelKey]}-${idx}`}>
            <span>{item[labelKey]}</span>
            <div className="sustain-bar-track">
              <motion.i
                initial={{ width: 0 }}
                whileInView={{ width: `${(value / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: idx * 0.04 }}
              />
            </div>
            <b>{value}{suffix}</b>
          </div>
        )
      })}
    </div>
  )
}

function ClusterScatter({ clusters }) {
  return (
    <svg className="sustain-scatter" viewBox="0 0 100 100" role="img" aria-label="클러스터링 산점도">
      <line x1="10" y1="88" x2="92" y2="88" />
      <line x1="10" y1="10" x2="10" y2="88" />
      {clusters.map(cluster => (
        <g key={cluster.id}>
          <circle cx={cluster.x} cy={cluster.y} r="5.8" />
          <text x={cluster.x + 5} y={cluster.y - 5}>{cluster.id}</text>
        </g>
      ))}
      <text x="50" y="98" textAnchor="middle">지속성 / 반응 축</text>
    </svg>
  )
}

export default function SustainPage() {
  const [data, setData] = useState(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [category, setCategory] = useState('ALL')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('duration')

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)

    fetch(`${API}/sustain/summary`, { signal: controller.signal })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('API error'))))
      .then(json => {
        if (!cancelled) {
          setData(normalizeData(json))
          setError(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(fallback)
          setError(true)
        }
      })
      .finally(() => {
        clearTimeout(timer)
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [])

  const categories = useMemo(() => {
    const list = new Set(['ALL', ...data.videos.map(video => video.category).filter(Boolean)])
    return Array.from(list)
  }, [data.videos])

  const processedVideos = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.videos
      .filter(video => category === 'ALL' || video.category === category)
      .filter(video => !q || `${video.title} ${video.category}`.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sort === 'score') return Number(b.score || 0) - Number(a.score || 0)
        return Number(b.duration || 0) - Number(a.duration || 0)
      })
  }, [data.videos, category, search, sort])

  const topCategories = useMemo(() => {
    return [...data.categoryDuration]
      .sort((a, b) => Number(b.duration || 0) - Number(a.duration || 0))
      .slice(0, 3)
      .map(item => item.category)
  }, [data.categoryDuration])

  const reentryRatio = Math.round((data.dataScale.reentries / Math.max(data.dataScale.events, 1)) * 100)

  const downloadCSV = () => {
    const header = ['title', 'category', 'duration_h', 'prediction_score', 'prediction']
    const rows = processedVideos.map(video => [
      `"${String(video.title || '').replaceAll('"', '""')}"`,
      video.category,
      video.duration,
      video.score,
      video.pred,
    ].join(','))
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sustain_analysis.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="sustain-page-reset">
      <section className="sustain-hero-reset">
        <div>
          <span className="sustain-label">Durability Analysis</span>
          <h1>지속성 분석</h1>
          <p>트렌딩 이벤트가 얼마나 오래 유지되는지, 카테고리별 차이와 XGBoost 예측 신호를 함께 확인합니다.</p>
          <div className={`sustain-status ${error ? 'warn' : 'ok'}`}>
            {loading ? '데이터 준비 중...' : error ? 'API 연결 실패 · fallback 데이터 표시 중' : 'API 연결됨'}
          </div>
        </div>
        <button type="button" onClick={() => window.print()}>PDF 요약</button>
      </section>


      <section className="sustain-grid-reset">
        <article className="sustain-card-reset">
          <div className="sustain-card-head"><span>Category EDA</span><h2>카테고리별 지속 시간</h2></div>
          <BarList data={data.categoryDuration} labelKey="category" valueKey="duration" suffix="h" />
        </article>
        <article className="sustain-card-reset">
          <div className="sustain-card-head"><span>XGBoost</span><h2>Feature Importance</h2></div>
          <BarList data={data.featureImportance} labelKey="feature" valueKey="value" suffix="%" />
          <p className="sustain-insight">조회수 증가율과 초기 반응 지표가 지속성 예측에 가장 큰 영향을 미칩니다.</p>
        </article>
      </section>

      <section className="sustain-grid-reset">
        <article className="sustain-card-reset">
          <div className="sustain-card-head"><span>K-Means</span><h2>클러스터링 시각화</h2></div>
          <ClusterScatter clusters={data.clusters} />
        </article>
        <article className="sustain-card-reset">
          <div className="sustain-card-head"><span>Strategy</span><h2>광고 추천 카테고리 TOP 3</h2></div>
          <div className="sustain-final-card">{topCategories.join(' · ')}</div>
          <p className="sustain-insight">지속 시간이 긴 카테고리는 광고 집행 후 잔존 효과가 길 가능성이 높습니다.</p>
        </article>
      </section>

      <section className="sustain-card-reset sustain-table-card">
        <div className="sustain-card-head"><span>Video Table</span><h2>상세 영상 테이블</h2></div>
        <div className="sustain-toolbar">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="영상 검색 (제목 / 카테고리)" />
          <select value={category} onChange={event => setCategory(event.target.value)}>
            {categories.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={sort} onChange={event => setSort(event.target.value)}>
            <option value="duration">지속시간 순</option>
            <option value="score">예측 확률 순</option>
          </select>
          <button type="button" onClick={downloadCSV}>CSV 다운로드</button>
        </div>
        <div className="sustain-table-wrap">
          <table className="sustain-video-table">
            <thead>
              <tr><th>제목</th><th>카테고리</th><th>지속시간</th><th>예측 확률</th><th>등급</th></tr>
            </thead>
            <tbody>
              {processedVideos.slice(0, 20).map((video, index) => (
                <tr key={`${video.title}-${index}`}>
                  <td>{video.title}</td>
                  <td>{video.category}</td>
                  <td>{video.duration}h</td>
                  <td>{((Number(video.score) || 0) * 100).toFixed(1)}%</td>
                  <td><span className={`sustain-badge ${video.pred}`}>{video.pred === 'long' ? '장기' : video.pred === 'short' ? '단기' : '일반'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}