'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { MEMBERS, ALL_MEMBERS, lsGet, lsSet, parseItems, todayString } from '@/lib/constants';
import { fetchReports, ReportRow } from '@/hooks/useReports';
import { useSectionContext } from '@/hooks/useSection';

// ── 아이템 리스트 (write form용) ─────────────────────────
interface Item { text: string; id: number; }

function ItemList({ label, dot, items, onAdd, onChange, onRemove }: {
  label: string; dot?: string;
  items: Item[];
  onAdd: () => void;
  onChange: (id: number, val: string) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="section-group">
      <div className="section-label"><div className="dot"></div>{label}</div>
      <div className="section-items">
        {items.map(it => (
          <div key={it.id} className="item-row">
            <input
              type="text"
              className="item-input"
              value={it.text}
              onChange={e => onChange(it.id, e.target.value)}
              placeholder="내용을 입력하세요"
            />
            <button className="item-del" onClick={() => onRemove(it.id)}>✕</button>
          </div>
        ))}
      </div>
      <button className="btn-add-item" onClick={onAdd}>+ 항목 추가</button>
    </div>
  );
}

let nextId = 1;
function newItem(text = ''): Item { return { text, id: nextId++ }; }

// ── 작성 탭 ─────────────────────────────────────────────
function WriteTab() {
  const [name, setName]       = useState('');
  const [date, setDate]       = useState(todayString());
  const [done, setDone]       = useState<Item[]>([]);
  const [meeting, setMeeting] = useState<Item[]>([]);
  const [progress, setProgress] = useState<Item[]>([]);
  const [issue, setIssue]     = useState<Item[]>([]);
  const [tomorrow, setTomorrow] = useState<Item[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]         = useState('');

  const add    = (set: React.Dispatch<React.SetStateAction<Item[]>>) => () => set(p => [...p, newItem()]);
  const change = (set: React.Dispatch<React.SetStateAction<Item[]>>) => (id: number, val: string) =>
    set(p => p.map(x => x.id === id ? { ...x, text: val } : x));
  const remove = (set: React.Dispatch<React.SetStateAction<Item[]>>) => (id: number) =>
    set(p => p.filter(x => x.id !== id));

  const texts = (items: Item[]) => items.map(x => x.text.trim()).filter(Boolean);

  async function submit() {
    if (!name) { setMsg('이름을 선택해주세요'); return; }
    if (!date) { setMsg('날짜를 선택해주세요'); return; }
    const [n, dept] = name.split('|');
    const allItems = [...texts(done), ...texts(meeting), ...texts(progress), ...texts(issue), ...texts(tomorrow)];
    if (!allItems.length) { setMsg('내용을 하나 이상 입력해주세요'); return; }
    setSubmitting(true); setMsg('');
    try {
      const { error } = await supabase.from('daily_reports').insert({
        date, name: n, dept,
        done:     texts(done).join('\n'),
        meeting:  texts(meeting).join('\n'),
        progress: texts(progress).join('\n'),
        issue:    texts(issue).join('\n'),
        tomorrow: texts(tomorrow).join('\n'),
      });
      if (error) throw error;
      setMsg('✅ 업무보고가 제출되었습니다');
      setDone([]); setMeeting([]); setProgress([]); setIssue([]); setTomorrow([]);
    } catch (e: unknown) {
      setMsg('❌ 제출 실패: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="form-card">
      <div className="form-title">일일 업무보고 작성</div>
      <div className="form-row">
        <div className="form-group">
          <label>이름</label>
          <select value={name} onChange={e => setName(e.target.value)}>
            <option value="">이름을 선택하세요</option>
            {MEMBERS.map(m => <option key={m.name} value={`${m.name}|${m.dept}`}>{m.name} ({m.dept})</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>보고 날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>
      <hr className="divider" />
      <ItemList label="주요 완료"           items={done}     onAdd={add(setDone)}     onChange={change(setDone)}     onRemove={remove(setDone)} />
      <ItemList label="주요 회의 및 의사결정" items={meeting}  onAdd={add(setMeeting)}  onChange={change(setMeeting)}  onRemove={remove(setMeeting)} />
      <ItemList label="진행사항"            items={progress} onAdd={add(setProgress)} onChange={change(setProgress)} onRemove={remove(setProgress)} />
      <ItemList label="이슈 및 리스크"       items={issue}    onAdd={add(setIssue)}    onChange={change(setIssue)}    onRemove={remove(setIssue)} />
      <ItemList label="익일 계획"           items={tomorrow} onAdd={add(setTomorrow)} onChange={change(setTomorrow)} onRemove={remove(setTomorrow)} />
      <hr className="divider" />
      {msg && <div style={{ color: msg.startsWith('✅') ? '#16a34a' : '#ef4444', fontSize: '0.85rem', marginBottom: 10 }}>{msg}</div>}
      <div className="form-actions">
        <button className="btn-reset" onClick={() => { setDone([]); setMeeting([]); setProgress([]); setIssue([]); setTomorrow([]); setMsg(''); }}>초기화</button>
        <button className="btn-submit" onClick={submit} disabled={submitting}>{submitting ? '제출 중...' : '보고 제출'}</button>
      </div>
    </div>
  );
}

// ── 보고카드 렌더 헬퍼 ───────────────────────────────────
function renderReportHtml(r: ReportRow, comments: {author: string; text: string; time: string}[]): string {
  const sections = [
    { label: '주요 완료',           key: '주요완료'   as keyof ReportRow },
    { label: '주요 회의 및 의사결정', key: '주요회의'  as keyof ReportRow },
    { label: '진행사항',            key: '진행사항'  as keyof ReportRow },
    { label: '이슈 및 리스크',       key: '이슈리스크' as keyof ReportRow },
    { label: '익일 계획',           key: '익일계획'  as keyof ReportRow },
  ];
  const sectionsHtml = sections.map(s => {
    const items = parseItems(r[s.key] as string || '');
    if (!items.length) return '';
    return `<div><div class="report-section-title">${s.label}</div><ul class="report-items">${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
  }).join('');

  const ckey = `${r['날짜']}_${r['이름']}`;
  const commentsHtml = comments.map((c, i) => `
    <div class="comment-card">
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-author">${c.author}</span>
          <span class="comment-time">${c.time}</span>
        </div>
        <div class="comment-text">${c.text.replace(/</g,'&lt;')}</div>
      </div>
    </div>`).join('');

  return `
    <div class="report-card">
      <div class="report-card-header">
        <div>
          <div class="report-name">${r['이름']}</div>
          <div class="report-dept">${r['부서']}</div>
        </div>
        <div class="report-date-badge">${r['날짜']}</div>
      </div>
      <div class="report-sections">${sectionsHtml}</div>
      <div class="report-comments">
        <div class="comment-list">${commentsHtml || '<div class="comment-empty">아직 코멘트가 없습니다</div>'}</div>
        <div class="comment-form-inline">
          <select id="cauthor-${ckey}"><option value="">작성자</option>${ALL_MEMBERS.map(m => `<option>${m.name}</option>`).join('')}</select>
          <input type="text" id="ctext-${ckey}" placeholder="코멘트를 입력하세요" onkeydown="if(event.key==='Enter')window.__submitComment('${ckey}')">
          <button onclick="window.__submitComment('${ckey}')">등록</button>
        </div>
      </div>
    </div>`;
}

function getComments(ckey: string) {
  try { return JSON.parse(lsGet('comments_' + ckey) || '[]'); } catch { return []; }
}
function saveComments(ckey: string, list: unknown[]) { lsSet('comments_' + ckey, JSON.stringify(list)); }

// ── 날짜별 탭 ────────────────────────────────────────────
function ByDateTab() {
  const [calYear, setCalYear]   = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const [allDates, setAllDates] = useState<Set<string>>(new Set());
  const [rangeFrom, setRangeFrom]     = useState('');
  const [rangeTo, setRangeTo]         = useState('');
  const [rangePerson, setRangePerson] = useState('');
  const [dateResult, setDateResult]   = useState('');
  const [rangeResult, setRangeResult] = useState('');
  const [loading, setLoading]         = useState(false);
  const dateResultRef = useRef<HTMLDivElement>(null);
  const rangeResultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReports().then(rows => {
      setAllDates(new Set(rows.map(r => r['날짜']).filter(Boolean)));
    });
  }, []);

  const today = todayString();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const lastDate = new Date(calYear, calMonth + 1, 0).getDate();
  const DOW = ['일','월','화','수','목','금','토'];

  function changeMonth(dir: number) {
    let m = calMonth + dir, y = calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalMonth(m); setCalYear(y);
  }

  async function selectDate(ds: string) {
    setSelected(ds);
    setRangeResult('');
    setLoading(true);
    const rows = await fetchReports();
    const filtered = rows.filter(r => r['날짜'] === ds);
    const [, m, d] = ds.split('-');
    if (!filtered.length) {
      setDateResult(`<div class="empty-state">${parseInt(m)}월 ${parseInt(d)}일 보고가 없습니다</div>`);
    } else {
      setDateResult(`<div class="date-report-grid">${filtered.map(r => renderReportHtml(r, getComments(`${r['날짜']}_${r['이름']}`))).join('')}</div>`);
    }
    setLoading(false);
  }

  async function searchRange() {
    if (!rangeFrom || !rangeTo) { alert('시작일과 종료일을 모두 선택해주세요'); return; }
    setSelected(null);
    setDateResult('');
    setLoading(true);
    const rows = await fetchReports();
    const filtered = rows.filter(r => r['날짜'] >= rangeFrom && r['날짜'] <= rangeTo && (!rangePerson || r['이름'] === rangePerson));
    if (!filtered.length) {
      setRangeResult(`<div class="empty-state">해당 기간 보고가 없습니다</div>`);
    } else {
      const grouped: Record<string, ReportRow[]> = {};
      filtered.forEach(r => { if (!grouped[r['날짜']]) grouped[r['날짜']] = []; grouped[r['날짜']].push(r); });
      let html = '';
      Object.keys(grouped).sort().forEach(ds => {
        const [, m, d] = ds.split('-');
        html += `<div class="range-date-group"><div class="range-date-label">${parseInt(m)}월 ${parseInt(d)}일</div><div class="date-report-grid">${grouped[ds].map(r => renderReportHtml(r, getComments(`${r['날짜']}_${r['이름']}`))).join('')}</div></div>`;
      });
      setRangeResult(html);
    }
    setLoading(false);
  }

  // expose comment submit to inline HTML
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__submitComment = (ckey: string) => {
      const sel = document.getElementById('cauthor-' + ckey) as HTMLSelectElement;
      const inp = document.getElementById('ctext-' + ckey) as HTMLInputElement;
      if (!sel || !inp) return;
      const author = sel.value; const text = inp.value.trim();
      if (!author || !text) return;
      const now = new Date();
      const time = `${now.getMonth()+1}/${now.getDate()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const list = getComments(ckey);
      list.push({ author, text, time });
      saveComments(ckey, list);
      inp.value = '';
      // re-render
      if (dateResultRef.current || rangeResultRef.current) {
        const el = dateResultRef.current?.querySelector('.date-report-grid') || rangeResultRef.current?.querySelector('.date-report-grid');
        if (el) { const card = el.closest('.report-card'); if (card) { /* refresh done via list */ } }
      }
    };
  });

  const monthNames = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

  return (
    <div className="bydate-layout">
      <div className="bydate-left">
        <div className="bydate-left-sticky">
          <div className="cal-wrap">
            <div className="cal-header">
              <button className="cal-nav" onClick={() => changeMonth(-1)}>‹</button>
              <div className="cal-month-label">{calYear}년 {monthNames[calMonth]}</div>
              <button className="cal-nav" onClick={() => changeMonth(1)}>›</button>
            </div>
            <div className="cal-grid">
              {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
              {Array.from({ length: firstDay }, (_, i) => <div key={'e' + i} className="cal-day empty" />)}
              {Array.from({ length: lastDate }, (_, i) => {
                const day = i + 1;
                const ds  = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const dow = (firstDay + i) % 7;
                const cls = [
                  'cal-day',
                  allDates.has(ds) ? 'has-report' : '',
                  ds === selected  ? 'selected' : '',
                  ds === today     ? 'today' : '',
                  dow === 0 ? 'sunday' : '',
                  dow === 6 ? 'saturday' : '',
                ].filter(Boolean).join(' ');
                return (
                  <div key={ds} className={cls} onClick={() => selectDate(ds)}>
                    <span className="cal-num">{day}</span>
                    <span className="cal-dot" />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="cal-hint">날짜를 클릭하면 보고를 확인할 수 있어요</div>
        </div>
      </div>

      <div className="bydate-right">
        <div className="range-search-wrap">
          <div className="range-search-title">📆 기간별 조회</div>
          <div className="range-search-row">
            <input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className="range-date-input" />
            <span style={{ color: '#aaa', fontSize: '0.85rem' }}>~</span>
            <input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} className="range-date-input" />
            <select value={rangePerson} onChange={e => setRangePerson(e.target.value)} className="range-person-select">
              <option value="">전체 인원</option>
              {MEMBERS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
            <button className="btn-load" onClick={searchRange} disabled={loading}>조회</button>
          </div>
        </div>
        <div ref={rangeResultRef} dangerouslySetInnerHTML={{ __html: rangeResult }} />
        <div ref={dateResultRef} dangerouslySetInnerHTML={{ __html: loading ? '<div class="empty-state"><div class="loading-spinner"></div>불러오는 중...</div>' : dateResult }} />
      </div>
    </div>
  );
}

// ── 인물별 탭 ────────────────────────────────────────────
function ByPersonTab() {
  const [person, setPerson]       = useState('');
  const [month, setMonth]         = useState('');
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [result, setResult]       = useState('');
  const [loading, setLoading]     = useState(false);

  async function updateMonthOptions(p: string) {
    if (!p) { setMonthOptions([]); setMonth(''); return; }
    const rows = await fetchReports();
    const months = [...new Set(
      rows.filter(r => r['이름'] === p).map(r => r['날짜'].slice(0, 7))
    )].sort((a, b) => b.localeCompare(a));
    setMonthOptions(months);
    setMonth('');
  }

  async function load() {
    if (!person) { alert('이름을 선택해주세요'); return; }
    setLoading(true);
    const rows = await fetchReports();
    const filtered = rows
      .filter(r => r['이름'] === person)
      .filter(r => !month || r['날짜'].startsWith(month))
      .sort((a, b) => b['날짜'].localeCompare(a['날짜']));
    if (!filtered.length) {
      setResult(`<div class="empty-state">${person}${month ? ' · ' + month : ''}의 보고가 없습니다</div>`);
    } else {
      const byMonth: Record<string, typeof filtered> = {};
      filtered.forEach(r => {
        const key = r['날짜'].slice(0, 7);
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(r);
      });
      let html = '';
      Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).forEach(mk => {
        const [y, m] = mk.split('-');
        const label = `${y}년 ${parseInt(m)}월`;
        html += `<div class="range-date-group"><div class="range-date-label">${label}</div><div class="date-report-grid">${byMonth[mk].map(r => renderReportHtml(r, getComments(`${r['날짜']}_${r['이름']}`))).join('')}</div></div>`;
      });
      setResult(html);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="view-controls">
        <select value={person} onChange={e => { setPerson(e.target.value); updateMonthOptions(e.target.value); }}>
          <option value="">이름을 선택하세요</option>
          {MEMBERS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(e.target.value)}>
          <option value="">전체 월</option>
          {monthOptions.map(mk => {
            const [y, m] = mk.split('-');
            return <option key={mk} value={mk}>{y}년 {parseInt(m)}월</option>;
          })}
        </select>
        <button className="btn-load" onClick={load} disabled={loading}>조회</button>
      </div>
      <div dangerouslySetInnerHTML={{ __html: loading ? '<div class="empty-state"><div class="loading-spinner"></div>불러오는 중...</div>' : result || '<div class="empty-state">이름을 선택하고 조회하세요</div>' }} />
    </>
  );
}

// ── 내 업무 요약 탭 ──────────────────────────────────────
function MySummaryTab() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState('');
  useEffect(() => { setMyName(lsGet('my_name') || ''); }, []);

  useEffect(() => {
    if (!myName) {
      setResult('<div class="empty-state">내 이름을 먼저 설정해주세요</div>');
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const rows = await fetchReports();
      const mine = rows.filter(r => r['이름'] === myName);
      if (!mine.length) {
        setResult(`<div class="empty-state">${myName}의 보고가 없습니다</div>`);
      } else {
        const sorted = [...mine].sort((a, b) => b['날짜'].localeCompare(a['날짜']));
        // aggregate stats
        let totalDone = 0, totalMeet = 0, totalIssue = 0;
        sorted.forEach(r => {
          totalDone  += parseItems(r['주요완료'] || '').length;
          totalMeet  += parseItems(r['주요회의'] || '').length;
          totalIssue += parseItems(r['이슈리스크'] || '').length;
        });
        const statsHtml = `
          <div class="dashboard-grid" style="margin-bottom:20px;grid-template-columns:repeat(4,1fr)">
            <div class="dash-card"><div class="label">제출 일수</div><div class="value purple">${sorted.length}일</div></div>
            <div class="dash-card"><div class="label">완료 업무</div><div class="value green">${totalDone}건</div></div>
            <div class="dash-card"><div class="label">회의 참석</div><div class="value">${totalMeet}건</div></div>
            <div class="dash-card"><div class="label">이슈 발굴</div><div class="value red">${totalIssue}건</div></div>
          </div>`;
        setResult(statsHtml + `<div class="date-report-grid">${sorted.map(r => renderReportHtml(r, getComments(`${r['날짜']}_${r['이름']}`))).join('')}</div>`);
      }
      setLoading(false);
    })();
  }, [myName]);

  return (
    <div dangerouslySetInnerHTML={{ __html: loading ? '<div class="empty-state"><div class="loading-spinner"></div>불러오는 중...</div>' : result }} />
  );
}

// ── 이슈 모아보기 탭 ─────────────────────────────────────
function IssuesTab() {
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!from || !to) { setResult('<div class="empty-state">기간을 선택하고 조회하세요</div>'); return; }
    setLoading(true);
    const rows = await fetchReports();
    const filtered = rows.filter(r => r['날짜'] >= from && r['날짜'] <= to && r['이슈리스크']);
    if (!filtered.length) {
      setResult('<div class="empty-state">해당 기간 이슈가 없습니다</div>');
    } else {
      let html = '';
      filtered.forEach(r => {
        const items = parseItems(r['이슈리스크'] || '');
        if (!items.length) return;
        html += `<div class="issue-card"><div class="issue-card-header"><div class="issue-card-meta">${r['이름']} · ${r['부서']} · ${r['날짜']}</div></div><ul class="issue-items">${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
      });
      setResult(html);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="view-controls">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} placeholder="시작일" />
        <span style={{ color: '#aaa', fontSize: '0.85rem' }}>~</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} placeholder="종료일" />
        <button className="btn-load" onClick={load} disabled={loading}>조회</button>
      </div>
      <div dangerouslySetInnerHTML={{ __html: loading ? '<div class="empty-state"><div class="loading-spinner"></div>불러오는 중...</div>' : result || '<div class="empty-state">기간을 선택하고 조회하세요</div>' }} />
    </>
  );
}

// ── 이슈 트래킹 탭 ──────────────────────────────────────
interface IssueTrack { id: number; title: string; person: string; date: string; status: 'open' | 'progress' | 'resolved'; note: string; }

function IssueTrackTab() {
  const [issues, setIssues] = useState<IssueTrack[]>([]);
  const [filter, setFilter] = useState('all');
  const [personFilter, setPersonFilter] = useState('');
  const [form, setForm] = useState({ title: '', person: '', date: todayString(), note: '' });
  const [editing, setEditing] = useState<number | null>(null);

  const loadIssues = useCallback(() => {
    try { setIssues(JSON.parse(lsGet('issue_track') || '[]')); } catch { setIssues([]); }
  }, []);

  useEffect(() => { loadIssues(); }, [loadIssues]);

  function save(list: IssueTrack[]) { lsSet('issue_track', JSON.stringify(list)); setIssues(list); }

  function addIssue() {
    if (!form.title) { alert('이슈 제목을 입력해주세요'); return; }
    const list = [...issues, { ...form, id: Date.now(), status: 'open' as const }];
    save(list); setForm({ title: '', person: '', date: todayString(), note: '' });
  }

  function updateStatus(id: number, status: IssueTrack['status']) {
    save(issues.map(x => x.id === id ? { ...x, status } : x));
  }

  function del(id: number) { save(issues.filter(x => x.id !== id)); }

  const filtered = issues
    .filter(x => filter === 'all' || x.status === filter)
    .filter(x => !personFilter || x.person === personFilter);

  const counts = { open: 0, progress: 0, resolved: 0 };
  issues.forEach(x => { counts[x.status]++; });

  const STATUS_LABEL: Record<string, string> = { open: '🔴 미해결', progress: '🟡 해결 중', resolved: '🟢 완료' };

  return (
    <>
      <div className="itrack-summary">
        <div className="itrack-sum-card"><div className="itrack-sum-num" style={{ color: '#ef4444' }}>{counts.open}</div><div className="itrack-sum-label">미해결</div></div>
        <div className="itrack-sum-card"><div className="itrack-sum-num" style={{ color: '#f59e0b' }}>{counts.progress}</div><div className="itrack-sum-label">해결 중</div></div>
        <div className="itrack-sum-card"><div className="itrack-sum-num" style={{ color: '#22c55e' }}>{counts.resolved}</div><div className="itrack-sum-label">완료</div></div>
        <div className="itrack-sum-card"><div className="itrack-sum-num" style={{ color: '#4f46e5' }}>{issues.length}</div><div className="itrack-sum-label">전체</div></div>
      </div>

      {/* 이슈 추가 폼 */}
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'flex-end' }}>
        <input type="text" placeholder="이슈 제목" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={{ flex: 2, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }} />
        <select value={form.person} onChange={e => setForm(p => ({ ...p, person: e.target.value }))} style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }}>
          <option value="">담당자</option>
          {MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}
        </select>
        <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }} />
        <button onClick={addIssue} style={{ padding: '7px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}>+ 추가</button>
      </div>

      <div className="itrack-controls">
        {(['all', 'open', 'progress', 'resolved'] as const).map(f => (
          <button key={f} className={`itrack-filter-btn${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? '전체' : STATUS_LABEL[f]}
          </button>
        ))}
        <select value={personFilter} onChange={e => setPersonFilter(e.target.value)} style={{ marginLeft: 'auto', border: '1px solid #e2e8f0', borderRadius: 20, padding: '5px 14px', fontSize: '0.8rem', color: '#666', background: '#fff', cursor: 'pointer', outline: 'none' }}>
          <option value="">전체 팀원</option>
          {MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}
        </select>
      </div>

      <div id="itrack-list">
        {filtered.length === 0
          ? <div className="empty-state">이슈가 없습니다</div>
          : filtered.map(x => (
            <div key={x.id} className="itrack-item" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1a1a2e', marginBottom: 3 }}>{x.title}</div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{x.person || '담당자 미지정'} · {x.date}</div>
                {x.note && <div style={{ fontSize: '0.78rem', color: '#666', marginTop: 4 }}>{x.note}</div>}
              </div>
              <select value={x.status} onChange={e => updateStatus(x.id, e.target.value as IssueTrack['status'])} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 8px', fontSize: '0.78rem', cursor: 'pointer' }}>
                <option value="open">🔴 미해결</option>
                <option value="progress">🟡 해결 중</option>
                <option value="resolved">🟢 완료</option>
              </select>
              <button onClick={() => del(x.id)} style={{ border: 'none', background: 'none', color: '#ccc', fontSize: '1rem', cursor: 'pointer', padding: '0 4px' }}>✕</button>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ── 키워드 검색 탭 ───────────────────────────────────────
function SearchTab() {
  const [keyword, setKeyword] = useState('');
  const [result, setResult]   = useState('');
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!keyword.trim()) { setResult('<div class="empty-state">검색어를 입력해주세요</div>'); return; }
    setLoading(true);
    const rows = await fetchReports();
    const kw   = keyword.trim().toLowerCase();
    const filtered = rows.filter(r =>
      Object.values(r).some(v => typeof v === 'string' && v.toLowerCase().includes(kw))
    );
    if (!filtered.length) {
      setResult(`<div class="empty-state">"${keyword}" 검색 결과가 없습니다</div>`);
    } else {
      setResult(`<div class="date-report-grid">${filtered.map(r => renderReportHtml(r, getComments(`${r['날짜']}_${r['이름']}`))).join('')}</div>`);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="search-bar">
        <input
          type="text"
          placeholder="검색어를 입력하세요 (예: 수분스틱, 채용, 이카운트)"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') search(); }}
        />
        <button className="btn-load" onClick={search} disabled={loading}>검색</button>
      </div>
      <div dangerouslySetInnerHTML={{ __html: loading ? '<div class="empty-state"><div class="loading-spinner"></div>검색 중...</div>' : result || '<div class="empty-state">검색어를 입력하고 검색하세요</div>' }} />
    </>
  );
}

// ── 주간 요약 탭 ─────────────────────────────────────────
function WeeklyTab() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekLabel, setWeekLabel]   = useState('—');
  const [result, setResult]         = useState('');
  const [loading, setLoading]       = useState(false);

  function getWeekDates(offset: number) {
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
    const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { monStr: fmt(mon), friStr: fmt(fri), mon };
  }

  const loadWeek = useCallback(async (offset: number) => {
    setLoading(true);
    const { monStr, friStr, mon } = getWeekDates(offset);
    const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
    const [m1, d1] = monStr.slice(5).split('-');
    const [m2, d2] = friStr.slice(5).split('-');
    setWeekLabel(`${parseInt(m1)}/${parseInt(d1)} (월) ~ ${parseInt(m2)}/${parseInt(d2)} (금)`);

    const days: string[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(mon); d.setDate(d.getDate() + i);
      days.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    }

    const rows  = await fetchReports();
    const today = todayString();
    const weekRows = rows.filter(r => r['날짜'] >= monStr && r['날짜'] <= friStr);
    const dayLabels = ['월','화','수','목','금'];

    let html = '<div class="weekly-grid">';
    html += '<div></div>';
    days.forEach((d, i) => {
      const isToday = d === today;
      const mm = parseInt(d.slice(5,7)), dd = parseInt(d.slice(8));
      html += `<div class="weekly-col-header${isToday ? ' today-col' : ''}"><div class="wch-day">${dayLabels[i]}</div><div class="wch-date">${mm}/${dd}</div></div>`;
    });

    MEMBERS.forEach(m => {
      html += `<div class="weekly-name-cell"><div class="wn-name">${m.name}</div><div class="wn-dept">${m.dept}</div></div>`;
      days.forEach(d => {
        const r = weekRows.find(row => row['날짜'] === d && row['이름'].startsWith(m.name));
        if (!r) { html += `<div class="weekly-day-cell no-data">미제출</div>`; return; }
        const done    = parseItems(r['주요완료']);
        const meeting = parseItems(r['주요회의']);
        const issue   = parseItems(r['이슈리스크']);
        const badges  = [
          done.length    ? `<span class="wdc-badge done">완료 ${done.length}</span>` : '',
          meeting.length ? `<span class="wdc-badge meeting">회의 ${meeting.length}</span>` : '',
          issue.length   ? `<span class="wdc-badge issue">이슈 ${issue.length}</span>` : '',
        ].join('');
        const preview = [
          ...done.slice(0,2).map(t => `<span class="wdc-item">${t}</span>`),
          ...meeting.slice(0,1).map(t => `<span class="wdc-item mtg">${t}</span>`),
          ...issue.slice(0,1).map(t => `<span class="wdc-item iss">⚠ ${t}</span>`),
        ].join('');
        html += `<div class="weekly-day-cell"><div class="wdc-badges">${badges}</div><div class="wdc-items">${preview}</div></div>`;
      });
    });
    html += '</div>';
    setResult(html);
    setLoading(false);
  }, []);

  useEffect(() => { loadWeek(weekOffset); }, [weekOffset, loadWeek]);

  return (
    <>
      <div className="week-nav">
        <button onClick={() => setWeekOffset(p => p - 1)}>← 이전 주</button>
        <div className="week-label">{weekLabel}</div>
        <button onClick={() => setWeekOffset(p => p + 1)}>다음 주 →</button>
      </div>
      <div dangerouslySetInnerHTML={{ __html: loading ? '<div class="empty-state"><div class="loading-spinner"></div>불러오는 중...</div>' : result }} />
    </>
  );
}

// ── 메인 Report 컴포넌트 ──────────────────────────────────
const TAB_LABELS: Record<string, string> = {
  'write': '✏️ 데일리보고 작성',
  'by-date': '📅 날짜별 보기',
  'by-person': '👤 인물별 보기',
  'my-summary': '📊 내 업무 요약',
  'issues': '⚠️ 이슈 모아보기',
  'issue-track': '🚨 이슈 트래킹',
  'search': '🔍 키워드 검색',
  'weekly': '📋 주간 요약',
};

export function Report() {
  const { tab, setTab } = useSectionContext();
  const activeTab = tab || 'write';

  return (
    <>
      <div className="tab-bar" style={{ display: 'flex' }}>
        {Object.entries(TAB_LABELS).map(([id, label]) => (
          <button
            key={id}
            className={`tab-btn${activeTab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {activeTab === 'write'       && <WriteTab />}
      {activeTab === 'by-date'     && <ByDateTab />}
      {activeTab === 'by-person'   && <ByPersonTab />}
      {activeTab === 'my-summary'  && <MySummaryTab />}
      {activeTab === 'issues'      && <IssuesTab />}
      {activeTab === 'issue-track' && <IssueTrackTab />}
      {activeTab === 'search'      && <SearchTab />}
      {activeTab === 'weekly'      && <WeeklyTab />}
    </>
  );
}
