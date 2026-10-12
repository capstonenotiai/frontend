import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from './context/UserContext';
import { shouldShowWelcome } from './utils/settings';
import WelcomePage from './pages/WelcomePage';
import ScrollToTop from './components/ScrollToTop';
import AppLayout from './layouts/AppLayout';
import CalendarPage from './pages/CalendarPage';
import SavedPage from './pages/SavedPage';
import HiddenPage from './pages/HiddenPage';
import FeedbackPage from './pages/FeedbackPage';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import PolicyPage from './pages/PolicyPage';
import PlannerPage from './pages/PlannerPage';
import SchedulesPage from './pages/SchedulesPage';
import SettingsPage from './pages/SettingsPage';
import AdminReviewPage from './pages/AdminReviewPage';

/** 라우팅. 사이드바 메뉴 구성은 config/navigation.js를 따른다. */
export default function App() {
  const { profile, preferences, status } = useUser();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const checked = useRef(new Set());
  useEffect(() => {
    if (pathname === '/welcome' && status === 'ready') { checked.current.add(profile.email); return; }
    if (pathname !== '/dashboard' || status !== 'ready' || checked.current.has(profile.email)) return;
    checked.current.add(profile.email);
    let storage;
    try { storage = globalThis.localStorage; } catch { /* 접근 제한에도 앱은 동작 */ }
    if (shouldShowWelcome(profile, preferences, storage)) navigate('/welcome', { replace: true });
  }, [pathname, status, profile, preferences, navigate]);
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PolicyPage title="개인정보처리방침" />} />
        <Route path="/terms" element={<PolicyPage title="이용약관" />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/schedules/saved" element={<SavedPage />} />
          <Route path="/schedules/hidden" element={<HiddenPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/curation" element={<Navigate to="/dashboard" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/review" element={<AdminReviewPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
