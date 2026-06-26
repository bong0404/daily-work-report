'use client';

import { useState, useEffect, useCallback } from 'react';
import { MEMBERS, ALL_MEMBERS, lsGet, lsSet, parseItems, todayString } from '@/lib/constants';
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

// ── 대시보드 결과 표시 ───────────────────────────────────
interface DashResult {
  dateLabel: string;
  submittedNames: string[];
  dayIssues: { name: string; dept: string; items: string[] }[];
}

function DashboardResult({ result }: { result: DashResult | null }) {
  if (!result) return <div className="empty-state">날짜를 선택하고 조회하세요</div>;

  const submitted = MEMBERS.filter(m => result.submittedNames.some(n => n.startsWith(m.name)));
  const missing   = MEMBERS.filter(m => !result.submittedNames.some(n => n.startsWith(m.name)));

  return (
    <>
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
          return (
            <div key={m.name} className={`member-status-card ${done ? 'submitted' : 'missing'}`}>
              <div className="member-status-top">
                <div className={`status-dot ${done ? 'submitted' : 'missing'}`} />
                <div className="member-status-info">
                  <div className="member-status-name">{m.name}</div>
                  <div className="member-status-dept">{m.dept}</div>
                </div>
                <div className={`status-badge ${done ? 'submitted' : 'missing'}`}>{done ? '제출' : '미제출'}</div>
              </div>
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
    </>
  );
}

// ── 공지 게시판 ──────────────────────────────────────────
function NoticeBoard() {
  const [notices, setNotices]     = useState<Notice[]>([]);
  const [author, setAuthor]       = useState('');
  const [title, setTitle]         = useState('');
  const [body, setBody]           = useState('');
  const [pinned, setPinned]       = useState(false);
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<number, { author: string; text: string }>>({});

  const myName = lsGet('my_name') || '';

  const reload = useCallback(() => {
    const list = getNotices();
    const sorted = [...list.filter(n => n.pinned), ...list.filter(n => !n.pinned)];
    setNotices(sorted);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function submit() {
    const a = myName || author;
    if (!a)     { alert('작성자를 선택해주세요'); return; }
    if (!title) { alert('제목을 입력해주세요'); return; }
    if (!body)  { alert('내용을 입력해주세요'); return; }
    const now  = new Date();
    const time = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const list = getNotices();
    list.unshift({ author: a, title, body, pinned, time, id: Date.now() });
    saveNotices(list);
    setTitle(''); setBody(''); setPinned(false);
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
        <textarea
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 80, padding: '10px 12px', border: '1px solid #e8eaf0', borderRadius: 8, fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="내용을 입력하세요"
          value={body}
          onChange={e => setBody(e.target.value)}
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
