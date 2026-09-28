import { Outlet, useLocation } from 'react-router-dom';
import LoadError from '../components/LoadError';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { getAppPageByPath } from '../config/navigation';
import { useAppData } from '../context/AppDataContext';

/** 앱 공통 레이아웃: 사이드바 + 탑바 + 본문 (원본 #page-app) */
export default function AppLayout() {
  const { pathname } = useLocation();
  const page = getAppPageByPath(pathname);
  const { status, actionError, refresh } = useAppData();

  return (
    <div className="app-root">
      <Sidebar />
      <div className="app-main-area">
        <Topbar page={page} />
        <main className="app-content">
          {status === 'error' && <LoadError message="일정 데이터를 불러오지 못했습니다." onRetry={refresh} />}
          {actionError && <LoadError message={`요청을 처리하지 못했습니다: ${actionError.message}`} />}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
