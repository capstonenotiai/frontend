import Badge from '../components/Badge';
import Card from '../components/Card';
import LoadError from '../components/LoadError';
import StatCard from '../components/StatCard';
import { useAsync } from '../hooks/useAsync';
import * as curationService from '../services/curationService';
import { formatDday } from '../utils/date';

/** 추천 활동 D-day 색상 (원본: D-2 빨강, D-5 주황, D-7 파랑) */
function ddayColor(daysLeft) {
  if (daysLeft <= 3) return 'var(--red)';
  if (daysLeft <= 5) return 'var(--amber)';
  return 'var(--blue)';
}

/** 분야별 분포 → conic-gradient */
function buildDonutGradient(items) {
  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  let acc = 0;
  const stops = items.map((item) => {
    const from = (acc / total) * 100;
    acc += item.count;
    const to = (acc / total) * 100;
    return `${item.color} ${from.toFixed(1)}% ${to.toFixed(1)}%`;
  });
  return { total, background: `conic-gradient(${stops.join(', ')})` };
}

export default function CurationPage() {
  const { data, error, reload } = useAsync(() => curationService.getCuration(), []);

  if (error) return <LoadError message="큐레이션 데이터를 불러오지 못했습니다." onRetry={reload} />;
  if (!data) return null;

  const donut = buildDonutGradient(data.categoryDistribution);

  return (
    <>
      <div className="page-header">
        <div className="page-title">대외활동 큐레이션</div>
        <div className="page-sub">
          Cloud·데이터·AI 파이프라인 구축 부트캠프에서 실제 배포한 서비스를 NotiAI에 연동했습니다
        </div>
        <div className="page-header-meta">
          <Badge tone="blue">{data.header.stackLabel}</Badge>
          <span className="page-header-meta-r">{data.header.updateLabel}</span>
        </div>
      </div>

      <div className="db-grid">
        {data.stats.map((stat) => (
          <StatCard key={stat.label} value={stat.value} label={stat.label} change={stat.change} tone={stat.tone} />
        ))}
      </div>

      <Card
        title="오늘의 추천 활동"
        headerRight={<Badge tone="green">{data.recommendationBasis}</Badge>}
        style={{ marginBottom: 16 }}
        bodyClassName="cur-rec-grid"
      >
        {data.recommendations.map((item) => (
          <div className="cur-rec" key={item.id}>
            <Badge tone={item.categoryTone} style={{ fontSize: 10 }}>
              {item.category}
            </Badge>
            <div className="cur-rec-title">{item.title}</div>
            <div className="cur-rec-rank">{item.rankLabel}</div>
            <div className="cur-rec-dday" style={{ color: ddayColor(item.daysLeft) }}>
              {formatDday(item.daysLeft)} · {item.prize}
            </div>
          </div>
        ))}
      </Card>

      <div className="cur-two-col">
        <Card title="분야별 분포" headerRight={<Badge tone="gray">전체 {donut.total}건</Badge>} bodyClassName="cur-donut-wrap">
          <div className="cur-donut" style={{ background: donut.background }}>
            <div className="cur-donut-hole">
              <div className="cur-donut-val">{donut.total}</div>
              <div className="cur-donut-lbl">전체 활동</div>
            </div>
          </div>
          <div className="cur-legend">
            {data.categoryDistribution.map((item) => (
              <div className="cur-legend-row" key={item.label}>
                <span className="cur-swatch" style={{ background: item.color }} />
                {item.label}
                <b>
                  {item.count}건 · {Math.round((item.count / donut.total) * 100)}%
                </b>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="사이트 × 분야별 분포"
          headerRight={
            <div className="cur-site-legend">
              {data.siteDistribution.sites.map((site) => (
                <span key={site.id}>
                  <span className="cur-swatch" style={{ background: site.color }} />
                  {site.label}
                </span>
              ))}
            </div>
          }
          bodyClassName="cur-bars"
        >
          {data.siteDistribution.rows.map((row) => (
            <div key={row.label}>
              <div className="cur-bar-head">
                <span>{row.label}</span>
                <span>{row.counts.join(' · ')}</span>
              </div>
              <div className="cur-bar">
                {row.barWidths.map((width, index) => (
                  <div
                    key={data.siteDistribution.sites[index].id}
                    style={{ width: `${width}%`, background: data.siteDistribution.sites[index].color }}
                  />
                ))}
              </div>
            </div>
          ))}
        </Card>
      </div>

      <Card title="마감 임박 TOP 5" headerRight={<Badge tone="gray">days_left 오름차순</Badge>} bodyStyle={{ padding: 0 }}>
        <table className="cur-table">
          <thead>
            <tr>
              <th>제목</th>
              <th>분야</th>
              <th>D-day</th>
            </tr>
          </thead>
          <tbody>
            {data.deadlineTop5.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>
                  <Badge tone={item.categoryTone} style={{ fontSize: 10 }}>
                    {item.category}
                  </Badge>
                </td>
                <td className="dday">{formatDday(item.daysLeft)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="cur-footnote">
        {data.footnote.text} (원본 서비스: <span>{data.footnote.originLabel}</span>)
      </div>
    </>
  );
}
