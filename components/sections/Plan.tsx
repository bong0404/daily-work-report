'use client';

import { useState, useEffect, useCallback } from 'react';
import { MEMBERS, lsGet, lsSet,
  currentMkey, mkeyLabel, getMonthDays, getHoliday,
  loadMpData, saveMpData, PlanTask, MonthPlanData
} from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useSectionContext } from '@/hooks/useSection';
import { fetchReports } from '@/hooks/useReports';

const STATUS_CYCLE: Record<string, string> = { todo: 'doing', doing: 'done', done: 'todo' };
const STATUS_LABEL: Record<string, string> = { todo: '예정', doing: '진행', done: '완료' };

// ── 셀 내 태스크 컴포넌트 ────────────────────────────────
interface TaskElProps {
  task: PlanTask;
  onChange: (t: Partial<PlanTask>) => void;
  onDelete: () => void;
}

function TaskEl({ task, onChange, onDelete }: TaskElProps) {
  const status  = task.status || (task.done ? 'done' : 'todo');
  const starred = !!task.starred;

  function cycleStatus() {
    const next = STATUS_CYCLE[status] || 'doing';
    const update: Partial<PlanTask> = { status: next as PlanTask['status'], done: next === 'done' };
    if (next === 'done') {
      const now = new Date();
      update.completedAt = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    } else {
      update.completedAt = undefined;
    }
    onChange(update);
  }

  return (
    <div className={`wpt-task${status === 'done' ? ' done' : status === 'doing' ? ' doing' : ''}${starred ? ' starred-task' : ''}${task.color ? ' color-' + task.color : ''}`}>
      <button className={`wpt-status-btn s-${status}`} onClick={cycleStatus} title="클릭하여 상태 변경">
        {STATUS_LABEL[status]}
      </button>
      <textarea
        className="wpt-task-text"
        rows={1}
        placeholder="업무 입력"
        defaultValue={task.text || ''}
        onBlur={e => onChange({ text: e.target.value })}
        onInput={e => {
          const el = e.currentTarget;
          el.style.height = 'auto';
          el.style.height = el.scrollHeight + 'px';
        }}
      />
      <div className="wpt-task-actions">
        <button
          className={`wpt-star-btn${starred ? ' starred' : ''}`}
          onClick={() => onChange({ starred: !starred })}
          title={starred ? '중요 해제' : '중요 표시'}
        >★</button>
        <button className="wpt-task-del" onClick={onDelete}>✕</button>
      </div>
    </div>
  );
}

// ── 셀 하단 인라인 입력 ───────────────────────────────────
function DraftTaskInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [val, setVal] = useState('');
  function commit() {
    if (val.trim()) { onAdd(val.trim()); setVal(''); }
  }
  return (
    <input
      type="text"
      value={val}
      onChange={e => setVal(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      onBlur={commit}
      placeholder="+ 입력 후 Enter"
      style={{ width: '100%', fontSize: '0.73rem', border: 'none', borderBottom: '1px dashed #d0d4e8', background: 'transparent', outline: 'none', padding: '3px 4px', color: '#9da3b8', marginTop: 3, boxSizing: 'border-box' }}
    />
  );
}

// ── 타임라인 작성 탭 ─────────────────────────────────────
function TimelinePlanTab() {
  const [person, setPerson]  = useState('');
  const [mkey, setMkey]      = useState(currentMkey());
  const [data, setData]      = useState<MonthPlanData>(() => loadMpData(currentMkey(), ''));
  const [keyWork, setKeyWork] = useState('');
  const [issue, setIssue]    = useState('');
  useEffect(() => { setPerson(lsGet('my_name') || ''); }, []);

  const reload = useCallback((m: string, p: string) => {
    const d = loadMpData(m, p);
    setData(d);
    setKeyWork(d.keyWork || '');
    setIssue(d.issue || '');
  }, []);

  useEffect(() => { reload(mkey, person); }, [mkey, person, reload]);

  async function syncFromSupabase(m: string, p: string) {
    if (!p) return;
    try {
      const { data: row } = await supabase.from('monthly_plans')
        .select('data').eq('year_month', m).eq('name', p).maybeSingle();
      if (row) { lsSet(`mplan_${p}_${m}`, JSON.stringify(row.data)); reload(m, p); }
    } catch (e: unknown) { console.warn('동기화 실패:', (e as Error).message); }
  }

  function changeMonth(dir: number) {
    const [y, m] = mkey.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    const nm = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    setMkey(nm);
    reload(nm, person);
  }

  function save(newData: MonthPlanData) {
    const updated = { ...newData, keyWork, issue };
    setData(updated);
    saveMpData(mkey, person, updated);
    if (person) {
      supabase.from('monthly_plans')
        .upsert({ year_month: mkey, name: person, data: updated, updated_at: new Date().toISOString() }, { onConflict: 'year_month,name' })
        .then(({ error }) => { if (error) console.warn('저장 실패:', error.message); });
    }
  }

  function updateTask(cat: string, dayKey: string, ti: number, changes: Partial<PlanTask>) {
    const newData = JSON.parse(JSON.stringify(data)) as MonthPlanData;
    if (newData.grid[cat]?.[dayKey]?.[ti] !== undefined) {
      Object.assign(newData.grid[cat][dayKey][ti], changes);
    }
    save(newData);
  }

  function addTask(cat: string, dayKey: string, text = '') {
    const newData = JSON.parse(JSON.stringify(data)) as MonthPlanData;
    if (!newData.grid[cat]) newData.grid[cat] = {};
    if (!newData.grid[cat][dayKey]) newData.grid[cat][dayKey] = [];
    newData.grid[cat][dayKey].push({ text, status: 'todo', done: false });
    save(newData);
  }

  function deleteTask(cat: string, dayKey: string, ti: number) {
    const newData = JSON.parse(JSON.stringify(data)) as MonthPlanData;
    if (newData.grid[cat]?.[dayKey]) {
      newData.grid[cat][dayKey].splice(ti, 1);
    }
    save(newData);
  }

  function addCategory() {
    const name = prompt('새 카테고리명을 입력하세요');
    if (!name?.trim()) return;
    const newData = { ...data, categories: [...data.categories, name.trim()] };
    save(newData);
  }

  function deleteCategory(catIdx: number) {
    const cat = data.categories[catIdx];
    if (!confirm(`"${cat}" 카테고리를 삭제할까요?`)) return;
    const newData = JSON.parse(JSON.stringify(data)) as MonthPlanData;
    newData.categories.splice(catIdx, 1);
    delete newData.grid[cat];
    delete newData.memo[cat];
    save(newData);
  }

  function saveMemos() {
    const newData = { ...data, keyWork, issue };
    setData(newData);
    saveMpData(mkey, person, newData);
  }

  const days = getMonthDays(mkey);
  const today = new Date(); today.setHours(0,0,0,0);
  const DOW_KR = ['일','월','화','수','목','금','토'];

  const chunks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
  const [y, m] = mkey.split('-').map(Number);

  return (
    <>
      <div className="wpt-top">
        <div className="wpt-nav">
          <button className="wpt-nav-btn" onClick={() => changeMonth(-1)}>← 이전 달</button>
          <div className="wpt-week-label">{mkeyLabel(mkey)}</div>
          <button className="wpt-nav-btn" onClick={() => changeMonth(1)}>다음 달 →</button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 8 }}>
        <div className="wpt-month-memo" style={{ flex: 1, marginBottom: 0 }}>
          <div className="wpt-memo-col">
            <div className="wpt-memo-col-label">📌 월 주요업무</div>
            <textarea className="wpt-memo-ta" placeholder="이달의 주요 업무를 입력하세요" value={keyWork} onChange={e => setKeyWork(e.target.value)} onBlur={saveMemos} />
          </div>
          <div className="wpt-memo-col">
            <div className="wpt-memo-col-label">⚠️ 이슈</div>
            <textarea className="wpt-memo-ta" placeholder="이달의 이슈 사항을 입력하세요" value={issue} onChange={e => setIssue(e.target.value)} onBlur={saveMemos} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, alignItems: 'flex-end' }}>
          <div className="wpt-person-bar" style={{ margin: 0 }}>
            <label className="wpt-person-label">작성자</label>
            {person
              ? <span style={{ padding: '6px 12px', background: '#eef2ff', borderRadius: 8, fontWeight: 600, color: '#4338ca', fontSize: '0.9rem' }}>{person}</span>
              : <span style={{ padding: '6px 12px', background: '#fee2e2', borderRadius: 8, color: '#b91c1c', fontSize: '0.85rem' }}>설정 필요 (설정 탭에서 이름 입력)</span>
            }
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
            <button className="wpt-cat-add-btn" onClick={() => alert('템플릿을 불러옵니다')}>📋 템플릿</button>
            <button className="wpt-cat-add-btn" onClick={addCategory}>+ 카테고리 추가</button>
            <button className="wp-submit-btn" onClick={saveMemos}>저장</button>
          </div>
        </div>
      </div>

      {!person
        ? <div className="empty-state">작성자를 선택하세요</div>
        : (
          <div className="wpt-table-wrap">
            {chunks.map((chunk, chunkIdx) => (
              <div key={chunkIdx}>
                <div className="wpt-block-label">
                  {m}월 {chunkIdx + 1}주차 ({chunk[0].label} ~ {chunk[chunk.length-1].label})
                </div>
                <table className="wpt-table">
                  <thead>
                    <tr>
                      <th className="wpt-th-cat">카테고리</th>
                      {chunk.map(day => {
                        const isToday   = day.date.getTime() === today.getTime();
                        const dow       = day.date.getDay();
                        const isSun     = dow === 0;
                        const isSat     = dow === 6;
                        const holiday   = !day.isOther ? getHoliday(day.date) : null;
                        const isHoliday = !!holiday;
                        const isSub     = !!holiday?.sub;
                        const color     = isToday ? '#4f46e5' : day.isOther ? '#bbb'
                          : (isSun || (isHoliday && !isSub)) ? '#e53e3e'
                          : isSub ? '#d97706' : isSat ? '#3182ce' : undefined;
                        const bg        = isToday ? '#e0e7ff' : day.isOther ? '#f8f8fb' : isSub ? '#fffbeb' : undefined;
                        return (
                          <th key={day.key} style={{ background: bg, color, width: (isSat || isSun) ? 120 : undefined }}>
                            {day.label}<br/>
                            <span style={{ fontWeight: 400, fontSize: '0.65rem' }}>{day.dow}</span>
                            {isHoliday && <><br/><span style={{ fontSize: '0.58rem', color: isSub ? '#d97706' : '#e53e3e', fontWeight: 600, whiteSpace: 'nowrap' }}>{isSub ? '🔶 ' : '🔴 '}{holiday!.name}</span></>}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories.map((cat, catIdx) => {
                      if (!data.grid[cat]) data.grid[cat] = {};
                      return (
                        <tr key={cat}>
                          <td className="wpt-cat-cell">
                            <span className="wpt-cat-name">{cat}</span>
                            <div className="wpt-cat-actions">
                              <button className="wpt-cat-del" onClick={() => deleteCategory(catIdx)} title="카테고리 삭제">✕</button>
                            </div>
                          </td>
                          {chunk.map(day => {
                            const tasks = data.grid[cat][day.key] || [];
                            return (
                              <td key={day.key} className="wpt-day-cell" style={{ width: (day.date.getDay() === 0 || day.date.getDay() === 6) ? 120 : undefined }}>
                                {tasks.map((task, ti) => (
                                  <TaskEl
                                    key={ti}
                                    task={task}
                                    onChange={changes => updateTask(cat, day.key, ti, changes)}
                                    onDelete={() => deleteTask(cat, day.key, ti)}
                                  />
                                ))}
                                <DraftTaskInput onAdd={text => addTask(cat, day.key, text)} />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )
      }
    </>
  );
}

// ── 인물별 조회 탭 ────────────────────────────────────────
function PersonPlanTab() {
  const [person, setPerson] = useState('');
  const [mkey, setMkey]     = useState(currentMkey());
  const [data, setData]     = useState<MonthPlanData | null>(null);

  useEffect(() => {
    if (!person) { setData(null); return; }
    const d = loadMpData(mkey, person);
    setData(d);
    // try sync from supabase
    supabase.from('monthly_plans')
      .select('data').eq('year_month', mkey).eq('name', person).maybeSingle()
      .then(({ data: row }) => {
        if (row) { lsSet(`mplan_${person}_${mkey}`, JSON.stringify(row.data)); setData(row.data as MonthPlanData); }
      });
  }, [person, mkey]);

  function changeMonth(dir: number) {
    const [y, m] = mkey.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMkey(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  const days = getMonthDays(mkey);
  const today = new Date(); today.setHours(0,0,0,0);
  const chunks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) chunks.push(days.slice(i, i + 7));
  const [, m] = mkey.split('-').map(Number);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}>조회 인물</label>
          <select value={person} onChange={e => setPerson(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #dde1f0', borderRadius: 8, fontSize: '0.85rem' }}>
            <option value="">이름을 선택하세요</option>
            {MEMBERS.map(mb => <option key={mb.name} value={mb.name}>{mb.name} ({mb.dept})</option>)}
            <option value="김청진">김청진 (이사)</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="wpt-nav-btn" onClick={() => changeMonth(-1)}>← 이전 달</button>
          <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: 90, textAlign: 'center' }}>{mkeyLabel(mkey)}</span>
          <button className="wpt-nav-btn" onClick={() => changeMonth(1)}>다음 달 →</button>
        </div>
      </div>
      {!person
        ? <div className="empty-state">인물을 선택하세요</div>
        : !data || !data.categories.length
          ? <div className="empty-state">{person}의 {mkeyLabel(mkey)} 계획이 없습니다</div>
          : (
            <div className="wpt-table-wrap">
              {chunks.map((chunk, chunkIdx) => (
                <div key={chunkIdx}>
                  <div className="wpt-block-label">{m}월 {chunkIdx + 1}주차 ({chunk[0].label} ~ {chunk[chunk.length-1].label})</div>
                  <table className="wpt-table">
                    <thead>
                      <tr>
                        <th className="wpt-th-cat">카테고리</th>
                        {chunk.map(day => {
                          const dow = day.date.getDay();
                          const holiday = !day.isOther ? getHoliday(day.date) : null;
                          const color = day.isOther ? '#bbb' : (dow === 0 || (holiday && !holiday.sub)) ? '#e53e3e' : holiday?.sub ? '#d97706' : dow === 6 ? '#3182ce' : undefined;
                          return (
                            <th key={day.key} style={{ color }}>
                              {day.label}<br/><span style={{ fontWeight: 400, fontSize: '0.65rem' }}>{day.dow}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {data.categories.map(cat => (
                        <tr key={cat}>
                          <td className="wpt-cat-cell"><span className="wpt-cat-name">{cat}</span></td>
                          {chunk.map(day => {
                            const tasks = (data.grid[cat] || {})[day.key] || [];
                            return (
                              <td key={day.key} className="wpt-day-cell">
                                {tasks.map((task, ti) => {
                                  const status = task.status || (task.done ? 'done' : 'todo');
                                  return (
                                    <div key={ti} className={`wpt-task${status === 'done' ? ' done' : status === 'doing' ? ' doing' : ''}`}>
                                      <span className={`wpt-status-btn s-${status}`}>{STATUS_LABEL[status]}</span>
                                      <span style={{ fontSize: '0.82rem', padding: '2px 4px', flex: 1 }}>{task.text}</span>
                                    </div>
                                  );
                                })}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )
      }
    </>
  );
}

// ── 팀원 현황 탭 ─────────────────────────────────────────
function TeamOverviewTab() {
  const [mkey, setMkey]   = useState(currentMkey());
  const [rows, setRows]   = useState<{ name: string; dept: string; submitted: boolean; totalDays: number; done: number }[]>([]);
  const [loading, setLoading] = useState(false);

  function changeMonth(dir: number) {
    const [y, m] = mkey.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMkey(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  useEffect(() => {
    setLoading(true);
    fetchReports().then(reports => {
      const monthRows = reports.filter(r => r['날짜'] && r['날짜'].startsWith(mkey));
      const result = MEMBERS.map(m => {
        const myRows   = monthRows.filter(r => r['이름'] === m.name);
        let totalDone  = 0;
        myRows.forEach(r => { totalDone += (r['주요완료'] || '').split('\n').filter(Boolean).length; });

        // plan completion from localStorage
        const planData = loadMpData(mkey, m.name);
        let planTotal = 0, planDone = 0;
        Object.values(planData.grid).forEach(dayGrid => {
          Object.values(dayGrid).forEach(tasks => {
            tasks.forEach((t: PlanTask) => { planTotal++; if (t.done || t.status === 'done') planDone++; });
          });
        });

        return { name: m.name, dept: m.dept, submitted: myRows.length > 0, totalDays: myRows.length, done: totalDone };
      });
      setRows(result);
      setLoading(false);
    });
  }, [mkey]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button className="wpt-nav-btn" onClick={() => changeMonth(-1)}>← 이전 달</button>
        <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: 100, textAlign: 'center' }}>{mkeyLabel(mkey)}</span>
        <button className="wpt-nav-btn" onClick={() => changeMonth(1)}>다음 달 →</button>
      </div>
      {loading
        ? <div className="empty-state"><div className="loading-spinner" />불러오는 중...</div>
        : (
          <div className="submit-status-grid">
            {rows.map(r => (
              <div key={r.name} className={`member-status-card${r.submitted ? ' submitted' : ' missing'}`}>
                <div className="member-status-top">
                  <div className={`status-dot${r.submitted ? ' submitted' : ' missing'}`} />
                  <div className="member-status-info">
                    <div className="member-status-name">{r.name}</div>
                    <div className="member-status-dept">{r.dept}</div>
                  </div>
                  <div className={`status-badge${r.submitted ? ' submitted' : ' missing'}`}>
                    {r.submitted ? `${r.totalDays}일 제출` : '미제출'}
                  </div>
                </div>
                {r.submitted && (
                  <div style={{ fontSize: '0.78rem', color: '#64748b', padding: '6px 0 0' }}>
                    완료 업무 {r.done}건
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    </>
  );
}

// ── 메인 Plan 컴포넌트 ───────────────────────────────────
const TAB_LABELS: Record<string, string> = {
  'weekly-plan':   '📅 타임라인 작성',
  'person-plan':   '🔍 인물별 조회',
  'team-overview': '👥 팀원 현황',
};

export function Plan() {
  const { tab, setTab } = useSectionContext();
  const activeTab = tab || 'weekly-plan';

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
      {activeTab === 'weekly-plan'   && <TimelinePlanTab />}
      {activeTab === 'person-plan'   && <PersonPlanTab />}
      {activeTab === 'team-overview' && <TeamOverviewTab />}
    </>
  );
}
