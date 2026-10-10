import { useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import EventRow from '../components/events/EventRow';
import NoticeListState from '../components/events/NoticeListState';
import { useAppData } from '../context/AppDataContext';
import { savedList } from '../utils/noticeFilters';

export default function SavedPage() {
  const { events, actionBusy, saveBookmark, requestRegistration, showUndo } = useAppData();
  const [selectedId, setSelectedId] = useState(null);
  const items = savedList(events);
  const release = async (id) => {
    if (await saveBookmark(id, false)) showUndo('관심 저장을 해제했어요.', () => saveBookmark(id, true));
  };
  return <section className="card notices-card">
    <div className="card-header"><h2 className="card-title">관심 저장 <strong>{items.length}</strong></h2>
      <span className="notices-description">캘린더에 넣기 전 챙겨 보는 공지예요. 접수 마감 3일 전과 하루 전에 알려 드려요.</span>
    </div>
    <NoticeListState>
      <div className="notice-list">{items.map((event) => <EventRow key={event.id} event={event} mode="saved" idPrefix="saved"
        open={selectedId === event.id} onToggle={() => setSelectedId(selectedId === event.id ? null : event.id)} hideActions
        actions={<>
          <button type="button" className="event-button primary" disabled={actionBusy || event.can_register === false}
            title={event.can_register === false ? event.registration_reason : undefined}
            onClick={() => requestRegistration(event.id, event.event_type === 'interview', false, '캘린더에 등록했어요. 홈에서 볼 수 있어요.')}>일정 등록</button>
          <button type="button" className="event-button quiet" disabled={actionBusy} onClick={() => release(event.id)}>저장 해제</button>
        </>} />)}</div>
      {!items.length && <EmptyState>관심 저장한 공지가 없어요. 전체 공지에서 공지를 펼쳐 [관심 저장]을 눌러 보세요.
        <Link className="event-original" to="/schedules">전체 공지 보기</Link>
      </EmptyState>}
    </NoticeListState>
  </section>;
}
