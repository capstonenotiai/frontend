/** 원본 HTML 의 inline SVG 아이콘 모음 */
export function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" /><path d="m15 15 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
export function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
}
export function CheckIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function ChevronIcon({ direction = 'right' }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={direction === 'left' ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export function ExternalLinkIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const NAV_ICONS = {
  home: <path d="M2 7L8 2l6 5v7h-4V9H6v5H2V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  spark: <path d="m8 1 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  flag: <path d="M3 15V2c3-2 7 2 10 0v7c-3 2-7-2-10 0" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,

  dashboard: (
    <>
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".4" />
    </>
  ),
  list: <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  star: (
    <path
      d="M8 2L9.5 6.5H14L10.5 9L12 13.5L8 11L4 13.5L5.5 9L2 6.5H6.5L8 2Z"
      fill="currentColor"
      opacity=".8"
    />
  ),
  calendar: (
    <>
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M5 1v4M11 1v4M2 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
        stroke="currentColor"
        strokeWidth="2"
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
      <path d="M7.5 1.5a6 6 0 100 12 6 6 0 000-12zM7.5 4v4l2.5 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function NewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="2" />
      <path d="M7.5 4.5v3l2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="2" />
      <path d="M5 1v3M10 1v3M1.5 6.5h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
