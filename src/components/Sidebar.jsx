import { NavLink, useNavigate } from 'react-router-dom';
import { APP_PAGES, SIDEBAR_SECTIONS } from '../config/navigation';
import { useAppData } from '../context/AppDataContext';
import { useUser } from '../context/UserContext';
import { LogoMark, NavIcon } from './icons';

export default function Sidebar() {
  const navigate = useNavigate();
  const { events } = useAppData();
  const { profile } = useUser();

  const badgeValues = {
    eventCount: events.length,
  };

  return (
    <aside className="sidebar">
      <div className="sb-top">
        <div className="sb-logo-box">
          <LogoMark />
        </div>
        <button type="button" className="sb-logo-name" onClick={() => navigate('/')}>
          NotiAI
        </button>
      </div>

      {SIDEBAR_SECTIONS.map((section, index) => (
        <div key={section.id}>
          {index > 0 && <div className="sb-divider" />}
          <div className="sb-section">{section.label}</div>
          <nav className="sb-nav">
            {APP_PAGES.filter((page) => page.section === section.id).map((page) => {
              const badge = page.badge ? badgeValues[page.badge] : null;
              return (
                <NavLink
                  key={page.id}
                  to={page.path}
                  className={({ isActive }) => `sb-item ${isActive ? 'on' : ''}`.trim()}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <NavIcon name={page.icon} />
                  {page.label}
                  {badge ? <span className="sb-badge red">{badge}</span> : null}
                </NavLink>
              );
            })}
          </nav>
        </div>
      ))}

      <div className="sb-user">
        <div className="sb-avatar">{profile.name.slice(0, 1)}</div>
        <div>
          <div className="sb-uname">{profile.name}</div>
          <div className="sb-email">{profile.email}</div>
        </div>
      </div>
    </aside>
  );
}
