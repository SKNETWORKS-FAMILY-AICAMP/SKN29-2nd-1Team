import '../styles/feedback.css'

export default function ErrorState({ title = '데이터를 불러오지 못했습니다', message = '네트워크 또는 API 서버 상태를 확인해 주세요.', actionLabel = '다시 시도', onRetry }) {
  return (
    <div className="ui-feedback-card ui-feedback-error" role="alert">
      <div className="ui-feedback-icon">!</div>
      <strong>{title}</strong>
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="ui-feedback-btn">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
