import { NavLink } from 'react-router-dom';
import { useAppData } from '../context/AppDataContext';
import { savedList, hiddenList } from '../utils/noticeFilters';

export default function NoticeTabs() {
  const { events, hiddenEvents } = useAppData();
  return <nav className="notice-tabs" aria-label="공지 목록">
    {[[ '/schedules', '전체 공지', events.filter(event => !event.dismissed).length ],
      ['/schedules/saved', '관심 저장', savedList(events).length],
      ['/schedules/hidden', '숨긴 공지', hiddenList(hiddenEvents).length]].map(([path, label, count]) =>
      <NavLink key={path} to={path} end>{label} <span>{count}</span></NavLink>)}
  </nav>;
}
