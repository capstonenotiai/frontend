import { NavLink, useLocation } from 'react-router-dom';
import { APP_PAGES, SIDEBAR_SECTIONS } from '../config/navigation';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { countSaved } from '../utils/events';
import { NavIcon } from './icons';

export default function Sidebar() {
  const { pathname } = useLocation();
  const { events, hiddenEvents } = useAppData();
  const { profile } = useUser();
  const badges = { saved: countSaved(events), hidden: hiddenEvents.length };
  const schedulesOpen = pathname === '/schedules' || pathname.startsWith('/schedules/');
  const renderLink = (page) => (
    <NavLink key={page.id} to={page.path} end={page.path === '/schedules'}
      className={({ isActive }) => `sb-item${page.parent ? ' sb-subitem' : ''}${isActive ? ' on' : ''}`}>
      {page.icon && <NavIcon name={page.icon} />}
      {page.label}
      {(page.badge === 'saved' || badges[page.badge] > 0) && <span className="sb-badge">{badges[page.badge]}</span>}
    </NavLink>
  );
  return (
    <aside className="sidebar">
      <NavLink to="/dashboard" className="sb-logo-name">NotiAI</NavLink>
      {SIDEBAR_SECTIONS.map((section) => (
        <div key={section.id}>
          <div className="sb-section">{section.label}</div>
          <nav className="sb-nav" aria-label={section.label}>
            {APP_PAGES.filter((page) => page.section === section.id && !page.parent && (!page.adminOnly || profile.is_admin)).map((page) => (
              <div key={page.id}>
                {renderLink(page)}
                {page.id === 'dashboard' && (
                  <div className={`sb-group${schedulesOpen ? ' open' : ''}`}>
                    <div className="sb-group-heading"><NavIcon name="list" />일정</div>
                    {APP_PAGES.filter((child) => child.parent === 'schedules').map(renderLink)}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      ))}
      <div className="sb-user">
        <div className="sb-avatar">{profile.name?.trim().slice(0, 1)}</div>
        <span className="sb-email">{profile.email}</span>
      </div>
    </aside>
  );
}
