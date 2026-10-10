import EmptyState from '../components/EmptyState';
import EventRow from '../components/events/EventRow';
import NoticeListState from '../components/events/NoticeListState';
import { useAppData } from '../context/AppDataContext';
import { hiddenList } from '../utils/noticeFilters';

export default function HiddenPage() {
  const { hiddenEvents, actionBusy, setDismissed, showUndo } = useAppData();
  const items = hiddenList(hiddenEvents);
  const restore = async (id) => {
    if (await setDismissed(id, false)) showUndo('숨김을 해제했어요. 전체 공지에서 볼 수 있어요.');
  };
  return <section className="card notices-card">
    <div className="card-header"><h2 className="card-title">숨긴 공지 <strong>{items.length}</strong></h2>
      <span className="notices-description">관심 없음으로 숨긴 공지예요. 목록, 알림, AI 플래너 추천에서 빠져 있어요.</span>
    </div>
    <NoticeListState>
      <div className="notice-list">{items.map((event) => <EventRow key={event.id} event={event} mode="hidden" idPrefix="hidden"
        actions={<button type="button" className="event-button" disabled={actionBusy} onClick={() => restore(event.id)}>숨김 해제</button>} />)}</div>
      {!items.length && <EmptyState>숨긴 공지가 없어요.</EmptyState>}
    </NoticeListState>
  </section>;
}
