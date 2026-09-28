import { INTEREST_CATEGORIES } from '../config/interestCategories';

/**
 * 관심 분야(WHAT) 복수 선택 칩.
 * 아직 최종 UI 에 없으므로 config/app.js FEATURE_FLAGS.interestSettings 가 true 일 때만 Settings 에 노출.
 */
export default function InterestSelector({ selected, onToggle, categories = INTEREST_CATEGORIES }) {
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
            onClick={() => onToggle(category.id)}
          >
            {category.label}
          </button>
        );
      })}
    </div>
  );
}
