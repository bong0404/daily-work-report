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
    sel.forEach((_, i) => setTimeout(() => (window as unknown as Record<string,unknown>).__traceIdx?.(i), i * 180));
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

// ── 밸런스 게임 ─────────────────────────────────────────
interface BalanceQuestion {
  id: number;
  a: string;
  b: string;
  category: string;
}

interface BalanceVotes {
  [questionId: number]: { a: string[]; b: string[] };
}

const DEFAULT_QUESTIONS: BalanceQuestion[] = [
  { id: 1,  a: '🍗 치킨',         b: '🍕 피자',         category: '점심/회식' },
  { id: 2,  a: '🍜 면 요리',       b: '🍚 밥 요리',       category: '점심/회식' },
  { id: 3,  a: '🍣 일식',          b: '🥩 고기',          category: '점심/회식' },
  { id: 4,  a: '🍺 1차 회식',      b: '🏠 바로 귀가',     category: '점심/회식' },
  { id: 5,  a: '🥂 고급 레스토랑', b: '🍻 편한 분위기 술자리', category: '점심/회식' },
  { id: 6,  a: '☕ 커피',          b: '🧋 버블티',        category: '카페' },
  { id: 7,  a: '🏢 사무실 점심',   b: '🚶 외식',          category: '점심/회식' },
  { id: 8,  a: '🛵 배달',          b: '🚶 직접 픽업',     category: '점심/회식' },
];

function getVotes(): BalanceVotes {
  try { return JSON.parse(lsGet('balance_votes') || '{}'); } catch { return {}; }
}
function saveVotes(v: BalanceVotes) { lsSet('balance_votes', JSON.stringify(v)); }

function getCustomQuestions(): BalanceQuestion[] {
  try { return JSON.parse(lsGet('balance_custom_q') || '[]'); } catch { return []; }
}
function saveCustomQuestions(q: BalanceQuestion[]) { lsSet('balance_custom_q', JSON.stringify(q)); }

function BalanceGame() {
  const [questions, setQuestions]   = useState<BalanceQuestion[]>([...DEFAULT_QUESTIONS, ...getCustomQuestions()]);
  const [votes, setVotes]           = useState<BalanceVotes>(getVotes());
  const [activeIdx, setActiveIdx]   = useState(0);
  const [myName, setMyName]         = useState(lsGet('my_name') || '');
  const [newA, setNewA]             = useState('');
  const [newB, setNewB]             = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [categories, setCategories] = useState<string[]>([...new Set(DEFAULT_QUESTIONS.map(q => q.category))]);
  const [filterCat, setFilterCat]   = useState('전체');

  const filtered = filterCat === '전체' ? questions : questions.filter(q => q.category === filterCat);
  const q        = filtered[activeIdx] ?? filtered[0];

  function refreshName() { setMyName(lsGet('my_name') || ''); }

  function vote(side: 'a' | 'b') {
    if (!myName) { alert('내 이름을 먼저 설정해주세요'); return; }
    if (!q) return;
    const v = getVotes();
    if (!v[q.id]) v[q.id] = { a: [], b: [] };
    // remove from both sides first (toggle)
    v[q.id].a = v[q.id].a.filter(n => n !== myName);
    v[q.id].b = v[q.id].b.filter(n => n !== myName);
    // check if already voted same side → cancel
    const currentVotes = getVotes()[q.id];
    const alreadyVoted = currentVotes?.[side]?.includes(myName);
    if (!alreadyVoted) v[q.id][side].push(myName);
    saveVotes(v);
    setVotes({ ...v });
  }

  function addQuestion() {
    if (!newA.trim() || !newB.trim()) { alert('A와 B 보기를 모두 입력해주세요'); return; }
    const custom = getCustomQuestions();
    const newQ: BalanceQuestion = { id: Date.now(), a: newA.trim(), b: newB.trim(), category: '커스텀' };
    custom.push(newQ);
    saveCustomQuestions(custom);
    const all = [...DEFAULT_QUESTIONS, ...custom];
    setQuestions(all);
    setNewA(''); setNewB(''); setShowAdd(false);
    const newIdx = filtered.length; // go to new question
    setActiveIdx(Math.max(0, all.length - 1));
    if (!categories.includes('커스텀')) setCategories(p => [...p, '커스텀']);
  }

  function deleteQuestion(id: number) {
    const custom = getCustomQuestions().filter(q => q.id !== id);
    saveCustomQuestions(custom);
    setQuestions([...DEFAULT_QUESTIONS, ...custom]);
    setActiveIdx(0);
  }

  function resetVotes() {
    if (!confirm('이 질문의 투표를 초기화할까요?')) return;
    if (!q) return;
    const v = getVotes();
    delete v[q.id];
    saveVotes(v);
    setVotes({ ...v });
  }

  if (!q) return null;

  const qVotes   = votes[q.id] || { a: [], b: [] };
  const totalVotes = qVotes.a.length + qVotes.b.length;
  const pctA     = totalVotes ? Math.round(qVotes.a.length / totalVotes * 100) : 50;
  const pctB     = 100 - pctA;
  const myVote   = qVotes.a.includes(myName) ? 'a' : qVotes.b.includes(myName) ? 'b' : null;
  const winnerA  = totalVotes > 0 && pctA > pctB;
  const winnerB  = totalVotes > 0 && pctB > pctA;
  const isCustom = !DEFAULT_QUESTIONS.find(dq => dq.id === q.id);

  const allCats  = ['전체', ...new Set(questions.map(q => q.category))];

  return (
    <div>
      <div className="lounge-block-title">⚖️ 밸런스 게임</div>
      <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 10px rgba(15,23,42,0.07)' }}>

        {/* 카테고리 필터 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 16 }}>
          {allCats.map(cat => (
            <button
              key={cat}
              onClick={() => { setFilterCat(cat); setActiveIdx(0); }}
              style={{
                padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                background: filterCat === cat ? '#4f46e5' : '#f1f5f9',
                color: filterCat === cat ? '#fff' : '#64748b',
                transition: 'all 0.15s',
              }}
            >{cat}</button>
          ))}
          <button
            onClick={() => { setShowAdd(p => !p); }}
            style={{ padding: '4px 12px', borderRadius: 20, border: '1px dashed #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}
          >+ 질문 추가</button>
        </div>

        {/* 질문 추가 폼 */}
        {showAdd && (
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
            <input
              type="text" placeholder="A 보기 (예: 🍗 치킨)"
              value={newA} onChange={e => setNewA(e.target.value)}
              style={{ flex: 1, minWidth: 120, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }}
            />
            <span style={{ color: '#94a3b8', fontWeight: 700 }}>vs</span>
            <input
              type="text" placeholder="B 보기 (예: 🍕 피자)"
              value={newB} onChange={e => setNewB(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addQuestion(); }}
              style={{ flex: 1, minWidth: 120, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }}
            />
            <button onClick={addQuestion} style={{ padding: '7px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}>추가</button>
          </div>
        )}

        {/* 질문 네비게이션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setActiveIdx(p => Math.max(0, p - 1))}
            disabled={activeIdx === 0}
            style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#64748b', fontSize: '0.85rem' }}
          >‹</button>
          <div style={{ flex: 1, textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8' }}>
            {activeIdx + 1} / {filtered.length}
            <span style={{ marginLeft: 6, padding: '2px 8px', background: '#f1f5f9', borderRadius: 20, fontSize: '0.72rem', color: '#64748b' }}>{q.category}</span>
          </div>
          <button
            onClick={() => setActiveIdx(p => Math.min(filtered.length - 1, p + 1))}
            disabled={activeIdx === filtered.length - 1}
            style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#64748b', fontSize: '0.85rem' }}
          >›</button>
          {isCustom && (
            <button onClick={() => deleteQuestion(q.id)} style={{ padding: '4px 8px', border: 'none', background: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: '0.82rem' }}>✕</button>
          )}
        </div>

        {/* 메인 투표 카드 */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {/* A */}
          <button
            onClick={() => vote('a')}
            style={{
              flex: 1, padding: '22px 14px', border: `2px solid ${myVote === 'a' ? '#4f46e5' : '#e2e8f0'}`,
              borderRadius: 14, background: myVote === 'a' ? '#eef2ff' : '#fff',
              cursor: 'pointer', transition: 'all 0.18s', textAlign: 'center' as const,
              boxShadow: myVote === 'a' ? '0 0 0 3px rgba(79,70,229,0.15)' : 'none',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{q.a}</div>
            {myVote === 'a' && <div style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 700 }}>✓ 내 선택</div>}
          </button>

          {/* vs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, color: '#94a3b8' }}>VS</div>
          </div>

          {/* B */}
          <button
            onClick={() => vote('b')}
            style={{
              flex: 1, padding: '22px 14px', border: `2px solid ${myVote === 'b' ? '#ec4899' : '#e2e8f0'}`,
              borderRadius: 14, background: myVote === 'b' ? '#fdf2f8' : '#fff',
              cursor: 'pointer', transition: 'all 0.18s', textAlign: 'center' as const,
              boxShadow: myVote === 'b' ? '0 0 0 3px rgba(236,72,153,0.15)' : 'none',
            }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{q.b}</div>
            {myVote === 'b' && <div style={{ fontSize: '0.72rem', color: '#ec4899', fontWeight: 700 }}>✓ 내 선택</div>}
          </button>
        </div>

        {/* 결과 바 */}
        {totalVotes > 0 ? (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', height: 28, marginBottom: 8 }}>
              <div style={{ width: `${pctA}%`, background: winnerA ? '#4f46e5' : '#a5b4fc', transition: 'width 0.5s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pctA > 15 && <span style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>{pctA}%</span>}
              </div>
              <div style={{ width: `${pctB}%`, background: winnerB ? '#ec4899' : '#f9a8d4', transition: 'width 0.5s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pctB > 15 && <span style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700 }}>{pctB}%</span>}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                {qVotes.a.length > 0 && (
                  <div style={{ fontSize: '0.73rem', color: '#6366f1' }}>
                    {qVotes.a.map(n => (
                      <span key={n} style={{ display: 'inline-block', background: '#eef2ff', borderRadius: 20, padding: '1px 7px', marginRight: 3, marginBottom: 2 }}>{n}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' as const }}>
                {qVotes.b.length > 0 && (
                  <div style={{ fontSize: '0.73rem', color: '#ec4899' }}>
                    {qVotes.b.map(n => (
                      <span key={n} style={{ display: 'inline-block', background: '#fdf2f8', borderRadius: 20, padding: '1px 7px', marginLeft: 3, marginBottom: 2 }}>{n}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'center' as const, marginTop: 6 }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>총 {totalVotes}명 참여</span>
              <button onClick={resetVotes} style={{ marginLeft: 10, fontSize: '0.72rem', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer' }}>초기화</button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' as const, color: '#94a3b8', fontSize: '0.82rem', marginBottom: 12, padding: '8px 0' }}>
            아직 투표가 없어요. 먼저 선택해보세요! 🗳️
          </div>
        )}

        {/* 내 이름 안내 */}
        {!myName && (
          <div style={{ textAlign: 'center' as const, fontSize: '0.78rem', color: '#f97316', background: '#fff7ed', borderRadius: 8, padding: '7px 14px' }}>
            왼쪽 하단에서 <strong>내 이름을 설정</strong>하면 투표할 수 있어요
          </div>
        )}
      </div>
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
      <BalanceGame />
      <LadderGame />
    </div>
  );
}
