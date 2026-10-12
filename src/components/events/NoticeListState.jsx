import { useAppData } from '../../context/AppDataContext';
import LoadError from '../LoadError';

export default function NoticeListState({ children }) {
  const { status, error, refresh } = useAppData();
  if (status === 'loading') return <div className="notice-skeletons" role="status" aria-label="공지를 불러오는 중">
    {Array.from({ length: 5 }, (_, index) => <div key={index} className="notice-skeleton" aria-hidden="true"><i /><span /><i /></div>)}
  </div>;
  if (status === 'error') return <LoadError message={error?.message} onRetry={() => refresh()} />;
  return <>{children}</>;
}
