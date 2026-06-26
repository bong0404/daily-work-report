'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MEMBERS, ALL_MEMBERS, lsGet, lsSet, parseItems, todayString, getMonthDays, MonthPlanData } from '@/lib/constants';
import { fetchReports } from '@/hooks/useReports';

// ── 공지 타입 ────────────────────────────────────────────
interface Notice {
  id: number;
  author: string;
  title: string;
  body: string;
  pinned: boolean;
  time: string;
}
interface NoticeComment { author: string; text: string; time: string; }

function getNotices(): Notice[] {
  try { return JSON.parse(lsGet('notices') || '[]'); } catch { return []; }
}
function saveNotices(list: Notice[]) { lsSet('notices', JSON.stringify(list)); }
function getNoticeComments(id: number): NoticeComment[] {
  try { return JSON.parse(lsGet(`notice_comments_${id}`) || '[]'); } catch { return []; }
}
function saveNoticeComments(id: number, list: NoticeComment[]) {
  lsSet(`notice_comments_${id}`, JSON.stringify(list));
}

// ── 차주 계획 유틸 ───────────────────────────────────────
function getNextWeekRange(): { nextMon: Date; nextSun: Date } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  const daysToNextMon = dow === 0 ? 1 : 8 - dow;
  const nextMon = new Date(today);
  nextMon.setDate(today.getDate() + daysToNextMon);
  const nextSun = new Date(nextMon);
  nextSun.setDate(nextMon.getDate() + 6);
  return { nextMon, nextSun };
}

function hasNextWeekPlan(memberName: string): boolean {
  const { nextMon, nextSun } = getNextWeekRange();
  const months = new Set<string>();
  for (let d = new Date(nextMon); d <= nextSun; d.setDate(d.getDate() + 1)) {
    months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  for (const mkey of months) {
    const raw = lsGet(`mplan_${memberName}_${mkey}`);
    if (!raw) continue;
    try {
      const data: MonthPlanData = JSON.parse(raw);
      const days = getMonthDays(mkey);
      for (const day of days) {
        if (day.isOther) continue;
        if (day.date >= nextMon && day.date <= nextSun) {
          const cats = data.categories || [];
          for (const cat of cats) {
            const tasks = (data.grid[cat] || {})[day.key] || [];
            if (tasks.some(t => t.text && t.text.trim())) return true;
          }
        }
      }
    } catch {
      continue;
    }
  }
  return false;
}

// ── 업무계획 지표 계산 ───────────────────────────────────
interface PlanMetrics {
  total: number; done: number; onTime: number; late: number;
  doing: number; overdue: number; starTotal: number; starDone: number;
}

function getMemberPlanMetrics(memberName: string, mkey: string): PlanMetrics {
  const empty = { total: 0, done: 0, onTime: 0, late: 0, doing: 0, overdue: 0, starTotal: 0, starDone: 0 };
  const raw = lsGet(`mplan_${memberName}_${mkey}`);
  if (!raw) return empty;
  try {
    const data: MonthPlanData = JSON.parse(raw);
    const days = getMonthDays(mkey);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dayByKey: Record<string, Date> = {};
    days.forEach(d => { dayByKey[d.key] = d.date; });

    let total = 0, done = 0, onTime = 0, late = 0, doing = 0, overdue = 0, starTotal = 0, starDone = 0;
    (data.categories || []).forEach(cat => {
      const catGrid = (data.grid || {})[cat] || {};
      Object.entries(catGrid).forEach(([key, tasks]) => {
        const plannedDate = dayByKey[key] ?? null;
        const isPast = plannedDate && plannedDate < today;
        (tasks || []).forEach(t => {
          if (!t.text || !t.text.trim()) return;
          total++;
          const status = t.status || (t.done ? 'done' : 'todo');
          if (status === 'done') {
            done++;
            if (t.completedAt && plannedDate) {
              new Date(t.completedAt) <= plannedDate ? onTime++ : late++;
            } else { onTime++; }
          } else if (status === 'doing') {
            doing++;
            if (isPast) overdue++;
          } else if (isPast) { overdue++; }
          if (t.starred) { starTotal++; if (status === 'done') starDone++; }
        });
      });
    });
    return { total, done, onTime, late, doing, overdue, starTotal, starDone };
  } catch { return empty; }
}

// ── 업무지표 모달 ────────────────────────────────────────
function MetricsModal({ name, dept, onClose }: { name: string; dept: string; onClose: () => void }) {
  const today = new Date();
  const months: string[] = [];
  let mx: PlanMetrics = { total: 0, done: 0, onTime: 0, late: 0, doing: 0, overdue: 0, starTotal: 0, starDone: 0 };
  for (let mo = 0; mo < 2; mo++) {
    const d = new Date(today.getFullYear(), today.getMonth() - mo, 1);
    const mkey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(`${d.getFullYear()}년 ${d.getMonth() + 1}월`);
    const m = getMemberPlanMetrics(name, mkey);
    (Object.keys(mx) as (keyof PlanMetrics)[]).forEach(k => { mx[k] += m[k]; });
  }
  const periodLabel = `${months[1]} ~ ${months[0]} 업무계획 기준`;
  const barCls = (pct: number) => pct >= 80 ? '' : pct >= 50 ? 'mid' : 'low';
  const doneRate   = mx.total     > 0 ? Math.round(mx.done    / mx.total     * 100) : null;
  const onTimeRate = mx.done      > 0 ? Math.round(mx.onTime  / mx.done      * 100) : null;
  const starRate   = mx.starTotal > 0 ? Math.round(mx.starDone / mx.starTotal * 100) : null;

  return (
    <div className="tomorrow-check-modal open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tcm-box" style={{ maxWidth: 380 }}>
        <div className="wdb-header">
          <div className="wdb-title">{name} · 업무 지표</div>
          <button className="wdb-close" onClick={onClose}>✕</button>
        </div>
        <div id="metrics-modal-body">
          {mx.total === 0 ? (
            <div style={{ color: '#bbb', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>업무계획 데이터가 없습니다</div>
          ) : (
            <>
              <div style={{ fontSize: '0.72rem', color: '#aaa', marginBottom: 18 }}>{periodLabel}</div>
              <div className="metric-row">
                <div className="metric-label-row">
                  <span className="metric-label">📋 완료율</span>
                  <span className="metric-pct" style={{ color: '#6366f1' }}>{doneRate}%</span>
                </div>
                <div className="metric-bar-bg">
                  <div className={`metric-bar-fill progress-bar ${doneRate !== null ? barCls(doneRate) : ''}`} style={{ width: `${doneRate ?? 0}%` }} />
                </div>
                <div className="metric-sub">전체 {mx.total}건 중 {mx.done}건 완료</div>
              </div>
              <div className="metric-row" style={{ marginTop: 14 }}>
                <div className="metric-label-row">
                  <span className="metric-label">⏱ 기한내 완료율</span>
                  <span className="metric-pct" style={{ color: '#10b981' }}>{onTimeRate !== null ? `${onTimeRate}%` : '-'}</span>
                </div>
                <div className="metric-bar-bg">
                  <div className={`metric-bar-fill deadline-bar ${onTimeRate !== null ? barCls(onTimeRate) : ''}`} style={{ width: `${onTimeRate ?? 0}%` }} />
                </div>
                <div className="metric-sub">기한내 {mx.onTime}건 · 지연완료 {mx.late}건</div>
              </div>
              {starRate !== null && (
                <div className="metric-row" style={{ marginTop: 14 }}>
                  <div className="metric-label-row">
                    <span className="metric-label">★ 중요업무</span>
                    <span className="metric-pct" style={{ color: '#f59e0b' }}>{starRate}%</span>
                  </div>
                  <div className="metric-bar-bg">
                    <div className="metric-bar-fill" style={{ width: `${starRate}%`, height: '100%', borderRadius: 99, background: '#f59e0b', transition: 'width 0.6s ease' }} />
                  </div>
                  <div className="metric-sub">{mx.starTotal}건 중 {mx.starDone}건 완료</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                <div style={{ flex: 1, minWidth: 80, background: '#eef2ff', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: 4 }}>진행중</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4f46e5' }}>{mx.doing}</div>
                </div>
                <div style={{ flex: 1, minWidth: 80, background: mx.overdue > 0 ? '#fee2e2' : '#f0fdf4', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.68rem', color: '#888', marginBottom: 4 }}>미완료 기한초과</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: mx.overdue > 0 ? '#dc2626' : '#16a34a' }}>{mx.overdue}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 대시보드 결과 표시 ───────────────────────────────────
interface DashResult {
  dateLabel: string;
  submittedNames: string[];
  dayIssues: { name: string; dept: string; items: string[] }[];
}

function DashboardResult({ result }: { result: DashResult | null }) {
  const [metricsTarget, setMetricsTarget] = useState<{ name: string; dept: string } | null>(null);

  if (!result) return <div className="empty-state">날짜를 선택하고 조회하세요</div>;

  const submitted = MEMBERS.filter(m => result.submittedNames.some(n => n.startsWith(m.name)));
  const missing   = MEMBERS.filter(m => !result.submittedNames.some(n => n.startsWith(m.name)));
  const mkey = result.dateLabel ? (() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  })() : '';

  return (
    <>
      {metricsTarget && (
        <MetricsModal name={metricsTarget.name} dept={metricsTarget.dept} onClose={() => setMetricsTarget(null)} />
      )}
      <div className="dash-section-title" style={{ marginBottom: 8 }}>
        📋 데일리보고 작성 현황 ({result.dateLabel})
      </div>
      <div className="dashboard-grid">
        <div className="dash-card"><div className="label">전체 팀원</div><div className="value purple">{MEMBERS.length}명</div></div>
        <div className="dash-card"><div className="label">보고 완료</div><div className="value green">{submitted.length}명</div></div>
        <div className="dash-card"><div className="label">미제출</div><div className="value red">{missing.length}명</div></div>
      </div>
      <div className="submit-status-grid">
        {MEMBERS.map(m => {
          const done = result.submittedNames.some(n => n.startsWith(m.name));
          const mx = getMemberPlanMetrics(m.name, mkey);
          const pct = mx.total > 0 ? Math.round(mx.done / mx.total * 100) : null;
          const barCls = pct === null ? '' : pct >= 80 ? '' : pct >= 50 ? 'mid' : 'low';
          const starPct = mx.starTotal > 0 ? Math.round(mx.starDone / mx.starTotal * 100) : null;
          return (
            <div key={m.name} className={`member-status-card ${done ? 'submitted' : 'missing'}`}
              style={{ cursor: 'pointer' }} onClick={() => setMetricsTarget({ name: m.name, dept: m.dept })}>
              <div className="member-status-top">
                <div className={`status-dot ${done ? 'submitted' : 'missing'}`} />
                <div className="member-status-info">
                  <div className="member-status-name">{m.name}</div>
                  <div className="member-status-dept">{m.dept}</div>
                </div>
                <div className={`status-badge ${done ? 'submitted' : 'missing'}`}>{done ? '제출' : '미제출'}</div>
              </div>
              {mx.total > 0 && (
                <div className="plan-metrics">
                  <div className="plan-metric-row">
                    <span className="plan-metric-label">완료율</span>
                    <div className="plan-metric-bar-bg">
                      <div className={`plan-metric-bar-fill ${barCls}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="plan-metric-pct">{pct}%</span>
                  </div>
                  {starPct !== null && (
                    <div className="plan-metric-row">
                      <span className="plan-metric-label">★완료율</span>
                      <div className="plan-metric-bar-bg">
                        <div className={`plan-metric-bar-fill ${starPct >= 80 ? '' : starPct >= 50 ? 'mid' : 'low'}`} style={{ width: `${starPct}%` }} />
                      </div>
                      <span className="plan-metric-pct">{starPct}%</span>
                    </div>
                  )}
                  <div className="plan-metric-chips">
                    {mx.onTime  > 0 && <span className="plan-chip ontime">기한내 {mx.onTime}</span>}
                    {mx.late    > 0 && <span className="plan-chip late">지연완료 {mx.late}</span>}
                    {mx.doing   > 0 && <span className="plan-chip doing">진행중 {mx.doing}</span>}
                    {mx.overdue > 0 && <span className="plan-chip overdue">미완료초과 {mx.overdue}</span>}
                    <span style={{ fontSize: '0.62rem', color: '#aaa' }}>전체 {mx.total}건</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {result.dayIssues.length > 0 && (
        <>
          <div className="dash-section-title">오늘의 이슈 및 리스크</div>
          {result.dayIssues.map((r, i) => (
            <div key={i} className="issue-card">
              <div className="issue-card-header">
                <div className="issue-card-meta">{r.name} · {r.dept}</div>
              </div>
              <ul className="issue-items">
                {r.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            </div>
          ))}
        </>
      )}
      <NextWeekPlanStatus />
    </>
  );
}

// 차주 계획에는 김청진(이사) 포함
const PLAN_MEMBERS = [{ name: '김청진', dept: '이사' }, ...MEMBERS];

// ── 차주 업무계획 현황 ────────────────────────────────────
function NextWeekPlanStatus() {
  const planDone    = PLAN_MEMBERS.filter(m => hasNextWeekPlan(m.name));
  const planMissing = PLAN_MEMBERS.filter(m => !hasNextWeekPlan(m.name));
  const pct     = Math.round(planDone.length / PLAN_MEMBERS.length * 100);
  const barCls  = pct >= 80 ? '' : pct >= 50 ? 'mid' : 'low';

  return (
    <div style={{ background: '#fff', border: '1px solid #f1f5f9', boxShadow: '0 1px 3px rgba(15,23,42,0.05)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span className="dash-section-title" style={{ marginBottom: 0, paddingLeft: 0, border: 'none' }}>차주 업무계획 현황</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4f46e5' }}>{planDone.length} / {PLAN_MEMBERS.length}명 작성</span>
      </div>
      <div className="metric-bar-bg" style={{ marginBottom: 12 }}>
        <div className={`metric-bar-fill progress-bar ${barCls}`} style={{ width: `${pct}%` }} />
      </div>
      {planMissing.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', color: '#aaa', flexShrink: 0 }}>미작성</span>
          {planMissing.map(m => (
            <span key={m.name} style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ef4444', background: '#fee2e2', padding: '2px 9px', borderRadius: 20 }}>{m.name}</span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>✅ 전원 작성 완료</div>
      )}
      {planDone.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <span style={{ fontSize: '0.75rem', color: '#aaa', flexShrink: 0 }}>완료</span>
          {planDone.map(m => (
            <span key={m.name} style={{ fontSize: '0.78rem', fontWeight: 600, color: '#16a34a', background: '#dcfce7', padding: '2px 9px', borderRadius: 20 }}>{m.name}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 이모지 목록 ──────────────────────────────────────────
const NOTICE_EMOJIS = [
  '😊','😂','🎉','👍','🙏','💪','🔥','✅','❌','⚠️',
  '📌','📢','📊','💡','🎯','🚀','💬','❤️','👀','🤔',
  '😅','😍','🥳','👏','✨','🎈','📝','🔔','💯','🙌',
];

// ── 공지 게시판 ──────────────────────────────────────────
function NoticeBoard() {
  const [notices, setNotices]     = useState<Notice[]>([]);
  const [author, setAuthor]       = useState('');
  const [title, setTitle]         = useState('');
  const [pinned, setPinned]       = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<number, { author: string; text: string }>>({});
  const bodyRef = useRef<HTMLDivElement>(null);

  const myName = lsGet('my_name') || '';

  const reload = useCallback(() => {
    const list = getNotices();
    const sorted = [...list.filter(n => n.pinned), ...list.filter(n => !n.pinned)];
    setNotices(sorted);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function noticeFormat(cmd: string) {
    document.execCommand(cmd, false);
    bodyRef.current?.focus();
  }

  function insertEmoji(emoji: string) {
    bodyRef.current?.focus();
    document.execCommand('insertText', false, emoji);
    setShowEmoji(false);
  }

  function submit() {
    const a = myName || author;
    const bodyContent = bodyRef.current?.innerHTML?.trim() || '';
    if (!a)          { alert('작성자를 선택해주세요'); return; }
    if (!title)      { alert('제목을 입력해주세요'); return; }
    if (!bodyContent || bodyContent === '<br>') { alert('내용을 입력해주세요'); return; }
    const now  = new Date();
    const time = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const list = getNotices();
    list.unshift({ author: a, title, body: bodyContent, pinned, time, id: Date.now() });
    saveNotices(list);
    setTitle('');
    if (bodyRef.current) bodyRef.current.innerHTML = '';
    setPinned(false);
    reload();
  }

  function del(id: number) {
    saveNotices(getNotices().filter(n => n.id !== id));
    reload();
  }

  function togglePin(id: number) {
    saveNotices(getNotices().map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
    reload();
  }

  function toggleComments(id: number) {
    setOpenComments(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function submitComment(id: number) {
    const ci = commentInputs[id] || { author: myName, text: '' };
    if (!ci.author) { alert('내 이름을 먼저 설정해주세요'); return; }
    if (!ci.text)   { alert('댓글을 입력해주세요'); return; }
    const now  = new Date();
    const time = `${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const list = getNoticeComments(id);
    list.push({ author: ci.author, text: ci.text, time });
    saveNoticeComments(id, list);
    setCommentInputs(prev => ({ ...prev, [id]: { author: ci.author, text: '' } }));
    reload();
    setOpenComments(prev => new Set([...prev, id]));
  }

  function delComment(nId: number, idx: number) {
    const list = getNoticeComments(nId);
    list.splice(idx, 1);
    saveNoticeComments(nId, list);
    reload();
  }

  return (
    <>
      <div className="dash-section-title" style={{ marginTop: 36 }}>📢 본부 게시판</div>
      <div className="notice-compose">
        <div className="notice-compose-row">
          {myName ? (
            <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: 8, fontSize: '0.85rem', color: '#4f46e5', fontWeight: 600 }}>{myName}</div>
          ) : (
            <select value={author} onChange={e => setAuthor(e.target.value)}>
              <option value="">작성자 선택</option>
              <optgroup label="임원">
                {['이지선','조맹섭','김청진'].map(n => <option key={n}>{n}</option>)}
              </optgroup>
              <optgroup label="경영지원본부">
                {MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}
              </optgroup>
            </select>
          )}
          <input type="text" placeholder="제목을 입력하세요" value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div className="notice-editor-toolbar">
          <button type="button" className="toolbar-btn" onMouseDown={e => { e.preventDefault(); noticeFormat('bold'); }} title="굵게"><b>B</b></button>
          <button type="button" className="toolbar-btn" onMouseDown={e => { e.preventDefault(); noticeFormat('underline'); }} title="밑줄"><u>U</u></button>
          <button type="button" className="toolbar-btn" onMouseDown={e => { e.preventDefault(); noticeFormat('strikeThrough'); }} title="취소선"><s>S</s></button>
          <div className="toolbar-divider" />
          <div className="emoji-wrap" style={{ position: 'relative' }}>
            <button type="button" className="toolbar-btn" onClick={() => setShowEmoji(v => !v)} title="이모지">😊</button>
            {showEmoji && (
              <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 200, background: '#fff', border: '1px solid #e8eaf0', borderRadius: 8, padding: 8, display: 'flex', flexWrap: 'wrap', gap: 2, width: 220, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                {NOTICE_EMOJIS.map(e => (
                  <button key={e} type="button" onMouseDown={ev => { ev.preventDefault(); insertEmoji(e); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', padding: '2px 4px', borderRadius: 4 }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = '#f1f5f9')}
                    onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}
                  >{e}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          ref={bodyRef}
          className="notice-editor"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="내용을 입력하세요"
        />

        <div className="notice-compose-footer">
          <label className="notice-pin-label">
            <input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> 상단 고정
          </label>
          <button className="btn-notice-submit" onClick={submit}>공지 등록</button>
        </div>
      </div>

      <div id="notice-list">
        {notices.length === 0
          ? <div className="empty-state">등록된 공지가 없습니다</div>
          : notices.map(n => {
            const comments = getNoticeComments(n.id);
            const ci = commentInputs[n.id] || { author: myName, text: '' };
            const isOpen = openComments.has(n.id);
            return (
              <div key={n.id} className={`notice-card${n.pinned ? ' pinned' : ''}`}>
                <div className="notice-card-header">
                  {n.pinned && <span className="notice-pin-badge">📌 고정</span>}
                  <div className="notice-title">{n.title}</div>
                  <div className="notice-meta">{n.author} · {n.time}</div>
                  <div className="notice-actions">
                    <button className={`notice-pin-btn${n.pinned ? ' active' : ''}`} onClick={() => togglePin(n.id)} title={n.pinned ? '고정 해제' : '상단 고정'}>📌</button>
                    <button className="notice-delete" onClick={() => del(n.id)} title="삭제">✕</button>
                  </div>
                </div>
                <div className="notice-body" dangerouslySetInnerHTML={{ __html: n.body }} />
                <button className="notice-comment-toggle" onClick={() => toggleComments(n.id)}>
                  💬 댓글 {comments.length > 0 ? `${comments.length}개` : ''}
                </button>
                {isOpen && (
                  <div className="notice-comment-section open">
                    <div className="notice-comment-list">
                      {comments.map((c, i) => (
                        <div key={i} className="notice-comment-item">
                          <div className="notice-comment-content">
                            <div className="notice-comment-author">{c.author}</div>
                            <div className="notice-comment-text">{c.text}</div>
                            <div className="notice-comment-time">{c.time}</div>
                          </div>
                          <button className="notice-comment-del" onClick={() => delComment(n.id, i)}>✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="notice-comment-form">
                      {!myName && (
                        <select
                          value={ci.author}
                          onChange={e => setCommentInputs(prev => ({ ...prev, [n.id]: { ...ci, author: e.target.value } }))}
                        >
                          <option value="">작성자</option>
                          <optgroup label="임원">{['이지선','조맹섭','김청진'].map(nm => <option key={nm}>{nm}</option>)}</optgroup>
                          <optgroup label="경영지원본부">{ALL_MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}</optgroup>
                        </select>
                      )}
                      <input
                        className="notice-comment-input"
                        placeholder="댓글을 입력하세요"
                        value={ci.text}
                        onChange={e => setCommentInputs(prev => ({ ...prev, [n.id]: { ...ci, text: e.target.value } }))}
                        onKeyDown={e => { if (e.key === 'Enter') submitComment(n.id); }}
                      />
                      <button className="notice-comment-submit" onClick={() => submitComment(n.id)}>등록</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        }
      </div>
    </>
  );
}

// ── 메인 Dashboard 컴포넌트 ──────────────────────────────
export function Dashboard() {
  const [date, setDate]     = useState(todayString());
  const [result, setResult] = useState<DashResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadDashboard() {
    if (!date) { alert('날짜를 선택해주세요'); return; }
    setLoading(true);
    try {
      const rows     = await fetchReports();
      const dayRows  = rows.filter(r => r['날짜'] === date);
      const submittedNames = dayRows.map(r => r['이름']);
      const [, mo, d] = date.split('-');
      const dayIssues = dayRows
        .filter(r => r['이슈리스크'])
        .map(r => ({ name: r['이름'], dept: r['부서'], items: parseItems(r['이슈리스크']) }));
      setResult({ dateLabel: `${parseInt(mo)}월 ${parseInt(d)}일`, submittedNames, dayIssues });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []); // load today on mount

  return (
    <>
      <div className="view-controls">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button className="btn-load" onClick={loadDashboard} disabled={loading}>
          {loading ? '조회 중...' : '조회'}
        </button>
      </div>
      <div id="dash-result">
        <DashboardResult result={result} />
      </div>
      <NoticeBoard />
    </>
  );
}
