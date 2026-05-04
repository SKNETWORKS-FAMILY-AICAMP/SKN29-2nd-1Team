import { motion } from 'framer-motion'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { fadeUp, fadeUpStagger } from '../animations/variants'
import { FEATURE_IMPORTANCE_EXPLAIN, ML_PIPELINE_STEPS } from '../constants/mlProjectData'
import '../styles/MLStructurePage.css'

const tooltipStyle = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  color: 'var(--text)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.12)',
}

export default function ModelExplainPage({ onBack }) {
  return (
    <div className="yta-app-inner ml-page-wrap">
      <button className="back-btn" onClick={onBack}>← 목록으로</button>

      <motion.section className="ml-hero" variants={fadeUpStagger} initial="hidden" animate="show">
        <motion.span className="part-page-num" variants={fadeUp}>Part 7 · Explainable ML</motion.span>
        <motion.h1 className="part-page-title" variants={fadeUp}>모델 해석과 학습 전략</motion.h1>
        <motion.p className="part-page-subtitle" variants={fadeUp}>
          단순히 예측값만 보여주는 것이 아니라, 어떤 변수와 실험 전략이 결과에 영향을 주었는지 설명 가능한 구조로 정리했습니다.
        </motion.p>
      </motion.section>

      <section className="ml-two-grid">
        <article className="ml-panel">
          <div className="ml-section-head">
            <span>Feature Impact</span>
            <h2>주요 영향 변수</h2>
            <p>발표에서는 이 그래프를 사용해 “왜 이런 예측이 나왔는지” 설명할 수 있습니다.</p>
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={FEATURE_IMPORTANCE_EXPLAIN} layout="vertical" margin={{ left: 56, right: 24 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.45} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text2)', fontSize: 12 }} />
              <YAxis type="category" dataKey="feature" width={145} tick={{ fill: 'var(--text2)', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => `${v}점`} />
              <Bar dataKey="impact" name="영향도" fill="var(--red)" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="ml-panel explain-card-list">
          <div className="ml-section-head">
            <span>Interpretation</span>
            <h2>해석 포인트</h2>
            <p>Feature Importance를 그대로 나열하지 않고, 콘텐츠 트렌드 관점으로 바꿔 설명합니다.</p>
          </div>
          {FEATURE_IMPORTANCE_EXPLAIN.map((item) => (
            <div className="ml-explain-row" key={item.feature}>
              <strong>{item.feature}</strong>
              <p>{item.desc}</p>
            </div>
          ))}
        </article>
      </section>

      <section className="ml-panel">
        <div className="ml-section-head">
          <span>Training Strategy</span>
          <h2>학습 실험 설계</h2>
          <p>업로드된 ML 구조의 핵심은 “Baseline → 튜닝 → 앙상블 → 최종 평가” 순서입니다.</p>
        </div>
        <div className="ml-timeline">
          {ML_PIPELINE_STEPS.map((item, idx) => (
            <div className="ml-timeline-item" key={item.step}>
              <div className="ml-timeline-dot">{idx + 1}</div>
              <div>
                <strong>{item.step}</strong>
                <p>{item.detail}</p>
                <span>{item.output}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="ml-panel ml-code-panel">
        <div className="ml-section-head">
          <span>Presentation Point</span>
          <h2>발표에서 강조할 한 줄</h2>
        </div>
        <pre>{`최종 모델은 예측 성능만 높인 것이 아니라,
video_id 기준 GroupSplit과 누수 변수 제거를 통해
실제 서비스 환경에서도 일반화될 수 있도록 설계했습니다.`}</pre>
      </section>
    </div>
  )
}
