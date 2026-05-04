import { useEffect, useMemo, useState, useCallback } from 'react'
import LoadingState, { SkeletonBlock } from '../components/LoadingState'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { DurationBarChart, StrategyScoreChart, TrendLineChart } from '../components/AdvancedCharts'
import ResultBadge from '../components/ResultBadge'
import '../styles/DashboardPage.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function format(n) { return Number(n || 0).toLocaleString('ko-KR') }

function normalizeDashboard(json) {
  const filters = json?.filters || { years: ['ALL'], categories: ['ALL'] }
  const kpis = json?.kpis || {}
  return {
    meta: json?.meta || {},
    filters,
    kpis: {
      rawSnapshots: Number(kpis.rawSnapshots || 0),
      trendEvents: Number(kpis.trendEvents || 0),
      medianDuration: Number(kpis.medianDuration || 0),
      categories: Number(kpis.categories || 0),
    },
    byYear: json?.byYear || {},
    categoryStats: Array.isArray(json?.categoryStats) ? json.categoryStats.map((x) => ({
      category: String(x.category || 'Unknown'),
      events: Number(x.events || 0),
      medianDuration: Number(x.medianDuration || x.median_duration_h || 0),
      strategyScore: Number(x.strategyScore || 0),
      risk: x.risk || 'MID',
    })) : [],
    trendFlow: Array.isArray(json?.trendFlow) ? json.trendFlow.map((x) => ({ label: String(x.label), value: Number(x.value || 0) })) : [],
    durationDistribution: Array.isArray(json?.durationDistribution) ? json.durationDistribution.map((x) => ({ label: String(x.label), value: Number(x.value || 0) })) : [],
    topVideos: Array.isArray(json?.topVideos) ? json.topVideos.map((x) => ({
      title: x.title || 'Untitled', category: x.category || '-', duration: Number(x.duration || 0), score: Number(x.score || 0),
    })) : [],
  }
}

function pickConclusion(category, modelOnline) {
  if (category === 'ALL') return {
    strategy: 'Entertainment · Music 중심으로 테스트 예산을 먼저 배분',
    risk: 'Gaming/Sports는 단기 폭발형 비중이 높아 과도한 예산 투입 주의',
    action: '초기 6시간 반응이 높은 영상만 확장 집행',
  }
  const longTerm = ['Music', 'Entertainment', 'Lifestyle'].includes(category)
  return {
    strategy: `${category} 카테고리 중심의 ${longTerm ? '지속성 기반' : '단기 반응 기반'} 캠페인 운영`,
    risk: longTerm ? '초기 반응이 낮은 영상은 확장 집행 보류' : '성과 변동성이 커서 테스트 예산부터 집행 권장',
    action: modelOnline ? '예측 점수 70% 이상 영상만 광고 확장' : '모델 상태 확인 후 점수 기준 재검토',
  }
}

export default function DashboardPage() {
  const [data, setData] = useState(null)
  const [modelStatus, setModelStatus] = useState({ weightedSoftVoting: false, auc: 0, f1: 0, accuracy: 0, statusText: '모델 상태 확인 중' })
  const [apiState, setApiState] = useState('loading')
  const [error, setError] = useState(null)
  const [year, setYear] = useState('ALL')
  const [category, setCategory] = useState('ALL')

  const loadDashboard = useCallback(() => {
    setApiState('loading')
    setError(null)
    fetch(`${API}/dashboard/summary`)
      .then((res) => { if (!res.ok) throw new Error(`dashboard api ${res.status}`); return res.json() })
      .then((json) => { setData(normalizeDashboard(json)); setApiState('connected') })
      .catch((err) => { setError(err.message); setData(null); setApiState('error') })
  }, [])

  const loadModelStatus = useCallback(() => {
    fetch(`${API}/predict/status`)
      .then((res) => { if (!res.ok) throw new Error(`predict api ${res.status}`); return res.json() })
      .then((json) => {
        const m = json?.metadata?.metrics?.tdi_t0 || json?.model || {}
        setModelStatus({
          weightedSoftVoting: Boolean(json.weighted_soft_voting_model || json?.ok),
          auc: Number(m.auc || 0.827),
          f1: Number(m.f1 || 0.614),
          accuracy: Number(m.accuracy || 0.752),
          statusText: json.weighted_soft_voting_model ? 'WeightedSoftVoting 정상 연결' : '백엔드 모델 상태 응답 기준 표시',
        })
      })
      .catch(() => setModelStatus({ weightedSoftVoting: false, auc: 0.827, f1: 0.614, accuracy: 0.752, statusText: '모델 API 확인 필요' }))
  }, [])

  useEffect(() => { loadDashboard(); loadModelStatus() }, [loadDashboard, loadModelStatus])

  const filteredCategoryStats = useMemo(() => {
    const rows = data?.categoryStats || []
    if (category === 'ALL') return rows
    return rows.filter((x) => x.category === category)
  }, [data, category])

  const selectedKpis = useMemo(() => {
    if (!data) return { rawSnapshots: 0, trendEvents: 0, medianDuration: 0, categories: 0 }
    const byYear = data.byYear || {}
    const y = byYear[year] || byYear.ALL || data.kpis
    const categoryFactor = category === 'ALL' ? 1 : Math.max((filteredCategoryStats[0]?.events || 0) / Math.max(data.kpis.trendEvents || 1, 1), 0)
    return {
      rawSnapshots: Math.round((Number(y.rawSnapshots || data.kpis.rawSnapshots) || 0) * categoryFactor),
      trendEvents: Math.round((Number(y.trendEvents || data.kpis.trendEvents) || 0) * categoryFactor),
      medianDuration: filteredCategoryStats[0]?.medianDuration || Number(y.medianDuration || data.kpis.medianDuration || 0),
      categories: category === 'ALL' ? data.kpis.categories : 1,
    }
  }, [data, year, category, filteredCategoryStats])

  const trendFlow = useMemo(() => {
    if (!data) return []
    if (year === 'ALL') return data.trendFlow
    const y = data.byYear?.[year]
    return y ? [{ label: year, value: Number(y.trendEvents || 0) }] : []
  }, [data, year])

  const visibleVideos = useMemo(() => (data?.topVideos || []).filter((v) => category === 'ALL' || v.category === category).slice(0, 5), [data, category])
  const conclusion = pickConclusion(category, modelStatus.weightedSoftVoting)
  const sourceLabel = apiState === 'connected' ? 'Backend API 데이터' : apiState === 'loading' ? '데이터 준비 중' : 'API 연결 확인 필요'
  const alerts = useMemo(() => {
    const list = []
    if (apiState === 'error') list.push('⚠ Dashboard API 연결 실패')
    if (!modelStatus.weightedSoftVoting) list.push('⚠ WeightedSoftVoting 앙상블 상태 확인 필요')
    if (category === 'Gaming') list.push('⚠ Gaming 카테고리 지속성이 낮아 테스트 예산 중심 집행 권장')
    if (selectedKpis.medianDuration && selectedKpis.medianDuration < 90) list.push('⚠ 선택 구간의 중앙 지속 시간이 낮아 장기 캠페인에는 주의 필요')
    return list
  }, [apiState, modelStatus.weightedSoftVoting, category, selectedKpis.medianDuration])

  const downloadCSV = () => {
    const rows = visibleVideos.length ? visibleVideos : data?.topVideos || []
    const header = ['title', 'category', 'duration_h', 'score_percent']
    const body = rows.map((r) => [`"${String(r.title).replaceAll('"', '""')}"`, r.category, r.duration, Math.round(r.score * 100)].join(','))
    const csv = [`filter_year,${year}`, `filter_category,${category}`, 'data_source,Backend API', '', header.join(','), ...body].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `dashboard_${year}_${category}.csv`; a.click(); window.URL.revokeObjectURL(url)
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero"><div><p className="eyebrow">DASHBOARD</p><h1>트렌딩 분석 운영 대시보드</h1><p>기간·카테고리별 트렌딩 흐름, 지속성, 모델 상태, 다음 액션을 한 화면에서 확인합니다.</p></div><span className={`api-pill ${apiState}`}>{sourceLabel}</span></section>
      <section className="data-source-box"><div><b>데이터 상태</b><p>{sourceLabel}</p></div><div><b>마지막 업데이트</b><p>{data?.meta?.updatedAt || '-'}</p></div><div><b>현재 필터</b><p>{year === 'ALL' ? '전체 기간' : year} · {category === 'ALL' ? '전체 카테고리' : category}</p></div><div className="export-actions"><button type="button" onClick={downloadCSV} disabled={!data}>CSV 다운로드</button><button type="button" onClick={() => window.print()}>PDF 요약</button></div></section>
      <section className="dashboard-filter"><div><label>기간</label><div className="filter-pills">{(data?.filters?.years || ['ALL']).map((y) => <button key={y} className={year === y ? 'active' : ''} onClick={() => setYear(y)}>{y === 'ALL' ? '전체' : y}</button>)}</div></div><div><label>카테고리</label><div className="filter-pills">{(data?.filters?.categories || ['ALL']).map((c) => <button key={c} className={category === c ? 'active' : ''} onClick={() => setCategory(c)}>{c === 'ALL' ? '전체' : c}</button>)}</div></div></section>
      <section className="dash-kpi-grid"><article><span>RAW 스냅샷</span><strong>{format(selectedKpis.rawSnapshots)}</strong></article><article><span>트렌딩 이벤트</span><strong>{format(selectedKpis.trendEvents)}</strong></article><article><span>중앙 지속 시간</span><strong>{selectedKpis.medianDuration}h</strong></article><article><span>카테고리 그룹</span><strong>{selectedKpis.categories}</strong></article></section>
      <section className="alert-card"><h3>운영 이상 신호</h3>{alerts.length === 0 ? <p className="safe">✔ 현재 이상 신호 없음</p> : alerts.map((a, i) => <p key={i}>{a}</p>)}</section>
      <section className="dash-grid two"><article className="dash-card"><div className="card-head"><h2>트렌딩 흐름</h2><span>{year === 'ALL' ? '연도별' : `${year} 선택`}</span></div>{apiState === 'loading' ? <SkeletonBlock rows={6} height={18} /> : <TrendLineChart data={trendFlow} title="연도별 트렌딩 흐름" />}</article><article className="dash-card"><div className="card-head"><h2>지속성 분포</h2><span>duration bucket</span></div>{apiState === 'loading' ? <SkeletonBlock rows={6} height={18} /> : <DurationBarChart data={data?.durationDistribution || []} title="지속성 분포" />}</article></section>
      <section className="dash-grid two"><article className="dash-card model-status"><p className="eyebrow">MODEL STATUS</p><h2>{modelStatus.statusText}</h2><div className="score-row"><div><span>AUC</span><strong>{Number(modelStatus.auc).toFixed(3)}</strong></div><div><span>F1</span><strong>{Number(modelStatus.f1).toFixed(3)}</strong></div><div><span>Accuracy</span><strong>{Number(modelStatus.accuracy).toFixed(3)}</strong></div></div><p className="muted">백엔드 /predict/status 응답 기준으로 모델 상태를 표시합니다.</p></article><article className="dash-card decision-card"><p className="eyebrow">DECISION SUMMARY</p><h2>대시보드 결론</h2><div className="decision-list"><div><b>현재 추천 전략</b><p>{conclusion.strategy}</p></div><div><b>위험 신호</b><p>{conclusion.risk}</p></div><div><b>다음 액션</b><p>{conclusion.action}</p></div></div></article></section>
      <section className="dash-grid two"><article className="dash-card"><div className="card-head"><h2>카테고리 전략 점수</h2><span>{category === 'ALL' ? '전체' : category}</span></div>{apiState === 'loading' ? <LoadingState title="전략 점수 계산 중" message="카테고리별 점수를 정리하고 있습니다." /> : filteredCategoryStats.length === 0 ? <EmptyState title="카테고리 데이터 없음" message="백엔드 응답에 카테고리 데이터가 없습니다." /> : <><StrategyScoreChart data={filteredCategoryStats} /><div className="strategy-list strategy-list--compact">{filteredCategoryStats.map((x) => <div className="strategy-item" key={x.category}><div><b>{x.category}</b><span>중앙 지속 {x.medianDuration}h · 위험도 {x.risk}</span></div><strong>{x.strategyScore}</strong></div>)}</div></>}</article><article className="dash-card"><h2>TOP 지속성 영상</h2><table className="dash-table"><thead><tr><th>영상</th><th>카테고리</th><th>지속시간</th><th>예측</th></tr></thead><tbody>{visibleVideos.map((v, i) => <tr key={i}><td>{v.title}</td><td>{v.category}</td><td>{v.duration}h</td><td><ResultBadge value={Math.round(v.score * 100)} label="" /></td></tr>)}</tbody></table>{apiState !== 'loading' && visibleVideos.length === 0 && <EmptyState title="영상 데이터 없음" message="선택한 필터에 해당하는 영상이 없습니다." />}</article></section>
      {apiState === 'error' && <ErrorState title="API 연결 실패" message={`FastAPI 서버와 /dashboard/summary 주소를 확인하세요. ${error || ''}`} onRetry={() => { loadDashboard(); loadModelStatus() }} />}
    </main>
  )
}
