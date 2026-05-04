/**
 * TabSectionLayout
 * ─────────────────
 * EDAPage / ModelPage / FeaturePage 등이 공통으로 쓰는
 * "탭 목록 → 차트 패널 + 설명 패널" 레이아웃.
 *
 * Props:
 *   sections  — [{ id, tag, shortTitle, title, Chart, findings, note }]
 *   active    — 현재 활성 탭 index (number)
 *   setActive — setter
 */
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp, slideTab } from '../animations/variants'

export default function TabSectionLayout({ sections, active, setActive }) {
  const sec   = sections[active]
  const total = sections.length

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show">
      {/* ── 탭 바 ── */}
      <div className="eda-tabs" role="tablist" aria-label="분석 섹션 탭">
        {sections.map((s, i) => (
          <motion.button
            key={s.id}
            role="tab"
            aria-selected={active === i}
            aria-controls={`tabpanel-${s.id}`}
            id={`tab-${s.id}`}
            className={`eda-tab ${active === i ? 'on' : ''}`}
            onClick={() => setActive(i)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="eda-tab-tag">{s.tag}</span>
            <span className="eda-tab-title">{s.shortTitle}</span>
          </motion.button>
        ))}
      </div>


      <label className="eda-tab-select-wrap" htmlFor="eda-tab-select">
        <span>분석 섹션</span>
        <select
          id="eda-tab-select"
          className="eda-tab-select"
          value={active}
          onChange={(event) => setActive(Number(event.target.value))}
        >
          {sections.map((s, i) => (
            <option key={s.id} value={i}>{s.tag} · {s.shortTitle}</option>
          ))}
        </select>
      </label>

      {/* ── 바디 ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          id={`tabpanel-${sec.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${sec.id}`}
          className="eda-body"
          variants={slideTab}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          {/* 차트 */}
          <div className="eda-chart-panel">
            <p className="eda-chart-title">{sec.title}</p>
            <div className="eda-chart-wrap" style={{ overflow: "visible", alignItems: "center" }}>
              <sec.Chart />
            </div>
          </div>

          {/* 설명 */}
          <div className="eda-desc-panel">
            <div className="eda-tag-row">
              <span className="eda-big-tag">{sec.tag}</span>
              <span className="eda-progress">{active + 1} / {total}</span>
            </div>
            <h3 className="eda-desc-title">{sec.title}</h3>
            <p className="eda-findings-label">주요 발견</p>
            <ul className="eda-findings">
              {sec.findings.map((f, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                >
                  <span className="eda-finding-num">{i + 1}</span>{f}
                </motion.li>
              ))}
            </ul>
            <div className="eda-note-box">
              <span className="eda-note-label">NOTE</span>
              <span className="eda-note-text">{sec.note}</span>
            </div>
            <div className="eda-nav-btns">
              <motion.button
                className="eda-nav-btn"
                disabled={active === 0}
                onClick={() => setActive(a => a - 1)}
                whileHover={active > 0 ? { x: -2 } : {}}
                whileTap={active > 0 ? { scale: 0.97 } : {}}
                aria-label="이전 섹션"
              >
                ← 이전
              </motion.button>
              <motion.button
                className="eda-nav-btn"
                disabled={active === total - 1}
                onClick={() => setActive(a => a + 1)}
                whileHover={active < total - 1 ? { x: 2 } : {}}
                whileTap={active < total - 1 ? { scale: 0.97 } : {}}
                aria-label="다음 섹션"
              >
                다음 →
              </motion.button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
