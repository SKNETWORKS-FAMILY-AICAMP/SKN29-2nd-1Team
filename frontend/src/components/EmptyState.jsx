import '../styles/feedback.css'

export default function EmptyState({ title = '표시할 데이터가 없습니다', message = '필터를 변경하거나 API 연결 상태를 확인해 주세요.', actionLabel, onAction }) {
  return (
    <div className="ui-feedback-card ui-feedback-empty">
      <div className="ui-feedback-icon">∅</div>
      <strong>{title}</strong>
      <p>{message}</p>
      {actionLabel && (
        <button type="button" onClick={onAction} className="ui-feedback-btn">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
