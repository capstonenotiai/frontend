/** 설정 토글 스위치 (.toggle) */
export default function Toggle({ checked, onChange, label, disabled = false, state = 'idle', describedBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      aria-invalid={state === 'error' || undefined}
      aria-busy={state === 'saving' || undefined}
      data-state={state}
      disabled={disabled}
      className={`toggle ${checked ? 'on' : ''}`.trim()}
      onClick={() => onChange(!checked)}
    />
  );
}
