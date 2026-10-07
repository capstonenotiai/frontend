/**
 * 캘린더 등록 토글 버튼.
 *  - variant 'compact' : 대시보드용 (.btn-register)  "등록하기" / "등록됨"
 *  - variant 'full'    : 일정 목록용 (.btn-reg)      "캘린더 등록" / "등록됨"
 * 원본과 동일하게 "등록됨" 상태에서 다시 누르면 등록 해제된다.
 */
export default function RegisterButton({ registered, onToggle, variant = 'compact', disabled = false, reason = '' }) {
  const handleClick = (event) => {
    event.stopPropagation();
    onToggle();
  };

  if (variant === 'full') {
    return (
      <button type="button" disabled={disabled} title={reason} className={`btn-reg ${registered ? 'done' : 'active'}`} onClick={handleClick}>
        {registered ? '등록됨' : '일정 등록'}
      </button>
    );
  }

  return (
    <button type="button" disabled={disabled} title={reason} className={`btn-register ${registered ? 'done' : ''}`.trim()} onClick={handleClick}>
      {registered ? '등록됨' : '함께 등록'}
    </button>
  );
}
