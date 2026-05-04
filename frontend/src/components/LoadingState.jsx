import '../styles/feedback.css'

export function Spinner({ label = '불러오는 중입니다' }) {
  return (
    <div className="ui-spinner-wrap" role="status" aria-live="polite">
      <span className="ui-spinner" />
      <span>{label}</span>
    </div>
  )
}

export function SkeletonBlock({ rows = 4, height = 16 }) {
  return (
    <div className="ui-skeleton-block" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <span
          key={i}
          className="ui-skeleton-line"
          style={{ height, width: `${100 - i * 11}%` }}
        />
      ))}
    </div>
  )
}

export default function LoadingState({ title = '데이터를 준비하고 있습니다', message = '잠시만 기다려 주세요.' }) {
  return (
    <div className="ui-feedback-card ui-feedback-loading" role="status" aria-live="polite">
      <Spinner label={title} />
      <p>{message}</p>
      <SkeletonBlock rows={3} />
    </div>
  )
}
