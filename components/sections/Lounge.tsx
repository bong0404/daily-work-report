'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MEMBERS, lsGet, lsSet, parseItems, avatarColor } from '@/lib/constants';
import { fetchReports } from '@/hooks/useReports';

// ── 메시지 타입 ──────────────────────────────────────────
interface LoungeMsg {
  id: number;
  from: string;       // 받는 사람
  msg: string;
  ts: string;
  likes: string[];
  sender?: string;    // 보내는 사람 실명 (없으면 익명)
  anonymous?: boolean;
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
  const [myName, setMyName] = useState('');
  const [to, setTo]         = useState('');
  const [sender, setSender] = useState('');
  const [input, setInput]   = useState('');
  const [anon, setAnon]     = useState(true);

  const reload = useCallback(() => setMsgs(getMsgs()), []);

  useEffect(() => {
    const name = lsGet('my_name') || '';
    setMyName(name);
    setSender(name);
    reload();
  }, [reload]);

  function post() {
    if (!to) { alert('받는 팀원을 선택해주세요'); return; }
    if (!input.trim()) { alert('메시지를 입력해주세요'); return; }
    const ts = new Date().toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const list = getMsgs();
    list.unshift({ id: Date.now(), from: to, msg: input.trim(), ts, likes: [], sender: anon ? '' : sender, anonymous: anon });
    saveMsgs(list);
    setInput('');
    reload();
  }

  function toggleLike(id: number) {
    if (!myName) { alert('먼저 내 이름을 설정해주세요'); return; }
    const list = getMsgs();
    const m = list.find(x => x.id === id); if (!m) return;
    if (m.likes.includes(myName)) m.likes = m.likes.filter(n => n !== myName);
    else m.likes.push(myName);
    saveMsgs(list);
    reload();
  }

  function del(id: number) {
    saveMsgs(getMsgs().filter(m => m.id !== id));
    reload();
  }

  const [inbox, setInbox] = useState(false);
  const displayed = inbox ? msgs.filter(m => m.from === myName) : msgs;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="lounge-block-title" style={{ marginBottom: 0 }}>💌 팀원에게 한마디</div>
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2 }}>
          <button onClick={() => setInbox(false)}
            style={{ padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: '0.8rem', fontWeight: inbox ? 400 : 700, background: inbox ? 'transparent' : '#fff', color: inbox ? '#94a3b8' : '#4f46e5', cursor: 'pointer', boxShadow: inbox ? 'none' : '0 1px 3px rgba(0,0,0,0.08)' }}>
            전체
          </button>
          <button onClick={() => setInbox(true)}
            style={{ padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: '0.8rem', fontWeight: inbox ? 700 : 400, background: inbox ? '#fff' : 'transparent', color: inbox ? '#4f46e5' : '#94a3b8', cursor: 'pointer', boxShadow: inbox ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            내게 온 한마디
            {msgs.filter(m => m.from === myName).length > 0 && (
              <span style={{ background: '#4f46e5', color: '#fff', borderRadius: 10, fontSize: '0.7rem', padding: '1px 6px', fontWeight: 700 }}>
                {msgs.filter(m => m.from === myName).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 작성 폼 */}
      <div style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, boxShadow: '0 2px 10px rgba(15,23,42,0.07)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={sender} onChange={e => setSender(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem', color: anon ? '#94a3b8' : '#1e293b' }}
            disabled={anon}>
            <option value="">보내는 사람</option>
            {MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}
          </select>
          <span style={{ alignSelf: 'center', color: '#cbd5e1', fontSize: '1rem' }}>→</span>
          <select value={to} onChange={e => setTo(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }}>
            <option value="">받는 사람 선택</option>
            {MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}
          </select>
        </div>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder="응원이나 피드백을 남겨보세요 ✨"
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.85rem', resize: 'vertical', minHeight: 68, fontFamily: 'inherit', outline: 'none' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <label style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} />
            익명으로 전달
          </label>
          <button onClick={post}
            style={{ padding: '7px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}>
            전송 💌
          </button>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div>
        {displayed.length === 0
          ? <div className="empty-state">{inbox ? `${myName || '나'}에게 온 메시지가 없어요 💌` : '아직 메시지가 없어요. 첫 번째 한마디를 남겨보세요! 💌'}</div>
          : displayed.map(m => {
            const senderLabel = m.anonymous === false && m.sender ? m.sender : '익명';
            return (
              <div key={m.id} className="lounge-msg-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    <strong style={{ color: m.anonymous === false ? '#4f46e5' : '#94a3b8' }}>{senderLabel}</strong>
                    <span style={{ margin: '0 6px', color: '#cbd5e1' }}>→</span>
                    <strong style={{ color: '#0f172a' }}>{m.from}</strong>님에게
                    <span style={{ marginLeft: 8, color: '#94a3b8', fontSize: '0.75rem' }}>{m.ts}</span>
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      className={`lounge-like-btn${m.likes.includes(myName) ? ' liked' : ''}`}
                      onClick={() => toggleLike(m.id)}>
                      🙌 {m.likes.length ? <strong>{m.likes.length}</strong> : '응원'}
                    </button>
                    <button onClick={() => del(m.id)}
                      style={{ border: 'none', background: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px' }}>✕</button>
                  </div>
                </div>
                <div className="lounge-msg-body" style={{ marginBottom: 0 }}>{m.msg}</div>
              </div>
            );
          })
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
  const [winnerPopup, setWinnerPopup] = useState<{name:string;result:string}|null>(null);
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
        if (result !== '😊 통과') setWinnerPopup({ name, result });
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
      const winner = allResults.find(r => r.result !== '😊 통과');
      if (winner) setWinnerPopup({ name: winner.name, result: winner.result });
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
    <>
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
            style={{ marginBottom: 3, fontSize: '0.8rem', padding: '7px 10px', fontWeight: 700 }}
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
    {winnerPopup && (
      <div
        onClick={() => setWinnerPopup(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: '#fff', borderRadius: 24, padding: '40px 48px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: 340, width: '90%' }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>🎉</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1b4b', marginBottom: 6 }}>{winnerPopup.name}님 당첨!</div>
          <div style={{ fontSize: '1.1rem', color: '#4f46e5', fontWeight: 700, background: '#eef2ff', borderRadius: 12, padding: '10px 20px', margin: '12px 0 24px' }}>{winnerPopup.result}</div>
          <button
            onClick={() => setWinnerPopup(null)}
            style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 32px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
          >확인</button>
        </div>
      </div>
    )}
  </>
  );
}

// ── 자유 제안 투표 ─────────────────────────────────────────
interface FreeSuggestion {
  id: number;
  text: string;
  author: string;
  voters: string[];
}

interface FreeSuggestionPollData {
  id: number;
  question: string;
  suggestions: FreeSuggestion[];
  createdAt: string;
}

const FREE_POLL_TEMPLATES = [
  { label: '🍱 점심 메뉴',  question: '오늘 점심 뭐 먹을까요?' },
  { label: '☕ 카페 메뉴',  question: '카페 메뉴 어떤 걸로 할까요?' },
  { label: '🍺 회식 장소',  question: '회식 장소 어디로 갈까요?' },
  { label: '🏃 팀빌딩',    question: '이번 팀빌딩 활동 어떤 게 좋을까요?' },
  { label: '🎁 선물',      question: '선물로 뭐가 좋을까요?' },
  { label: '📅 일정',      question: '일정 어떻게 잡으면 좋을까요?' },
];

function getFreePoll(): FreeSuggestionPollData | null {
  try { const s = lsGet('free_suggestion_poll'); return s ? JSON.parse(s) : null; } catch { return null; }
}

function FreeSuggestionPoll() {
  const [poll, setPoll]         = useState<FreeSuggestionPollData | null>(null);
  const [myName, setMyName]     = useState('');
  const [newText, setNewText]   = useState('');
  const [question, setQuestion] = useState('');

  useEffect(() => {
    setMyName(lsGet('my_name') || '');
    setPoll(getFreePoll());
  }, []);

  function save(p: FreeSuggestionPollData | null) {
    lsSet('free_suggestion_poll', p ? JSON.stringify(p) : '');
    setPoll(p);
  }

  function startPoll(q: string) {
    if (!q.trim()) return;
    save({ id: Date.now(), question: q.trim(), suggestions: [], createdAt: new Date().toISOString() });
    setQuestion('');
  }

  function addSuggestion() {
    if (!myName) { alert('내 이름을 먼저 설정해주세요'); return; }
    if (!newText.trim() || !poll) return;
    save({ ...poll, suggestions: [...poll.suggestions, { id: Date.now(), text: newText.trim(), author: myName, voters: [] }] });
    setNewText('');
  }

  function toggleVote(id: number) {
    if (!myName) { alert('내 이름을 먼저 설정해주세요'); return; }
    if (!poll) return;
    save({
      ...poll,
      suggestions: poll.suggestions.map(s =>
        s.id !== id ? s :
        s.voters.includes(myName)
          ? { ...s, voters: s.voters.filter(n => n !== myName) }
          : { ...s, voters: [...s.voters, myName] }
      ),
    });
  }

  function deleteSuggestion(id: number) {
    if (!poll) return;
    save({ ...poll, suggestions: poll.suggestions.filter(s => s.id !== id) });
  }

  const sorted = poll ? [...poll.suggestions].sort((a, b) => b.voters.length - a.voters.length) : [];
  const topVotes = sorted[0]?.voters.length ?? 0;

  return (
    <div>
      <div className="lounge-block-title">🙋 자유 제안 투표</div>

      {!poll && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, marginBottom: 14, boxShadow: '0 2px 10px rgba(15,23,42,0.07)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: 8 }}>빠른 시작</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {FREE_POLL_TEMPLATES.map(t => (
              <button key={t.label} onClick={() => startPoll(t.question)}
                style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: '0.82rem', color: '#475569', fontWeight: 600, transition: 'all 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
              >{t.label}</button>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: 8 }}>직접 입력</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="주제를 입력하세요 (예: 오늘 저녁 회식)"
                value={question} onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') startPoll(question); }}
                style={{ flex: 1, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.85rem' }}
              />
              <button onClick={() => startPoll(question)} disabled={!question.trim()}
                style={{ padding: '9px 16px', background: question.trim() ? '#4f46e5' : '#f1f5f9', color: question.trim() ? '#fff' : '#94a3b8', border: 'none', borderRadius: 9, fontWeight: 700, cursor: question.trim() ? 'pointer' : 'not-allowed', fontSize: '0.85rem', transition: 'all 0.15s', flexShrink: 0 }}>
                열기
              </button>
            </div>
          </div>
        </div>
      )}

      {poll ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 10px rgba(15,23,42,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{poll.question}</div>
            <button onClick={() => { if (confirm('투표를 종료할까요?')) save(null); }} style={{ fontSize: '0.75rem', color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>종료</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {sorted.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', padding: '16px 0' }}>아직 의견이 없어요. 첫 번째로 제안해보세요!</div>
            )}
            {sorted.map(s => {
              const isMyVote = s.voters.includes(myName);
              const isMine   = s.author === myName;
              const isTop    = topVotes > 0 && s.voters.length === topVotes;
              return (
                <div key={s.id} style={{ border: `2px solid ${isMyVote ? '#6366f1' : isTop ? '#6366f144' : '#e2e8f0'}`, borderRadius: 12, padding: '12px 14px', background: isMyVote ? '#eef2ff' : '#fff', transition: 'all 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button onClick={() => toggleVote(s.id)} style={{
                      width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
                      background: isMyVote ? '#6366f1' : '#f1f5f9',
                      color: isMyVote ? '#fff' : '#94a3b8',
                      fontWeight: 700, fontSize: '0.82rem',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                    }}>
                      <span style={{ fontSize: '1rem' }}>👍</span>
                      {s.voters.length > 0 && <span style={{ fontSize: '0.65rem', marginTop: 1 }}>{s.voters.length}</span>}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {s.text}
                        {isTop && <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#b45309', borderRadius: 20, padding: '1px 7px', fontWeight: 700 }}>🏆 1위</span>}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>제안: {s.author}</div>
                    </div>
                    {isMine && (
                      <button onClick={() => deleteSuggestion(s.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '0.9rem', padding: '0 4px', flexShrink: 0 }}>✕</button>
                    )}
                  </div>
                  {s.voters.length > 0 && (
                    <div style={{ marginTop: 8, paddingLeft: 50, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {s.voters.map(n => <span key={n} style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: 20, background: '#eef2ff', color: '#6366f1' }}>{n}</span>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text"
              placeholder={myName ? '의견을 입력하세요...' : '설정에서 내 이름을 먼저 등록해주세요'}
              value={newText} onChange={e => setNewText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSuggestion(); }}
              disabled={!myName}
              style={{ flex: 1, padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: '0.85rem' }}
            />
            <button onClick={addSuggestion} disabled={!myName || !newText.trim()}
              style={{ padding: '9px 16px', background: !myName || !newText.trim() ? '#f1f5f9' : '#4f46e5', color: !myName || !newText.trim() ? '#94a3b8' : '#fff', border: 'none', borderRadius: 9, fontWeight: 700, cursor: !myName || !newText.trim() ? 'not-allowed' : 'pointer', fontSize: '0.85rem', transition: 'all 0.15s', flexShrink: 0 }}>
              제안
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
      <FreeSuggestionPoll />
      <LadderGame />
    </div>
  );
}