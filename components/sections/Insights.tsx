'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { MEMBERS, lsGet, lsSet, parseItems, currentMkey, mkeyLabel, loadMpData, saveMpData, getMonthDays, PlanTask, MonthPlanData } from '@/lib/constants';
import { fetchReports, ReportRow } from '@/hooks/useReports';
import { useSectionContext } from '@/hooks/useSection';
import { supabase } from '@/lib/supabase';

const TREND_COLORS = [
  '#F9D87A',  // 박희진 — 옐로우
  '#F4A8BC',  // 설한영 — 핑크
  '#7ECEC4',  // 정연환 — 민트
  '#A8C8E8',  // 박수정 — 스카이블루
  '#F4A07C',  // 박경현 — 코럴
  '#C4A8D8',  // 유준우 — 라벤더
  '#A8D4A0',  // 유하연 — 세이지그린
];

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

    // 데이터가 1개월치일 때 → 가로 막대 차트
    if (months.length === 1) {
      const [yr, mn] = months[0].split('-');
      const visible = MEMBERS.filter(mb => !hiddenSet.has(mb.name));
      const W = 620, rowH = 40, PAD = { top: 36, right: 70, bottom: 16, left: 88 };
      const H = PAD.top + visible.length * rowH + PAD.bottom;
      const barW = W - PAD.left - PAD.right;
      let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="max-width:${W}px;display:block">`;
      svg += `<text x="${W/2}" y="20" text-anchor="middle" font-size="12" fill="#94a3b8" font-weight="600">${yr.slice(2)}.${parseInt(mn)}월 완료율</text>`;
      visible.forEach((mb, i) => {
        const color = TREND_COLORS[MEMBERS.indexOf(mb) % TREND_COLORS.length];
        const val = memberRates[mb.name][0];
        const y = PAD.top + i * rowH;
        const pct = val ?? 0;
        const w = Math.round((pct / 100) * barW);
        svg += `<text x="${PAD.left - 8}" y="${y + 15}" text-anchor="end" font-size="12" fill="#374151" font-weight="600">${mb.name}</text>`;
        svg += `<rect x="${PAD.left}" y="${y + 4}" width="${barW}" height="20" rx="5" fill="#f1f5f9"/>`;
        if (w > 0) svg += `<rect x="${PAD.left}" y="${y + 4}" width="${w}" height="20" rx="5" fill="${color}" opacity="0.55"/>`;
        svg += val !== null
          ? `<text x="${PAD.left + w + 6}" y="${y + 18}" font-size="12" fill="${color}" font-weight="700">${pct}%</text>`
          : `<text x="${PAD.left + 6}" y="${y + 18}" font-size="11" fill="#cbd5e1">데이터 없음</text>`;
      });
      svg += '</svg>';
      setChart(svg);
      setLoading(false);
      return;
    }

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
        svg += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.55"/>`;
      }
      valid.forEach(([x, y, v]) => {
        svg += `<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="#fff" stroke-width="2" opacity="0.55"><title>${mb.name}: ${v}%</title></circle>`;
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
const REPORT_SECTIONS: [keyof ReportRow, string][] = [
  ['주요완료',   '주요 완료'],
  ['주요회의',   '주요 회의 / 의사결정'],
  ['진행사항',   '진행사항'],
  ['이슈리스크', '이슈 / 리스크'],
];

function ExportTab() {
  const today = new Date().toISOString().slice(0,10);
  const firstOfMonth = today.slice(0,8) + '01';
  const [from, setPeriodFrom] = useState(firstOfMonth);
  const [to, setPeriodTo]     = useState(today);
  const [person, setPerson]   = useState('');
  const [title, setTitle]     = useState('팀 업무보고서');
  const [period, setPeriodLabel] = useState('기간을 선택하고 조회하세요');
  const [body, setBody]       = useState('');
  const [loading, setLoading] = useState(false);

  async function doQuery() {
    if (!from || !to) { alert('기간을 입력해주세요'); return; }
    setLoading(true);
    const allRows = await fetchReports();
    let rows = allRows.filter(r => r['날짜'] && r['날짜'] >= from && r['날짜'] <= to);
    if (person) rows = rows.filter(r => (r['이름'] || '').startsWith(person));

    setTitle(person ? `${person} 업무보고서` : '팀 업무보고서');
    setPeriodLabel(`${from.replace(/-/g,'.')} ~ ${to.replace(/-/g,'.')}`);

    if (!rows.length) {
      setBody('<div class="empty-state" style="padding:40px 0">해당 기간에 데이터가 없습니다</div>');
      setLoading(false);
      return;
    }

    const memberOrder = person ? [person] : MEMBERS.map(m => m.name);
    let html = '';
    memberOrder.forEach(name => {
      const mrows = rows.filter(r => (r['이름'] || '').startsWith(name));
      if (!mrows.length) return;
      const dept = mrows[0]['부서'] || '';
      html += `<div class="export-member-block">`;
      html += `<div class="export-member-name">${name}<span style="font-size:0.78rem;font-weight:400;color:#999;margin-left:4px">${dept}</span></div>`;
      [...mrows].sort((a, b) => a['날짜'] > b['날짜'] ? 1 : -1).forEach(r => {
        const dl = r['날짜'].replace(/-/g,'.').slice(2);
        html += `<div class="export-date-label">▸ ${dl}</div>`;
        REPORT_SECTIONS.forEach(([key, label]) => {
          const items = parseItems((r[key] as string) || '');
          if (!items.length) return;
          html += `<div class="export-section-title">${label}</div>`;
          html += items.map(it => `<div class="export-item">${it}</div>`).join('');
        });
      });
      html += '</div>';
    });
    setBody(html);
    setLoading(false);
  }

  function doPrint() {
    if (!body) { alert('먼저 조회하세요'); return; }
    document.body.classList.add('printing-report');
    window.print();
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-report'), { once: true });
  }

  function doCopy() {
    const el = document.getElementById('export-preview-body');
    if (!el || !el.textContent?.trim()) { alert('먼저 조회하세요'); return; }
    const text = (el as HTMLElement).innerText;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => alert('클립보드에 복사됐습니다'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      alert('클립보드에 복사됐습니다');
    }
  }

  return (
    <div>
      {/* 컨트롤 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>기간</span>
        <input type="date" value={from} onChange={e => setPeriodFrom(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }} />
        <span style={{ color: '#aaa' }}>~</span>
        <input type="date" value={to} onChange={e => setPeriodTo(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }} />
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>팀원</span>
        <select value={person} onChange={e => setPerson(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem' }}>
          <option value="">전체</option>
          {MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={doQuery} disabled={loading}
          style={{ padding: '8px 22px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}>
          {loading ? '조회 중...' : '조회'}
        </button>
        <button onClick={doPrint}
          style={{ padding: '8px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
          🖨 인쇄 / PDF
        </button>
        <button onClick={doCopy}
          style={{ padding: '8px 18px', background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>
          📋 텍스트 복사
        </button>
      </div>

      {/* 미리보기 */}
      <div id="export-print-area" style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8eaf0', padding: '24px 28px' }}>
        <div style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: 12, marginBottom: 16 }}>
          <div className="print-report-title" style={{ fontSize: '1.18rem', fontWeight: 700, color: '#1e293b' }}>{title}</div>
          <div className="print-report-period" style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 4 }}>{period}</div>
        </div>
        <div id="export-preview-body" dangerouslySetInnerHTML={{ __html: body }} />
      </div>
    </div>
  );
}

// ── 키워드 분석 탭 ──────────────────────────────────────
const KFREQ_FIELDS = [
  { id: 'all',      label: '전체 섹션' },
  { id: '주요완료',  label: '주요완료' },
  { id: '진행사항',  label: '진행사항' },
  { id: '주요회의',  label: '주요회의' },
  { id: '이슈리스크', label: '이슈리스크' },
  { id: '익일계획',  label: '익일계획' },
];

const KFREQ_STOP = new Set(['및','또는','관련','진행','완료','업무','작업','확인','검토','처리','등록','예정','요청','미팅','회의','참석','보고','대응','공유','협의','기안','승인','반려','수령','발송','전달','안내','파악','조율','제출','작성','등','를','을','이','가','에','의','은','는','로','에서','으로','과','와','대한','위해','위한','통해','따라','대해','하여','하고','하는','있는','없는','되는','으로써','부터','까지','보다','에게','에서의','에의','서의']);

function KfreqTab() {
  const [mkey, setMkey]     = useState(currentMkey());
  const [field, setField]   = useState('all');
  const [allRows, setAllRows] = useState<Awaited<ReturnType<typeof fetchReports>>>([]);

  useEffect(() => { fetchReports().then(setAllRows); }, []);

  function changeMonth(dir: number) {
    const [y, m] = mkey.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMkey(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  const { top20, top50 } = useMemo(() => {
    const monthRows = allRows.filter(r => r['날짜'] && r['날짜'].startsWith(mkey));
    const targets   = monthRows;
    const fields    = field === 'all' ? ['주요완료','주요회의','진행사항','이슈리스크','익일계획'] : [field];
    const freq: Record<string, number> = {};
    targets.forEach(r => {
      fields.forEach(f => {
        parseItems((r as Record<string, string>)[f] || '').forEach(line => {
          line.split(/[\s,·\-\/\(\)\[\]]+/).forEach(w => {
            const word = w.replace(/[^가-힣a-zA-Z0-9]/g, '').trim();
            if (word.length < 2 || KFREQ_STOP.has(word)) return;
            freq[word] = (freq[word] || 0) + 1;
          });
        });
      });
    });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    return { top20: sorted.slice(0, 20), top50: sorted.slice(0, 50) };
  }, [allRows, mkey, field]);

  const maxC = top20[0]?.[1] || 1;
  const [yr, mn] = mkey.split('-');
  const monthLabel = `${yr}년 ${parseInt(mn)}월`;

  return (
    <div>
      {/* 월 네비 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <button onClick={() => changeMonth(-1)}
          style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: '0.84rem', color: '#4f46e5', fontWeight: 600 }}>
          ← 이전 달
        </button>
        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#1e293b', minWidth: 100, textAlign: 'center' }}>{monthLabel}</span>
        <button onClick={() => changeMonth(1)}
          style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: '0.84rem', color: '#4f46e5', fontWeight: 600 }}>
          다음 달 →
        </button>
      </div>

      {/* 섹션 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {KFREQ_FIELDS.map(f => (
          <button key={f.id} onClick={() => setField(f.id)}
            style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: 20, fontSize: '0.83rem', fontWeight: field === f.id ? 700 : 400, cursor: 'pointer', background: field === f.id ? '#4f46e5' : '#fff', color: field === f.id ? '#fff' : '#374151', transition: 'all 0.15s' }}>
            {f.label}
          </button>
        ))}
      </div>

      {top20.length === 0
        ? <div className="empty-state">해당 월에 데이터가 없습니다</div>
        : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* 바 차트 */}
            <div style={{ flex: '1 1 340px', background: '#fff', borderRadius: 14, border: '1px solid #e8eaf0', padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', marginBottom: 14 }}>🏆 상위 키워드 Top 20</div>
              {top20.map(([word, cnt], i) => {
                const ratio = cnt / maxC;
                const color = TREND_COLORS[i % TREND_COLORS.length];
                return (
                  <div key={word} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    <span style={{ width: 58, fontSize: '0.81rem', textAlign: 'right', color: '#374151', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{word}</span>
                    <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 20, overflow: 'hidden' }}>
                      <div style={{ width: `${ratio * 100}%`, background: color, height: '100%', borderRadius: 4, transition: 'width 0.3s', opacity: 0.55 }} />
                    </div>
                    <span style={{ width: 24, fontSize: '0.79rem', color: '#64748b', textAlign: 'right', flexShrink: 0 }}>{cnt}</span>
                  </div>
                );
              })}
            </div>

            {/* 태그 클라우드 */}
            <div style={{ flex: '1 1 300px', background: '#fff', borderRadius: 14, border: '1px solid #e8eaf0', padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', marginBottom: 14 }}>☁️ 키워드 태그</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', lineHeight: 1.8 }}>
                {top50.map(([word, cnt], i) => {
                  const ratio = cnt / maxC;
                  const size  = (0.78 + ratio * 1.1).toFixed(2);
                  const color = TREND_COLORS[i % TREND_COLORS.length];
                  return (
                    <span key={word} title={`${cnt}회`}
                      style={{ fontSize: `${size}rem`, color, fontWeight: 700, cursor: 'default' }}>
                      {word}<sup style={{ fontSize: '0.5em', opacity: 0.75 }}>{cnt}</sup>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}

// ── 계획 vs 실적 탭 ─────────────────────────────────────
interface CmpStats {
  planTotal: number; planDone: number; planDoing: number; completionRate: number;
  actualDone: number; actualMeet: number; actualIssue: number; reportDays: number;
}

function PlanCmpTab() {
  const [mkey, setMkey]     = useState(currentMkey());
  const [person, setPerson] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats]   = useState<CmpStats | null>(null);
  const [planData, setPlanData] = useState<MonthPlanData | null>(null);
  const [rolledOver, setRolledOver] = useState<Set<string>>(new Set());

  function changeMonth(dir: number) {
    const [y, m] = mkey.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setMkey(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  const load = useCallback(async (m: string, p: string) => {
    if (!p) { setStats(null); setPlanData(null); return; }
    setLoading(true);
    const rows = await fetchReports();
    const pd   = loadMpData(m, p);
    const monthRows = rows.filter(r => r['날짜'] && r['날짜'].startsWith(m) && r['이름'] === p);

    let planTotal = 0, planDone = 0, planDoing = 0;
    Object.values(pd.grid).forEach(dayGrid =>
      Object.values(dayGrid).forEach(tasks =>
        tasks.forEach((t: PlanTask) => {
          planTotal++;
          if (t.status === 'done' || t.done) planDone++;
          else if (t.status === 'doing') planDoing++;
        })
      )
    );
    let actualDone = 0, actualMeet = 0, actualIssue = 0;
    monthRows.forEach(r => {
      actualDone  += parseItems(r['주요완료'] || '').length;
      actualMeet  += parseItems(r['주요회의'] || '').length;
      actualIssue += parseItems(r['이슈리스크'] || '').length;
    });
    const completionRate = planTotal > 0 ? Math.round(planDone / planTotal * 100) : 0;
    setStats({ planTotal, planDone, planDoing, completionRate, actualDone, actualMeet, actualIssue, reportDays: monthRows.length });
    setPlanData(pd);
    setRolledOver(new Set());
    setLoading(false);
  }, []);

  useEffect(() => { load(mkey, person); }, [mkey, person, load]);

  function rollover(cat: string, taskText: string, key: string) {
    const [y, mn] = mkey.split('-').map(Number);
    const nextDate = new Date(y, mn, 1);
    const nextMkey = `${nextDate.getFullYear()}-${String(nextDate.getMonth()+1).padStart(2,'0')}`;
    const nextData = loadMpData(nextMkey, person);
    if (!nextData.grid[cat]) nextData.grid[cat] = {};
    const nextDays = getMonthDays(nextMkey);
    const firstDay = nextDays.find(d => !d.isOther && d.date.getDay() !== 0 && d.date.getDay() !== 6);
    const dayKey   = firstDay?.key || nextDays.find(d => !d.isOther)?.key;
    if (!dayKey) return;
    if (!nextData.grid[cat][dayKey]) nextData.grid[cat][dayKey] = [];
    nextData.grid[cat][dayKey].push({ text: taskText, status: 'todo', done: false });
    saveMpData(nextMkey, person, nextData);
    supabase.from('monthly_plans')
      .upsert({ year_month: nextMkey, name: person, data: nextData, updated_at: new Date().toISOString() }, { onConflict: 'year_month,name' })
      .then(({ error }) => { if (error) console.warn('이월 저장 실패:', error.message); });
    setRolledOver(prev => new Set([...prev, key]));
  }

  const incompleteTasks = useMemo(() => {
    if (!planData) return [];
    const result: { cat: string; task: PlanTask; key: string }[] = [];
    Object.entries(planData.grid).forEach(([cat, dayGrid]) =>
      Object.values(dayGrid).forEach(tasks =>
        tasks.forEach((t: PlanTask, ti) => {
          if ((t.status !== 'done' && !t.done) && t.text?.trim())
            result.push({ cat, task: t, key: `${cat}-${ti}-${t.text}` });
        })
      )
    );
    return result;
  }, [planData]);

  const nextMonthLabel = (() => {
    const [y, mn] = mkey.split('-').map(Number);
    const d = new Date(y, mn, 1);
    return `${d.getFullYear()}년 ${d.getMonth()+1}월`;
  })();

  return (
    <>
      {/* 네비 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="cmp-nav-btn" onClick={() => changeMonth(-1)}>← 이전 달</button>
        <div className="cmp-month-lbl">{mkeyLabel(mkey)}</div>
        <button className="cmp-nav-btn" onClick={() => changeMonth(1)}>다음 달 →</button>
        <select value={person} onChange={e => setPerson(e.target.value)}
          style={{ border: '1px solid #e2e8f0', borderRadius: 20, padding: '5px 14px', fontSize: '0.8rem', color: '#555', background: '#fff', cursor: 'pointer', outline: 'none' }}>
          <option value="">팀원을 선택하세요</option>
          {MEMBERS.map(m => <option key={m.name}>{m.name}</option>)}
        </select>
      </div>

      {loading
        ? <div className="empty-state"><div className="loading-spinner" />불러오는 중...</div>
        : !stats
          ? <div className="empty-state">팀원을 선택하세요</div>
          : <>
            {/* 수치 요약 */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 10px rgba(15,23,42,0.07)', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a2e', marginBottom: 16 }}>{person}님 · {mkeyLabel(mkey)} 계획 vs 실적</div>
              <div className="dashboard-grid">
                <div className="dash-card"><div className="label">계획 전체</div><div className="value purple">{stats.planTotal}건</div></div>
                <div className="dash-card"><div className="label">계획 완료</div><div className="value green">{stats.planDone}건</div></div>
                <div className="dash-card"><div className="label">진행 중</div><div className="value">{stats.planDoing}건</div></div>
                <div className="dash-card"><div className="label">완료율</div><div className={`value ${stats.completionRate >= 80 ? 'green' : stats.completionRate >= 50 ? '' : 'red'}`}>{stats.completionRate}%</div></div>
              </div>
              <div className="dashboard-grid" style={{ marginTop: 12 }}>
                <div className="dash-card"><div className="label">보고 일수</div><div className="value purple">{stats.reportDays}일</div></div>
                <div className="dash-card"><div className="label">완료 업무</div><div className="value green">{stats.actualDone}건</div></div>
                <div className="dash-card"><div className="label">회의 참석</div><div className="value">{stats.actualMeet}건</div></div>
                <div className="dash-card"><div className="label">이슈 발굴</div><div className="value red">{stats.actualIssue}건</div></div>
              </div>
            </div>

            {/* 완료율 바 */}
            {stats.planTotal > 0
              ? <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 10px rgba(15,23,42,0.07)', marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#64748b', marginBottom: 8 }}>월 계획 완료율</div>
                  <div className="metric-bar-bg">
                    <div className={`metric-bar-fill progress-bar ${stats.completionRate >= 80 ? '' : stats.completionRate >= 50 ? 'mid' : 'low'}`} style={{ width: `${stats.completionRate}%` }} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 700, color: '#4f46e5', marginTop: 4 }}>{stats.completionRate}%</div>
                </div>
              : <div className="empty-state">{mkeyLabel(mkey)} 계획 데이터가 없습니다</div>
            }

            {/* 미달성 항목 이월 */}
            {incompleteTasks.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 14, padding: 20, boxShadow: '0 2px 10px rgba(15,23,42,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>
                    📋 미달성 항목 ({incompleteTasks.filter(t => !rolledOver.has(t.key)).length}건)
                  </div>
                  <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>→ {nextMonthLabel} 이월 가능</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {incompleteTasks.map(({ cat, task, key }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: rolledOver.has(key) ? '#f0fdf4' : '#f8fafc', borderRadius: 8, border: `1px solid ${rolledOver.has(key) ? '#bbf7d0' : '#e8eaf0'}` }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', background: task.status === 'doing' ? '#fef3c7' : '#f1f5f9', color: task.status === 'doing' ? '#d97706' : '#94a3b8', borderRadius: 10, flexShrink: 0 }}>
                        {task.status === 'doing' ? '진행 중' : '미착수'}
                      </span>
                      <span style={{ fontSize: '0.76rem', color: '#94a3b8', flexShrink: 0 }}>{cat}</span>
                      <span style={{ flex: 1, fontSize: '0.84rem', color: '#1e293b' }}>{task.text}</span>
                      {rolledOver.has(key)
                        ? <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, flexShrink: 0 }}>✅ 이월됨</span>
                        : <button onClick={() => rollover(cat, task.text || '', key)}
                            style={{ padding: '4px 12px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            → 다음 달 이월
                          </button>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
      }
    </>
  );
}

// ── 메인 Insights 컴포넌트 ──────────────────────────────
const TAB_LABELS: Record<string, string> = {
  'heatmap':  '🔥 업무 히트맵',
  'trend':    '📈 완료율 추이',
  'export':   '📤 리포트 내보내기',
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
      {activeTab === 'kfreq'    && <KfreqTab />}
      {activeTab === 'plan-cmp' && <PlanCmpTab />}
    </>
  );
}
