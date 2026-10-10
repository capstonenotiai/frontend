import { INTEREST_CATEGORIES } from '../config/interestCategories';
import { canToggleInterest } from '../utils/settings';

/**
 * 관심 분야(WHAT) 복수 선택 칩.
 * 설정과 첫 로그인 단계에서 공유한다. 최소 1개 — 마지막 하나는 끌 수 없다.
 */
export default function InterestSelector({ selected, onToggle, categories = INTEREST_CATEGORIES, disabled = false, state = 'idle', helpId = 'interest-help' }) {
  const lastOne = selected.length === 1;
  return (
    <>
    <div className="interest-list" aria-describedby={helpId}>
      {categories.map((category) => {
        const active = selected.includes(category.id);
        const locked = active && !canToggleInterest(selected, category.id);
        return (
          <button
            key={category.id}
            type="button"
            className={`interest-chip ${active ? 'on' : ''}`.trim()}
            aria-pressed={active}
            disabled={disabled || locked}
            data-state={state}
            aria-busy={state === 'saving' || undefined}
            aria-invalid={state === 'error' || undefined}
            onClick={() => onToggle(category.id)}
          >
            <i aria-hidden="true" style={{ background: `var(--cat-${category.id})` }} />{category.label}
          </button>
        );
      })}
    </div>
    <p className="interest-help" id={helpId}>{selected.length === 0 ? '하나 이상 골라 주세요.' : lastOne ? '하나 이상 골라 두어야 해요.' : ''}</p>
    </>
  );
}
