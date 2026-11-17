import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { getAppPageByPath, getMorePages, MOBILE_TABS, SIDEBAR_SECTIONS } from '../config/navigation';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { countSaved } from '../utils/events';
import useMobile from '../hooks/useMobile';
import useModalFocus from '../hooks/useModalFocus';
import { CloseIcon, NavIcon } from './icons';

export default function MobileNavigation() {
  const mobile = useMobile();
  const [open, setOpen] = useState(false);
  const trigger = useRef(null), panel = useRef(null);
  const { pathname } = useLocation();
  const { profile } = useUser();
  const { events, hiddenEvents } = useAppData();
  const badges = { saved: countSaved(events), hidden: hiddenEvents.length };
  const morePages = getMorePages(profile.is_admin);
  const current = getAppPageByPath(pathname);
  useModalFocus(open && mobile, panel, trigger);
  useEffect(() => { setOpen(false); }, [pathname, mobile]);
  useEffect(() => {
    if (!open) return;
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);
  if (!mobile) return null;
  return <>
    <nav className="mobile-tabs" aria-label="주 메뉴">
      {MOBILE_TABS.map(page => <NavLink key={page.id} to={page.path} end={page.id !== 'schedules'} className="mobile-tab">
        <NavIcon name={page.icon || 'list'} /><span>{page.id === 'schedules' ? '공지' : page.label}</span>
      </NavLink>)}
      <button type="button" ref={trigger} className="mobile-tab" aria-current={current?.parent !== 'schedules' && morePages.some(page => page.id === current?.id) ? 'page' : undefined}
        aria-expanded={open} aria-controls="mobile-more" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <NavIcon name="more" /><span>더보기</span>
      </button>
    </nav>
    {open && createPortal(<div className="mobile-more-backdrop" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={panel} id="mobile-more" className="mobile-more" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title" tabIndex={-1}>
        <header className="mobile-more-header"><h2 id="mobile-more-title">NotiAI</h2></header>
        {SIDEBAR_SECTIONS.map(section => <nav key={section.id} aria-label={section.label}>
          <div className="sb-section">{section.label}</div>
          {morePages.filter(page => page.section === section.id).map(page => <NavLink key={page.id} to={page.path} className="sb-item" onClick={() => setOpen(false)}>
            <NavIcon name={page.icon || 'list'} />{page.label}
            {page.badge && <span className="sb-badge">{badges[page.badge]}</span>}
          </NavLink>)}
        </nav>)}
        <button className="mobile-more-close" type="button" aria-label="메뉴 닫기" onClick={() => setOpen(false)}><CloseIcon /></button>
      </section>
    </div>, document.body)}
  </>;
}
