import ModeCard from './ModeCard';

/**
 * 모드 선택 영역. 모드 개수에 맞춰 열 개수가 자동으로 정해진다.
 * modes 는 config/aiModes.js 의 AI_MODES 를 그대로 넘기면 된다.
 */
export default function ModeSelector({ modes, activeId, onSelect, id }) {
  return (
    <div
      id={id}
      className="mode-selector"
      role="radiogroup"
      aria-label="AI 플래너 모드"
      style={{ gridTemplateColumns: `repeat(${modes.length}, 1fr)` }}
    >
      {modes.map((mode) => (
        <ModeCard key={mode.id} mode={mode} active={mode.id === activeId} onSelect={onSelect} />
      ))}
    </div>
  );
}
