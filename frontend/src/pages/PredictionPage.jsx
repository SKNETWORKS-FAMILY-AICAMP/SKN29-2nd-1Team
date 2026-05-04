import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { fadeUp, fadeUpStagger, slideTab } from "../animations/variants"
import LoadingState, { Spinner } from "../components/LoadingState"
import ErrorState from "../components/ErrorState"
import ResultBadge from "../components/ResultBadge"
import "../styles/PredictionPage.css"

const API = import.meta.env.VITE_API_URL || "http://localhost:8000"
const RED = "#ff2d2d"
const GRID = "rgba(255,0,0,0.08)"

const FALLBACK_OPTIONS = {
  categories: ["Entertainment", "Music", "News", "Lifestyle", "Education", "Gaming"],
  weekdays: [
    { label: "월", value: 0 },
    { label: "화", value: 1 },
    { label: "수", value: 2 },
    { label: "목", value: 3 },
    { label: "금", value: 4 },
    { label: "토", value: 5 },
    { label: "일", value: 6 },
  ],
}

const DEFAULT_FORM = {
  category: "Entertainment",
  view_count: 300000,
  comment_count: 1200,
  published_hour: 20,
  published_weekday: 5,
  view_growth_24h: 80000,
  mode: "T0",
}

const FALLBACK_RESULT = {
  prediction: {
    probability: 72.4,
    expectedDuration: 221.8,
    level: "Medium",
    message: "중간 수준의 지속 가능성이 있습니다. 24시간 성장 추이를 추가 확인하는 것이 좋습니다.",
    modelMode: "T0",
  },
  drivers: [
    { name: "초기 조회수", value: 70 },
    { name: "댓글 반응", value: 65 },
    { name: "Engagement", value: 58 },
    { name: "카테고리", value: 62 },
    { name: "타이밍", value: 80 },
  ],
  recommendations: [
    "초기 24시간 조회수 성장률을 지속적으로 모니터링하세요.",
    "댓글 반응을 유도하는 제목/설명/커뮤니티 액션을 강화하세요.",
    "카테고리별 지속성 차이를 고려해 광고 집행 우선순위를 정하세요.",
  ],
}

const tooltipStyle = {
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(14px)",
  border: "1px solid rgba(255,45,45,0.20)",
  borderRadius: 14,
  color: "#111",
  boxShadow: "0 16px 42px rgba(0,0,0,0.10)",
}

async function requestPrediction(form) {
  const payload = {
    ...form,
    view_count: Number(form.view_count),
    comment_count: Number(form.comment_count),
    published_hour: Number(form.published_hour),
    published_weekday: Number(form.published_weekday),
    view_growth_24h: form.mode === "24h" ? Number(form.view_growth_24h || 0) : null,
  }

  const res = await fetch(`${API}/predict/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

function PredictForm({ form, setForm, options, onSubmit, loading }) {
  const update = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [setForm])

  return (
    <div className="predict-panel predict-form-card">
      <div className="predict-panel-head">
        <span className="predict-kicker">Input</span>
        <h3>영상 초기 정보 입력</h3>
        <p>T0 예측은 초기 신호만, 24h 예측은 성장량까지 반영합니다.</p>
      </div>

      <div className="predict-mode-toggle">
        {["T0", "24h"].map((mode) => (
          <button key={mode} className={form.mode === mode ? "on" : ""} onClick={() => update("mode", mode)} type="button">
            {mode}
          </button>
        ))}
      </div>

      <div className="predict-form-grid">
        <label>
          <span>카테고리</span>
          <select value={form.category} onChange={(e) => update("category", e.target.value)}>
            {(options.categories || FALLBACK_OPTIONS.categories).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </label>
        <label>
          <span>초기 조회수</span>
          <input type="number" min="0" value={form.view_count} onChange={(e) => update("view_count", e.target.value)} />
        </label>
        <label>
          <span>댓글 수</span>
          <input type="number" min="0" value={form.comment_count} onChange={(e) => update("comment_count", e.target.value)} />
        </label>
        <label>
          <span>업로드 시간</span>
          <input type="number" min="0" max="23" value={form.published_hour} onChange={(e) => update("published_hour", e.target.value)} />
        </label>
        <label>
          <span>요일</span>
          <select value={form.published_weekday} onChange={(e) => update("published_weekday", Number(e.target.value))}>
            {(options.weekdays || FALLBACK_OPTIONS.weekdays).map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
          </select>
        </label>
        <label className={form.mode !== "24h" ? "is-disabled" : ""}>
          <span>24h 조회수 증가량</span>
          <input type="number" min="0" value={form.view_growth_24h} disabled={form.mode !== "24h"} onChange={(e) => update("view_growth_24h", e.target.value)} />
        </label>
      </div>

      <button className="predict-submit-btn" onClick={onSubmit} disabled={loading}>
        {loading ? <Spinner label="예측 중" /> : "예측 실행"}
      </button>
    </div>
  )
}

function ResultCard({ result }) {
  const p = Number(result?.prediction?.probability ?? 0)
  const level = String(result?.prediction?.level || "Medium").toLowerCase()

  return (
    <div className="predict-panel predict-result-card">
      <div className="predict-result-top">
        <span className={`predict-level ${level}`}>{result?.prediction?.level || "Medium"}</span>
        <ResultBadge value={p} label="신뢰 구간" />
        <span className="predict-mode-badge">{result?.prediction?.modelMode || "T0"} Model</span>
      </div>

      <div className="predict-progress-shell">
        <div className="predict-progress-ring" style={{ "--p": `${p}%` }}>
          <div>
            <strong>{p}%</strong>
            <span>장기 지속 확률</span>
          </div>
        </div>
      </div>

      <div className="predict-duration-box">
        <span>예상 지속 시간</span>
        <strong>{result?.prediction?.expectedDuration ?? 0}h</strong>
      </div>

      <p className="predict-message">{result?.prediction?.message}</p>
    </div>
  )
}

function DriverChart({ drivers }) {
  const rows = (drivers?.length ? drivers : FALLBACK_RESULT.drivers)
    .map((d) => ({ name: d.name, value: Math.max(0, Math.min(100, Number(d.value) || 0)) }))
  const W = 760
  const H = 330
  const L = 132
  const R = 58
  const T = 42
  const rowH = 48
  const barW = W - L - R
  const avg = rows.length ? rows.reduce((sum, d) => sum + d.value, 0) / rows.length : 0
  const avgX = L + (avg / 100) * barW

  return (
    <div className="predict-panel predict-driver-card predict-driver-visual-card">
      <div className="predict-panel-head compact predict-driver-head">
        <div>
          <span className="predict-kicker">Drivers</span>
          <h3>예측 영향 요인</h3>
          <p>반응률과 초기 신호가 장기 지속 예측에 얼마나 기여하는지 직관적으로 보여줍니다.</p>
        </div>
        <div className="predict-driver-legend">
          <span><i className="legend-red" /> 기여도</span>
          <span><i className="legend-dash" /> 평균선 {avg.toFixed(0)}%</span>
        </div>
      </div>

      <svg className="predict-driver-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="예측 영향 요인 그래프">
        {[0, 25, 50, 75, 100].map((v) => {
          const x = L + (v / 100) * barW
          return (
            <g key={v}>
              <line x1={x} x2={x} y1={T - 18} y2={T + rows.length * rowH + 10} className="predict-grid-line" />
              <text x={x} y={T + rows.length * rowH + 34} textAnchor="middle" className="predict-axis-label">{v}%</text>
            </g>
          )
        })}

        <line x1={avgX} x2={avgX} y1={T - 24} y2={T + rows.length * rowH + 10} className="predict-average-line" />
        <text x={avgX + 8} y={T - 30} className="predict-average-label">평균 {avg.toFixed(0)}%</text>

        {rows.map((d, i) => {
          const y = T + i * rowH
          const w = (d.value / 100) * barW
          const isTop = d.value >= avg
          return (
            <g key={d.name} className="predict-driver-row-svg">
              <text x={L - 16} y={y + 23} textAnchor="end" className="predict-driver-name">{d.name}</text>
              <rect x={L} y={y + 6} width={barW} height="24" rx="12" className="predict-driver-track" />
              <rect
                x={L}
                y={y + 6}
                width={w}
                height="24"
                rx="12"
                className={`predict-driver-fill ${isTop ? "is-strong" : ""}`}
                style={{ animationDelay: `${i * 110}ms` }}
              />
              <circle cx={L + w} cy={y + 18} r="7" className="predict-driver-dot" style={{ animationDelay: `${i * 110 + 420}ms` }} />
              <text x={Math.min(L + w + 14, W - R + 2)} y={y + 23} className="predict-driver-value">{d.value}%</text>
            </g>
          )
        })}
      </svg>

      <div className="predict-driver-insight-row">
        <div>
          <span>Top Factor</span>
          <strong>{rows.slice().sort((a, b) => b.value - a.value)[0]?.name}</strong>
        </div>
        <div>
          <span>Reaction Signal</span>
          <strong>{rows.find((d) => d.name.toLowerCase().includes("engagement") || d.name.includes("댓글"))?.value ?? "-"}%</strong>
        </div>
        <div>
          <span>해석</span>
          <strong>평균선 이상 요인 우선 개선</strong>
        </div>
      </div>
    </div>
  )
}

function RecommendationCards({ items }) {
  return (
    <div className="predict-recommend-grid">
      {(items || []).map((item, idx) => (
        <div key={item} className="predict-recommend-card">
          <span>0{idx + 1}</span>
          <p>{item}</p>
        </div>
      ))}
    </div>
  )
}

function UsageFlow() {
  const steps = [
    ["01", "입력", "영상의 초기 신호 입력"],
    ["02", "예측", "장기 지속 확률 계산"],
    ["03", "해석", "영향 요인 확인"],
    ["04", "전략", "광고·업로드 전략 적용"],
  ]

  return (
    <div className="predict-flow">
      {steps.map(([num, title, desc]) => (
        <div key={num} className="predict-flow-item">
          <span>{num}</span>
          <strong>{title}</strong>
          <p>{desc}</p>
        </div>
      ))}
    </div>
  )
}

export default function PredictionPage({ onBack }) {
  const [active, setActive] = useState(0)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [options] = useState(FALLBACK_OPTIONS)
  const [result, setResult] = useState(FALLBACK_RESULT)
  const [loading, setLoading] = useState(false)
  const [apiState, setApiState] = useState("ok")

  useEffect(() => {
    setApiState("ok")
  }, [])

  const handlePredict = useCallback(async () => {
    setLoading(true)
    try {
      const json = await requestPrediction(form)
      setResult(json)
      setApiState("ok")
      setActive(1)
    } catch (err) {
      console.error(err)
      setResult(FALLBACK_RESULT)
      setApiState("fail")
      setActive(1)
    } finally {
      setLoading(false)
    }
  }, [form])

  const sections = useMemo(() => [
    {
      id: "input",
      tag: "INPUT",
      title: "사용자 입력 기반 예측",
      shortTitle: "입력",
      Chart: () => <PredictForm form={form} setForm={setForm} options={options} onSubmit={handlePredict} loading={loading} />,
      findings: [
        "사용자가 카테고리, 조회수, 댓글 수, 업로드 시간 같은 초기 신호를 입력합니다.",
        "T0 모드는 트렌딩 진입 시점 정보만 사용해 빠른 예측을 제공합니다.",
        "24h 모드는 24시간 성장량을 추가해 업데이트 예측으로 확장됩니다.",
      ],
      note: "입력 → 예측 → 결과 해석 흐름",
    },
    {
      id: "result",
      tag: "RESULT",
      title: "예측 결과",
      shortTitle: "결과",
      Chart: () => <ResultCard result={result} />,
      findings: [
        "장기 지속 확률을 가벼운 CSS 게이지로 표시해 렌더링 속도를 개선했습니다.",
        "예상 지속 시간을 시간 단위로 제공해 회귀 결과처럼 활용할 수 있습니다.",
        "High / Medium / Low 등급으로 빠른 의사결정을 지원합니다.",
      ],
      note: "장기 지속 확률 + 예상 지속 시간",
    },
    {
      id: "drivers",
      tag: "DRIVERS",
      title: "예측 영향 요인",
      shortTitle: "요인",
      Chart: () => <DriverChart drivers={result.drivers} />,
      findings: [
        "초기 조회수, 댓글 반응, engagement, 카테고리, 타이밍이 예측에 기여합니다.",
        "모델 결과를 단순 숫자가 아니라 해석 가능한 요인으로 보여줍니다.",
        "팀원이 만든 모델이 연결되면 Feature Importance나 SHAP 값으로 교체할 수 있습니다.",
      ],
      note: "예측 결과의 설명 가능성 확보",
    },
    {
      id: "recommend",
      tag: "ACTION",
      title: "추천 액션",
      shortTitle: "추천",
      Chart: () => <RecommendationCards items={result.recommendations} />,
      findings: [
        "예측 결과를 실제 행동으로 연결하는 것이 Part8의 핵심입니다.",
        "확률이 낮으면 초기 반응을 강화하고, 높으면 광고 집행 또는 추가 노출을 고려합니다.",
        "분석 프로젝트를 서비스형 의사결정 도구로 완성합니다.",
      ],
      note: "예측 → 전략 액션",
    },
    {
      id: "flow",
      tag: "SERVICE",
      title: "서비스 사용 흐름",
      shortTitle: "흐름",
      Chart: () => <UsageFlow />,
      findings: [
        "Part8은 모델 결과를 사용자가 직접 체험할 수 있는 서비스 UI입니다.",
        "팀원의 ML/DL 모델 결과가 준비되면 API 내부만 교체하면 됩니다.",
        "프론트 구조는 유지하면서 실제 모델 예측으로 자연스럽게 확장 가능합니다.",
      ],
      note: "UI는 유지, API 내부 모델만 교체 가능",
    },
  ], [form, options, result, loading, handlePredict])

  const sec = sections[active]
  const total = sections.length

  return (
    <div className="yta-app-inner prediction-page">
      <motion.button className="back-btn" onClick={onBack} whileHover={{ x: -3 }} transition={{ duration: 0.2 }}>
        ← 목록으로
      </motion.button>

      <motion.div className="part-page-header prediction-page-header" variants={fadeUpStagger} initial="hidden" animate="show">
        <motion.div className="prediction-hero-top" variants={fadeUp}>
          <span className="part-page-num">Part 8</span>
          <span className="prediction-hero-badge">Prediction System</span>
        </motion.div>

        <motion.h1 className="part-page-title" variants={fadeUp}>예측 시스템</motion.h1>
        <motion.p className="part-page-subtitle" variants={fadeUp}>
          사용자 입력 기반으로 장기 트렌딩 확률과 예상 지속 시간을 제공하는 서비스형 예측 UI입니다.
        </motion.p>

        <motion.div variants={fadeUp}>
          {apiState === "ok" && <div className="api-status api-status--ok"><span className="api-status-dot" /><span>예측 API 준비 완료 · {API}</span></div>}
          {apiState === "fail" && <div className="api-status api-status--fail"><span className="api-status-dot" /><span>API 연결 실패 · 로컬 예측 사용 중</span></div>}
        </motion.div>

        <motion.div className="eda-summary-row" variants={fadeUpStagger}>
          {[
            ["예측 모드", form.mode],
            ["카테고리", form.category],
            ["장기 확률", `${result.prediction?.probability ?? 0}%`],
            ["예상 지속", `${result.prediction?.expectedDuration ?? 0}h`],
          ].map(([label, value]) => (
            <motion.div key={label} className="eda-summary-item" variants={fadeUp}>
              <span className="eda-summary-label">{label}</span>
              <span className="eda-summary-val">{value}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="eda-tabs prediction-tabs">
          {sections.map((s, i) => (
            <motion.button key={s.id} className={`eda-tab ${active === i ? "on" : ""}`} onClick={() => setActive(i)} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
              <span className="eda-tab-tag">{s.tag}</span>
              <span className="eda-tab-title">{s.shortTitle}</span>
            </motion.button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={sec.id} className="eda-body prediction-body" variants={slideTab} initial="hidden" animate="show" exit="exit">
            <div className="eda-chart-panel">
              <p className="eda-chart-title">{sec.title}</p>
              <div className="eda-chart-wrap prediction-chart-wrap">
                {loading && sec.id !== "input" ? (
                  <LoadingState title="예측 결과 계산 중" message="모델 응답을 기다리는 동안 안전한 로딩 UI를 표시합니다." />
                ) : apiState === "fail" && sec.id === "result" ? (
                  <ErrorState title="API 연결 실패" message="현재는 로컬 Fallback 예측값을 표시 중입니다. FastAPI 서버 실행 후 다시 예측해 주세요." onRetry={handlePredict} />
                ) : (
                  <sec.Chart />
                )}
              </div>
            </div>

            <div className="eda-desc-panel">
              <div className="eda-tag-row">
                <span className="eda-big-tag">{sec.tag}</span>
                <span className="eda-progress">{active + 1} / {total}</span>
              </div>

              <h3 className="eda-desc-title">{sec.title}</h3>
              <p className="eda-findings-label">서비스 포인트</p>

              <ul className="eda-findings">
                {sec.findings.map((finding, i) => (
                  <motion.li key={finding} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, duration: 0.22 }}>
                    <span className="eda-finding-num">{i + 1}</span>{finding}
                  </motion.li>
                ))}
              </ul>

              <div className="eda-note-box">
                <span className="eda-note-label">PREDICT</span>
                <span className="eda-note-text">{sec.note}</span>
              </div>

              <div className="eda-nav-btns">
                <motion.button className="eda-nav-btn" disabled={active === 0} onClick={() => setActive((a) => a - 1)} whileHover={active > 0 ? { x: -2 } : {}}>← 이전</motion.button>
                <motion.button className="eda-nav-btn" disabled={active === total - 1} onClick={() => setActive((a) => a + 1)} whileHover={active < total - 1 ? { x: 2 } : {}}>다음 →</motion.button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
