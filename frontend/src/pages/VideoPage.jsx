import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import '../styles/VideoPage.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
const CACHE_TTL_MS = 5 * 60 * 1000
const AUTO_REFRESH_MS = 20 * 1000
const CACHE_VERSION = 'live-latest-video-async-ai-v4'
const PAGE_SIZE = 24
const MAX_FETCH_RESULTS = 50
const CATEGORY_PREF_KEY = 'trendit:youtube-category-clicks'

const cacheKey = (key) => `yta:${CACHE_VERSION}:${API_BASE}:${key}`

const readCache = (key) => {
  try {
    const raw = localStorage.getItem(cacheKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.time || Date.now() - parsed.time > CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

const writeCache = (key, data) => {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify({ time: Date.now(), data }))
  } catch {
    // localStorage 용량 초과 등은 화면 동작에 영향 없도록 무시
  }
}

const readCategoryPrefs = () => {
  try {
    return JSON.parse(localStorage.getItem(CATEGORY_PREF_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

const bumpCategoryPref = (key) => {
  try {
    const prefs = readCategoryPrefs()
    prefs[key] = Number(prefs[key] || 0) + 1
    localStorage.setItem(CATEGORY_PREF_KEY, JSON.stringify(prefs))
  } catch {
    // 개인화 저장 실패는 무시
  }
}


const videoKey = (video) => String(video?.video_id || video?.id || video?.videoId || '')


const getBestThumbnail = (video) => {
  const id = videoKey(video)
  if (id) return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
  return video?.thumbnail || video?.thumbnail_fallback || ''
}

const handleThumbnailFallback = (event, video) => {
  const id = videoKey(video)
  const fallback = video?.thumbnail_fallback || (id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '')
  if (fallback && event.currentTarget.src !== fallback) {
    event.currentTarget.src = fallback
  }
}

const sortVideos = (videos = [], order = 'relevance') => {
  const unique = Array.from(new Map((videos || []).map(v => [videoKey(v), v]).filter(([id]) => id)).values())
  if (order === 'date') {
    return unique.sort((a, b) => String(b.publishedAt || b.published_at || '').localeCompare(String(a.publishedAt || a.published_at || '')))
  }
  if (order === 'viewCount') {
    return unique.sort((a, b) => Number(b.views || b.view_count || 0) - Number(a.views || a.view_count || 0))
  }
  return unique
}

const flattenGroups = (groups = {}) => {
  const seen = new Set()
  return Object.values(groups || {}).flat().filter((video) => {
    const id = videoKey(video)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

const normalizePredictionItems = (payload) => {
  if (!payload) return []
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload.items)) return payload.items
  if (Array.isArray(payload.predictions)) return payload.predictions
  if (payload.predictions && typeof payload.predictions === 'object') {
    return Object.entries(payload.predictions).map(([id, prediction]) => ({ video_id: id, prediction }))
  }
  if (payload.results && typeof payload.results === 'object') {
    return Object.entries(payload.results).map(([id, prediction]) => ({ video_id: id, prediction }))
  }
  return []
}

const mergePredictionsIntoGroups = (groups = {}, predictionPayload) => {
  const items = normalizePredictionItems(predictionPayload)
  const predMap = new Map()
  items.forEach((item) => {
    const id = String(item?.video_id || item?.id || item?.videoId || item?.video?.video_id || '')
    const prediction = item?.prediction || item?.pred || item
    if (id && prediction) predMap.set(id, prediction)
  })

  const nextGroups = {}
  Object.entries(groups || {}).forEach(([key, list]) => {
    nextGroups[key] = (list || []).map((video) => {
      const id = videoKey(video)
      const prediction = predMap.get(id)
      return prediction ? { ...video, prediction: { ...(video.prediction || {}), ...prediction } } : video
    })
  })
  return nextGroups
}

const fetchBulkPredictions = async (videos = []) => {
  const slimVideos = videos.slice(0, 100).map((v, idx) => ({
    video_id: v.video_id || v.id || v.videoId,
    id: v.video_id || v.id || v.videoId,
    title: v.title,
    category_id: v.category_id ?? v.categoryId,
    category_group: v.category_group || v.category,
    views: Number(v.views ?? v.view_count ?? v.viewCount ?? 0),
    likes: Number(v.likes ?? v.like_count ?? v.likeCount ?? 0),
    comments: Number(v.comments ?? v.comment_count ?? v.commentCount ?? 0),
    publishedAt: v.publishedAt || v.published_at,
    entry_rank: v.entry_rank ?? v.rank ?? idx + 1,
  })).filter(v => v.video_id)

  if (!slimVideos.length) return { items: [] }

  return fetchJSON(`${API_BASE}/predict/bulk`, 12000, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videos: slimVideos }),
  })
}

const fetchJSON = async (url, timeoutMs = 6500, options = {}) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store', ...options })
    if (!res.ok) throw new Error(`API ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const CATEGORIES = [
  { key: 'all', label: '전체', shortLabel: '전체', desc: '전체 트렌딩', icon: '✦', categoryIds: [0] },
  { key: 'entertainment', label: 'Entertainment', shortLabel: '엔터', desc: '엔터·스포츠·게임·영화·코미디', icon: '🎬', categoryIds: [24, 17, 20, 1, 23] },
  { key: 'music', label: 'Music', shortLabel: '뮤직', desc: '음악·뮤직비디오', icon: '🎧', categoryIds: [10] },
  { key: 'lifestyle', label: 'Lifestyle', shortLabel: '라이프', desc: '여행·동물·자동차·브이로그', icon: '🌿', categoryIds: [19, 15, 2, 22, 26] },
  { key: 'education', label: '교육·과학기술', shortLabel: '교육', desc: '교육·과학기술 트렌딩', icon: '📚', categoryIds: [27, 28] },
  { key: 'news', label: 'News', shortLabel: '뉴스', desc: '뉴스·정치/사회', icon: '📰', categoryIds: [25, 29] },
]


const CATEGORY_FEED_TITLES = {
  entertainment: 'Entertainment 트렌딩',
  music: 'Music 트렌딩',
  lifestyle: 'Lifestyle 트렌딩',
  education: '교육·과학기술 트렌딩',
  news: 'News 트렌딩',
}

const CATEGORY_LABELS = CATEGORIES.reduce((acc, cur) => {
  cur.categoryIds.forEach(id => { acc[String(id)] = cur.label })
  return acc
}, {})

const formatNumber = (value) => {
  const n = Number(value || 0)
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`
  return n.toLocaleString()
}

const getCategoryLabel = (video) => {
  const id = String(video?.category_id ?? video?.categoryId ?? '0')
  return video?.category_group || video?.category || CATEGORY_LABELS[id] || '기타'
}

const getPrediction = (video) => video?.prediction || {}

const getPredictionScore = (video) => {
  const prediction = getPrediction(video)
  const candidates = [
    prediction.ai_score,
    prediction.score,
    prediction.tdi_probability != null ? Number(prediction.tdi_probability) * 100 : null,
    video?.ai_score,
    video?.score,
    video?.surge_score,
  ]
  const value = candidates.find((v) => Number.isFinite(Number(v)))
  return Math.round(Math.min(100, Math.max(0, Number(value) || 0)))
}

const getModelLabel = (video) => {
  const prediction = getPrediction(video)
  const modelType = String(prediction.model_type || video?.model_type || '').toLowerCase()
  if (modelType === 'xgboost') return 'XGBoost 예측'
  if (modelType.includes('linear')) return 'Linear Regression 예측'
  return 'XGBoost 연결 대기 · Rule fallback'
}

const isXGBoostPrediction = (video) => String(getPrediction(video).model_type || video?.model_type || '').toLowerCase() === 'xgboost'


const getInsightText = (video) => {
  const score = getPredictionScore(video)
  const category = getCategoryLabel(video)
  const prediction = getPrediction(video)
  const growth = Number(prediction.predicted_growth ?? video?.view_growth_24h ?? 0)

  if (score >= 82) {
    return `AI가 ${category} 카테고리 내 장기 확산 가능성을 높게 판단했습니다. 초기 반응과 24h 성장 신호가 강한 영상입니다.`
  }
  if (score >= 64) {
    return `중기 유지 가능성이 있습니다. 조회수 증가세가 이어지면 추천 피드에서 추가 확산될 수 있습니다.`
  }
  if (score >= 42) {
    return `안정적인 반응은 있으나 폭발형보다는 관찰형입니다. 카테고리 평균 대비 성장률을 함께 확인하는 것이 좋습니다.`
  }
  return `초기 반응이 약해 빠르게 이탈할 가능성이 있습니다. 제목, 썸네일, 댓글 반응을 우선 점검하세요.`
}

const getStrategyText = (video) => {
  const score = getPredictionScore(video)
  const prediction = getPrediction(video)
  const predicted24h = Number(prediction.predicted_24h_views || video?.view_at_24h || video?.views || 0)
  const views = Number(video?.views || 0)
  const lift = predicted24h > views ? ((predicted24h - views) / Math.max(views, 1)) * 100 : 0

  if (score >= 82) return `전략: 메인 추천 후보로 우선 노출. 예상 24h 상승률 ${lift.toFixed(1)}% 구간.`
  if (score >= 64) return `전략: 6~12시간 추이를 추가 확인하고, 상승세 유지 시 추천 카드에 배치.`
  if (score >= 42) return `전략: 조회수보다 참여율을 보고 유지 가능성을 판단.`
  return `전략: 단기 이슈성 영상으로 분류하고 후속 추천 우선순위는 낮게 설정.`
}


const getReasonTags = (video) => {
  const score = getPredictionScore(video)
  const views = Number(video?.views || 0)
  const likes = Number(video?.likes || 0)
  const comments = Number(video?.comments || 0)
  const prediction = getPrediction(video)
  const predicted24h = Number(prediction.predicted_24h_views || video?.view_at_24h || views)
  const growth = Math.max(0, predicted24h - views)
  const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0
  const growthRate = views > 0 ? (growth / views) * 100 : 0

  const tags = []
  if (score >= 80) tags.push({ label: 'AI 고확률', text: 'AI가 장기 확산 가능성을 높게 판단했습니다.' })
  else if (score >= 60) tags.push({ label: 'AI 중상위', text: '추가 반응에 따라 중기 유지 가능성이 있습니다.' })
  else tags.push({ label: 'AI 관찰', text: '초기 반응 확인이 필요한 영상입니다.' })

  if (growthRate >= 60) tags.push({ label: '24h 성장', text: `예상 24h 성장률이 ${growthRate.toFixed(1)}%로 높습니다.` })
  else if (growthRate >= 25) tags.push({ label: '완만한 상승', text: `예상 24h 성장률이 ${growthRate.toFixed(1)}% 수준입니다.` })

  if (engagement >= 1.5) tags.push({ label: '참여율 강함', text: `좋아요·댓글 참여율이 ${engagement.toFixed(2)}%로 높습니다.` })
  else if (comments >= 1000) tags.push({ label: '댓글 반응', text: '댓글 반응이 많아 후속 확산 가능성이 있습니다.' })

  if (views < 500000 && score >= 70) tags.push({ label: '숨은 성장 후보', text: '조회수 대비 AI 예측 점수가 높아 추가 노출 후보입니다.' })
  if (views >= 3000000 && score < 55) tags.push({ label: '단기 이슈 주의', text: '조회수는 높지만 AI 점수는 낮아 빠른 이탈 가능성이 있습니다.' })

  return tags.slice(0, 4)
}

const getViewAiSummary = (videos) => {
  const unique = Array.from(new Map((videos || []).map(v => [v.video_id, v])).values())
  if (!unique.length) return { hidden: 0, shortBuzz: 0 }
  const hidden = unique.filter(v => Number(v.views || 0) < 500000 && getPredictionScore(v) >= 70).length
  const shortBuzz = unique.filter(v => Number(v.views || 0) >= 3000000 && getPredictionScore(v) < 55).length
  return { hidden, shortBuzz }
}

function AnimatedNumber({ value }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const target = Number(value || 0)
    let frame = 0
    const totalFrames = 32
    const start = display
    const diff = target - start

    const timer = setInterval(() => {
      frame += 1
      const progress = Math.min(frame / totalFrames, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + diff * eased))
      if (progress >= 1) clearInterval(timer)
    }, 18)

    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return <>{formatNumber(display)}</>
}

function getGrowthSeries(video) {
  const prediction = getPrediction(video)
  const score = getPredictionScore(video)
  const base = Math.max(0, Number(video?.t0_view || video?.views || 0))

  if (Array.isArray(video?.growth) && video.growth.length) {
    const raw = video.growth.map((d) => ({ label: d.time || d.label, value: Number(d.views ?? d.value ?? 0) }))
    const first = Number(raw[0]?.value || base || 0)
    const last = Number(raw[raw.length - 1]?.value || 0)

    // 실제 growth 값이 모두 같으면 AI 예측 점수로 위로 올라가는 곡선을 만들어 보여줍니다.
    if (last > first) return raw
  }

  const predictedRaw = Number(prediction.predicted_24h_views || video?.view_at_24h || 0)
  const scoreBoost = 0.16 + (score / 100) * 0.92
  const estimatedEnd = Math.round(base * (1 + scoreBoost))
  const end = predictedRaw > base ? Math.max(predictedRaw, estimatedEnd) : Math.max(base + 1, estimatedEnd)

  // 예전처럼 오른쪽 위로 상승하는 선형 그래프를 유지합니다.
  const curve = [0, 0.16, 0.39, 0.68, 1]
  return ['T0', '6h', '12h', '18h', '24h'].map((label, idx) => ({
    label,
    value: Math.round(base + (end - base) * curve[idx]),
  }))
}

function GrowthChart({ video }) {
  const data = getGrowthSeries(video)
  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values, 1)
  const range = Math.max(max - min, 1)
  const width = 360
  const height = 180
  const padX = 22
  const padTop = 18
  const padBottom = 34
  const plotW = width - padX * 2
  const plotH = height - padTop - padBottom

  const toX = (i) => padX + i * (plotW / Math.max(data.length - 1, 1))
  const toY = (value) => padTop + (1 - ((value - min) / range)) * plotH
  const points = data.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ')
  const areaPoints = `${padX},${height - padBottom} ${points} ${width - padX},${height - padBottom}`

  return (
    <div className="growth-panel glass-panel">
      <div className="section-head compact">
        <div>
          <p className="eyebrow">AI Growth Forecast</p>
          <h3>AI 예측 24시간 조회수 선그래프</h3>
        </div>
        <span className="mini-badge xgb-badge">AI</span>
      </div>

      <div className="growth-line-wrap">
        <svg className="growth-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="AI 예측 24시간 조회수 선그래프">
          <defs>
            <linearGradient id="growthLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff0033" />
              <stop offset="100%" stopColor="#2563eb" />
            </linearGradient>
            <linearGradient id="growthArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff0033" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0, 1, 2].map((line) => {
            const y = padTop + (plotH / 2) * line
            return <line key={line} x1={padX} x2={width - padX} y1={y} y2={y} className="growth-grid-line" />
          })}

          <polygon points={areaPoints} fill="url(#growthArea)" />
          <polyline points={points} fill="none" stroke="url(#growthLine)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

          {data.map((d, i) => (
            <g key={d.label}>
              <circle cx={toX(i)} cy={toY(d.value)} r="6.5" className="chart-dot-outer" />
              <circle cx={toX(i)} cy={toY(d.value)} r="4" className="chart-dot-inner" />
              <text x={toX(i)} y={height - 10} textAnchor="middle" className="growth-axis-label">{d.label}</text>
            </g>
          ))}
        </svg>
      </div>

      <div className="growth-labels">
        {data.map(d => (
          <div key={d.label}>
            <span>{d.label}</span>
            <strong>{formatNumber(d.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function AiInsight({ video }) {
  const views = Number(video?.views || 0)
  const likes = Number(video?.likes || 0)
  const comments = Number(video?.comments || 0)
  const prediction = getPrediction(video)

  const predicted24h = Number(prediction.predicted_24h_views || prediction.actual_24h_views || video?.view_at_24h || views)
  const growth = Number(prediction.predicted_growth ?? prediction.actual_growth ?? video?.view_growth_24h ?? Math.max(predicted24h - views, 0))
  const engagement = views > 0 ? ((likes + comments) / views) * 100 : 0

  // 예측점수는 백엔드 XGBoost의 ai_score/tdi_probability를 우선 사용합니다.
  // 모델 파일이 없거나 예측 실패 시에만 Rule fallback 점수가 들어갑니다.
  const score = getPredictionScore(video)
  const modelLabel = getModelLabel(video)

  const label = score >= 82
    ? '급상승 가능성 높음'
    : score >= 64
      ? '성장 추세 관찰'
      : score >= 42
        ? '안정적 확산 구간'
        : '초기 반응 확인 필요'

  return (
    <div className="ai-panel glass-panel">
      <div className="section-head compact">
        <div>
          <p className="eyebrow">AI Signal · {modelLabel}</p>
          <h3>AI 예측 점수</h3>
        </div>
        <span className="ai-score">{score}</span>
      </div>
      <p className="ai-copy">{label}</p>
      <p className="ai-auto-insight">{getInsightText(video)}</p>
      <div className="reason-chip-list">
        {getReasonTags(video).map(reason => (
          <span key={reason.label} title={reason.text}>
            <b>{reason.label}</b>
            <small>{reason.text}</small>
          </span>
        ))}
      </div>
      <div className="ai-meter"><span style={{ width: `${score}%` }} /></div>
      <div className="ai-stats">
        <span>참여율 {engagement.toFixed(2)}%</span>
        <span>AI 예측 24h {formatNumber(predicted24h)}</span>
        <span>성장 {formatNumber(growth)}</span>
      </div>
      <div className="ai-strategy-line">{getStrategyText(video)}</div>
    </div>
  )
}

function VideoCard({ video, active, onSelect }) {
  const [hover, setHover] = useState(false)
  const categoryLabel = getCategoryLabel(video)

  return (
    <button
      className={`nf-card ${active ? 'active' : ''}`}
      onClick={() => onSelect(video)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      type="button"
    >
      <div className="nf-thumb-wrap">
        {hover ? (
          <iframe
            className="nf-preview"
            src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1&mute=1&controls=0&playsinline=1&loop=1&playlist=${video.video_id}`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture"
            loading="lazy"
          />
        ) : (
          <img className="nf-thumb" src={getBestThumbnail(video)} onError={(e) => handleThumbnailFallback(e, video)} alt={video.title} loading="lazy" />
        )}
        <span className="surge-pill">AI 예측 {getPredictionScore(video)}</span>
        <span className="category-pill">{categoryLabel}</span>
      </div>
      <div className="nf-info">
        <strong>{video.title}</strong>
        <span>{video.channel || video.channel_title || 'YouTube'}</span>
        <p>조회수 <AnimatedNumber value={video.views} /></p>
      </div>
    </button>
  )
}


function RecommendationPanel({ videos, selected, onSelect }) {
  const recommended = useMemo(() => {
    const unique = Array.from(new Map((videos || []).map(v => [v.video_id, v])).values())
    return unique
      .sort((a, b) => getPredictionScore(b) - getPredictionScore(a))
      .slice(0, 5)
  }, [videos])

  const hiddenGems = useMemo(() => {
    const unique = Array.from(new Map((videos || []).map(v => [v.video_id, v])).values())
    return unique
      .filter(v => getPredictionScore(v) >= 65)
      .sort((a, b) => (Number(a.views || 0) - Number(b.views || 0)))
      .slice(0, 3)
  }, [videos])

  if (!recommended.length) return null

  return (
    <section className="ai-recommend-section glass-panel">
      <div className="section-head compact">
        <div>
          <p className="eyebrow">AI Recommendation</p>
          <h3>AI 추천 영상 TOP 5</h3>
        </div>
        <span className="mini-badge xgb-badge">AI 예측 점수 기준</span>
      </div>
      <div className="recommend-grid">
        {recommended.map((v, idx) => (
          <button
            type="button"
            className={`recommend-card ${selected?.video_id === v.video_id ? 'active' : ''}`}
            key={`rec-${v.video_id}`}
            onClick={() => onSelect(v)}
          >
            <span className="recommend-rank">{idx + 1}</span>
            <img src={getBestThumbnail(v)} onError={(e) => handleThumbnailFallback(e, v)} alt={v.title} loading="lazy" />
            <div>
              <strong>{v.title}</strong>
              <small>{getCategoryLabel(v)} · AI {getPredictionScore(v)}</small>
            </div>
          </button>
        ))}
      </div>

      {!!hiddenGems.length && (
        <div className="hidden-gem-box">
          <strong>숨은 성장 후보</strong>
          <p>조회수는 아직 낮지만 AI 예측 점수가 높은 영상입니다.</p>
          <div className="hidden-gem-list">
            {hiddenGems.map(v => (
              <button type="button" key={`gem-${v.video_id}`} onClick={() => onSelect(v)}>
                {v.title}<span>AI {getPredictionScore(v)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}


function ViewAiScatter({ videos, selected, onSelect }) {
  const points = useMemo(() => {
    const unique = Array.from(new Map((videos || []).map(v => [v.video_id, v])).values())
    return unique
      .filter(v => Number(v.views || 0) > 0)
      .sort((a, b) => getPredictionScore(b) - getPredictionScore(a))
      .slice(0, MAX_FETCH_RESULTS)
  }, [videos])

  if (!points.length) return null

  const width = 620
  const height = 320
  const padLeft = 54
  const padRight = 28
  const padTop = 26
  const padBottom = 48
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom
  const maxViews = Math.max(...points.map(v => Number(v.views || 0)), 1)
  const toX = (views) => padLeft + (Number(views || 0) / maxViews) * plotW
  const toY = (score) => padTop + (1 - (getPredictionScore(score) / 100)) * plotH
  const summary = getViewAiSummary(points)

  return (
    <section className="view-ai-section glass-panel">
      <div className="section-head compact">
        <div>
          <p className="eyebrow">AI Explainability</p>
          <h3>조회수 vs AI 예측 점수</h3>
        </div>
        <span className="mini-badge xgb-badge">숨은 성장 후보 탐색</span>
      </div>
      <div className="view-ai-body">
        <div className="scatter-wrap">
          <svg viewBox={`0 0 ${width} ${height}`} className="scatter-svg" role="img" aria-label="조회수와 AI 예측 점수 산점도">
            <defs>
              <linearGradient id="scatterPointGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff0033" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            {[0, 25, 50, 75, 100].map(score => {
              const y = padTop + (1 - score / 100) * plotH
              return (
                <g key={`y-${score}`}>
                  <line x1={padLeft} x2={width - padRight} y1={y} y2={y} className="scatter-grid" />
                  <text x={padLeft - 12} y={y + 4} textAnchor="end" className="scatter-label">{score}</text>
                </g>
              )
            })}
            {[0, 0.5, 1].map(ratio => {
              const x = padLeft + ratio * plotW
              const label = ratio === 0 ? '0' : formatNumber(maxViews * ratio)
              return (
                <g key={`x-${ratio}`}>
                  <line x1={x} x2={x} y1={padTop} y2={height - padBottom} className="scatter-grid faint" />
                  <text x={x} y={height - 18} textAnchor="middle" className="scatter-label">{label}</text>
                </g>
              )
            })}
            <line x1={padLeft} x2={width - padRight} y1={height - padBottom} y2={height - padBottom} className="scatter-axis" />
            <line x1={padLeft} x2={padLeft} y1={padTop} y2={height - padBottom} className="scatter-axis" />
            <text x={width / 2} y={height - 2} textAnchor="middle" className="scatter-axis-title">조회수</text>
            <text x="16" y={height / 2} textAnchor="middle" className="scatter-axis-title rotate">AI 점수</text>

            {points.map(v => {
              const x = toX(v.views)
              const y = padTop + (1 - getPredictionScore(v) / 100) * plotH
              const active = selected?.video_id === v.video_id
              return (
                <g key={`scatter-${v.video_id}`} className={`scatter-point ${active ? 'active' : ''}`} onClick={() => onSelect(v)}>
                  <circle cx={x} cy={y} r={active ? 9 : 6} />
                  <title>{v.title} · 조회수 ${formatNumber(v.views)} · AI ${getPredictionScore(v)}</title>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="scatter-insight-card">
          <strong>그래프 해석</strong>
          <p><b>오른쪽 위</b>: 조회수와 AI 점수가 모두 높은 핵심 추천 후보</p>
          <p><b>왼쪽 위</b>: 조회수는 낮지만 AI 점수가 높은 숨은 성장 후보</p>
          <p><b>오른쪽 아래</b>: 조회수는 높지만 단기 이슈 가능성이 있는 영상</p>
          <div className="scatter-summary">
            <span>숨은 성장 후보 <b>{summary.hidden}</b></span>
            <span>단기 이슈 주의 <b>{summary.shortBuzz}</b></span>
          </div>
        </div>
      </div>
    </section>
  )
}

function VideoRow({ title, videos, selected, onSelect, loading }) {
  if (loading) {
    return (
      <section className="netflix-row-section">
        <div className="section-head"><div><p className="eyebrow">Category Feed</p><h2>{title}</h2></div></div>
        <div className="nf-row">{Array.from({ length: 8 }).map((_, idx) => <div className="nf-skeleton" key={idx} />)}</div>
      </section>
    )
  }

  if (!videos?.length) return null

  return (
    <section className="netflix-row-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Category Feed</p>
          <h2>{title}</h2>
        </div>
        <span>{videos.length} videos</span>
      </div>
      <div className="nf-row">
        {videos.map(video => (
          <VideoCard
            key={`${title}-${video.video_id}`}
            video={video}
            active={selected?.video_id === video.video_id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}

export default function VideoPage() {
  const [categoryData, setCategoryData] = useState({})
  const [selected, setSelected] = useState(null)
  const [category, setCategory] = useState('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [sortOrder, setSortOrder] = useState('relevance')
  const [categoryPrefs, setCategoryPrefs] = useState(() => readCategoryPrefs())
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const [apiSource, setApiSource] = useState('연결 확인 중')
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')
  const [dataVersion, setDataVersion] = useState(0)
  const categoryRef = useRef(category)

  const hydratePredictions = async (groups, sourceLabel = '') => {
    const videos = flattenGroups(groups)
    if (!videos.length) return

    const missing = videos.filter(v => !Number.isFinite(Number(v?.prediction?.ai_score)))
    if (!missing.length) return

    setPredictionLoading(true)
    try {
      const predictionPayload = await fetchBulkPredictions(videos)
      const merged = mergePredictionsIntoGroups(groups, predictionPayload)
      setCategoryData(prev => ({ ...prev, ...merged }))
      setSelected(prev => {
        if (!prev) return prev
        const currentKey = categoryRef.current
        const currentList = merged[currentKey] || merged.all || flattenGroups(merged)
        return currentList.find(v => videoKey(v) === videoKey(prev)) || prev
      })
      writeCache(`youtube-live-bulk-v1-${sortOrder}`, {
        groups: merged,
        source_label: sourceLabel || 'YouTube API + XGBoost 예측',
        refreshed_at: new Date().toISOString(),
      })
      Object.entries(merged).forEach(([key, value]) => writeCache(`youtube-${key}`, value))
      setApiSource(sourceLabel ? `${sourceLabel} · AI 점수 반영` : '영상 최신화 · AI 점수 반영')
      setDataVersion(v => v + 1)
    } catch (e) {
      setApiSource(sourceLabel ? `${sourceLabel} · AI 점수 지연` : '영상 최신화 · AI 점수 지연')
    } finally {
      setPredictionLoading(false)
    }
  }

  const loadBulkTrending = async (force = false, silent = false) => {
    const cache = !force ? readCache(`youtube-live-bulk-v1-${sortOrder}`) : null
    if (cache?.groups) {
      setCategoryData(cache.groups)
      setSelected(prev => prev || cache.groups[categoryRef.current]?.[0] || cache.groups.all?.[0] || null)
      setApiSource(`${cache.source_label || '브라우저 캐시'} · 즉시 표시`)
      setLastUpdated(cache.refreshed_at || new Date().toISOString())
      setLoading(false)
      setRefreshing(false)
      setAutoRefreshing(false)
      hydratePredictions(cache.groups, cache.source_label || '브라우저 캐시')
      return true
    }

    if (silent) setAutoRefreshing(true)
    else setRefreshing(true)
    setError('')
    try {
      const payload = await fetchJSON(`${API_BASE}/youtube/live/bulk?region_code=KR&max_results=${MAX_FETCH_RESULTS}&order=${sortOrder}&include_predictions=false${force ? '&refresh=true' : ''}&_=${force ? Date.now() : 'cache'}`, force ? 22000 : 9000)
      if (payload?.groups) {
        setCategoryData(payload.groups)
        setDataVersion(v => v + 1)
        setSelected(prev => {
          const currentKey = categoryRef.current
          const currentList = payload.groups[currentKey] || payload.groups.all || []
          if (prev?.video_id) {
            return currentList.find(v => v.video_id === prev.video_id) || prev
          }
          return currentList[0] || payload.groups.all?.[0] || null
        })
        if (!silent) setPlaying(false)
        writeCache(`youtube-live-bulk-v1-${sortOrder}`, payload)
        Object.entries(payload.groups).forEach(([key, value]) => writeCache(`youtube-${key}`, value))
        setApiSource(payload.source_label || (force ? 'YouTube API 최신 호출' : 'YouTube API 캐시 · 즉시 표시'))
        setLastUpdated(payload.refreshed_at || new Date().toISOString())
        setLoading(false)
        hydratePredictions(payload.groups, payload.source_label || 'YouTube API 최신 영상')
        return true
      }
    } catch (e) {
      const stale = readCache(`youtube-live-bulk-v1-${sortOrder}`)
      if (stale?.groups) {
        setCategoryData(stale.groups)
        setSelected(prev => prev || stale.groups[categoryRef.current]?.[0] || stale.groups.all?.[0] || null)
        setApiSource('이전 캐시 데이터 · API 지연')
        setLastUpdated(stale.refreshed_at || '')
        setLoading(false)
        return true
      }
      // bulk 엔드포인트가 아직 없으면 기존 단일 API로 자동 fallback
    } finally {
      setRefreshing(false)
      setAutoRefreshing(false)
    }
    return false
  }

  const fetchCategory = async (cat, silent = false, force = false) => {
    const cachedMemory = categoryData[cat.key]
    if (!force && cachedMemory?.length) {
      if (!silent) {
        setSelected(cachedMemory[0] || null)
        setPlaying(false)
        setLoading(false)
        setApiSource('브라우저 메모리 캐시 · 즉시 표시')
      }
      return cachedMemory
    }

    const localKey = `youtube-${cat.key}`
    const cachedLocal = !force ? readCache(localKey) : null
    if (cachedLocal?.length) {
      setCategoryData(prev => ({ ...prev, [cat.key]: cachedLocal }))
      if (!silent) {
        setSelected(cachedLocal[0] || null)
        setPlaying(false)
        setLoading(false)
        setApiSource('브라우저 캐시 · 즉시 표시')
      }
      return cachedLocal
    }

    const ids = cat.categoryIds?.length ? cat.categoryIds : [0]
    const maxPerCategory = cat.key === 'all' ? MAX_FETCH_RESULTS : Math.max(6, Math.ceil(MAX_FETCH_RESULTS / ids.length))
    const urls = ids.map(id => `${API_BASE}/youtube/trending?region_code=KR&max_results=${maxPerCategory}&category_id=${id}&include_predictions=false`)
    if (!silent) {
      setLoading(true)
      setRefreshing(true)
      setError('')
      setApiSource('API 요청 중')
    }
    try {
      const payloads = await Promise.all(urls.map(async (url) => fetchJSON(`${url}${url.includes('?') ? '&' : '?'}_=${force ? Date.now() : 'cache'}`, force ? 18000 : 9000)))
      const list = payloads
        .flatMap(payload => Array.isArray(payload) ? payload : (payload.items || payload.videos || []))
        .map(video => ({ ...video, category_group: cat.key === 'all' ? getCategoryLabel(video) : cat.label }))
      const unique = Array.from(new Map(list.map(v => [v.video_id, v])).values())
        .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
        .slice(0, MAX_FETCH_RESULTS)
      setCategoryData(prev => ({ ...prev, [cat.key]: unique }))
      setDataVersion(v => v + 1)
      writeCache(localKey, unique)
      hydratePredictions({ [cat.key]: unique, all: cat.key === 'all' ? unique : (categoryData.all || []) }, 'YouTube API 최신 영상')
      const firstSource = unique?.[0]?.source
      if (!silent) setApiSource(firstSource === 'youtube_api' ? 'YouTube API 실시간' : firstSource === 'parquet_fallback' ? 'Parquet 백업 데이터' : firstSource === 'static_fallback' ? '정적 백업 데이터' : 'API 데이터')
      if (!silent) {
        setSelected(unique[0] || null)
        setPlaying(false)
        const firstPayload = payloads[0] || {}
        if (firstPayload.source === 'fallback' || firstPayload.warning) setError(firstPayload.warning || 'API fallback 데이터를 사용 중입니다.')
      }
      return unique
    } catch (e) {
      if (!silent) {
        setSelected(null)
        setError('영상 데이터를 불러오지 못했습니다. 백엔드 서버를 확인하세요.')
      }
      return []
    } finally {
      if (!silent) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  useEffect(() => {
    categoryRef.current = category
  }, [category])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [category, sortOrder])

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 220) {
        setVisibleCount(v => v + PAGE_SIZE)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const current = CATEGORIES.find(c => c.key === category) || CATEGORIES[0]

    if (category === 'all') {
      // 1) 캐시/메모리 데이터는 즉시 표시해서 첫 화면을 빠르게 띄웁니다.
      // 2) 이어서 refresh=true로 최신 YouTube 데이터를 백그라운드에서 바로 동기화합니다.
      loadBulkTrending(false).then((ok) => {
        if (!ok) fetchCategory(current)
        loadBulkTrending(true, true)
      })
      return
    }

    fetchCategory(current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadBulkTrending(true, true)
      }
    }, AUTO_REFRESH_MS)

    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeVideos = useMemo(() => sortVideos(categoryData[category] || [], sortOrder), [categoryData, category, sortOrder])
  const visibleActiveVideos = useMemo(() => activeVideos.slice(0, visibleCount), [activeVideos, visibleCount])
  const hasMoreActiveVideos = activeVideos.length > visibleCount

  const syncState = useMemo(() => {
    if (refreshing || autoRefreshing) {
      return { key: 'syncing', label: '최신화 중', icon: '🟡' }
    }
    if (predictionLoading) {
      return { key: 'predicting', label: 'AI 점수 계산 중', icon: '🟣' }
    }
    const sourceText = String(apiSource || '')
    if (sourceText.includes('캐시') || sourceText.includes('fallback') || sourceText.includes('백업') || sourceText.includes('지연')) {
      return { key: 'cache', label: '캐시 표시', icon: '🔵' }
    }
    return { key: 'fresh', label: '최신 반영', icon: '🟢' }
  }, [refreshing, autoRefreshing, predictionLoading, apiSource])

  const allVideos = useMemo(() => {
    const source = Object.values(categoryData).flat()
    return Array.from(new Map(source.map(v => [v.video_id, v])).values())
  }, [categoryData])

  const rows = useMemo(() => {
    // 전체 탭에서는 전체 인기 + 5개 카테고리 피드를 모두 보여줍니다.
    if (category === 'all') {
      return [
        { title: '전체 인기 트렌딩', videos: sortVideos(categoryData.all || [], sortOrder).slice(0, visibleCount) },
        ...CATEGORIES
          .filter(c => c.key !== 'all')
          .map(c => ({
            title: CATEGORY_FEED_TITLES[c.key] || `${c.label} 트렌딩`,
            videos: sortVideos(categoryData[c.key] || [], sortOrder).slice(0, visibleCount),
          })),
      ]
    }

    // 개별 카테고리 탭에서는 선택한 카테고리 피드만 보여줍니다.
    // 예: Entertainment 클릭 시 Entertainment 트렌딩만 표시.
    const current = CATEGORIES.find(c => c.key === category)
    return [{ title: CATEGORY_FEED_TITLES[category] || `${current?.label || '선택'} 트렌딩`, videos: visibleActiveVideos }]
  }, [category, activeVideos, visibleActiveVideos, categoryData, sortOrder, visibleCount])

  const topVideos = useMemo(() => {
    const source = category === 'all'
      ? Object.values(categoryData).flat()
      : activeVideos
    const unique = Array.from(new Map(source.map(v => [v.video_id, v])).values())
    return unique.sort((a, b) => Number(b.views || 0) - Number(a.views || 0)).slice(0, 8)
  }, [category, activeVideos, visibleActiveVideos, categoryData, sortOrder, visibleCount])

  const maxViews = Math.max(...topVideos.map(v => Number(v.views || 0)), 1)

  const orderedCategories = useMemo(() => {
    const prefs = categoryPrefs || {}
    const [all, ...rest] = CATEGORIES
    return [all, ...rest.sort((a, b) => Number(prefs[b.key] || 0) - Number(prefs[a.key] || 0))]
  }, [categoryPrefs])

  const handleCategoryChange = (key) => {
    bumpCategoryPref(key)
    setCategoryPrefs(readCategoryPrefs())
    setCategory(key)
  }

  if (loading && !selected) {
    return (
      <main className="video-page-redblue">
        <section className="video-hero-shell">
          <div className="hero-copy">
            <p className="eyebrow">Korea YouTube Trending</p>
            <h1>AI 트렌딩 영상 분석</h1>
            <p>캐시와 YouTube Data API v3로 실시간 트렌딩 데이터를 빠르게 불러오는 중입니다.</p>
          </div>
          <div className="video-api-status">
            <span className="status-dot loading" />
            <strong>초기 데이터 로딩 중</strong>
            <small>YouTube 최신 동기화 준비</small>
          </div>
        </section>
        <section className="video-fast-skeleton">
          <div className="skeleton-player" />
          <div className="skeleton-side">
            <div />
            <div />
          </div>
        </section>
        <div className="nf-row skeleton-row">
          {Array.from({ length: 8 }).map((_, idx) => <div className="nf-skeleton" key={idx} />)}
        </div>
      </main>
    )
  }

  return (
    <motion.main className="video-page-redblue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
      <motion.section className="video-hero-shell" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
        <div className="hero-copy">
          <p className="eyebrow">Korea YouTube Trending</p>
          <h1>AI 트렌딩 영상 분석</h1>
          <p>카테고리별 가로 피드, hover 미리보기, AI 예측 점수, 24h 성장 예측, 추천 영상까지 한 화면에서 확인하는 AI 분석 페이지입니다.</p>
        </div>
      </motion.section>


      <section className={`video-tiny-sync-toolbar ${syncState.key}`} aria-label="YouTube 데이터 동기화 상태">
        <span className={`tiny-sync-dot ${syncState.key}`} />
        <span className="tiny-sync-state">{syncState.icon} {syncState.label}</span>
        <span className="tiny-sync-text">
          {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '준비 중'}
        </span>
        <button type="button" onClick={() => {
            CATEGORIES.forEach(c => localStorage.removeItem(cacheKey(`youtube-${c.key}`)))
            localStorage.removeItem(cacheKey(`youtube-live-bulk-v1-${sortOrder}`))
            if (category === 'all') loadBulkTrending(true)
            else fetchCategory(CATEGORIES.find(c => c.key === category) || CATEGORIES[0], false, true)
          }} disabled={refreshing}>
          {refreshing ? '동기화 중' : '바로 갱신'}
        </button>
        <span className={`tiny-auto-pill ${autoRefreshing ? 'syncing' : ''}`}>{autoRefreshing ? '자동 동기화 중' : '20초 자동'}</span>
      </section>


      <AnimatePresence>
        {error && (
          <motion.div className="video-notice" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            {error}
          </motion.div>
        )}
      </AnimatePresence>


      <motion.section key={`featured-${dataVersion}`} className="featured-layout" initial={{ opacity: 0.72, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
        <div className="main-player glass-panel">
          {selected ? (
            <>
              <div className="player-frame">
                {playing ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${selected.video_id}?autoplay=1&playsinline=1`}
                    title={selected.title}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <button className="poster-button" type="button" onClick={() => setPlaying(true)}>
                    <img src={getBestThumbnail(selected)} onError={(e) => handleThumbnailFallback(e, selected)} alt={selected.title} loading="lazy" />
                    <span className="play-orb">▶</span>
                  </button>
                )}
              </div>
              <div className="selected-meta">
                <div className="selected-badges">
                  <span className="mini-badge">선택 영상</span>
                  <span className="mini-badge category-selected">{getCategoryLabel(selected)}</span>
                </div>
                <h2>{selected.title}</h2>
                <p>{selected.channel || selected.channel_title || 'YouTube'}</p>
                <div className="metric-row">
                  <div><span>조회수</span><strong><AnimatedNumber value={selected.views} /></strong></div>
                  <div><span>좋아요</span><strong><AnimatedNumber value={selected.likes} /></strong></div>
                  <div><span>AI 예측 점수</span><strong>{getPredictionScore(selected)}</strong></div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">영상 로딩 중입니다.</div>
          )}
        </div>

        <div className="side-stack">
          <AiInsight video={selected} />
          <GrowthChart video={selected} />
        </div>
      </motion.section>

      <motion.section
        className="category-panel category-panel-below category-panel-under-video"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.48, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="category-tabs clean-category-tabs">
          {orderedCategories.map(c => (
            <button
              type="button"
              key={c.key}
              className={category === c.key ? 'active' : ''}
              onClick={() => handleCategoryChange(c.key)}
            >
              <span className="category-icon">{c.icon}</span>
              <span className="category-text">
                <strong>{c.shortLabel || c.label}</strong>
              </span>
            </button>
          ))}
        </div>
      </motion.section>

      <RecommendationPanel
        videos={category === 'all' ? allVideos : activeVideos}
        selected={selected}
        onSelect={(v) => { setSelected(v); setPlaying(false) }}
      />

      <ViewAiScatter
        videos={category === 'all' ? allVideos : activeVideos}
        selected={selected}
        onSelect={(v) => { setSelected(v); setPlaying(false) }}
      />

      {rows.map(row => (
        <VideoRow
          key={row.title}
          title={row.title}
          videos={row.videos}
          selected={selected}
          loading={loading && row.title.includes('전체')}
          onSelect={(v) => { setSelected(v); setPlaying(false) }}
        />
      ))}

      {hasMoreActiveVideos && (
        <section className="netflix-row-section">
          <button type="button" className="video-load-more" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>
            더보기
          </button>
        </section>
      )}

      <section className="rank-chart glass-panel">
        <div className="section-head compact">
          <div>
            <p className="eyebrow">Trending Views Ranking</p>
            <h3>조회수 TOP 그래프</h3>
          </div>
        </div>
        <div className="bar-list">
          {topVideos.map((v, i) => (
            <button type="button" className="bar-item" key={v.video_id} onClick={() => { setSelected(v); setPlaying(false) }}>
              <span>{i + 1}</span>
              <strong>{v.title}</strong>
              <small>{getCategoryLabel(v)}</small>
              <div className="bar-track"><em style={{ width: `${(Number(v.views || 0) / maxViews) * 100}%` }} /></div>
              <b>{formatNumber(v.views)}</b>
            </button>
          ))}
        </div>
      </section>
    </motion.main>
  )
}
