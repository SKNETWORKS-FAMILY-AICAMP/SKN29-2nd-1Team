import { AnimatePresence, motion } from 'framer-motion'
import { NAV_ITEMS, isActiveRoute } from '../../constants/navigation'

export default function MobileNavigation({ open, onClose, onNavigate, pathname }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="yta-nav-backdrop"
            aria-label="메뉴 닫기"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            className="yta-mobile-panel"
            role="dialog"
            aria-modal="true"
            aria-label="모바일 내비게이션"
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          >
            <div className="yta-mobile-panel-head">
              <strong>TrendIt 메뉴</strong>
              <button type="button" className="yta-mobile-close" onClick={onClose} aria-label="메뉴 닫기">×</button>
            </div>

            <div className="yta-mobile-grid">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`yta-mobile-link ${isActiveRoute(pathname, item) ? 'active' : ''}`}
                  onClick={() => onNavigate(item.path)}
                >
                  <span>{item.label}</span>
                  <small>{item.path === '/' ? '메인 페이지' : item.path}</small>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
