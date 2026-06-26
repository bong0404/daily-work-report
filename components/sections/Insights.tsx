'use client';

import { useState, useEffect, useCallback } from 'react';
import { MEMBERS, lsGet, lsSet, parseItems, currentMkey, mkeyLabel, loadMpData, PlanTask } from '@/lib/constants';
import { fetchReports, ReportRow } from '@/hooks/useReports';
import { useSectionContext } from '@/hooks/useSection';

const TREND_COLORS = ['#4f46e5','#22c55e','#f97316','#6366f1','#ec4899','#14b8a6','#a855f7'];

// ── 히트맵 탭 ───────────────────────────────────────────
function HeatmapTab() {
  const [year, setYear]     = useState(new Date().getFullYear());
  const [month, setMonth]   = useState(new Date().getMonth() + 1);
  const [html, setHtml]     = useState('');
  const [loading, setLoading] = useState(false);

  const render = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const mkey    = `${y}-${String(m).padStart(2,'0')}`;
    const allRows = await fetchReports();
    const monthRows = allRows.filter(r => r['날짜'] && r['날짜'].startsWith(mkey));
    const today   = new Date().toISOString().slice(0,10);
    const daysInMo = new Date(y, m, 0).getDate();
    const DOW_KO  = ['일','월','화','수','목','금','토'];

    const density: Record<string, Record<string, number>> = {};
    MEMBERS.forEach(mb => { density[mb.name] = {}; });
    monthRows.forEach(r => {
      const mem = MEMBERS.find(mb => (r['이름'] || '').startsWith(mb.name));
      if (!mem) return;
      const fields = ['주요완료','주요회의','진행사항','이슈리스크','익일계획'] as const;
      const filled = fields.filter(f => parseItems((r as Record<string, string>)[f] || '').length > 0).length;
      density[mem.name][r['날짜']] = (density[mem.name][r['날짜']] || 0) + filled;
    });

    const days: { d: number; ds: string; dow: number }[] = [];
    for (let d = 1; d <= daysInMo; d++) {
      const ds  = `${mkey}-${String(d).padStart(2,'0')}`;
      const dow = new Date(ds + 'T00:00:00').getDay();
      days.push({ d, ds, dow });
    }

    function hmClass(cnt: number, isWknd: boolean, isFuture: boolean) {
      if (isWknd)    return 'hm-weekend';
      if (isFuture)  return 'hm-future';
      if (cnt === 0) return 'hm-0';
      if (cnt <= 1)  return 'hm-1';
      if (cnt <= 2)  return 'hm-2';
      if (cnt <= 3)  return 'hm-3';
      if (cnt <= 4)  return 'hm-4';
      return 'hm-5';
    }

    let table = '<table class="heatmap-table"><thead><tr><th class="hm-name">팀원</th>';
    days.forEach(({ d, dow }) => {
      table += `<th style="${dow === 0 || dow === 6 ? 'color:#d1d5db' : ''}">${d}<br><span style="font-size:0.6rem">${DOW_KO[dow]}</span></th>`;
    });
    table += '</tr></thead><tbody>';
    MEMBERS.forEach(mb => {
      table += `<tr><td class="hm-name">${mb.name}</td>`;
      days.forEach(({ ds, dow }) => {
        const isWknd   = dow === 0 || dow === 6;
        const isFuture = ds > today;
        const cnt      = density[mb.name][ds] || 0;
        const cls      = hmClass(cnt, isWknd, isFuture);
        const tip      = isWknd ? '주말' : isFuture ? '미래' : `${cnt}건`;
        table += `<td class="${cls}" title="${mb.name} ${ds}: ${tip}">${!isWknd && !isFuture && cnt > 0 ? cnt : ''}</td>`;
      });
      table += '</tr>';
    });
    table += '</tbody></table>';
    setHtml(table);
    setLoading(false);
  }, []);

  useEffect(() => { render(year, month); }, [year, month, render]);

  function changeMonth(dir: number) {
    let m = month + dir, y = year;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }
    setMonth(m); setYear(y);
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button className="hm-nav-btn" onClick={() => changeMonth(-1)}>← 이전 달</button>
        <div className="hm-month-label">{year}년 {month}월</div>
        <button className="hm-nav-btn" onClick={() => changeMonth(1)}>다음 달 →</button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        {loading
          ? <div className="empty-state"><div className="loading-spinner" />불러오는 중...</div>
          : <div dangerouslySetInnerHTML={{ __html: html }} />
        }
      </div>
      <div className="heatmap-legend">
        <span style={{ fontWeight: 600, color: '#555' }}>작성 섹션 수:</span>
        {(['hm-0','hm-1','hm-2','hm-3','hm-4','hm-5'] as const).map((cls, i) => (
          <span key={cls} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className={`heatmap-legend-cell ${cls}`} />
            <span>{['미제출','1개','2개','3개','4개','5개 전체'][i]}</span>
          </span>
        ))}
        <span style={{ marginLeft: 12, color: '#bbb' }}>※ 완료·회의·진행·이슈·익일계획 중 내용 있는 섹션 개수</span>
      </div>
    </>
  );
}

// ── 완료율 추이 탭 ──────────────────────────────────────
function TrendTab() {
  const [hidden, setHidden]   = useState<Set<string>>(new Set());
  const [chartHtml, setChart] = useState('');
  const [loading, setLoading] = useState(true);

  const render = useCallback(async (hiddenSet: Set<string>) => {
    const allRows = await fetchReports();
    const monthSet = new Set<string>();
    allRows.forEach(r => { if (r['날짜']) monthSet.add(r['날짜'].slice(0,7)); });
    const months = [...monthSet].sort();

    if (!months.length) { setChart('<div class="trend-empty">데이터가 없습니다</div>'); return; }

    const memberRates: Record<string, (number | null)[]> = {};
    MEMBERS.forEach(mb => {
      memberRates[mb.name] = months.map(mo => {
        const mrows = allRows.filter(r => r['날짜']?.startsWith(mo) && r['이름'].startsWith(mb.name));
        let done = 0, progress = 0;
        mrows.forEach(r => { done += parseItems(r['주요완료'] || '').length; progress += parseItems(r['진행사항'] || '').length; });
        const total = done + progress;
        return total > 0 ? Math.round(done / total * 100) : null;
      });
    });

    const W = 680, H = 300;
    const PAD = { top: 24, right: 24, bottom: 44, left: 52 };
    const CW = W - PAD.left - PAD.right;
    const CH = H - PAD.top  - PAD.bottom;
    const xOf = (i: number) => PAD.left + (months.length > 1 ? (i / (months.length - 1)) * CW : CW / 2);
    const yOf = (v: number) => PAD.top + CH - (v / 100) * CH;

    let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:${W}px;display:block">`;
    [0,25,50,75,100].forEach(v => {
      const y = yOf(v);
      svg += `<line x1="${PAD.left}" y1="${y}" x2="${W-PAD.right}" y2="${y}" stroke="#f0f0f8" stroke-width="1.5"/>`;
      svg += `<text x="${PAD.left-6}" y="${y+4}" text-anchor="end" font-size="11" fill="#bbb">${v}%</text>`;
    });
    months.forEach((mo, i) => {
      const [yr, mn] = mo.split('-');
      const x = xOf(i);
      svg += `<text x="${x}" y="${H-8}" text-anchor="middle" font-size="11" fill="#888">${yr.slice(2)}.${parseInt(mn)}월</text>`;
      svg += `<line x1="${x}" y1="${PAD.top}" x2="${x}" y2="${PAD.top+CH}" stroke="#f0f0f8" stroke-width="1" stroke-dasharray="4,3"/>`;
    });

    MEMBERS.forEach((mb, mi) => {
      if (hiddenSet.has(mb.name)) return;
      const color = TREND_COLORS[mi % TREND_COLORS.length];
      const points = memberRates[mb.name];
      const valid = points.map((v, i) => v !== null ? [xOf(i), yOf(v), v] as [number,number,number] : null).filter(Boolean) as [number,number,number][];
      if (valid.length > 1) {
        const d = valid.map((p, i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ');
        svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>`;
      }
      valid.forEach(([x, y, v]) => {
        svg += `<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="#fff" stroke-width="2"><title>${mb.name}: ${v}%</title></circle>`;
        svg += `<text x="${x}" y="${y-9}" text-anchor="middle" font-size="10" fill="${color}" font-weight="700">${v}%</text>`;
      });
    });
    svg += '</svg>';
    setChart(svg);
    setLoading(false);
  }, []);

  useEffect(() => { render(hidden); }, [hidden, render]);

  function toggle(name: string) {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  return (
    <>
      <div className="trend-legend">
        {MEMBERS.map((mb, i) => (
          <div key={mb.name} className={`trend-legend-item${hidden.has(mb.name) ? ' tl-hidden' : ''}`} onClick={() => toggle(mb.name)} style={{ cursor: 'pointer' }}>
            <div className="trend-legend-dot" style={{ background: TREND_COLORS[i % TREND_COLORS.length] }} />
            {mb.name}
          </div>
        ))}
      </div>
      <div className="trend-chart-area">
        {loading
          ? <div className="empty-state"><div className="loading-spinner" />불러오는 중...</div>
          : <div dangerouslySetInnerHTML={{ __html: chartHtml }} />
        }
      </div>
    </>
  );
}

// ── 리포트 내보내기 탭 ──────────────────────────────────
function ExportTab() {
  const today = new Date().toISOString().slice(0,10);
  const firstOfMonth = today.slice(0,8) + '01';
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo]     = useState(today);
  const [status, setStatus] = useState('');

  async function doExport() {
    setStatus('내보내는 중...');
    try {
      const rows = await fetchReports();
      const filtered = rows.filter(r => r['날짜'] >= from && r['날짜'] <= to);
      if (!filtered.length) { setStatus('해당 기간 데이터가 없습니다'); return; }

      const headers = ['날짜','이름','부서','주요완료','주요회의','진행사항','이슈리스크','익일계획'];
      const csv = [
        headers.join(','),
        ...filtered.map(r => headers.map(h => `"${((r as Record<string,string>)[h] || '').replace(/"/g,'""').replace(/\n/g,' ')}"`).join(','))
      ].join('\n');

      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `업무보고_${from}_${to}.csv`; a.click();
      URL.revokeObjectURL(url);
      setStatus(`✅ ${filtered.length}건 내보내기 완료`);
    } catch (e: unknown) {
      setStatus('❌ 실패: ' + (e as Error).message);
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ marginBottom: 20, fontSize: '0.88rem', color: '#64748b' }}>선택한 기간의 업무보고를 CSV 파일로 다운로드합니다.</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.85rem' }} />
        <span style={{ color: '#aaa' }}>~</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.85rem' }} />
        <button onClick={doExport} style={{ padding: '8px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>📤 CSV 내보내기</button>
      </div>
      {status && <div style={{ fontSize: '0.85rem', color: status.startsWith('✅') ? '#16a34a' : '#ef4444' }}>{status}</div>}
    </div>
  );
}

// ── 피드백 탭 ───────────────────────────────────────────
interface Feedback { id: number; author: string; target: string; text: string; time: string; anonymous: boolean; }

function FeedbackTab() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [author, setAuthor]       = useState(lsGet('my_name') || '');
  const [target, setTarget]       = useState('');
  const [text, setText]           = useState('');
  const [anon, setAnon]           = useState(true);

  const reload = useCallback(() => {
    try { setFeedbacks(JSON.parse(lsGet('team_feedbacks') || '[]')); } catch { setFeedbacks([]); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function submit() {
    if (!author) { alert('작성자를 선택해주세요'); return; }
    if (!target) { alert('받는 사람을 선택해주세요'); return; }
    if (!text.trim()) { alert('피드백 내용을 입력해주세요'); return; }
    const now  = new Date();
    const time = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
    const list: Feedback[] = JSON.parse(lsGet('team_feedbacks') || '[]');
    list.unshift({ id: Date.now(), author, target, text: text.trim(), time, anonymous: anon });
    lsSet('team_feedbacks', JSON.stringify(list));
    setText('');
    reload();
  }

  function del(id: number) {
    const list = feedbacks.filter(f => f.id !== id);
    lsSet('team_feedbacks', JSON.stringify(list));
    reload();
  }

  return (
    <>
      <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={author} onChange={e => setAuthor(e.target.value)} style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }}>
            <option value="">작성자 선택</option>
            {MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}
          </select>
          <span style={{ alignSelf: 'center', color: '#aaa', fontSize: '0.85rem' }}>→</span>
          <select value={target} onChange={e => setTarget(e.target.value)} style={{ flex: 1, padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }}>
            <option value="">받는 사람 선택</option>
            {MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}
          </select>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="솔직한 피드백을 남겨주세요 🙏"
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem', resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <label style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={anon} onChange={e => setAnon(e.target.checked)} />
            익명으로 전달
          </label>
          <button onClick={submit} style={{ padding: '7px 20px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}>전달하기 💬</button>
        </div>
      </div>
      <div>
        {feedbacks.length === 0
          ? <div className="empty-state">아직 피드백이 없습니다</div>
          : feedbacks.map(f => (
            <div key={f.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  <strong style={{ color: f.anonymous ? '#94a3b8' : '#4f46e5' }}>{f.anonymous ? '익명' : f.author}</strong>
                  <span style={{ margin: '0 6px', color: '#cbd5e1' }}>→</span>
                  <strong style={{ color: '#0f172a' }}>{f.target}</strong>
                  <span style={{ marginLeft: 8, color: '#94a3b8' }}>{f.time}</span>
                </div>
                <button onClick={() => del(f.id)} style={{ border: 'none', background: 'none', color: '#d1d5db', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.6 }}>{f.text}</div>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ── 키워드 분석 탭 ──────────────────────────────────────
function KfreqTab() {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const rows = await fetchReports();
      const now  = new Date();
      const mkey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const monthRows = rows.filter(r => r['날짜'] && r['날짜'].startsWith(mkey));
      const targets = monthRows.length ? monthRows : rows;

      const stopWords = new Set(['및','또는','관련','진행','완료','업무','작업','확인','검토','처리','등록','예정','요청','미팅','회의','참석','보고','대응','공유','협의','기안','승인','반려','수령','발송','전달','안내','파악','조율','제출','작성','등','를','을','이','가','에','의','은','는','로','로','에서','으로','과','와','대한','위해','위한','통해','따라','대해','하여','하고','하는','있는','없는','되는','으로써','부터','까지','보다','에게','에서의','에의','서의']);

      const freq: Record<string, number> = {};
      targets.forEach(r => {
        const fields = ['주요완료','주요회의','진행사항','이슈리스크','익일계획'] as const;
        fields.forEach(f => {
          parseItems((r as Record<string, string>)[f] || '').forEach(line => {
            line.split(/[\s,·\-\/\(\)\[\]]+/).forEach(w => {
              const word = w.replace(/[^가-힣a-zA-Z0-9]/g, '').trim();
              if (word.length < 2 || stopWords.has(word)) return;
              freq[word] = (freq[word] || 0) + 1;
            });
          });
        });
      });

      const top50 = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 50);
      if (!top50.length) { setHtml('<div class="empty-state">데이터가 없습니다</div>'); setLoading(false); return; }

      const counts = top50.map(([,cnt]) => cnt);
      const maxC = Math.max(...counts), minC = Math.min(...counts);
      const range = maxC === minC ? 1 : maxC - minC;
      const cloud = top50.map(([word, cnt]) => {
        const ratio = (cnt - minC) / range;
        const size  = (0.72 + ratio * 1.3).toFixed(2);
        const alpha = (0.45 + ratio * 0.55).toFixed(2);
        const hue   = Math.round(220 + ratio * 60);
        return `<span class="kfreq-tag" style="font-size:${size}rem;opacity:${alpha};color:hsl(${hue},65%,52%)" title="${cnt}회">${word}<sup style="font-size:0.5em;opacity:0.65"> ${cnt}</sup></span>`;
      }).join('');

      const tableRows = top50.slice(0, 20).map(([word, cnt], i) =>
        `<tr><td style="padding:5px 10px;color:#94a3b8;text-align:center">${i+1}</td><td style="padding:5px 10px;font-weight:600">${word}</td><td style="padding:5px 10px;color:#4f46e5;font-weight:700">${cnt}회</td></tr>`
      ).join('');

      setHtml(`
        <div class="kfreq-wrap">
          <div class="kfreq-cloud">${cloud}</div>
          <div class="kfreq-table-wrap" style="margin-top:20px">
            <div style="font-weight:700;font-size:0.85rem;color:#374151;margin-bottom:8px">상위 20개 키워드</div>
            <table style="border-collapse:collapse;font-size:0.84rem">
              <thead><tr><th style="padding:5px 10px;color:#94a3b8">순위</th><th style="padding:5px 10px">키워드</th><th style="padding:5px 10px">빈도</th></tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </div>`);
      setLoading(false);
    })();
  }, []);

  return (
    <div dangerouslySetInnerHTML={{ __html: loading ? '<div class="empty-state"><div class="loading-spinner"></div>분석 중...</div>' : html }} />
  );
}

// ── 계획 vs 실적 탭 ─────────────────────────────────────
function PlanCmpTab() {
  const [mkey, setMkey]   = useState(currentMkey());
  const [person, setPerson] = useState('');
  const [html, setHtml]   = useState('');
  const [loading, setLoading] = useState(false);

  function changeMonth(dir: number) {
    const [y, m] = mkey.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMkey(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  const render = useCallback(async (m: string, p: string) => {
    if (!p) { setHtml('<div class="empty-state">팀원을 선택하세요</div>'); return; }
    setLoading(true);
    const rows      = await fetchReports();
    const planData  = loadMpData(m, p);
    const monthRows = rows.filter(r => r['날짜'] && r['날짜'].startsWith(m) && r['이름'] === p);

    // Plan tasks
    let planTotal = 0, planDone = 0, planDoing = 0;
    Object.values(planData.grid).forEach(dayGrid => {
      Object.values(dayGrid).forEach(tasks => {
        tasks.forEach((t: PlanTask) => {
          planTotal++;
          if (t.status === 'done' || t.done) planDone++;
          else if (t.status === 'doing') planDoing++;
        });
      });
    });

    // Actual report
    let actualDone = 0, actualMeet = 0, actualIssue = 0;
    monthRows.forEach(r => {
      actualDone  += parseItems(r['주요완료'] || '').length;
      actualMeet  += parseItems(r['주요회의'] || '').length;
      actualIssue += parseItems(r['이슈리스크'] || '').length;
    });
    const completionRate = planTotal > 0 ? Math.round(planDone / planTotal * 100) : 0;

    let out = `
      <div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 10px rgba(15,23,42,0.07);margin-bottom:20px">
        <div style="font-weight:700;font-size:1rem;color:#1a1a2e;margin-bottom:16px">${p}님 · ${mkeyLabel(m)} 계획 vs 실적</div>
        <div class="dashboard-grid">
          <div class="dash-card"><div class="label">계획 전체</div><div class="value purple">${planTotal}건</div></div>
          <div class="dash-card"><div class="label">계획 완료</div><div class="value green">${planDone}건</div></div>
          <div class="dash-card"><div class="label">진행 중</div><div class="value">${planDoing}건</div></div>
          <div class="dash-card"><div class="label">완료율</div><div class="value ${completionRate >= 80 ? 'green' : completionRate >= 50 ? '' : 'red'}">${completionRate}%</div></div>
        </div>
        <div class="dashboard-grid" style="margin-top:12px">
          <div class="dash-card"><div class="label">보고 일수</div><div class="value purple">${monthRows.length}일</div></div>
          <div class="dash-card"><div class="label">완료 업무</div><div class="value green">${actualDone}건</div></div>
          <div class="dash-card"><div class="label">회의 참석</div><div class="value">${actualMeet}건</div></div>
          <div class="dash-card"><div class="label">이슈 발굴</div><div class="value red">${actualIssue}건</div></div>
        </div>
      </div>`;

    if (planTotal > 0) {
      const pct = completionRate;
      const barCls = pct >= 80 ? '' : pct >= 50 ? 'mid' : 'low';
      out += `
        <div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 10px rgba(15,23,42,0.07)">
          <div style="font-weight:600;font-size:0.85rem;color:#64748b;margin-bottom:8px">월 계획 완료율</div>
          <div class="metric-bar-bg">
            <div class="metric-bar-fill progress-bar ${barCls}" style="width:${pct}%"></div>
          </div>
          <div style="text-align:right;font-size:0.82rem;font-weight:700;color:#4f46e5;margin-top:4px">${pct}%</div>
        </div>`;
    } else {
      out += `<div class="empty-state">${mkeyLabel(m)} 계획 데이터가 없습니다</div>`;
    }

    setHtml(out);
    setLoading(false);
  }, []);

  useEffect(() => { render(mkey, person); }, [mkey, person, render]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <button className="cmp-nav-btn" onClick={() => changeMonth(-1)}>← 이전 달</button>
        <div className="cmp-month-lbl">{mkeyLabel(mkey)}</div>
        <button className="cmp-nav-btn" onClick={() => changeMonth(1)}>다음 달 →</button>
        <select value={person} onChange={e => setPerson(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 20, padding: '5px 14px', fontSize: '0.8rem', color: '#555', background: '#fff', cursor: 'pointer', outline: 'none' }}>
          <option value="">팀원을 선택하세요</option>
          {MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}
        </select>
      </div>
      {loading
        ? <div className="empty-state"><div className="loading-spinner" />불러오는 중...</div>
        : <div dangerouslySetInnerHTML={{ __html: html }} />
      }
    </>
  );
}

// ── 메인 Insights 컴포넌트 ──────────────────────────────
const TAB_LABELS: Record<string, string> = {
  'heatmap':  '🔥 업무 히트맵',
  'trend':    '📈 완료율 추이',
  'export':   '📤 리포트 내보내기',
  'feedback': '💬 피드백',
  'kfreq':    '☁️ 키워드 분석',
  'plan-cmp': '🎯 계획 vs 실적',
};

export function Insights() {
  const { tab, setTab } = useSectionContext();
  const activeTab = tab || 'heatmap';

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
      {activeTab === 'heatmap'  && <HeatmapTab />}
      {activeTab === 'trend'    && <TrendTab />}
      {activeTab === 'export'   && <ExportTab />}
      {activeTab === 'feedback' && <FeedbackTab />}
      {activeTab === 'kfreq'    && <KfreqTab />}
      {activeTab === 'plan-cmp' && <PlanCmpTab />}
    </>
  );
}
