/** 데이터 불러오기 실패 안내 */
export default function LoadError({ message = '데이터를 불러오지 못했습니다.', onRetry }) {
  return (
    <div className="load-error" role="alert">
      {message}
      {onRetry && (
        <button type="button" className="btn-sm ghost" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
