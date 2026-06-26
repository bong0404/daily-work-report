'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MEMBERS, lsGet, lsSet, parseItems, avatarColor } from '@/lib/constants';
import { fetchReports } from '@/hooks/useReports';

// ── 메시지 타입 ──────────────────────────────────────────
interface LoungeMsg {
  id: number;
  from: string;
  msg: string;
  ts: string;
  likes: string[];
}

function getMsgs(): LoungeMsg[] {
  try { return JSON.parse(lsGet('team_lounge_msgs') || '[]'); } catch { return []; }
}
function saveMsgs(msgs: LoungeMsg[]) { lsSet('team_lounge_msgs', JSON.stringify(msgs)); }

// ── 에너지 카드 ─────────────────────────────────────────
function EnergyCard() {
  const [pct, setPct]       = useState(0);
  const [count, setCount]   = useState(0);
  const [dateLabel, setDateLabel] = useState('—');
  const [comment, setComment] = useState('로딩 중...');
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const rows = await fetchReports();
      const today = new Date().toISOString().slice(0, 10);
      let targetDate = today;
      let todayRows = rows.filter(r => r['날짜'] === today);
      if (!todayRows.length) {
        const dates = [...new Set(rows.map(r => r['날짜']))].sort().reverse();
        if (dates.length) { targetDate = dates[0]; todayRows = rows.filter(r => r['날짜'] === targetDate); }
      }
      const cnt   = new Set(todayRows.map(r => r['이름'])).size;
      const total = MEMBERS.length;
      const p     = total ? Math.round(cnt / total * 100) : 0;

      const comments: [number, string][] = [
        [100, '🎊 완벽한 하루! 온 팀이 빠짐없이 달렸어요'],
        [85,  '🔥 불타는 팀워크! 분위기 최고예요'],
        [70,  '💪 좋아요, 오늘도 열심히 달리는 중'],
        [50,  '😊 착실하게 쌓아가는 중이에요'],
        [30,  '☕ 느긋하게 시작하는 날이네요'],
        [0,   '😴 오늘은 조금 조용한 날이에요'],
      ];
      const cmt = (comments.find(([t]) => p >= t) || [0, '—'])[1] as string;

      setPct(p);
      setCount(cnt);
      setDateLabel(targetDate === today ? '오늘' : targetDate);
      setComment(cmt);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (barRef.current) barRef.current.style.width = p + '%';
      }));
    })();
  }, []);

  return (
    <div className="lounge-energy-card">
      <div className="lounge-energy-top">
        <div className="lounge-energy-label">⚡ 오늘의 팀 에너지</div>
        <div className="lounge-energy-date">{dateLabel}</div>
      </div>
      <div className="lounge-energy-pct">{pct}%</div>
      <div className="lounge-energy-sub">{count} / {MEMBERS.length}명 제출 완료</div>
      <div className="lounge-energy-track">
        <div className="lounge-energy-bar" ref={barRef} style={{ width: 0 }} />
      </div>
      <div className="lounge-energy-comment">{comment}</div>
    </div>
  );
}

// ── MVP 배지 ────────────────────────────────────────────
interface Stat { name: string; done: number; days: number; issues: number; plans: number; }

function MvpBadges() {
  const [badges, setBadges] = useState<{ icon: string; title: string; desc: string; winnerName: string; stat: string }[]>([]);
  const [empty, setEmpty]   = useState(false);

  useEffect(() => {
    (async () => {
      const rows = await fetchReports();
      const now  = new Date();
      const mkey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const monthRows = rows.filter(r => r['날짜'] && r['날짜'].startsWith(mkey));
      const targets   = monthRows.length ? monthRows : rows;

      const stats: Record<string, Stat> = {};
      MEMBERS.forEach(m => { stats[m.name] = { name: m.name, done: 0, days: 0, issues: 0, plans: 0 }; });
      targets.forEach(r => {
        const s = stats[r['이름']]; if (!s) return;
        s.days++;
        s.done   += parseItems(r['주요완료']   || '').length;
        s.issues += parseItems(r['이슈리스크'] || '').length;
        s.plans  += parseItems(r['익일계획']   || '').length;
      });
      const list = Object.values(stats).filter(s => s.days > 0);
      if (!list.length) { setEmpty(true); return; }

      const defs = [
        { icon: '👑', title: '완료왕',   desc: '가장 많은 업무를 완료',   key: 'done'   as keyof Stat, fmt: (s: Stat) => `${s.done}개 완료` },
        { icon: '🌟', title: '성실왕',   desc: '가장 많이 보고서 제출',   key: 'days'   as keyof Stat, fmt: (s: Stat) => `${s.days}일 제출` },
        { icon: '🔍', title: '이슈킬러', desc: '이슈를 가장 많이 발굴',   key: 'issues' as keyof Stat, fmt: (s: Stat) => `${s.issues}건 발굴` },
        { icon: '📋', title: '계획천재', desc: '익일계획을 가장 상세히',  key: 'plans'  as keyof Stat, fmt: (s: Stat) => `${s.plans}개 작성` },
      ];
      setBadges(defs.map(b => {
        const winner = [...list].sort((a, c) => (c[b.key] as number) - (a[b.key] as number))[0];
        return { icon: b.icon, title: b.title, desc: b.desc, winnerName: winner.name, stat: b.fmt(winner) };
      }));
    })();
  }, []);

  if (empty) return <div className="empty-state">이번 달 데이터가 없습니다</div>;

  return (
    <div className="lounge-badges">
      {badges.length === 0
        ? <div className="empty-state">로딩 중...</div>
        : badges.map(b => (
          <div key={b.title} className="lounge-badge-card">
            <span className="lounge-badge-icon">{b.icon}</span>
            <div className="lounge-badge-title">{b.title}</div>
            <div className="lounge-badge-name">{b.winnerName}</div>
            <div className="lounge-badge-stat">{b.stat}</div>
            <div className="lounge-badge-desc">{b.desc}</div>
          </div>
        ))
      }
    </div>
  );
}

// ── 팀원에게 한마디 ─────────────────────────────────────
function MessageBoard() {
  const [msgs, setMsgs]     = useState<LoungeMsg[]>([]);
  const [from, setFrom]     = useState('');
  const [input, setInput]   = useState('');
  const myName              = lsGet('my_name') || '';

  const reload = useCallback(() => setMsgs(getMsgs()), []);

  useEffect(() => { reload(); }, [reload]);

  function post() {
    if (!from)  { alert('받는 팀원을 선택해주세요'); return; }
    if (!input.trim()) { alert('메시지를 입력해주세요'); return; }
    const ts = new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const list = getMsgs();
    list.unshift({ id: Date.now(), from, msg: input.trim(), ts, likes: [] });
    saveMsgs(list);
    setInput('');
    reload();
  }

  function toggleLike(id: number) {
    const name = myName;
    if (!name) { alert('먼저 내 이름을 설정해주세요'); return; }
    const list = getMsgs();
    const m = list.find(x => x.id === id); if (!m) return;
    if (m.likes.includes(name)) m.likes = m.likes.filter(n => n !== name);
    else m.likes.push(name);
    saveMsgs(list);
    reload();
  }

  return (
    <div>
      <div className="lounge-block-title">💌 팀원에게 한마디</div>
      <div className="lounge-msg-form">
        <select className="lounge-msg-sel" value={from} onChange={e => setFrom(e.target.value)}>
          <option value="">팀원 선택</option>
          {MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}
        </select>
        <input
          className="lounge-msg-input"
          type="text"
          placeholder="응원 메시지를 남겨보세요 ✨ (익명)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') post(); }}
        />
        <button className="lounge-msg-btn" onClick={post}>전송 💌</button>
      </div>
      <div id="lounge-msg-list">
        {msgs.length === 0
          ? <div className="empty-state">아직 메시지가 없어요. 첫 번째 한마디를 남겨보세요! 💌</div>
          : msgs.map(m => (
            <div key={m.id} className="lounge-msg-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="lounge-msg-from" style={{ flexShrink: 0 }}>
                📨 <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#94a3b8', marginRight: 2 }}>익명 →</span> {m.from}님에게
              </span>
              <span className="lounge-msg-body" style={{ flex: 1, marginBottom: 0 }}>{m.msg}</span>
              <button
                className={`lounge-like-btn${m.likes.includes(myName) ? ' liked' : ''}`}
                onClick={() => toggleLike(m.id)}
                style={{ flexShrink: 0 }}
              >
                🙌 {m.likes.length ? <strong>{m.likes.length}</strong> : '응원하기'}
              </button>
              <span className="lounge-msg-ts" style={{ flexShrink: 0 }}>{m.ts}</span>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── 사다리타기 ──────────────────────────────────────────
const LC = { ROWS: 10, SX: 80, SY: 36, PX: 52, PTOP: 56, PBOT: 52 };
const LCOLORS = ['#f43f5e','#f97316','#eab308','#22c55e','#14b8a6','#8b5cf6','#ec4899'];
const lcx = (c: number) => LC.PX + c * LC.SX;
const lry = (r: number) => LC.PTOP + r * LC.SY;

interface LadderBridge { row: number; col: number; }
interface LadderPath { startCol: number; endCol: number; points: {x:number;y:number}[]; len: number; }

function LadderGame() {
  const [sel, setSel]             = useState<string[]>(MEMBERS.map(m => m.name));
  const [special, setSpecial]     = useState('☕ 커피 쏘기');
  const [phase, setPhase]         = useState<'setup' | 'game'>('setup');
  const [paths, setPaths]         = useState<LadderPath[]>([]);
  const [resMap, setResMap]       = useState<Record<number, string>>({});
  const [svgHtml, setSvgHtml]     = useState('');
  const [resultItems, setResultItems] = useState<{name:string;i:number;result:string}[]>([]);
  const revealedRef               = useRef<Set<number>>(new Set());
  const revealAllActiveRef        = useRef(false);
  const svgRef                    = useRef<HTMLDivElement>(null);

  function toggleChip(name: string) {
    setSel(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  }

  function generate() {
    const n = sel.length;
    if (n < 2) { alert('최소 2명을 선택해주세요'); return; }

    const brgs: LadderBridge[] = [];
    for (let r = 0; r < LC.ROWS; r++) {
      let c = 0;
      while (c < n - 1) {
        if (Math.random() < 0.42) { brgs.push({ row: r, col: c }); c += 2; }
        else c++;
      }
    }

    const ps: LadderPath[] = [];
    for (let i = 0; i < n; i++) {
      let pos = i;
      const pts: {x:number;y:number}[] = [{ x: lcx(pos), y: lry(0) }];
      for (let r = 0; r < LC.ROWS; r++) {
        const goR = brgs.some(b => b.row === r && b.col === pos);
        const goL = !goR && pos > 0 && brgs.some(b => b.row === r && b.col === pos - 1);
        if (goR) { pts.push({ x: lcx(pos), y: lry(r) }); pos++; pts.push({ x: lcx(pos), y: lry(r) }); }
        else if (goL) { pts.push({ x: lcx(pos), y: lry(r) }); pos--; pts.push({ x: lcx(pos), y: lry(r) }); }
        pts.push({ x: lcx(pos), y: lry(r + 1) });
      }
      const len = pts.reduce((s, p, j) => j === 0 ? 0 : s + Math.abs(p.x - pts[j-1].x) + Math.abs(p.y - pts[j-1].y), 0);
      ps.push({ startCol: i, endCol: pos, points: pts, len });
    }

    const sp = (special.trim()) || '☕ 커피 쏘기';
    const pool = [sp, ...Array(n - 1).fill('😊 통과')].sort(() => Math.random() - 0.5);
    const rm: Record<number, string> = Object.fromEntries(pool.map((v, c) => [c, v]));

    revealedRef.current = new Set();
    setResultItems([]);
    setPaths(ps);
    setResMap(rm);
    setPhase('game');
    drawSVG(n, sp, ps, brgs, rm);
  }

  function drawSVG(
    n: number, sp: string,
    ps: LadderPath[], brgs: LadderBridge[],
    rm: Record<number, string>
  ) {
    const W = LC.PX * 2 + (n - 1) * LC.SX;
    const H = LC.PTOP + LC.ROWS * LC.SY + LC.PBOT;
    let s = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" style="font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;display:block">`;
    s += `<rect width="${W}" height="${H}" fill="#fff" rx="14"/>`;

    for (let c = 0; c < n; c++) {
      s += `<line x1="${lcx(c)}" y1="${lry(0)}" x2="${lcx(c)}" y2="${lry(LC.ROWS)}" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round"/>`;
    }
    brgs.forEach(b => {
      s += `<line x1="${lcx(b.col)}" y1="${lry(b.row)}" x2="${lcx(b.col+1)}" y2="${lry(b.row)}" stroke="#cbd5e1" stroke-width="2.5" stroke-linecap="round"/>`;
    });

    ps.forEach((pd, i) => {
      const d = 'M ' + pd.points.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ');
      s += `<path id="lpath-${i}" d="${d}" fill="none" stroke="${LCOLORS[i % LCOLORS.length]}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${pd.len}" stroke-dashoffset="${pd.len}" style="transition:stroke-dashoffset 0.75s ease"/>`;
    });

    sel.forEach((name, i) => {
      const x = lcx(i);
      s += `<g style="cursor:pointer" onclick="window.__traceIdx(${i})">
        <rect x="${x-26}" y="7" width="52" height="24" rx="8" fill="transparent"/>
        <text x="${x}" y="23" text-anchor="middle" font-size="12" font-weight="700" fill="#6366f1">${name}</text>
        <polygon points="${x},${lry(0)-5} ${x-5},${lry(0)-13} ${x+5},${lry(0)-13}" fill="#cbd5e1"/>
      </g>`;
    });

    for (let c = 0; c < n; c++) {
      const x   = lcx(c);
      const res = rm[c];
      const isW = res !== '😊 통과';
      s += `<g id="lres-${c}" opacity="0" style="transition:opacity 0.45s ease">
        <rect x="${x-28}" y="${lry(LC.ROWS)+6}" width="56" height="38" rx="9" fill="${isW?'#fef3c7':'#f8fafc'}" stroke="${isW?'#fcd34d':'#e2e8f0'}" stroke-width="1.5"/>
        <text x="${x}" y="${lry(LC.ROWS)+22}" text-anchor="middle" font-size="13">${isW?'🎉':'😊'}</text>
        <text x="${x}" y="${lry(LC.ROWS)+36}" text-anchor="middle" font-size="8.5" font-weight="700" fill="${isW?'#b45309':'#64748b'}">${isW?'당첨!':'통과'}</text>
      </g>`;
    }
    s += '</svg>';
    setSvgHtml(s);
  }

  function traceIdx(idx: number) {
    if (revealedRef.current.has(idx)) return;
    revealedRef.current.add(idx);

    const pEl = document.getElementById(`lpath-${idx}`);
    if (pEl) pEl.style.strokeDashoffset = '0';
    setTimeout(() => {
      const endCol = paths[idx]?.endCol;
      const rEl = document.getElementById(`lres-${endCol}`);
      if (rEl) rEl.setAttribute('opacity', '1');
      if (!revealAllActiveRef.current) {
        const result = resMap[endCol];
        const name = sel[idx];
        setResultItems(prev => [...prev, { name, i: idx, result }]);
        if (result !== '😊 통과') alert(`🎉 ${name}님 "${result}" 당첨!`);
      }
    }, 820);
  }

  function revealAll() {
    revealAllActiveRef.current = true;
    const n = sel.length;
    sel.forEach((_, i) => setTimeout(() => { const fn = (window as unknown as Record<string, unknown>).__traceIdx; if (typeof fn === 'function') fn(i); }, i * 180));
    setTimeout(() => {
      revealAllActiveRef.current = false;
      const allResults = paths.map((p, i) => ({ name: sel[i], i, result: resMap[p.endCol] }));
      setResultItems(allResults);
    }, (n - 1) * 180 + 950);
  }

  function reset() {
    setPhase('setup');
    setSvgHtml('');
    revealedRef.current = new Set();
    revealAllActiveRef.current = false;
    setResultItems([]);
  }

  // expose traceIdx to SVG onclick
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__traceIdx = traceIdx;
  });

  return (
    <div>
      <div className="lounge-block-title">🎲 사다리타기</div>
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 10px rgba(15,23,42,0.07)', display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* 왼쪽: 설정 */}
        <div style={{ flex: '0 0 33%', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: 6 }}>🎁 당첨 결과 설정</div>
          <input
            className="ladder-special-input"
            type="text"
            value={special}
            onChange={e => setSpecial(e.target.value)}
            style={{ marginBottom: 3, fontSize: '0.8rem', padding: '7px 10px' }}
          />
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: 12 }}>나머지는 😊 통과 처리돼요</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: 6 }}>👥 참가자</div>
          <div className="ladder-chip-grid">
            {MEMBERS.map(m => (
              <div
                key={m.name}
                className={`ladder-chip${sel.includes(m.name) ? ' on' : ''}`}
                onClick={() => toggleChip(m.name)}
              >
                {m.name}
              </div>
            ))}
          </div>
        </div>

        {/* 오른쪽: 사다리 영역 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {phase === 'setup' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <button className="ladder-gen-btn" onClick={generate}>🎲 사다리 생성!</button>
            </div>
          ) : (
            <div>
              <div className="ladder-hint" style={{ marginTop: 0, marginBottom: 10 }}>이름을 클릭하면 해당 경로가 공개돼요 👆</div>
              <div
                className="ladder-svg-wrap"
                ref={svgRef}
                dangerouslySetInnerHTML={{ __html: svgHtml }}
              />
              <div className="ladder-controls">
                <button className="ladder-reveal-btn" onClick={revealAll}>🎊 모두 공개!</button>
                <button className="ladder-reset-btn" onClick={reset}>↩ 다시 생성</button>
              </div>
              {resultItems.length > 0 && (
                <div className="ladder-result-board">
                  {resultItems.map(x => (
                    <div key={x.i} className={`ladder-result-item${x.result !== '😊 통과' ? ' winner' : ''}`}>
                      <strong>{x.name}</strong>
                      <span style={{ color: '#94a3b8' }}>→</span>
                      <span>{x.result}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── 팀 투표 ─────────────────────────────────────────────
interface Poll {
  id: number;
  question: string;
  options: string[];
  votes: Record<string, number>;
  createdAt: string;
  subOptions?: string[][];
  phase?: 1 | 2;
  phaseWinner?: number;
  subVotes?: Record<string, number>;
}

const LUNCH_CATEGORIES = [
  { emoji: '🍚', label: '한식', dishes: ['찌개류', '찜·조림', '볶음류', '국밥·탕', '백반·정식', '쌈밥'] },
  { emoji: '🍜', label: '분식', dishes: ['떡볶이', '김밥', '라면·우동', '순대·튀김', '만두', '쫄면'] },
  { emoji: '🥢', label: '중식', dishes: ['짜장면', '짬뽕', '탕수육', '볶음밥', '마라탕', '딤섬'] },
  { emoji: '🍕', label: '서양식', dishes: ['피자', '파스타', '버거', '샌드위치', '스테이크', '샐러드'] },
  { emoji: '🍱', label: '아시안', dishes: ['스시·초밥', '라멘', '쌀국수', '팟타이', '카레', '덮밥'] },
  { emoji: '🌮', label: '중남미', dishes: ['타코', '부리또', '케밥', '샤와르마', '파히타', '나초'] },
];

const POLL_TEMPLATES: Array<{
  label: string; question: string; options: string[];
  subOptions?: string[][]; startDirect?: boolean;
}> = [
  {
    label: '🍱 점심 메뉴',
    question: '오늘 점심 어떤 종류로?',
    options: LUNCH_CATEGORIES.map(c => `${c.emoji} ${c.label}`),
    subOptions: LUNCH_CATEGORIES.map(c => c.dishes),
    startDirect: true,
  },
  { label: '☕ 카페', question: '카페 메뉴 고르기!', options: ['☕ 아메리카노', '🥛 라떼', '🍵 녹차라떼', '🧋 버블티', '🍹 에이드'] },
  { label: '🍺 회식', question: '회식 장소 어디로 갈까요?', options: ['🥩 고기집', '🐟 횟집', '🍝 이탈리안', '🥢 중식당', '🍺 호프집'] },
];

const POLL_COLORS = ['#6366f1', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#a855f7'];

function TeamPoll() {
  const [poll, setPoll]           = useState<Poll | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);
  const [myName, setMyName]       = useState('');

  useEffect(() => {
    setMyName(lsGet('my_name') || '');
    try { const s = lsGet('team_poll'); if (s) setPoll(JSON.parse(s)); } catch { /* ignore */ }
  }, []);

  function savePoll(p: Poll | null) {
    lsSet('team_poll', p ? JSON.stringify(p) : '');
    setPoll(p);
  }

  function createPoll() {
    const opts = newOptions.map(o => o.trim()).filter(Boolean);
    if (!newQuestion.trim()) { alert('질문을 입력해주세요'); return; }
    if (opts.length < 2) { alert('선택지를 2개 이상 입력해주세요'); return; }
    savePoll({ id: Date.now(), question: newQuestion.trim(), options: opts, votes: {}, createdAt: new Date().toISOString() });
    setShowCreate(false); setNewQuestion(''); setNewOptions(['', '']);
  }

  function applyTemplate(t: typeof POLL_TEMPLATES[0]) {
    if (t.startDirect) {
      savePoll({ id: Date.now(), question: t.question, options: t.options, votes: {}, createdAt: new Date().toISOString(), subOptions: t.subOptions, phase: 1 });
      return;
    }
    setNewQuestion(t.question);
    setNewOptions([...t.options, '']);
    setShowCreate(true);
  }

  function vote(optIdx: number) {
    if (!myName) { alert('내 이름을 먼저 설정해주세요'); return; }
    if (!poll) return;
    if (poll.phase === 2) {
      const sv = { ...poll.subVotes };
      if (sv[myName] === optIdx) delete sv[myName]; else sv[myName] = optIdx;
      savePoll({ ...poll, subVotes: sv });
    } else {
      const nv = { ...poll.votes };
      if (nv[myName] === optIdx) delete nv[myName]; else nv[myName] = optIdx;
      savePoll({ ...poll, votes: nv });
    }
  }

  function advancePhase(winnerIdx: number) {
    if (!poll) return;
    savePoll({ ...poll, phase: 2, phaseWinner: winnerIdx, subVotes: {} });
  }

  function backToPhase1() {
    if (!poll) return;
    savePoll({ ...poll, phase: 1, phaseWinner: undefined, subVotes: {} });
  }

  const totalVoters = poll ? Object.keys(poll.votes).length : 0;
  const myVote = poll && myName in poll.votes ? poll.votes[myName] : -1;

  return (
    <div>
      <div className="lounge-block-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🗳️ 팀 투표</span>
        <button onClick={() => setShowCreate(p => !p)} style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 20, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}>
          {showCreate ? '✕ 닫기' : '+ 새 투표'}
        </button>
      </div>

      {/* 투표 생성 폼 */}
      {showCreate && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, boxShadow: '0 2px 10px rgba(15,23,42,0.07)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: 8 }}>빠른 템플릿</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {POLL_TEMPLATES.map(t => (
              <button key={t.label} onClick={() => applyTemplate(t)}
                style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                {t.label}
              </button>
            ))}
          </div>
          <input type="text" placeholder="질문을 입력하세요 (예: 오늘 점심 뭐 먹을까요?)"
            value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.88rem', marginBottom: 10, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {newOptions.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: POLL_COLORS[i % POLL_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <input type="text" placeholder={`선택지 ${i + 1}`} value={opt}
                  onChange={e => { const o = [...newOptions]; o[i] = e.target.value; setNewOptions(o); }}
                  onKeyDown={e => { if (e.key === 'Enter' && i === newOptions.length - 1 && newOptions.length < 6) setNewOptions(p => [...p, '']); }}
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }}
                />
                {newOptions.length > 2 && (
                  <button onClick={() => setNewOptions(p => p.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {newOptions.length < 6 && (
              <button onClick={() => setNewOptions(p => [...p, ''])}
                style={{ padding: '7px 14px', border: '1px dashed #cbd5e1', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: '#94a3b8' }}>
                + 선택지 추가
              </button>
            )}
            <button onClick={createPoll}
              style={{ padding: '7px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>
              투표 시작 🗳️
            </button>
          </div>
        </div>
      )}

      {/* 활성 투표 */}
      {poll ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 10px rgba(15,23,42,0.07)' }}>

          {/* 2단계 카테고리 투표 (점심 메뉴 등) */}
          {poll.phase === 1 && poll.subOptions ? (() => {
            const voteCounts = poll.options.map((_, i) => Object.values(poll.votes).filter(v => v === i).length);
            const maxVotes = Math.max(...voteCounts, 0);
            const leadingIdx = maxVotes > 0 ? voteCounts.indexOf(maxVotes) : -1;
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{poll.question}</div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', background: '#f8fafc', borderRadius: 20, padding: '2px 10px' }}>1단계</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 14 }}>카테고리를 선택하면 세부 메뉴로 이동해요</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                  {poll.options.map((opt, i) => {
                    const parts = opt.split(' ');
                    const emoji = parts[0];
                    const name = parts.slice(1).join(' ');
                    const voters = Object.entries(poll.votes).filter(([, v]) => v === i).map(([n]) => n);
                    const pct = totalVoters > 0 ? Math.round(voters.length / totalVoters * 100) : 0;
                    const isMyVote = myVote === i;
                    const isLeading = i === leadingIdx;
                    const color = POLL_COLORS[i % POLL_COLORS.length];
                    return (
                      <div key={i} onClick={() => vote(i)} style={{
                        border: `2px solid ${isMyVote ? color : isLeading && totalVoters > 0 ? `${color}88` : '#e2e8f0'}`,
                        borderRadius: 14, padding: '14px 8px 10px', cursor: 'pointer',
                        textAlign: 'center', position: 'relative', overflow: 'hidden',
                        background: isMyVote ? `${color}0d` : '#fff', transition: 'all 0.15s',
                      }}>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%`, background: color, opacity: 0.1, transition: 'height 0.4s ease' }} />
                        <div style={{ position: 'relative', fontSize: '1.7rem', marginBottom: 4, lineHeight: 1 }}>{emoji}</div>
                        <div style={{ position: 'relative', fontSize: '0.82rem', fontWeight: isMyVote ? 700 : 500, color: isMyVote ? color : '#1e293b' }}>{name}</div>
                        {totalVoters > 0 && <div style={{ position: 'relative', fontSize: '0.72rem', color, fontWeight: 700, marginTop: 2 }}>{pct}%</div>}
                        {voters.length > 0 && (
                          <div style={{ position: 'relative', display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                            {voters.map(n => <span key={n} style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: 10, background: `${color}18`, color }}>{n}</span>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {leadingIdx >= 0 && (
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <button onClick={() => advancePhase(leadingIdx)}
                      style={{ padding: '9px 22px', background: POLL_COLORS[leadingIdx % POLL_COLORS.length], color: '#fff', border: 'none', borderRadius: 22, fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                      {poll.options[leadingIdx]} 세부 메뉴 보기 →
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>총 {totalVoters}명 참여</span>
                  <button onClick={() => { if (confirm('투표를 종료할까요?')) savePoll(null); }} style={{ fontSize: '0.75rem', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer' }}>투표 종료</button>
                </div>
              </>
            );
          })() : poll.phase === 2 && poll.phaseWinner !== undefined && poll.subOptions ? (() => {
            const dishes = poll.subOptions[poll.phaseWinner];
            const subVotes = poll.subVotes || {};
            const totalSub = Object.keys(subVotes).length;
            const mySubVote = myName in subVotes ? subVotes[myName] : -1;
            const winnerCat = poll.options[poll.phaseWinner];
            const catColor = POLL_COLORS[poll.phaseWinner % POLL_COLORS.length];
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <button onClick={backToPhase1} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '0.82rem', padding: '4px 8px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    ← 카테고리
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '1.1rem' }}>{winnerCat.split(' ')[0]}</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: catColor }}>{winnerCat.split(' ').slice(1).join(' ')} 세부 메뉴</span>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#94a3b8', background: '#f8fafc', borderRadius: 20, padding: '2px 10px' }}>2단계</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {dishes.map((dish, i) => {
                    const voters = Object.entries(subVotes).filter(([, v]) => v === i).map(([n]) => n);
                    const pct = totalSub > 0 ? Math.round(voters.length / totalSub * 100) : 0;
                    const isMyVote = mySubVote === i;
                    return (
                      <div key={i} onClick={() => vote(i)} style={{ border: `2px solid ${isMyVote ? catColor : '#e2e8f0'}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s', background: isMyVote ? `${catColor}0d` : '#fff', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: catColor, opacity: 0.08, transition: 'width 0.4s ease' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                          <span style={{ width: 26, height: 26, borderRadius: '50%', background: isMyVote ? catColor : '#f1f5f9', color: isMyVote ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ flex: 1, fontWeight: isMyVote ? 700 : 500, color: '#1e293b', fontSize: '0.9rem' }}>{dish}</span>
                          {totalSub > 0 && <span style={{ fontSize: '0.82rem', fontWeight: 700, color: catColor }}>{pct}%</span>}
                          {isMyVote && <span style={{ fontSize: '0.72rem', color: catColor, fontWeight: 700 }}>✓ 내 선택</span>}
                        </div>
                        {voters.length > 0 && (
                          <div style={{ marginTop: 6, paddingLeft: 36, display: 'flex', gap: 4, flexWrap: 'wrap', position: 'relative' }}>
                            {voters.map(n => <span key={n} style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: 20, background: `${catColor}18`, color: catColor }}>{n}</span>)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>총 {totalSub}명 참여</span>
                  <button onClick={() => { if (confirm('투표를 종료할까요?')) savePoll(null); }} style={{ fontSize: '0.75rem', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer' }}>투표 종료</button>
                </div>
              </>
            );
          })() : (
            /* 일반 투표 */
            <>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>{poll.question}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {poll.options.map((opt, i) => {
                  const voters = Object.entries(poll.votes).filter(([, v]) => v === i).map(([n]) => n);
                  const pct = totalVoters > 0 ? Math.round(voters.length / totalVoters * 100) : 0;
                  const isMyVote = myVote === i;
                  const color = POLL_COLORS[i % POLL_COLORS.length];
                  return (
                    <div key={i} onClick={() => vote(i)} style={{ border: `2px solid ${isMyVote ? color : '#e2e8f0'}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s', background: isMyVote ? `${color}0d` : '#fff', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, opacity: 0.08, transition: 'width 0.4s ease' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                        <span style={{ width: 26, height: 26, borderRadius: '50%', background: isMyVote ? color : '#f1f5f9', color: isMyVote ? '#fff' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ flex: 1, fontWeight: isMyVote ? 700 : 500, color: '#1e293b', fontSize: '0.9rem' }}>{opt}</span>
                        {totalVoters > 0 && <span style={{ fontSize: '0.82rem', fontWeight: 700, color }}>{pct}%</span>}
                        {isMyVote && <span style={{ fontSize: '0.72rem', color, fontWeight: 700 }}>✓ 내 선택</span>}
                      </div>
                      {voters.length > 0 && (
                        <div style={{ marginTop: 6, paddingLeft: 36, display: 'flex', gap: 4, flexWrap: 'wrap', position: 'relative' }}>
                          {voters.map(n => <span key={n} style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: 20, background: `${color}18`, color }}>{n}</span>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>총 {totalVoters}명 참여</span>
                <button onClick={() => { if (confirm('투표를 종료할까요?')) savePoll(null); }} style={{ fontSize: '0.75rem', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer' }}>투표 종료</button>
              </div>
            </>
          )}

          {!myName && (
            <div style={{ marginTop: 10, textAlign: 'center', fontSize: '0.78rem', color: '#f97316', background: '#fff7ed', borderRadius: 8, padding: '7px 14px' }}>
              설정에서 <strong>내 이름을 설정</strong>하면 투표할 수 있어요
            </div>
          )}
        </div>
      ) : !showCreate ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: '32px 20px', boxShadow: '0 2px 10px rgba(15,23,42,0.07)', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🗳️</div>
          <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: 16 }}>진행 중인 투표가 없어요</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
            {POLL_TEMPLATES.map(t => (
              <button key={t.label} onClick={() => applyTemplate(t)}
                style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                {t.label}
              </button>
            ))}
            <button onClick={() => setShowCreate(true)}
              style={{ padding: '7px 14px', borderRadius: 20, border: '1px dashed #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', color: '#94a3b8', fontWeight: 600 }}>
              직접 만들기
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── 메인 Lounge 컴포넌트 ─────────────────────────────────
export function Lounge() {
  return (
    <div className="lounge-wrap">
      <EnergyCard />
      <div>
        <div className="lounge-block-title">🏆 이번 달 MVP</div>
        <MvpBadges />
      </div>
      <MessageBoard />
      <TeamPoll />
      <LadderGame />
    </div>
  );
}
