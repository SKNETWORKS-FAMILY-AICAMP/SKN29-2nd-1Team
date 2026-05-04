// pages/ModelInterpretPage.jsx — Part 7 모델해석: 앙상블 성능 + Feature Importance 설명력
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import CountUp from '../components/CountUp'
import TabSectionLayout from '../components/TabSectionLayout'
import { fadeUp, fadeUpStagger } from '../animations/variants'
import '../styles/MLDLPartPages.css'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const FALLBACK_IMPORTANCE = {
  interpretationPrinciple: '성능은 앙상블 모델로 확보하고, 설명은 Feature Importance와 영향 방향 분석으로 보완합니다.',
  features: [
    { feature:'초기 조회수', score:0.31, direction:'positive', reason:'초기 노출과 관심도를 직접 반영합니다.' },
    { feature:'좋아요/댓글 반응', score:0.27, direction:'positive', reason:'초반 참여율이 높을수록 트렌딩 지속 가능성이 커집니다.' },
    { feature:'카테고리', score:0.19, direction:'mixed', reason:'카테고리별 확산 속도와 지속 시간이 다릅니다.' },
    { feature:'업로드 타이밍', score:0.14, direction:'mixed', reason:'요일·시간대는 초기 반응 형성에 영향을 줍니다.' },
    { feature:'24h 성장률', score:0.09, direction:'positive', reason:'업로드 이후 성장 추세를 반영하는 보정 신호입니다.' },
  ],
  finalMessage:'WeightedSoftVoting으로 예측 성능을 확보하고, Feature Importance로 의사결정 근거를 설명합니다.',
}

const FEATURE_NAME_MAP = {
  T0_view_log: '초기 조회수',
  T0_engagement_ratio_log: '좋아요/댓글 반응',
  T0_comment_log: '댓글 반응',
  T0_like_log: '좋아요 반응',
  T0_view: '초기 조회수',
  category: '카테고리',
  category_id: '카테고리',
  upload_hour: '업로드 타이밍',
  hour_sin: '업로드 타이밍',
  hour_cos: '업로드 타이밍',
  weekday_sin: '업로드 요일',
  weekday_cos: '업로드 요일',
  view_growth_24h_log: '24h 성장률',
  pretrend_view_velocity_log: '초기 확산 속도',
  entry_rank_log: '진입 순위',
  latency_to_trend_log: '트렌딩 진입 시간',
}

const defaultReason = (name, direction) => {
  if (name.includes('조회수')) return '초기 노출과 관심도를 직접 반영합니다.'
  if (name.includes('댓글') || name.includes('좋아요') || name.includes('engagement')) return '초반 참여율이 높을수록 트렌딩 지속 가능성이 커집니다.'
  if (name.includes('카테고리')) return '카테고리별 확산 속도와 지속 시간이 다릅니다.'
  if (name.includes('타이밍') || name.includes('요일') || name.includes('hour') || name.includes('weekday')) return '요일·시간대는 초기 반응 형성에 영향을 줍니다.'
  if (name.includes('성장') || name.includes('velocity')) return '업로드 이후 성장 추세를 반영하는 보정 신호입니다.'
  return direction === 'positive' ? '트렌딩 지속 가능성을 높이는 방향의 설명 변수입니다.' : '콘텐츠 유형에 따라 영향이 달라지는 보정 변수입니다.'
}

function normalizeFeatureImportancePayload(payload) {
  const source = Array.isArray(payload)
    ? payload
    : payload?.features || payload?.featureImportance || payload?.feature_importance || payload?.importances || payload?.data || []

  if (!Array.isArray(source) || !source.length) return FALLBACK_IMPORTANCE.features

  const rawRows = source.map((item, index) => {
    const rawFeature = item.feature || item.name || item.key || item.column || item.label || `feature_${index + 1}`
    const rawScore = item.score ?? item.value ?? item.importance ?? item.gain ?? item.weight ?? item.mean_abs_shap ?? item.shap_value
    const scoreNumber = Number(rawScore)
    return {
      feature: FEATURE_NAME_MAP[rawFeature] || rawFeature,
      rawFeature,
      rawScore: Number.isFinite(scoreNumber) ? Math.abs(scoreNumber) : 0,
      direction: item.direction || item.effect || item.sign || (String(rawFeature).includes('category') || String(rawFeature).includes('hour') || String(rawFeature).includes('weekday') ? 'mixed' : 'positive'),
      reason: item.reason || item.desc || item.description,
    }
  }).filter(item => item.rawScore > 0)

  if (!rawRows.length) return FALLBACK_IMPORTANCE.features

  const total = rawRows.reduce((sum, item) => sum + item.rawScore, 0)
  const shouldNormalize = total > 1.25 || rawRows.some(item => item.rawScore > 1)

  return rawRows.slice(0, 8).map(item => {
    const score = shouldNormalize ? item.rawScore / total : item.rawScore
    return {
      feature: item.feature,
      score: Math.max(0.01, Math.min(1, score)),
      direction: item.direction === 'positive' || item.direction === 'negative' ? item.direction : 'mixed',
      reason: item.reason || defaultReason(item.feature, item.direction),
    }
  })
}

function normalizeImportanceInfo(json) {
  const features = normalizeFeatureImportancePayload(json)
  return {
    ...FALLBACK_IMPORTANCE,
    ...(json && !Array.isArray(json) ? json : {}),
    features,
    interpretationPrinciple: json?.interpretationPrinciple || json?.interpretation_principle || FALLBACK_IMPORTANCE.interpretationPrinciple,
    finalMessage: json?.finalMessage || json?.final_message || FALLBACK_IMPORTANCE.finalMessage,
  }
}

function FeatureImportanceChart({ info }) {
  const rows = (info.features || FALLBACK_IMPORTANCE.features).map(f => ({
    name: f.feature,
    value: Math.round(Number(f.score || 0) * 100),
    text: Number(f.score || 0).toFixed(2),
    reason: f.reason,
  }))
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">FEATURE IMPORTANCE</div><div className="ml-chart-main-title">설명력 보완을 위한 주요 변수</div></div><span className="ml-badge">Interpretability</span></div>
    <div className="ml-chart-explain-note">
      <b>해석 포인트</b>
      <span>{rows[0]?.name}와 {rows[1]?.name}이 예측 결과를 설명하는 핵심 변수입니다. 즉, 업로드 직후 반응 지표가 트렌딩 지속 가능성 판단에 가장 큰 신호로 작용합니다.</span>
    </div>
    <div className="ml-bar-list">
      {rows.map((r,i)=><div className="ml-bar-row" key={r.name}><div className="ml-bar-name">{r.name}</div><div className="ml-bar-track"><div className="ml-bar-fill" style={{ '--value':`${r.value}%`, '--delay':`${i*.1}s` }}/></div><div className="ml-bar-value">{r.text}</div></div>)}
    </div>
    <div className="ml-insight-strip"><span className="ml-insight-label">POINT</span><span className="ml-insight-text">{info.interpretationPrinciple || FALLBACK_IMPORTANCE.interpretationPrinciple}</span></div>
  </div>
}

function InfluenceDirectionChart({ info }) {
  const rows = (info.features || FALLBACK_IMPORTANCE.features).map(f => ({
    name: f.feature,
    v: Math.max(8, Math.round(Number(f.score || 0) * 100)),
    sign: f.direction === 'positive' ? 'positive' : 'negative',
    text: `${f.direction === 'positive' ? '+' : '±'}${Number(f.score || 0).toFixed(2)}`,
  }))
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">EFFECT DIRECTION</div><div className="ml-chart-main-title">Positive / Mixed 영향 방향</div></div><div className="ml-dot-legend"><span>Positive</span><span>Mixed</span></div></div>
    <div className="ml-shap-wrap">
      {rows.map((r,i)=><div className="ml-shap-row" key={r.name}><div className="ml-shap-name">{r.name}</div><div className="ml-shap-axis"><div className={`ml-shap-fill ${r.sign}`} style={{ '--value':`${r.v}%`, '--delay':`${i*.1}s` }}/></div><div className="ml-shap-value">{r.text}</div></div>)}
    </div>
    <div className="ml-insight-strip"><span className="ml-insight-label">READ</span><span className="ml-insight-text">초기 조회수와 좋아요/댓글 반응은 상승 방향의 핵심 신호이고, 카테고리와 업로드 타이밍은 운영 전략에 따라 달라지는 보정 변수입니다.</span></div>
  </div>
}

function EnsembleExplainChart() {
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">ROLE SPLIT</div><div className="ml-chart-main-title">성능은 앙상블, 설명은 Feature Importance</div></div><span className="ml-badge">Final Logic</span></div>
    <div className="ml-card-grid">
      <div className="ml-mini-card is-best"><div className="ml-mini-label"><span>WeightedSoftVoting</span><span className="ml-badge">성능</span></div><div className="ml-model-name">최종 예측 모델</div><p className="ml-model-desc">AUC 0.895 / F1 0.796 / Accuracy 0.803으로 현재 tabular 데이터에 적합한 최종 모델입니다.</p></div>
      <div className="ml-mini-card"><div className="ml-mini-label"><span>XGBoost / RF</span><span className="ml-badge">해석</span></div><div className="ml-model-name">변수 중요도</div><p className="ml-model-desc">어떤 변수가 예측에 영향을 주는지 설명하는 보조 근거로 사용합니다.</p></div>
      <div className="ml-mini-card"><div className="ml-mini-label"><span>LSTM</span><span className="ml-badge">확장</span></div><div className="ml-model-name">시계열 향후 모델</div><p className="ml-model-desc">연속 시점별 조회수 sequence가 확보될 경우 확장 적용할 수 있습니다.</p></div>
    </div>
    <div className="ml-insight-strip"><span className="ml-insight-label">COMPARE</span><span className="ml-insight-text">LSTM을 최종 모델처럼 말하기보다, 현재는 앙상블 모델을 주력으로 두고 Feature Importance로 설명력을 보완하는 구성이 더 적절합니다.</span></div>
  </div>
}

function GrowthStrategyChart({ info }) {
  const features = info.features || FALLBACK_IMPORTANCE.features
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">ACTION INSIGHT</div><div className="ml-chart-main-title">모델 해석 → YouTube 성장 전략</div></div><span className="ml-badge">Strategy</span></div>
    <div className="ml-strategy-grid">
      <div className="ml-strategy-card"><div className="ml-strategy-title">① 초기 반응 확보</div><p className="ml-strategy-text">{features[0]?.feature}와 {features[1]?.feature}이 중요하므로 업로드 직후 조회수·좋아요·댓글 유도를 강화합니다.</p></div>
      <div className="ml-strategy-card"><div className="ml-strategy-title">② 카테고리별 운영</div><p className="ml-strategy-text">카테고리별 지속 시간과 확산 속도가 다르므로 장기형/단기형 운영 전략을 분리합니다.</p></div>
      <div className="ml-strategy-card"><div className="ml-strategy-title">③ 업로드 타이밍 최적화</div><p className="ml-strategy-text">요일·시간대 패턴을 이용해 초기 노출 가능성이 높은 구간에 업로드와 프로모션을 집중합니다.</p></div>
    </div>
    <div className="ml-insight-strip"><span className="ml-insight-label">FINAL</span><span className="ml-insight-text">{info.finalMessage || FALLBACK_IMPORTANCE.finalMessage}</span></div>
  </div>
}

function StrategyStoryChart() {
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">FINAL ACTION</div><div className="ml-chart-main-title">최종 YouTube 성장 액션맵</div></div><span className="ml-badge">Final Insight</span></div>
    <div className="ml-flow-line">
      {['초기 반응 확보','카테고리별 운영','업로드 타이밍 최적화','성과 검증 및 재학습'].map((x,i)=><div className="ml-flow-step" key={x} style={{ animationDelay:`${i*.08}s` }}><div className="ml-flow-no">{String(i+1).padStart(2,'0')}</div><div className="ml-flow-text">{x}</div></div>)}
    </div>
    <div className="ml-insight-strip"><span className="ml-insight-label">FINAL</span><span className="ml-insight-text">Part 7의 결론은 “모델 결과를 단순 점수가 아니라 실제 운영 전략으로 연결한다”입니다.</span></div>
  </div>
}

export default function ModelInterpretPage({ onBack }) {
  const [active, setActive] = useState(0)
  const [info, setInfo] = useState(FALLBACK_IMPORTANCE)
  const [apiOk, setApiOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${API}/model/feature-importance`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`API ${res.status}`)))
      .then(json => { if (!cancelled) { setInfo(normalizeImportanceInfo(json)); setApiOk(true) } })
      .catch(() => { if (!cancelled) setApiOk(false) })
    return () => { cancelled = true }
  }, [])

  const sections = useMemo(() => [
    { id:'importance', tag:'중요도', shortTitle:'Feature', title:'Feature Importance', Chart:() => <FeatureImportanceChart info={info}/>, findings:['초기 조회수와 좋아요/댓글 반응은 예측 결과를 설명하는 핵심 변수입니다.', '카테고리와 업로드 타이밍은 콘텐츠 유형별 전략을 조정하는 보정 변수입니다.', 'Feature Importance는 “왜 이런 예측이 나왔는지”를 설명해 발표 설득력을 높입니다.'], note:'차트 + 해석 문장으로 예측 근거를 함께 제시' },
    { id:'direction', tag:'방향', shortTitle:'영향 방향', title:'Positive / Mixed 영향 방향', Chart:() => <InfluenceDirectionChart info={info}/>, findings:['초기 반응 지표는 대체로 트렌딩 지속 가능성을 높이는 방향입니다.', '카테고리와 타이밍은 콘텐츠 유형에 따라 영향이 달라집니다.', '이 영향 방향을 Part9 전략으로 연결할 수 있습니다.'], note:'해석 결과를 운영 전략으로 전환' },
    { id:'compare', tag:'비교', shortTitle:'역할 분리', title:'앙상블 성능과 설명력 분리', Chart:EnsembleExplainChart, findings:['WeightedSoftVoting은 최종 예측 성능을 담당합니다.', 'XGBoost/RandomForest 계열은 변수 중요도 설명에 적합합니다.', 'LSTM은 향후 sequence 데이터 확보 시 확장 모델로 정리합니다.'], note:'성능 모델과 해석 모델의 역할 분리' },
    { id:'strategy', tag:'전략', shortTitle:'성장 전략', title:'실제 YouTube 성장 전략', Chart:() => <GrowthStrategyChart info={info}/>, findings:['초기 반응 확보가 가장 먼저 필요한 실행 전략입니다.', '카테고리별 운영과 업로드 타이밍 최적화가 후속 전략입니다.', '모델 해석 결과를 실제 서비스 액션으로 연결합니다.'], note:'모델 해석 → 실제 운영 전략' },
    { id:'actionmap', tag:'결론', shortTitle:'액션맵', title:'최종 YouTube 성장 액션맵', Chart:StrategyStoryChart, findings:['초기 반응 확보 → 카테고리별 운영 → 업로드 타이밍 최적화 흐름으로 정리합니다.', '예측 결과를 실제 운영 의사결정으로 전환합니다.', '성과 검증과 재학습까지 연결하면 프로젝트 완성도가 올라갑니다.'], note:'분석 → 해석 → 실제 성장 전략' },
  ], [info])

  return <div className="yta-app-inner">
    <motion.button className="back-btn" onClick={onBack} whileHover={{ x:-3 }} transition={{ duration:.2 }}>← 목록으로</motion.button>
    <motion.div className="part-page-header" variants={fadeUpStagger} initial="hidden" animate="show">
      <motion.span className="part-page-num" variants={fadeUp}>Part 7</motion.span>
      <motion.h1 className="part-page-title" variants={fadeUp}>모델해석 — Feature Importance & Strategy</motion.h1>
      <motion.p className="part-page-subtitle" variants={fadeUp}>최종 모델 성능은 WeightedSoftVoting으로 확보하고, Feature Importance로 예측 결과의 핵심 근거를 설명합니다.</motion.p>
      <motion.div variants={fadeUp} style={{ display:'flex', alignItems:'center', gap:10 }}><div className={`api-status ${apiOk ? 'api-status--ok' : 'api-status--loading'}`}><span className="api-status-dot"/><span>{apiOk ? `모델 해석 API 연결 성공 · ${API}` : '모델 해석 API 대기 · 로컬 해석 표시'}</span></div></motion.div>
      <motion.div className="eda-summary-row" variants={fadeUpStagger}>
        {[['최종 모델','WeightedSoftVoting'],['설명 방식','Feature Importance'],['Top Feature','초기 조회수'],['전략 흐름','3단계'],['LSTM','향후 확장']].map(([l,v])=><motion.div key={l} className="eda-summary-item" variants={fadeUp}><span className="eda-summary-label">{l}</span><span className="eda-summary-val"><CountUp value={v}/></span></motion.div>)}
      </motion.div>
    </motion.div>
    <TabSectionLayout sections={sections} active={active} setActive={setActive}/>
  </div>
}
