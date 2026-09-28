/** 통계 카드 — tone: 'up' | 'warn' | 'neutral' */
export default function StatCard({ value, label, change, tone = 'neutral' }) {
  return (
    <div className="stat-card">
      <div className="stat-val">{value}</div>
      <div className="stat-label">{label}</div>
      {change && <div className={`stat-change ${tone}`}>{change}</div>}
    </div>
  );
}
