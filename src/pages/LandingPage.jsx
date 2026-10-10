import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL, GITHUB_URL, USE_MOCK } from '../config/app';
import { SOURCES } from '../config/sources';
import { getLoginUrl, nextHighlight, LANDING_SCHEDULES, LANDING_NOTICES, LANDING_MODES } from '../utils/landing';
import cbnuLogo from '../assets/sources/cbnu.png';
import wevityLogo from '../assets/sources/wevity.png';
import contestLogo from '../assets/sources/contestkorea.png';

const CATEGORIES = { s: '장학', a: '학사', c: '진로·취업', k: '공모전', v: '대외활동' };
const SOURCE_DETAILS = {
  cbnu: { logo: cbnuLogo, description: '충북대학교 학교 공지', categories: ['a', 's', 'c'] },
  wevity: { logo: wevityLogo, description: '공모전·대외활동 모음', categories: ['k', 'v'] },
  contestkorea: { logo: contestLogo, description: '공모전 정보', categories: ['k', 'v'] },
};
function Arrow({ down = false, className = '' }) {
  return <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={down ? 'M12 5v14M6 13l6 6 6-6' : 'M5 12h14M13 6l6 6-6 6'} /></svg>;
}
function Bell() {
  return <span className="bell"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg></span>;
}
function GoogleLogo() {
  return <span className="g"><svg viewBox="0 0 48 48" aria-hidden="true"><path className="gr" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path className="gb" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path className="gy" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path className="gg" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg></span>;
}
const Category = ({ id }) => <span className={`cat ${id}`}>{CATEGORIES[id]}</span>;

// Observer는 자동 강조의 가시성만 판정한다. 스크롤 등장은 CSS만 담당한다.
function useHighlight(areaRef, reduce) {
  const [active, setActive] = useState('a');
  useEffect(() => {
    const area = areaRef.current;
    if (!area || reduce) return;
    let visible = false, hovered = false, focused = area.contains(document.activeElement);
    let timer, resume, resumeAt = 0;
    const paused = () => hovered || focused || document.hidden;
    const stop = () => { clearInterval(timer); timer = undefined; clearTimeout(resume); };
    const play = () => {
      stop();
      if (!visible || paused()) return;
      const delay = resumeAt - Date.now();
      if (delay > 0) { resume = setTimeout(play, delay); return; }
      timer = setInterval(() => setActive(value => nextHighlight(value, paused())), 2200);
    };
    const hold = () => { resumeAt = 0; stop(); };
    const release = () => { if (!paused()) { resumeAt = Date.now() + 3000; play(); } };
    const enter = () => { hovered = true; hold(); };
    const leave = () => { hovered = false; release(); };
    const focus = () => { focused = true; hold(); };
    const blur = event => { if (!area.contains(event.relatedTarget)) { focused = false; release(); } };
    const visibility = () => { if (document.hidden) stop(); else release(); };
    area.addEventListener('mouseenter', enter); area.addEventListener('mouseleave', leave);
    area.addEventListener('focusin', focus); area.addEventListener('focusout', blur);
    document.addEventListener('visibilitychange', visibility);
    let observer;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; play(); }, { threshold: 0.15 });
      observer.observe(area);
    } else { visible = true; play(); }
    return () => {
      stop(); observer?.disconnect();
      area.removeEventListener('mouseenter', enter); area.removeEventListener('mouseleave', leave);
      area.removeEventListener('focusin', focus); area.removeEventListener('focusout', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [areaRef, reduce]);
  const pick = id => ({
    role: 'button', tabIndex: 0, 'aria-pressed': active === id,
    onClick: () => setActive(id), onFocus: () => setActive(id), onMouseEnter: () => setActive(id),
    onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActive(id); } },
  });
  return { active, pick };
}

function Conversion({ reduce }) {
  const areaRef = useRef(null);
  const { active, pick } = useHighlight(areaRef, reduce);
  const hl = id => active === id ? 'hl' : '';
  return <section className="blk flow-section" id="flow"><div className="wrap">
    <div className="conv-head rv"><h2 className="sh">공지 한 건이 내 일정이 되기까지</h2><p className="sub">공지 원문의 날짜를 눌러 보세요. 정리된 일정과 캘린더의 같은 자리가 함께 표시돼요.</p></div>
    <div className="conv" ref={areaRef}>
      <article className="pane card src lift rv"><div className="step"><i>1</i>공지 원문</div><div className="notice-src">
        <h3 className="ttl">2026학년도 동계 계절학기 수강신청 안내</h3><span className="example">CBNU 포털 · 학사공지</span>
        <p>동계 계절학기 수강신청 일정을 다음과 같이 안내하오니 기간 내 신청하시기 바랍니다.</p>
        <div>{LANDING_SCHEDULES.map(item => <p key={item.id}>{item.title}: <mark className={hl(item.id)} data-k={item.id} {...pick(item.id)}>{item.original}</mark></p>)}</div>
        <p>납부 기간 내 미납 시 수강신청 내역은 일괄 취소됩니다.</p>
      </div></article>
      <div className="arrow"><Arrow /></div>
      <article className="pane card lift rv d1"><div className="step"><i>2</i>정리된 일정</div><div className="schedule-meta"><span className="dday">D-30</span><Category id="a" /><span className="example">CBNU 포털</span></div>
        <ol className="tl">{LANDING_SCHEDULES.map(item => <li key={item.id} data-k={item.id} className={hl(item.id)} {...pick(item.id)}><div><div className="w">{item.title}</div><div className="d">{item.when}</div></div></li>)}</ol><p className="example">미납하면 수강신청이 취소돼요.</p>
      </article><div className="arrow"><Arrow /></div>
      <article className="pane card lift rv d2"><div className="step"><i>3</i>Google 캘린더</div><div className="calendar-heading"><b>2026년 11월</b><span className="example">등록 한 번으로</span></div>
        <div className="cal">{['일', '월', '화', '수', '목', '금', '토'].map(day => <div className="h" key={day}>{day}</div>)}
          {Array.from({ length: 30 }, (_, index) => {
            const day = index + 1, date = `2026-11-${String(day).padStart(2, '0')}`;
            const item = LANDING_SCHEDULES.find(item => date >= item.start && date <= item.end);
            return <div className="c" key={day}><span>{day}</span>{item && <span className={`ev ${hl(item.id)}`} data-k={item.id} aria-label={`11월 ${day}일 ${item.title}`} {...pick(item.id)}>{date === item.start ? item.short : <span aria-hidden="true"> </span>}</span>}</div>;
          })}
        </div><p className="example">[일정 등록]을 누르면 이렇게 들어가요.</p>
      </article>
    </div>
  </div></section>;
}

function PlannerPreview() {
  const [mode, setMode] = useState(0);
  const selected = LANDING_MODES[mode];
  return <div className="card lift" id="landing-planner"><div className="planner-head"><div className="pills" role="group" aria-label="추천 방식">{LANDING_MODES.map((item, index) => <button className="pill" type="button" aria-pressed={index === mode} key={item.id} onClick={() => setMode(index)}>{item.name}</button>)}</div><p className="example">{selected.description}</p></div>
    <div key={selected.id}>{selected.items.map((item, index) => {
      const notice = item.notice === undefined ? item : LANDING_NOTICES[item.notice];
      return <div className="rec" key={notice.title}><div className="top">{mode === 0 && <span className="rank">{index + 1}</span>}<span className={`dday ${notice.dday <= 7 ? 'hot' : ''}`}>D-{notice.dday}</span><b>{notice.title}</b></div><span className="why">{item.why}</span><span className="next">다음 할 일 · <b>{item.next}</b></span></div>;
    })}</div>
  </div>;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false), [connecting, setConnecting] = useState(false), [reduce, setReduce] = useState(true);
  const heroRef = useRef(null), loginLock = useRef(false), loginTimer = useRef(null);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => setReduce(media.matches);
    onScroll(); onMotion();
    window.addEventListener('scroll', onScroll, { passive: true }); media.addEventListener('change', onMotion);
    return () => { window.removeEventListener('scroll', onScroll); media.removeEventListener('change', onMotion); clearTimeout(loginTimer.current); };
  }, []);
  useEffect(() => {
    const hero = heroRef.current;
    if (reduce || !hero) return;
    const move = event => {
      if (event.pointerType !== 'mouse') return;
      const rect = hero.getBoundingClientRect();
      hero.querySelectorAll('.fl').forEach(fragment => {
        const depth = Number(fragment.dataset.depth);
        fragment.style.setProperty('--px', `${((event.clientX - rect.left) / rect.width - 0.5) * depth}px`);
        fragment.style.setProperty('--py', `${((event.clientY - rect.top) / rect.height - 0.5) * depth}px`);
      });
    };
    const reset = () => hero.querySelectorAll('.fl').forEach(fragment => { fragment.style.removeProperty('--px'); fragment.style.removeProperty('--py'); });
    hero.addEventListener('pointermove', move); hero.addEventListener('pointerleave', reset);
    return () => { hero.removeEventListener('pointermove', move); hero.removeEventListener('pointerleave', reset); reset(); };
  }, [reduce]);
  const start = () => {
    if (loginLock.current) return;
    loginLock.current = true; setConnecting(true);
    // 연결 중 상태를 먼저 그린 뒤 기존 로그인 경로로 이동한다.
    loginTimer.current = setTimeout(() => {
      const url = getLoginUrl(USE_MOCK, API_BASE_URL);
      if (USE_MOCK) navigate(url); else window.location.assign(url);
    }, 320);
  };
  const loginButton = (style, label = 'Google로 계속하기') => <button type="button" className={`btn ${style} ${connecting ? 'is-loading' : ''}`} aria-disabled={connecting} aria-busy={connecting} onClick={start}><GoogleLogo /><span>{connecting ? '연결 중…' : label}</span></button>;
  return <div className="landing" id="top">
    <header className={`topnav ${scrolled ? 'scrolled' : ''}`}><div className="wrap nav"><a className="wordmark" href="#top">NotiAI</a><nav className="links" aria-label="주 메뉴"><a href="#flow">작동 방식</a><a href="#feat">기능</a><a href="#sites">연동 사이트</a></nav>{loginButton('btn-ghost', '로그인')}</div></header>
    <main>
      <section className="hero" ref={heroRef}><div className="floats" aria-hidden="true">
        <div className="fl f1" data-depth="18"><div><span className="dday hot">D-3</span><b>교내 근로장학생 추가 모집</b></div></div>
        <div className="fl f2" data-depth="-14"><div><span className="new">NEW</span><b>공개SW 개발자대회</b><Category id="k" /></div></div>
        <div className="fl f3" data-depth="-22"><div><span className="mini-cell">10</span><span><b>수강신청</b><br /><span className="example">11월 10일 10:00</span></span></div></div>
        <div className="fl f4" data-depth="12"><div><Bell /><b>내일 마감이에요</b></div></div>
      </div><div className="wrap inner"><h1 className="display in1">공지 속 날짜를 <span className="hl-word">캘린더로</span></h1><p className="lede in2">학교와 공모전 사이트의 공지에서 날짜를 찾아 Google 캘린더에 정리해요.</p><div className="cta in3">{loginButton('btn-primary btn-lg')}<a className="btn btn-ghost btn-lg" href="#flow">둘러보기 <Arrow down /></a></div><span className="example in4">충북대 학생용 · 무료</span></div></section>
      <Conversion reduce={reduce} />
      <section className="wrap" id="feat" aria-label="기능">
        <div className="feat"><div className="txt rv"><h2 className="sh">새 공지는 마감순으로</h2><p className="sub">세 사이트의 공지를 한 목록에서 봐요. 새로 올라온 공지에는 NEW, 일주일 안에 마감되면 빨간 D-day가 붙어요.</p></div><div className="rv d1"><div className="card soft rows">{LANDING_NOTICES.map(item => <div className="row" key={item.title}><span className={`dday ${item.dday <= 7 ? 'hot' : ''}`}>D-{item.dday}</span><div><div className="t">{item.isNew && <span className="new">NEW</span>}<span className="tt">{item.title}</span></div><div className="m"><Category id={item.cat} />{item.site} · {item.when}</div></div></div>)}</div></div></div>
        <div className="feat flip"><div className="txt rv"><h2 className="sh">마감 3일 전, 하루 전에 알려 드려요</h2><p className="sub">등록한 일정은 D-3과 D-1에 알림이 와요. 이메일로도 받을 수 있어요.</p></div><div className="stack rv d1"><div className="card mail back soft"><Bell /><div className="mtxt"><span className="from">11월 1일(일) 09:00 · D-3</span><span className="subj">근로장학생 추가 모집이 3일 남았어요</span></div></div><div className="card mail soft"><Bell /><div className="mtxt"><span className="from">NotiAI 알림 · 11월 3일(화) 09:00 · D-1</span><span className="subj">내일 마감: 2학기 교내 근로장학생 추가 모집</span><span className="body">11월 4일(수) 17:00까지 신청서를 내야 해요.</span></div></div></div></div>
        <div className="feat"><div className="txt rv"><h2 className="sh">무엇부터 할지 AI 플래너에게</h2><p className="sub">내 일정과 새 공지를 보고 세 가지 방식으로 추천해요. 날짜는 NotiAI가 공지에서 정리한 것만 써요.</p></div><div className="rv d1"><PlannerPreview /></div></div>
      </section>
      <section className="blk" id="sites"><div className="wrap sites-blk"><div className="sites-head rv"><h2 className="sh">이 사이트들의 공지를 읽어요</h2><span className="live">매일 새 공지를 확인해요</span></div><div className="sites">{SOURCES.map(source => {
        const detail = SOURCE_DETAILS[source.id];
        return <article className="site soft rv" key={source.id}><div className="logo-plate"><img className={source.id === 'contestkorea' ? 'sq' : 'wide'} src={detail.logo} alt={source.label} /></div><div className="nm"><b>{source.shortLabel === 'CBNU' ? 'CBNU 포털' : source.shortLabel}</b><span>{detail.description}</span></div><div className="chips">{detail.categories.map(id => <Category key={id} id={id} />)}</div></article>;
      })}</div><div className="merge rv"><svg className="lines" viewBox="0 0 900 72" preserveAspectRatio="none" aria-hidden="true"><path className="ln" d="M150 0 C150 48, 450 24, 450 72" /><path className="ln" d="M450 0 L450 72" /><path className="ln" d="M750 0 C750 48, 450 24, 450 72" /></svg><Arrow down className="down" /><div className="to"><span className="chip-lg main">NotiAI가 날짜를 정리</span><Arrow className="merge-arrow" /><span className="chip-lg">내 Google 캘린더</span></div></div></div></section>
      <section className="band"><div className="wrap rv"><h2>놓치는 마감 없이 이번 학기를</h2><p>Google 계정으로 바로 시작해요.</p>{loginButton('btn-band btn-lg')}</div></section>
    </main>
    <footer className="foot"><div className="wrap"><span className="wordmark">NotiAI</span><nav className="foot-links" aria-label="바닥글"><Link to="/privacy">개인정보처리방침</Link><Link to="/terms">이용약관</Link><a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a></nav><span className="copy">© 2026 NotiAI</span></div></footer>
  </div>;
}
