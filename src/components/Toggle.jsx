/** 설정 토글 스위치 (.toggle) */
export default function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'on' : ''}`.trim()}
      onClick={() => onChange(!checked)}
    />
  );
}
