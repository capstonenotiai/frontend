import { Navigate, Route, Routes } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import AppLayout from './layouts/AppLayout';
import CalendarPage from './pages/CalendarPage';
import CurationPage from './pages/CurationPage';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import PlannerPage from './pages/PlannerPage';
import SchedulesPage from './pages/SchedulesPage';
import SettingsPage from './pages/SettingsPage';

/**
 * 라우팅
 *  /           Landing
 *  /dashboard  대시보드       /schedules 일정 목록     /planner  AI 플래너
 *  /calendar   캘린더         /curation  대외활동 큐레이션  /settings 설정
 * 사이드바 메뉴 구성은 config/navigation.js
 */
export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/curation" element={<CurationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
