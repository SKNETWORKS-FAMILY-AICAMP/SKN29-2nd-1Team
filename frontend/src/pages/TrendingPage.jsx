// pages/TrendingPage.jsx — 파트 목록 페이지
import { useNavigate, useParams, Routes, Route } from 'react-router-dom'
import { motion } from 'framer-motion'
import { fadeUp, fadeUpStagger } from '../animations/variants'
import { FALLBACK } from '../constants/fallbackData'
import { makeEDASections } from './EDAsections'
import '../styles/TrendingPage.css'
import FeaturePage    from './FeaturePage'
import InsightPage    from './InsightPage'
import ProblemPage    from './ProblemPage'
import EDAPage        from './EDAPage'
import ModelPage      from './ModelPage'
import PredictionPage from './PredictionPage'
import StrategyPage   from './StrategyPage'
import ComparePage    from './ComparePage'
import ModelInterpretPage from './ModelInterpretPage'

import {
  EDAIcon, FeatureIcon, DataInterpretIcon, ProblemIcon,
  ModelResultIcon, CompareIcon, ExplainIcon, PredictionIcon, InsightIcon,
} from '../components/icons'

const PARTS = [
  {
    num: 1, slug: 'eda',
    title: 'EDA',
    desc: '34,964 이벤트 탐색 — 카테고리 분포, 수명, 피처 상관',
    Icon: EDAIcon,
    Component: EDAPage,
    tags: ['DISTRIBUTION', 'DURATION', 'CORRELATION'],
  },
  {
    num: 2, slug: 'feature',
    title: 'Feature Engineering',
    desc: '로그 변환 · 파생 변수 생성 · 인코딩 · Before/After 비교 시각화',
    Icon: FeatureIcon,
    Component: FeaturePage,
    tags: ['LOG1P', 'DERIVED', 'ENCODING', 'T0', '24H'],
  },
  {
    num: 3, slug: 'insight',
    title: '데이터 해석',
    desc: '변수 간 관계 분석 — Scatter, Heatmap, 트렌드 패턴 설명',
    Icon: DataInterpretIcon,
    Component: InsightPage,
    tags: ['RELATION', 'CATEGORY', 'TIME', 'REACTION'],
  },
  {
    num: 4, slug: 'problem',
    title: '문제 정의',
    desc: '분류: 트렌딩 유지 여부 · 회귀: 지속 시간 예측',
    Icon: ProblemIcon,
    Component: ProblemPage,
    tags: ['CLASSIFY', 'REGRESSION', 'TARGET', 'T0'],
  },
  {
    num: 5, slug: 'model',
    title: '모델 결과 시각화',
    desc: '분류 모델 성능 + 딥러닝 24h 지속 시간 예측 결과 비교',
    Icon: ModelResultIcon,
    Component: ModelPage,
    tags: ['AUC', 'F1', 'CM', 'MLP', '24H'],
  },
  {
    num: 6, slug: 'compare',
    title: '카테고리 비교',
    desc: '카테고리별 데이터 분포와 예측 난이도, 지속시간 차이를 비교',
    Icon: CompareIcon,
    Component: ComparePage,
    tags: ['CATEGORY', 'DURATION', 'RMSE', '24H'],
  },
  {
    num: 7, slug: 'explain',
    title: '모델 해석',
    desc: 'Feature Importance와 주요 변수 영향, 예측 신뢰도 해석',
    Icon: ExplainIcon,
    Component: ModelInterpretPage,
    tags: ['IMPORTANCE', 'SHAP', 'CONFIDENCE'],
  },
  {
    num: 8, slug: 'predict',
    title: '예측 시스템',
    desc: '사용자 입력 기반 트렌딩 지속성 예측 결과 제공',
    Icon: PredictionIcon,
    Component: PredictionPage,
    tags: ['PREDICT', 'T0', '24H', 'SERVICE'],
  },
  {
    num: 9, slug: 'strategy',
    title: '인사이트 & 전략',
    desc: '업로드 요일, 초기 조회수, 카테고리별 전략 도출',
    Icon: InsightIcon,
    Component: StrategyPage,
    tags: ['STRATEGY', 'TIMING', 'ROI', 'ACTION'],
  },
]

/* Coming Soon 페이지 */
function ComingSoonPage({ part, onBack }) {
  return (
    <div className="yta-app-inner">
      <button className="back-btn" onClick={onBack}>← 목록으로</button>
      <div className="part-page-header" style={{ textAlign: 'center', padding: '60px 0' }}>
        <div style={{ marginBottom: 24, opacity: 0.3 }}>
          <part.Icon />
        </div>
        <span className="part-page-num">Part {part.num}</span>
        <h1 className="part-page-title">{part.title}</h1>
        <p className="part-page-subtitle">{part.desc}</p>
        <div style={{
          display: 'inline-block', marginTop: 24,
          padding: '8px 20px', borderRadius: 20,
          border: '1px solid var(--border)',
          fontSize: 13, color: 'var(--text3)',
        }}>
          🚧 준비 중입니다
        </div>
      </div>
    </div>
  )
}

/* 태그 */
function PartTags({ part }) {
  if (part.num === 1) {
    return (
      <div className="part-eda-tags">
        {makeEDASections(FALLBACK).map(s => (
          <span key={s.id} className="part-eda-tag">{s.tag}</span>
        ))}
      </div>
    )
  }
  if (!part.tags?.length) return null
  return (
    <div className="part-eda-tags">
      {part.tags.map(tag => <span key={tag} className="part-eda-tag">{tag}</span>)}
    </div>
  )
}

/* 목록 화면 */
function PartList() {
  const navigate = useNavigate()

  const HERO_STATS = [
    { val:'34.9', unit:'K', label:'분석 이벤트', change:'2022–2025', red:false },
    { val:'0.827', unit:'', label:'AUC-ROC', change:'WeightedVoting', red:true },
    { val:'86', unit:'%', label:'Recall', change:'고지속 탐지율', red:true },
    { val:'144', unit:'h', label:'평균 지속', change:'중앙값 108h', red:false },
  ]

  return (
    <div className="yta-app-wrap">
      {/* ── 히어로 ── */}
      <div className="trending-hero">
        <div className="trending-hero-grid"/>
        <div className="trending-hero-glow"/>
        <div className="trending-hero-inner">
          <motion.div
            className="trending-hero-left"
            variants={fadeUpStagger} initial="hidden" animate="show"
          >
            <motion.div className="trending-hero-eyebrow" variants={fadeUp}>
              <div className="trending-hero-dot"/>
              YouTube KR Trending Analysis
            </motion.div>
            <motion.h1 className="trending-hero-title" variants={fadeUp}>
              유튜브 트렌딩<br/>
              <span>심층 분석</span>
            </motion.h1>
            <motion.p className="trending-hero-sub" variants={fadeUp}>
              34,964개 트렌딩 이벤트를 기반으로 EDA부터 예측 모델까지<br/>
              9개 파트로 구성된 완전한 데이터 분석 파이프라인입니다.
            </motion.p>
            <motion.div className="trending-hero-btns" variants={fadeUp}>
              <button className="trending-hero-btn-primary" onClick={() => {
                document.getElementById('parts-contents')?.scrollIntoView({ behavior:'smooth' })
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                </svg>
                분석 시작하기
              </button>
              <button className="trending-hero-btn-secondary" onClick={() => navigate('/analysis/compare')}>
                카테고리 비교 →
              </button>
            </motion.div>
          </motion.div>

          {/* 우측 스탯 카드 */}
          <motion.div
            className="trending-hero-stats"
            initial={{ opacity:0, x:30 }} animate={{ opacity:1, x:0 }}
            transition={{ duration:0.7, delay:0.2, ease:[0.22,1,0.36,1] }}
          >
            {HERO_STATS.map((s,i) => (
              <motion.div
                key={s.label} className="th-stat"
                initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
                transition={{ duration:0.5, delay:0.3+i*0.08, ease:[0.22,1,0.36,1] }}
              >
                <div className="th-stat-val">
                  {s.val}<span>{s.unit}</span>
                </div>
                <div className="th-stat-label">{s.label}</div>
                <div className={`th-stat-change ${s.red ? 'red' : ''}`}>{s.change}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── 파트 그리드 ── */}
      <div className="yta-app-inner">
        <div className="parts-section-new" id="parts-contents">
          <div className="parts-section-head">
            <div>
              <div className="parts-section-title">분석 파트</div>
              <div className="parts-section-sub">순서대로 또는 원하는 파트를 선택하세요</div>
            </div>
            <div className="parts-count-badge">{PARTS.filter(p=>!p.comingSoon).length}개 완성 · {PARTS.filter(p=>p.comingSoon).length}개 준비중</div>
          </div>

          <motion.div
            className="parts-grid-new"
            variants={fadeUpStagger} initial="hidden" animate="show"
          >
            {PARTS.map((part, idx) => (
              <motion.div
                key={part.num}
                className={`part-card-new ${part.comingSoon ? 'coming' : ''}`}
                onClick={() => !part.comingSoon && navigate(`/analysis/${part.slug}`)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key==='Enter' && !part.comingSoon && navigate(`/analysis/${part.slug}`)}
                variants={fadeUp}
                whileHover={part.comingSoon ? {} : { y:-6 }}
                whileTap={part.comingSoon ? {} : { scale:0.98 }}
              >
                {/* 헤더 */}
                <div className="pcn-header">
                  <div className="pcn-icon">
                    <part.Icon/>
                  </div>
                  <div className="pcn-num">Part {part.num}</div>
                </div>

                {/* 본문 */}
                <div className="pcn-title">{part.title}</div>
                <div className="pcn-desc">{part.desc}</div>

                {/* 태그 */}
                <div className="pcn-tags">
                  {part.num === 1
                    ? makeEDASections(FALLBACK).map(s => (
                        <span key={s.id} className="pcn-tag">{s.tag}</span>
                      ))
                    : part.tags?.map(tag => (
                        <span key={tag} className="pcn-tag">{tag}</span>
                      ))
                  }
                  {part.comingSoon && <span className="pcn-coming-tag">준비중</span>}
                </div>

                {/* 푸터 */}
                <div className="pcn-footer">
                  <div style={{ fontSize:11, color:'var(--text3)' }}>
                    {part.comingSoon ? '곧 공개됩니다' : '클릭해서 분석 보기'}
                  </div>
                  {!part.comingSoon && (
                    <div className="pcn-arrow">
                      열기
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
                      </svg>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

/* 개별 파트 래퍼 */
function PartView({ slug }) {
  const navigate = useNavigate()
  const part = PARTS.find(p => p.slug === slug)
  const onBack = () => navigate('/analysis')

  if (!part) return <div className="yta-app-wrap"><div className="yta-app-inner"><button className="back-btn" onClick={onBack}>← 목록으로</button><p>존재하지 않는 파트입니다.</p></div></div>
  if (part.comingSoon) return <div className="yta-app-wrap"><ComingSoonPage part={part} onBack={onBack}/></div>

  const Comp = part.Component
  if (!Comp) return <div className="yta-app-wrap"><ComingSoonPage part={{ ...part, comingSoon: true }} onBack={onBack}/></div>
  return <div className="yta-app-wrap"><Comp onBack={onBack}/></div>
}

/* 메인 라우터 */
export default function TrendingPage() {
  return (
    <Routes>
      <Route index element={<PartList/>}/>
      <Route path=":slug" element={<SlugRouter/>}/>
    </Routes>
  )
}

function SlugRouter() {
  const { slug } = useParams()
  return <PartView slug={slug}/>
}