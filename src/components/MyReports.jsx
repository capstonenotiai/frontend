import { useEffect, useState } from 'react';
import LoadError from './LoadError';
import { listMyReports } from '../services/reportService';
import { REPORT_REASONS } from '../utils/settings';

export const REPORT_STATUS_LABELS = { received: '접수됨', resolved: '처리됨' };

export function MyReportsContent({ reports, status, onRetry, limit, onMore }) {
  if (status === 'loading') return <p role="status">보낸 일정 신고를 불러오는 중…</p>;
  if (status === 'error') return <LoadError message="보낸 일정 신고를 불러오지 못했어요." onRetry={onRetry} />;
  if (!reports.length) return <p className="my-reports-empty">보낸 일정 신고가 없어요. 일정 상세에서 날짜·내용이 틀리면 신고할 수 있어요.</p>;
  return <section className="my-reports" aria-labelledby="my-reports-title">
    <h2 id="my-reports-title">내가 보낸 일정 신고</h2>
    <div className="my-reports-list">{reports.slice(0, limit).map(report => <article className="my-report" key={report.id}>
      <div className="my-report-heading"><h3>{report.title || '삭제된 일정'}</h3><span className={`my-report-status ${report.status === 'resolved' ? 'is-resolved' : ''}`}>{REPORT_STATUS_LABELS[report.status] || report.status}</span></div>
      <div className="my-report-meta"><span>신고 사유: {REPORT_REASONS.find(([id]) => id === report.reason)?.[1] || '기타'}</span><span>보낸 날짜: <time dateTime={report.created_at}>{new Date(report.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })}</time></span></div>
      {report.memo && <p className="my-report-memo">{report.memo}</p>}
      {report.status === 'resolved' && <p className="my-report-resolved">관리자가 확인하고 일정을 반영했어요.</p>}
    </article>)}</div>
    {reports.length > limit && <button type="button" className="settings-button quiet" onClick={onMore}>더 보기</button>}
  </section>;
}

export default function MyReports({ refreshKey }) {
  const [reports, setReports] = useState([]), [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0), [limit, setLimit] = useState(10);
  useEffect(() => {
    let active = true;
    setStatus('loading');
    listMyReports().then(data => {
      if (!active) return;
      setReports(data); setLimit(10); setStatus('ready');
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [attempt, refreshKey]);
  return <MyReportsContent reports={reports} status={status} limit={limit} onRetry={() => setAttempt(value => value + 1)} onMore={() => setLimit(value => value + 10)} />;
}
