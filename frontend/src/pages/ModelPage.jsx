// pages/ModelPage.jsx — Part 5 모델 전체 점수 + 6개씩 페이지네이션
import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import CountUp from '../components/CountUp'
import TabSectionLayout from '../components/TabSectionLayout'
import { fadeUp, fadeUpStagger } from '../animations/variants'
import '../styles/MLDLPartPages.css'

const API = 'http://127.0.0.1:8000'
const PAGE_SIZE = 6

const FALLBACK_MODEL_DATA = {
  selectedModel: 'WeightedSoftVoting',
  selectedReason: '검증 AUC 0.895, F1 0.796, Accuracy 0.803으로 최종 앙상블 중 가장 안정적입니다.',
  binaryModels: [
    { model:'XGBoost', family:'ML', task:'24h binary', auc:0.909, f1:0.813, accuracy:0.820, precision:0.762, recall:0.872 },
    { model:'XGBoost', family:'ML', task:'T0 binary',  auc:0.854, f1:0.669, accuracy:0.738, precision:0.700, recall:0.860 },
    { model:'RandomForest', family:'ML', task:'24h binary', auc:0.895, f1:0.793, accuracy:0.799, precision:0.736, recall:0.860 },
    { model:'WeightedSoftVoting', family:'Ensemble', task:'final binary', auc:0.895, f1:0.796, accuracy:0.803, precision:0.743, recall:0.857, selected:true },
    { model:'SoftVoting', family:'Ensemble', task:'final binary', auc:0.895, f1:0.796, accuracy:0.802, precision:0.743, recall:0.857 },
    { model:'LightGBM', family:'ML', task:'24h binary', auc:0.892, f1:0.794, accuracy:0.801, precision:0.742, recall:0.853 },
    { model:'CatBoost', family:'ML', task:'24h binary', auc:0.870, f1:0.773, accuracy:0.780, precision:0.719, recall:0.836 },
    { model:'GradientBoosting', family:'ML', task:'T0 binary', auc:0.813, f1:0.569, accuracy:0.735, precision:0.662, recall:0.498 },
  ],
  deepModels: [
    { model:'MLP + Embedding', family:'DL', task:'24h duration regression', mae_h:85.19, rmse_h:121.46, r2:0.1431 },
    { model:'MLPRegressor', family:'DL', task:'T0 duration regression', mae_h:90.1612, rmse_h:134.0558, r2:0.1431, spearman:0.6067 },
    { model:'DurationBucketSurvivalNet', family:'DL', task:'T0 duration bucket', bucket_accuracy:0.5357, bucket_macro_f1:0.4972, expected_duration_mae_h:81.22, expected_duration_r2:0.2972, auc_gt_48h:0.8708 },
    { model:'Wide & Deep', family:'DL', task:'T0 category interaction', mae_h:91.1099, rmse_h:133.5704, r2:0.1493, spearman:0.6067 },
    { model:'LSTMSequence', family:'DL', task:'sequence binary', verified:false, status:'검증 점수 파일 없음', metrics:{}, note:'현재 backend에는 LSTM 학습 스크립트는 있으나 저장된 검증 점수 파일(lstm_metrics.json)이 없습니다.' },
  ],
  lstm: { verified:false, status:'검증 점수 파일 없음', metrics:{} },
}

const num = (v, digits = 3) => Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : '-'
const pct = (v) => Number.isFinite(Number(v)) ? `${(Number(v) * 100).toFixed(1)}%` : '-'

function getModelScore(row) {
  if (Number.isFinite(Number(row.auc))) return Number(row.auc) * 100
  if (Number.isFinite(Number(row.auc_gt_48h))) return Number(row.auc_gt_48h) * 100
  if (Number.isFinite(Number(row.f1))) return Number(row.f1) * 100
  if (Number.isFinite(Number(row.bucket_macro_f1))) return Number(row.bucket_macro_f1) * 100
  if (Number.isFinite(Number(row.r2))) return Math.max(8, 50 + Number(row.r2) * 100)
  if (Number.isFinite(Number(row.expected_duration_r2))) return Math.max(8, 50 + Number(row.expected_duration_r2) * 100)
  return 12
}

function getSortValue(row, sortKey) {
  if (sortKey === 'auc') return Number(row.auc ?? row.auc_gt_48h ?? -999)
  if (sortKey === 'f1') return Number(row.f1 ?? row.bucket_macro_f1 ?? -999)
  if (sortKey === 'accuracy') return Number(row.accuracy ?? row.bucket_accuracy ?? -999)
  if (sortKey === 'mae') return Number.isFinite(Number(row.mae_h ?? row.expected_duration_mae_h)) ? -Number(row.mae_h ?? row.expected_duration_mae_h) : -999
  return String(row.model || '').toLowerCase()
}

function toUnifiedRows(data) {
  const binary = (data.binaryModels || []).map((row) => ({
    ...row,
    type: row.family || 'ML',
    kind: '분류',
    primaryLabel: row.auc ? 'AUC' : 'Score',
    primaryValue: row.auc ?? row.auc_gt_48h ?? row.f1 ?? row.accuracy,
    score: getModelScore(row),
  }))

  const deep = (data.deepModels || []).map((row) => ({
    ...row,
    type: row.family || 'DL',
    kind: row.model === 'LSTMSequence' ? '시계열 확장' : '회귀/딥러닝',
    primaryLabel: row.auc_gt_48h ? 'AUC>48h' : row.bucket_macro_f1 ? 'Macro F1' : row.mae_h || row.expected_duration_mae_h ? 'MAE(h)' : 'Status',
    primaryValue: row.auc_gt_48h ?? row.bucket_macro_f1 ?? row.mae_h ?? row.expected_duration_mae_h,
    score: getModelScore(row),
  }))

  return [...binary, ...deep]
}

function useModelData() {
  const [data, setData] = useState(FALLBACK_MODEL_DATA)
  const [apiState, setApiState] = useState('로컬 결과 표시')

  useEffect(() => {
    let alive = true
    fetch(`${API}/model/compare`)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(String(res.status))))
      .then((json) => {
        if (!alive) return
        setData({ ...FALLBACK_MODEL_DATA, ...json })
        setApiState('API 연결 성공')
      })
      .catch(() => {
        if (!alive) return
        setData(FALLBACK_MODEL_DATA)
        setApiState('API 대기 · 로컬 결과 표시')
      })
    return () => { alive = false }
  }, [])

  return { data, apiState }
}

function ModelCard({ row, bestName, rank }) {
  const isBest = row.selected || row.model === bestName
  const isLstmNoScore = row.model === 'LSTMSequence' && !row.verified && !row.auc

  return <motion.div
    className={`ml-model-card ${isBest ? 'is-best' : ''}`}
    initial={{ opacity:0, y:12 }}
    animate={{ opacity:1, y:0 }}
    transition={{ duration:.28, delay: Math.min(rank, 5) * .035 }}
  >
    <div className="ml-model-card-top">
      <span className={`ml-type-pill ml-type-${String(row.type || '').toLowerCase()}`}>{row.type}</span>
      {isBest ? <span className="ml-best-badge">BEST</span> : <span className="ml-badge">{row.kind}</span>}
    </div>
    <div className="ml-model-card-name">{row.model}</div>
    <div className="ml-model-card-task">{row.task || 'model result'}</div>

    {isLstmNoScore ? <div className="ml-model-card-empty">
      <b>검증 수치 대기</b>
      <span>lstm_metrics.json 저장 시 자동 표시</span>
    </div> : <>
      <div className="ml-card-score-line">
        <span>{row.primaryLabel}</span>
        <strong>{row.primaryLabel?.includes('MAE') ? num(row.primaryValue, 1) : num(row.primaryValue, 3)}</strong>
      </div>
      <div className="ml-card-progress"><span style={{ '--value': `${Math.max(4, Math.min(100, row.score))}%` }} /></div>
    </>}

    <div className="ml-model-metrics">
      <span>AUC <b>{num(row.auc ?? row.auc_gt_48h, 3)}</b></span>
      <span>F1 <b>{num(row.f1 ?? row.bucket_macro_f1, 3)}</b></span>
      <span>ACC <b>{num(row.accuracy ?? row.bucket_accuracy, 3)}</b></span>
      <span>MAE <b>{num(row.mae_h ?? row.expected_duration_mae_h, 1)}</b></span>
    </div>
  </motion.div>
}

function PaginatedModelBoard({ data }) {
  const [filter, setFilter] = useState('ALL')
  const [sortKey, setSortKey] = useState('auc')
  const [page, setPage] = useState(0)

  const rows = useMemo(() => toUnifiedRows(data), [data])
  const bestRow = useMemo(() => [...(data.binaryModels || [])].sort((a,b) => Number(b.auc || 0) - Number(a.auc || 0))[0] || {}, [data])

  const filteredRows = useMemo(() => {
    const base = rows.filter((row) => filter === 'ALL' || row.type === filter)
    return [...base].sort((a, b) => {
      if (sortKey === 'name') return String(a.model).localeCompare(String(b.model))
      return getSortValue(b, sortKey) - getSortValue(a, sortKey)
    })
  }, [rows, filter, sortKey])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const pagedRows = filteredRows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  const changeFilter = (next) => { setFilter(next); setPage(0) }
  const changeSort = (next) => { setSortKey(next); setPage(0) }

  return <div className="ml-chart-stack">
    <div className="ml-chart-head">
      <div>
        <div className="ml-chart-kicker">MODEL SCORE BOARD</div>
        <div className="ml-chart-main-title">모델 전체 점수판</div>
      </div>
      <span className="ml-badge">6개씩 보기</span>
    </div>

    <div className="ml-board-toolbar">
      <div className="ml-filter-group">
        {['ALL','ML','DL','Ensemble'].map((key) => <button key={key} type="button" className={filter === key ? 'is-active' : ''} onClick={() => changeFilter(key)}>{key}</button>)}
      </div>
      <div className="ml-sort-group">
        <span>정렬</span>
        {[
          ['auc','AUC'], ['f1','F1'], ['accuracy','Accuracy'], ['mae','MAE'], ['name','이름']
        ].map(([key, label]) => <button key={key} type="button" className={sortKey === key ? 'is-active' : ''} onClick={() => changeSort(key)}>{label}</button>)}
      </div>
    </div>

    <div className="ml-summary-mini-row">
      <div><span>최고 단일 AUC</span><b>{bestRow.model || '-'}</b><em>{num(bestRow.auc, 3)}</em></div>
      <div><span>최종 앙상블</span><b>{data.selectedModel || 'WeightedSoftVoting'}</b><em>{num((data.binaryModels || []).find(r => r.selected)?.auc ?? 0.895124, 3)}</em></div>
      <div><span>현재 보기</span><b>{filter}</b><em>{filteredRows.length}개</em></div>
    </div>

    <div key={`${filter}-${sortKey}-${currentPage}`} className="ml-model-page-grid">
      {pagedRows.map((row, i) => <ModelCard key={`${row.model}-${row.task}`} row={row} bestName={bestRow.model} rank={i}/>) }
    </div>

    <div className="ml-pagination-row">
      <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={currentPage === 0}>← 이전</button>
      <span>{currentPage + 1} / {totalPages}</span>
      <button type="button" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}>다음 →</button>
    </div>
  </div>
}

function SelectionCriteriaChart({ data }) {
  const binary = (data.binaryModels || []).filter(m => m.auc && m.recall)
  const RECALL_MIN = 0.85
  const AUC_MIN    = 0.89

  // 기준 통과 여부
  const rows = binary.map(m => ({
    ...m,
    passRecall: (m.recall || 0) >= RECALL_MIN,
    passAuc:    (m.auc    || 0) >= AUC_MIN,
    passAll:    (m.recall || 0) >= RECALL_MIN && (m.auc || 0) >= AUC_MIN,
  })).sort((a, b) => b.auc - a.auc)

  const BAR_COLORS = { pass: 'var(--red)', fail: 'var(--text3)' }

  return (
    <div className="ml-chart-stack">
      <div className="ml-chart-head">
        <div>
          <div className="ml-chart-kicker">SELECTION CRITERIA</div>
          <div className="ml-chart-main-title">모델 선정 기준 비교</div>
        </div>
        <span className="ml-badge">3단계 기준</span>
      </div>

      {/* 기준 카드 */}
      <div className="ml-strategy-grid" style={{ marginBottom: 20 }}>
        <div className="ml-strategy-card">
          <div className="ml-strategy-title">① 1순위 — Recall ≥ 0.85</div>
          <p className="ml-strategy-text">고지속 영상을 놓치는 FN이 가장 큰 손실. Recall이 낮으면 탈락.</p>
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', fontWeight: 700 }}>
            통과: {rows.filter(r => r.passRecall).map(r => r.model).join(' · ')}
          </p>
        </div>
        <div className="ml-strategy-card">
          <div className="ml-strategy-title">② 2순위 — AUC ≥ 0.89</div>
          <p className="ml-strategy-text">전반적인 분류 변별력. 두 기준 모두 통과한 모델만 후보.</p>
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', fontWeight: 700 }}>
            통과: {rows.filter(r => r.passAll).map(r => `${r.model}(${r.task})`).join(' · ')}
          </p>
        </div>
        <div className="ml-strategy-card" style={{ background: 'rgba(255,45,45,0.06)', border: '1px solid rgba(255,45,45,0.2)' }}>
          <div className="ml-strategy-title">③ 3순위 — 분산 안정성</div>
          <p className="ml-strategy-text">단일 최고 모델(XGBoost 0.909)보다 앙상블이 노이즈 데이터에서 오류 보정 효과로 일반화가 우수.</p>
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', fontWeight: 700 }}>최종 선택: WeightedSoftVoting</p>
        </div>
      </div>

      {/* AUC 막대 비교 */}
      <div className="ml-bar-list">
        {rows.map((r, i) => (
          <div className="ml-bar-row" key={`${r.model}-${r.task}-${i}`}>
            <div className="ml-bar-name" style={{ fontSize: 11 }}>
              {r.model}
              <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>({r.task})</span>
              {r.selected && <span style={{ marginLeft: 6, color: 'var(--red)', fontWeight: 800 }}>★</span>}
            </div>
            <div className="ml-bar-track">
              <div className="ml-bar-fill" style={{
                '--value': `${Math.round(r.auc * 100)}%`,
                '--delay': `${i * 0.08}s`,
                background: r.passAll ? 'var(--red)' : 'var(--text3)',
                opacity: r.passAll ? 1 : 0.4,
              }}/>
            </div>
            <div className="ml-bar-value" style={{ color: r.passAll ? 'var(--red)' : 'var(--text3)' }}>
              AUC {r.auc.toFixed(3)}
              {r.passRecall
                ? <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--red)' }}>R✓</span>
                : <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text3)' }}>R✗</span>
              }
            </div>
          </div>
        ))}
      </div>

      <div className="ml-insight-strip">
        <span className="ml-insight-label">RESULT</span>
        <span className="ml-insight-text">
          3단계 기준 모두 통과한 모델: WeightedSoftVoting (AUC 0.895 · Recall 0.857 · 앙상블 분산 안정).
          XGBoost 24h가 단일 AUC 최고(0.909)이지만 앙상블이 일반화 안정성에서 우위.
        </span>
      </div>
    </div>
  )
}

function SelectedModelChart({ data }) {
  const selected = (data.binaryModels || []).find(r => r.selected) || (data.binaryModels || []).find(r => r.model === data.selectedModel) || {}
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">FINAL MODEL</div><div className="ml-chart-main-title">최종 모델 선정</div></div><span className="ml-badge">{selected.model || data.selectedModel}</span></div>
    <div className="ml-strategy-grid">
      <div className="ml-strategy-card"><div className="ml-strategy-title">AUC-ROC</div><p className="ml-strategy-text metric-big">{num(selected.auc, 6)}</p></div>
      <div className="ml-strategy-card"><div className="ml-strategy-title">F1-score</div><p className="ml-strategy-text metric-big">{num(selected.f1, 6)}</p></div>
      <div className="ml-strategy-card"><div className="ml-strategy-title">Accuracy</div><p className="ml-strategy-text metric-big">{num(selected.accuracy, 6)}</p></div>
    </div>
    <div className="ml-insight-strip"><span className="ml-insight-label">RESULT</span><span className="ml-insight-text">{data.selectedReason}</span></div>
  </div>
}

function DeepModelBoard({ data }) {
  const rows = data.deepModels || []
  return <div className="ml-chart-stack">
    <div className="ml-chart-head">
      <div><div className="ml-chart-kicker">DEEP LEARNING</div><div className="ml-chart-main-title">딥러닝/확장 모델 점수</div></div>
      <span className="ml-badge">MAE · RMSE · R²</span>
    </div>
    <div className="ml-model-catalog-grid">
      {rows.map((r, i) => <div className="ml-model-tile" key={r.model} style={{ animationDelay:`${i * .055}s` }}>
        <div className="ml-mini-label"><span>{r.family || 'DL'}</span><span className="ml-badge">{r.task}</span></div>
        <div className="ml-model-name">{r.model}</div>
        {r.model === 'LSTMSequence' ? <>
          <div className="ml-model-score"><span style={{ fontSize: 22 }}>{r.verified ? 'OK' : '검증 없음'}</span></div>
          <p className="ml-model-desc">{r.note || r.status || 'LSTM 검증 수치가 저장되면 자동 표시됩니다.'}</p>
        </> : <>
          <div className="ml-model-score"><span>{r.mae_h ? Number(r.mae_h).toFixed(1) : r.expected_duration_mae_h ? Number(r.expected_duration_mae_h).toFixed(1) : num(r.bucket_macro_f1,2)}</span><small>{r.mae_h || r.expected_duration_mae_h ? 'h MAE' : 'Macro F1'}</small></div>
          <p className="ml-model-desc">RMSE {num(r.rmse_h,1)} · R² {num(r.r2 ?? r.expected_duration_r2,3)} {r.auc_gt_48h ? `· AUC>48h ${num(r.auc_gt_48h,3)}` : ''}</p>
        </>}
      </div>)}
    </div>
  </div>
}

function LstmStatusChart({ data }) {
  const lstm = data.lstm || {}
  const hasMetrics = lstm.verified && lstm.metrics
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">LSTM CHECK</div><div className="ml-chart-main-title">LSTM 검증 수치 확인</div></div><span className="ml-badge">{hasMetrics ? 'Verified' : 'Not saved'}</span></div>
    {hasMetrics ? <div className="ml-metric-row">
      {Object.entries(lstm.metrics).slice(0,4).map(([k,v]) => <div className="ml-metric-box" key={k}><div className="ml-metric-label">{k}</div><div className="ml-metric-value"><CountUp value={num(v,3)}/></div></div>)}
    </div> : <div className="ml-model-detail-card">
      <div><div className="ml-chart-kicker">확인 결과</div><div className="ml-detail-title">저장된 LSTM 검증 점수 없음</div><p className="ml-model-desc">backend에는 LSTM 학습 코드와 `/predict/lstm` 예측 라우터가 있지만, 실제 검증 점수를 담은 `backend/models/lstm_metrics.json` 파일은 없습니다.</p></div>
      <div className="ml-detail-list"><span>✓ MLP 24h 검증/테스트 수치는 있음</span><span>✓ SurvivalNet, Wide&Deep 수치는 있음</span><span className="ml-detail-weak">주의: LSTM 수치를 임의로 넣으면 근거가 약해집니다.</span></div>
    </div>}
    <div className="ml-insight-strip"><span className="ml-insight-label">ACTION</span><span className="ml-insight-text">LSTM 점수를 표시하려면 학습 후 생성되는 lstm_metrics.json을 API가 읽게 하면 됩니다.</span></div>
  </div>
}

function ModelStoryChart({ data }) {
  return <div className="ml-chart-stack">
    <div className="ml-chart-head"><div><div className="ml-chart-kicker">STORY LINE</div><div className="ml-chart-main-title">발표용 모델 해석 흐름</div></div><span className="ml-badge">Decision Flow</span></div>
    <div className="ml-flow-line">
      {[
        ['① ML 후보', 'XGBoost · LightGBM · RandomForest · CatBoost'],
        ['② 앙상블', `${data.selectedModel || 'WeightedSoftVoting'} 중심 최종 선택`],
        ['③ DL 비교', 'MLP · SurvivalNet · Wide&Deep은 지속시간 예측 보조'],
        ['④ LSTM', '검증 점수 확보 시 sequence 확장 모델로 표시'],
      ].map((x,i)=><div className="ml-flow-step" key={x[0]} style={{ animationDelay:`${i*.08}s` }}><div className="ml-flow-no">{x[0]}</div><div className="ml-flow-text">{x[1]}</div></div>)}
    </div>
  </div>
}

export default function ModelPage({ onBack }) {
  const [active, setActive] = useState(0)
  const { data, apiState } = useModelData()

  const selected = (data.binaryModels || []).find(r => r.selected) || {}
  const rows = toUnifiedRows(data)

  const sections = [
    {
      id:'score', tag:'점수', shortTitle:'전체 점수', title:'모델 전체 점수판',
      Chart:() => <PaginatedModelBoard data={data}/>,
      findings:[
        '총 13개 모델(ML 7개 · DL 4개 · Ensemble 2개)을 동일한 데이터와 분리 방식으로 평가했습니다.',
        '단일 지표(AUC만)로 결정하지 않고 AUC · F1 · Accuracy · Recall을 함께 보았습니다. 고지속 영상 탐지가 목적이므로 Recall을 특히 중요하게 봤습니다.',
        'video_id 기준 GroupShuffleSplit으로 분리해 동일 영상이 학습·검증에 동시에 들어가는 데이터 누수를 방지했습니다.',
      ],
      note:'비교 기준: AUC + Recall 우선 · GroupSplit 누수 방지',
    },
    {
      id:'criteria', tag:'기준', shortTitle:'선정 기준', title:'모델 선정 기준 분석',
      Chart:() => <SelectionCriteriaChart data={data}/>,
      findings:[
        '1순위 기준 — Recall ≥ 0.85: 고지속 영상을 놓치는 FN이 더 큰 손실입니다. XGBoost 24h(0.872), WeightedSoftVoting(0.857), RandomForest(0.860)가 통과했습니다.',
        '2순위 기준 — AUC ≥ 0.89: 분류 전반의 변별력입니다. XGBoost 24h(0.909), RandomForest(0.895), WeightedSoftVoting(0.895), LightGBM(0.892)가 통과했습니다.',
        '3순위 기준 — 일반화 안정성: 단일 모델 중 XGBoost가 가장 높지만, 앙상블은 여러 모델이 서로 오류를 보정해 노이즈가 많은 트렌딩 데이터에서 분산이 더 낮습니다. 최종적으로 WeightedSoftVoting을 선택했습니다.',
      ],
      note:'최종 선택: Recall · AUC · 분산 안정성 3기준 모두 충족',
    },
    {
      id:'final', tag:'최종', shortTitle:'최종 모델', title:'최종 모델 선정 근거',
      Chart:() => <SelectedModelChart data={data}/>,
      findings:[
        'WeightedSoftVoting을 최종 모델로 선정한 이유는 단일 모델 중 가장 높은 XGBoost(AUC 0.909)보다 앙상블이 일반화 성능이 더 안정적이었기 때문입니다.',
        '선정 기준은 ① 검증 AUC 0.895 이상 ② Recall 0.85 이상 ③ 단일 모델 대비 분산 감소 세 가지입니다. XGBoost · LightGBM · MLP를 0.4 · 0.35 · 0.25 가중치로 결합했습니다.',
        'WeightedSoftVoting은 어느 한 모델이 틀려도 나머지 두 모델이 보정해 주는 구조라 트렌딩처럼 노이즈가 많은 데이터에서 강점이 있습니다.',
      ],
      note:'선정 기준: AUC ≥ 0.895 · Recall ≥ 0.85 · 분산 안정성',
    },
    {
      id:'deep', tag:'딥러닝', shortTitle:'DL 점수', title:'딥러닝/확장 모델 점수',
      Chart:() => <DeepModelBoard data={data}/>,
      findings:[
        'DL 모델은 지속시간 회귀(MAE · RMSE · R²)와 구간 분류(Bucket Accuracy) 두 관점으로 평가했습니다.',
        'MLP · SurvivalNet · Wide&Deep 모두 R² 0.14~0.30 수준으로 ML 분류 모델보다 예측력이 낮았습니다. 트렌딩 데이터는 이상치가 많아 회귀보다 분류가 더 적합한 구조입니다.',
        'DL을 채택하지 않은 이유: 분류 목적에서 XGBoost 대비 뚜렷한 성능 우위가 없었고, 해석 가능성도 낮았기 때문입니다.',
      ],
      note:'DL 회귀 R² 0.14~0.30 · 분류 목적엔 ML이 우위',
    },
    {
      id:'lstm', tag:'LSTM', shortTitle:'LSTM 확인', title:'LSTM 채택 여부 판단',
      Chart:() => <LstmStatusChart data={data}/>,
      findings:[
        'LSTM은 시계열 패턴 학습에 강하지만, 저희 데이터는 트렌딩 진입 순간(T0) 단면 스냅샷 1개입니다. 연속된 시간 흐름 시퀀스가 없어 LSTM의 장점을 살리기 어렵습니다.',
        '실제로 학습 스크립트는 구현했으나, 저장된 검증 점수가 없어 다른 모델과 공정한 비교가 불가능했습니다. 근거 없는 수치를 발표에 사용하지 않기 위해 채택을 보류했습니다.',
        '향후 영상별 시간순 스냅샷 시퀀스 데이터를 구축하면 LSTM 적용이 유효할 수 있습니다.',
      ],
      note:'LSTM 미채택 근거: T0 단면 구조 · 검증 점수 미확보',
    },
    {
      id:'story', tag:'흐름', shortTitle:'선정 흐름', title:'모델 선정 흐름 요약',
      Chart:() => <ModelStoryChart data={data}/>,
      findings:[
        '① Baseline → ② 상위 모델 압축 → ③ Optuna 튜닝 → ④ 앙상블 실험 → ⑤ 최종 Test 평가 순서로 진행했습니다. Test set은 마지막 단 한 번만 사용해 데이터 누수를 막았습니다.',
        '최종 선정 흐름: XGBoost 단일 AUC 0.909 → WeightedSoftVoting 앙상블로 일반화 성능 보완 → Recall 0.857 확인 → 최종 채택.',
        'Part 7 Feature Importance와 연결하면 "왜 이 모델이, 어떤 변수로, 어떻게 예측하는지"까지 설명할 수 있습니다.',
      ],
      note:'Test set은 최종 1회만 사용 · 누수 없는 평가',
    },
  ]

  return <div className="yta-app-inner">
    <motion.button className="back-btn" onClick={onBack} whileHover={{ x:-3 }} transition={{ duration:.2 }}>← 목록으로</motion.button>
    <motion.div className="part-page-header" variants={fadeUpStagger} initial="hidden" animate="show">
      <motion.span className="part-page-num" variants={fadeUp}>Part 5</motion.span>
      <motion.h1 className="part-page-title" variants={fadeUp}>모델 점수 및 결과 시각화</motion.h1>
      <motion.p className="part-page-subtitle" variants={fadeUp}>머신러닝·딥러닝 모델의 실제 검증 지표를 6개씩 비교하고 최종 모델과 LSTM 적용 상태를 정리합니다.</motion.p>
      <motion.div variants={fadeUp} style={{ display:'flex', alignItems:'center', gap:10 }}><div className="api-status api-status--ok"><span className="api-status-dot"/><span>{apiState} · {API}</span></div></motion.div>
      <motion.div className="eda-summary-row" variants={fadeUpStagger}>
        {[["모델 수", `${rows.length}개`],["최종 모델", data.selectedModel || 'WeightedSoftVoting'],["AUC", num(selected.auc ?? 0.895124,3)],["F1", num(selected.f1 ?? 0.796048,3)],["Accuracy", num(selected.accuracy ?? 0.802773,3)]].map(([l,v])=><motion.div key={l} className="eda-summary-item" variants={fadeUp}><span className="eda-summary-label">{l}</span><span className="eda-summary-val"><CountUp value={v}/></span></motion.div>)}
      </motion.div>
    </motion.div>
    <TabSectionLayout sections={sections} active={active} setActive={setActive}/>
  </div>
}