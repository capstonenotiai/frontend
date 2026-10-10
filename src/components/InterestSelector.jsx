import { INTEREST_CATEGORIES } from '../config/interestCategories';

/**
 * 관심 분야(WHAT) 복수 선택 칩.
 * 설정과 첫 로그인 단계에서 공유한다. 선택하지 않아도 된다.
 */
export default function InterestSelector({ selected, onToggle, categories = INTEREST_CATEGORIES, disabled = false, state = 'idle' }) {
  return (
    <div className="interest-list">
      {categories.map((category) => {
        const active = selected.includes(category.id);
        return (
          <button
            key={category.id}
            type="button"
            className={`interest-chip ${active ? 'on' : ''}`.trim()}
            aria-pressed={active}
            disabled={disabled}
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
  );
}
