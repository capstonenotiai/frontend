import { Link } from 'react-router-dom';

export default function PolicyPage({ title }) {
  return <main className="policy-page"><h1>{title}</h1><p>준비 중이에요. 곧 공개할게요.</p><Link to="/">처음으로</Link></main>;
}
