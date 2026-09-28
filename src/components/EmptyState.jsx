export default function EmptyState({ children = '표시할 항목이 없습니다.' }) {
  return <div className="empty-state">{children}</div>;
}
