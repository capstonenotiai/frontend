/** 원본 HTML 의 inline SVG 아이콘 모음 */

export function LogoMark() {
  return (
    <svg viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="4.5" height="4.5" rx="1" fill="white" />
      <rect x="7.5" y="1" width="4.5" height="4.5" rx="1" fill="white" opacity=".5" />
      <rect x="1" y="7.5" width="4.5" height="4.5" rx="1" fill="white" opacity=".5" />
      <rect x="7.5" y="7.5" width="4.5" height="4.5" rx="1" fill="white" opacity=".25" />
    </svg>
  );
}

const NAV_ICONS = {
  dashboard: (
    <>
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4" />
    </>
  ),
  list: <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
  star: (
    <path
      d="M8 2L9.5 6.5H14L10.5 9L12 13.5L8 11L4 13.5L5.5 9L2 6.5H6.5L8 2Z"
      fill="currentColor"
      opacity=".8"
    />
  ),
  calendar: (
    <>
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 1v4M11 1v4M2 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
};

export function NavIcon({ name }) {
  return (
    <svg className="sb-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {NAV_ICONS[name]}
    </svg>
  );
}

/** 카드 제목용 아이콘 (15px) */
export function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path d="M7.5 1.5a6 6 0 100 12 6 6 0 000-12zM7.5 4v4l2.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function NewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7.5 4.5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 1v3M10 1v3M1.5 6.5h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
