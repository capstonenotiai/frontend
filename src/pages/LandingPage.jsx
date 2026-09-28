import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/icons';
import { AI_MODES, DEFAULT_AI_MODE_ID } from '../config/aiModes';
import { GITHUB_URL } from '../config/app';
import { SOURCES } from '../config/sources';

/* 랜딩 페이지 소개용 정적 예시 데이터 (실제 데이터 아님) */
const MOCKUP_TASKS = [
  { tone: 'r', badge: 'red', color: 'var(--red)', name: '캡스톤디자인 신청 마감', src: 'CBNU 포털 · 2026-05-30', dday: 'D-11' },
  { tone: 'a', badge: 'amb', color: 'var(--amber)', name: 'SW 공모전 1차 제출', src: 'Wevity · 2026-06-10', dday: 'D-22' },
  { tone: 'g', badge: 'grn', color: 'var(--green)', name: '장학금 신청', src: 'CBNU 포털 · 2026-06-15', dday: 'D-27' },
];

const STEPS = [
  { num: '01', done: true, title: '공지 수집', desc: '매일 자동으로 주요 사이트에서 공지와 공모전을 수집합니다.', tag: 'daily auto' },
  { num: '02', done: true, title: 'AI 분석', desc: '파인튜닝한 LLaMA 모델이 공지 본문에서 핵심 일정을 자동 추출합니다.', tag: 'llm extract' },
  { num: '03', done: false, title: '일정 생성', desc: '추출된 정보를 캘린더 등록 형식으로 자동 변환합니다.', tag: 'auto parse' },
  { num: '04', done: false, title: '캘린더 등록', desc: '원클릭으로 Google Calendar에 등록하고 알림을 설정합니다.', tag: 'one click' },
];

const CRAWL_ROWS = [
  { name: 'CBNU 포털', count: 11, width: 78 },
  { name: 'Wevity', count: 8, width: 56 },
  { name: 'ContestKorea', count: 4, width: 30 },
];

const AI_ROWS = [
  { label: '이벤트명', value: '2026 캡스톤디자인 경진대회' },
  { label: '신청 기간', value: '2026.05.15 ~ 05.30' },
  { label: '마감일', value: '2026년 5월 30일 18:00' },
];

const GCAL_ROWS = [
  { color: '#2563EB', name: '캡스톤디자인 신청 마감', date: '05/30', badge: 'r', dday: 'D-11' },
  { color: '#D97706', name: 'SW 공모전 1차 제출', date: '06/10', badge: 'a', dday: 'D-22' },
  { color: '#16A34A', name: '장학금 신청', date: '06/15', badge: 'g', dday: 'D-27' },
];

/** 스크롤 시 .reveal / .reveal-l / .reveal-r 요소에 .in 을 붙인다 (원본 IntersectionObserver) */
function useScrollReveal(containerRef) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const targets = container.querySelectorAll('.reveal, .reveal-l, .reveal-r');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('in'));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [containerRef]);
}

export default function LandingPage() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  useScrollReveal(containerRef);

  const start = () => navigate('/dashboard');
  const scrollTo = (id) => (event) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div ref={containerRef}>
      <nav id="landing-nav">
        <button type="button" className="nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="nlb">
            <LogoMark />
          </div>
          NotiAI
        </button>
        <div className="nav-r">
          <a href="#how" className="nav-a" onClick={scrollTo('how')}>
            작동방식
          </a>
          <a href="#feat" className="nav-a" onClick={scrollTo('feat')}>
            기능
          </a>
          <a href="#modes" className="nav-a" onClick={scrollTo('modes')}>
            AI 모드
          </a>
          <a href={GITHUB_URL} className="nav-a" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <button type="button" className="nav-cta" onClick={start}>
            시작하기 →
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="dot-bg fade-v" />
        <div className="hero-glow" />
        <div className="hero-pill">
          <span className="pulse" />
          AI 기반 자동 일정 생성 · CBNU 팀 프로젝트
        </div>
        <h1>
          공지 수집부터
          <br />
          <span className="grad">캘린더 등록</span>까지
          <br />
          자동으로
        </h1>
        <p className="hero-sub">
          CBNU, Wevity, ContestKorea의 공지와 공모전을 AI가 자동 수집·분석하여 Google Calendar에 바로 등록합니다.
        </p>
        <div className="hero-btns">
          {/* TODO: Google OAuth 연동 후 실제 로그인으로 교체 */}
          <button type="button" className="btn-dk" onClick={start}>
            Google로 시작하기
          </button>
          <button type="button" className="btn-gh" onClick={start}>
            데모 보기
          </button>
        </div>

        <div className="hero-mockup">
          <div className="mockup-shadow">
            <div className="mb">
              <div className="mb-dots">
                <div className="mbd" style={{ background: '#FF5F57' }} />
                <div className="mbd" style={{ background: '#FFBD2E' }} />
                <div className="mbd" style={{ background: '#28CA41' }} />
              </div>
              <div className="mb-url">notiai.app/dashboard</div>
            </div>
            <div className="app-shell">
              <div className="app-side">
                <div className="app-side-logo">
                  <span className="app-side-logo-dot" />
                  NotiAI
                </div>
                <div className="app-nav-item on">대시보드</div>
                <div className="app-nav-item">
                  공지 수집<span className="app-nav-badge">23</span>
                </div>
                <div className="app-nav-item">AI 플래너</div>
                <div className="app-nav-item">캘린더</div>
              </div>
              <div className="app-main">
                <div className="app-topbar">
                  <div className="app-title">다가오는 마감</div>
                  <div className="app-badge">오늘 23건 수집</div>
                </div>
                {MOCKUP_TASKS.map((task) => (
                  <div className="task" key={task.name}>
                    <div className={`task-icon ${task.tone}`} style={{ fontSize: 0 }}>
                      <span
                        style={{ width: 8, height: 8, borderRadius: '50%', background: task.color, display: 'block', margin: 'auto' }}
                      />
                    </div>
                    <div className="task-info">
                      <div className="task-name">{task.name}</div>
                      <div className="task-src">{task.src}</div>
                    </div>
                    <div className={`task-badge ${task.badge}`}>{task.dday}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mock-stats">
              <div className="ms">
                <div className="ms-val">3+</div>
                <div className="ms-lbl">연동 사이트</div>
              </div>
              <div className="ms">
                <div className="ms-val">23</div>
                <div className="ms-lbl">오늘 수집</div>
              </div>
              <div className="ms">
                <div className="ms-val">6</div>
                <div className="ms-lbl">임박 마감</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr />

      {/* HOW */}
      <section className="sec sec-center reveal" id="how">
        <div className="tag">
          <span className="tag-dash" />
          작동 방식
          <span className="tag-dash" />
        </div>
        <h2 className="sh">
          공지 수집부터 등록까지 <span className="dim">4단계</span>
        </h2>
        <p className="ssub">매일 자동으로 수집하고, AI가 분석하고, 원클릭으로 캘린더에 등록합니다.</p>
        <div className="steps">
          {STEPS.map((step, index) => (
            <div className="step" key={step.num}>
              <div className="step-top-line" />
              <div className="step-n">
                <div className={`step-num ${step.done ? 'done' : ''}`.trim()}>{step.num}</div>
                {index < STEPS.length - 1 && <div className="step-ln" />}
              </div>
              <div className="step-t">{step.title}</div>
              <div className="step-d">{step.desc}</div>
              <div className="step-tag">{step.tag}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="sec-alt" id="feat">
        <div className="sec-inner">
          <div className="reveal sec-center" style={{ marginBottom: 52 }}>
            <div className="tag">
              <span className="tag-dash" />
              주요 기능
            </div>
            <h2 className="sh">
              일정 관리의 <span className="dim">모든 것을 자동화</span>
            </h2>
          </div>
          <div className="feat-row">
            <div className="feat-text reveal-l">
              <div className="feat-num-big">01 · 자동 공지 수집</div>
              <h3 className="feat-h">
                매일 자동으로
                <br />
                주요 사이트를 수집
              </h3>
              <p className="feat-desc">
                CBNU 포털, Wevity, ContestKorea 등 주요 사이트에서 매일 자동으로 공지와 공모전 정보를 수집합니다.
              </p>
            </div>
            <div className="feat-visual reveal-r">
              <div className="vis-block">
                <div className="vis-header">
                  <div className="vis-dot" style={{ background: '#28CA41' }} />
                  오늘 수집 현황 · 09:04 AM
                </div>
                <div className="vis-body">
                  {CRAWL_ROWS.map((row) => (
                    <div className="crawl-row" key={row.name}>
                      <span className="cr-name">{row.name}</span>
                      <span className="cr-count" style={{ color: 'var(--t2)' }}>
                        {row.count}건
                      </span>
                      <div className="cr-bar">
                        <div className="cr-fill" style={{ width: `${row.width}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec-dk">
        <div className="sec-inner">
          <div className="feat-row rev">
            <div className="feat-text reveal-r">
              <div className="feat-num-big" style={{ color: '#818CF8' }}>
                02 · AI 일정 추출
              </div>
              <h3 className="feat-h">
                AI가 본문을 읽고
                <br />
                핵심 정보만 추출
              </h3>
              <p className="feat-desc">
                대학 공지 데이터로 파인튜닝한 LLaMA 3.1 8B 모델이 공지 본문을 분석해 신청 기간, 마감일, 장소 등 핵심 정보를
                자동 추출합니다.
              </p>
            </div>
            <div className="feat-visual reveal-l">
              <div className="vis-block">
                <div className="vis-header">
                  <div className="vis-dot" style={{ background: '#818CF8' }} />
                  AI 분석 결과 · LLaMA 3.1 8B
                </div>
                <div className="vis-body">
                  {AI_ROWS.map((row) => (
                    <div className="ai-row" key={row.label}>
                      <div className="ai-label">{row.label}</div>
                      <div className="ai-val">{row.value}</div>
                      <div>
                        <div className="ai-tag b">추출됨</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sec-alt">
        <div className="sec-inner">
          <div className="feat-row">
            <div className="feat-text reveal-l">
              <div className="feat-num-big">03 · Google Calendar 연동</div>
              <h3 className="feat-h">
                원클릭으로
                <br />
                캘린더에 바로 등록
              </h3>
              <p className="feat-desc">원클릭으로 Google Calendar에 일정을 등록하고, 마감 알림을 자동으로 설정합니다.</p>
            </div>
            <div className="feat-visual reveal-r">
              <div className="vis-block">
                <div className="vis-header">
                  <div className="vis-dot" style={{ background: '#0D9488' }} />
                  Google Calendar 연동
                </div>
                <div className="vis-body">
                  {GCAL_ROWS.map((row) => (
                    <div className="gcal-row" key={row.name}>
                      <div className="gcal-color" style={{ background: row.color }} />
                      <div className="gcal-name">{row.name}</div>
                      <div className="gcal-date">{row.date}</div>
                      <div className={`gcal-badge ${row.badge}`}>{row.dday}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr />

      {/* MODES — config/aiModes.js 에서 목록을 가져옴 */}
      <section className="sec reveal" id="modes">
        <div className="tag">
          <span className="tag-dash" />
          AI 플래너
        </div>
        <h2 className="sh">
          나에게 맞는 <span className="dim">AI 모드 선택</span>
        </h2>
        <div style={{ height: 44 }} />
        <div className="modes">
          {AI_MODES.map((mode) => (
            <div className={`mode ${mode.id === DEFAULT_AI_MODE_ID ? 'on' : ''}`.trim()} key={mode.id}>
              <div>
                <div className="mode-nm">{mode.name}</div>
                <div className="mode-dc">{mode.shortDescription}</div>
              </div>
              {mode.id === DEFAULT_AI_MODE_ID && <span className="mode-badge">기본</span>}
            </div>
          ))}
        </div>
      </section>

      <hr />

      {/* SITES — config/sources.js */}
      <section className="sec reveal">
        <div className="tag">
          <span className="tag-dash" />
          연동 사이트
        </div>
        <h2 className="sh">
          주요 플랫폼 <span className="dim">연동</span>
        </h2>
        <div style={{ height: 44 }} />
        <div className="sites">
          {SOURCES.map((source) => (
            <div className="site" key={source.id}>
              <span className="site-dot" />
              <span className="site-nm">{source.label}</span>
              <span className="site-tp">{source.type}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section reveal" id="cta">
        <div className="dot-bg" />
        <div className="cta-glow" />
        <h2 className="cta-h">지금 바로 시작하세요</h2>
        <p className="cta-sub">Google 계정 하나로 모든 기능을 무료로 사용할 수 있습니다.</p>
        <div className="cta-btns">
          <button type="button" className="btn-wh" onClick={start}>
            Google로 시작하기
          </button>
          <a href={GITHUB_URL} className="btn-wh-ghost" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </section>

      <footer>
        <span>NotiAI</span>
        <span className="fd">·</span>
        <span>AI 대학생 일정 자동 생성 시스템</span>
        <span className="fd">·</span>
        <span>충북대학교 팀 프로젝트</span>
        <a href={GITHUB_URL} style={{ marginLeft: 'auto', color: 'var(--t3)', textDecoration: 'none' }} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>
    </div>
  );
}
