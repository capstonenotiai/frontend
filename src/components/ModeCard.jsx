/** AI 플래너 모드 카드 (.mode-card). 모드 데이터는 config/aiModes.js */
export default function ModeCard({ mode, active, onSelect }) {
  return (
    <div
      role="radio"
      aria-checked={active}
      tabIndex={0}
      className={`mode-card ${active ? 'on' : ''}`.trim()}
      onClick={() => onSelect(mode.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(mode.id);
        }
      }}
    >
      <div className="mc-name">{mode.name}</div>
      <div className="mc-desc">{mode.description}</div>
      {active && <div className="mc-badge">현재 활성</div>}
    </div>
  );
}
