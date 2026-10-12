import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import LoadError from '../components/LoadError';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ChatPanel from '../components/ChatPanel';
import { getAppPageByPath } from '../config/navigation';
import { useAppData } from '../context/AppDataContext';
import { CloseIcon } from '../components/icons';

/** 앱 공통 레이아웃: 사이드바 + 탑바 + 본문 (원본 #page-app) */
export default function AppLayout() {
  const { pathname } = useLocation();
  const page = getAppPageByPath(pathname);
  const { status, actionError, clearActionError, refresh } = useAppData();
  // 동작 실패 안내는 그 화면에서만 보인다. 다른 화면으로 가면 지운다.
  useEffect(() => { clearActionError(); }, [pathname, clearActionError]);

  return (
    <div className="app-root">
      <Sidebar />
      <div className="app-main-area">
        <Topbar page={page} />
        <main className="app-content">
          {status === 'error' && <LoadError message="일정을 불러오지 못했어요." onRetry={refresh} />}
          {actionError && <div className="load-error action-error" role="alert"><span>처리하지 못했어요. {actionError.message}</span><button type="button" className="action-error-close" aria-label="안내 닫기" onClick={clearActionError}><CloseIcon /></button></div>}
          <Outlet />
        </main>
      </div>
      <ChatPanel />
    </div>
  );
}
