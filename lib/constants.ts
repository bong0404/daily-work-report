// ── 팀원 목록 ─────────────────────────────────────────
export interface Member {
  name: string;
  dept: string;
}

export const MEMBERS: Member[] = [
  { name: '박희진', dept: '경영지원실/실장' },
  { name: '설한영', dept: '피플팀/팀장' },
  { name: '정연환', dept: '피플팀' },
  { name: '박수정', dept: '재무회계팀' },
  { name: '박경현', dept: '커넥트팀/팀장' },
  { name: '유준우', dept: '커넥트팀' },
  { name: '유하연', dept: '수입팀/팀장' },
];

export const EXECUTIVES: Member[] = [
  { name: '이지선', dept: '임원' },
  { name: '조맹섭', dept: '임원' },
  { name: '김청진', dept: '이사' },
];

export const ALL_MEMBERS: Member[] = [...EXECUTIVES, ...MEMBERS];

// ── 섹션/탭 제목 ──────────────────────────────────────
export const SECTION_TITLES: Record<string, string> = {
  dashboard: '🏠 현황판',
  report:    '📋 업무보고',
  plan:      '📅 업무계획',
  admin:     '📊 인사이트',
  lounge:    '💬 라운지',
};

// ── 업무보고 서브탭 ────────────────────────────────────
export const REPORT_TABS = [
  { id: 'write',        label: '데일리보고 작성' },
  { id: 'by-date',      label: '날짜별 보기' },
  { id: 'by-person',    label: '인물별 보기' },
  { id: 'my-summary',   label: '내 업무 요약' },
  { id: 'issues',       label: '이슈 모아보기' },
  { id: 'issue-track',  label: '이슈 트래킹' },
  { id: 'search',       label: '키워드 검색' },
  { id: 'weekly',       label: '주간 요약' },
];

// ── 업무계획 서브탭 ────────────────────────────────────
export const PLAN_TABS = [
  { id: 'weekly-plan',   label: '타임라인 작성' },
  { id: 'person-plan',   label: '인물별 조회' },
  { id: 'team-overview', label: '팀원 현황' },
];

// ── 인사이트 서브탭 ────────────────────────────────────
export const ADMIN_TABS = [
  { id: 'heatmap',   label: '업무 히트맵' },
  { id: 'trend',     label: '완료율 추이' },
  { id: 'export',    label: '리포트 내보내기' },
  { id: 'feedback',  label: '피드백' },
  { id: 'kfreq',     label: '키워드 분석' },
  { id: 'plan-cmp',  label: '계획 vs 실적' },
];

// ── 아바타 색상 ───────────────────────────────────────
export const AVATAR_COLORS = [
  '#4f46e5','#22c55e','#f97316','#6366f1','#ec4899','#14b8a6','#a855f7',
];

export function avatarColor(name: string): string {
  let code = 0;
  for (const c of (name || '')) code += c.charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// ── 보고서 섹션 이름 ──────────────────────────────────
export const REPORT_SECTION_KEYS = [
  '주요완료', '주요회의', '진행사항', '이슈리스크', '익일계획',
] as const;

// ── 대한민국 공휴일 (2025~2026) ───────────────────────
export const KR_HOLIDAYS: Record<string, { name: string; sub?: boolean }> = {
  '2025-01-01': { name: '신정' },
  '2025-01-28': { name: '설날연휴' },
  '2025-01-29': { name: '설날' },
  '2025-01-30': { name: '설날연휴' },
  '2025-03-01': { name: '삼일절' },
  '2025-03-03': { name: '대체공휴일', sub: true },
  '2025-05-05': { name: '어린이날·부처님오신날' },
  '2025-06-06': { name: '현충일' },
  '2025-08-15': { name: '광복절' },
  '2025-10-03': { name: '개천절·추석' },
  '2025-10-04': { name: '추석' },
  '2025-10-05': { name: '추석연휴' },
  '2025-10-06': { name: '대체공휴일', sub: true },
  '2025-10-09': { name: '한글날' },
  '2025-12-25': { name: '크리스마스' },
  '2026-01-01': { name: '신정' },
  '2026-01-28': { name: '설날연휴' },
  '2026-01-29': { name: '설날' },
  '2026-01-30': { name: '설날연휴' },
  '2026-03-01': { name: '삼일절' },
  '2026-03-02': { name: '대체공휴일', sub: true },
  '2026-05-05': { name: '어린이날' },
  '2026-05-24': { name: '부처님오신날' },
  '2026-05-25': { name: '대체공휴일', sub: true },
  '2026-06-06': { name: '현충일' },
  '2026-07-17': { name: '제헌절' },
  '2026-08-15': { name: '광복절' },
  '2026-08-17': { name: '대체공휴일', sub: true },
  '2026-09-24': { name: '추석연휴' },
  '2026-09-25': { name: '추석' },
  '2026-09-26': { name: '추석연휴' },
  '2026-10-03': { name: '개천절' },
  '2026-10-05': { name: '대체공휴일', sub: true },
  '2026-10-09': { name: '한글날' },
  '2026-12-25': { name: '크리스마스' },
  '2026-12-28': { name: '대체공휴일', sub: true },
};

export function getHoliday(dateObj: Date) {
  const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
  return KR_HOLIDAYS[key] || null;
}

// ── 날짜 유틸 ─────────────────────────────────────────
export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMkey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

export function mkeyLabel(mkey: string): string {
  const [y, m] = mkey.split('-').map(Number);
  return `${y}년 ${m}월`;
}

// ── 보고서 항목 파싱 ──────────────────────────────────
export function parseItems(text: string): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((s: string) => s.trim())
    .filter(Boolean);
}

// ── localStorage 래퍼 ────────────────────────────────
let _lsMem: Record<string, string> = {};
let _lsReal = false;

if (typeof window !== 'undefined') {
  try {
    localStorage.setItem('__test__', '1');
    localStorage.removeItem('__test__');
    _lsReal = true;
  } catch (_e) {
    _lsReal = false;
  }
}

export function lsGet(k: string): string | null {
  if (typeof window === 'undefined') return null;
  if (_lsReal) return localStorage.getItem(k);
  return _lsMem[k] ?? null;
}

export function lsSet(k: string, v: string): void {
  if (typeof window === 'undefined') return;
  if (_lsReal) localStorage.setItem(k, v);
  else _lsMem[k] = v;
}

export function lsRemove(k: string): void {
  if (typeof window === 'undefined') return;
  if (_lsReal) localStorage.removeItem(k);
  else delete _lsMem[k];
}

export function lsKeys(): string[] {
  if (typeof window === 'undefined') return [];
  if (_lsReal) return Object.keys(localStorage);
  return Object.keys(_lsMem);
}

// ── 月 계획 데이터 구조 ───────────────────────────────
export interface PlanTask {
  text: string;
  done: boolean;
  status?: 'todo' | 'doing' | 'done';
  color?: string | null;
  starred?: boolean;
  completedAt?: string;
}

export interface MonthPlanData {
  categories: string[];
  grid: Record<string, Record<string, PlanTask[]>>;
  memo: Record<string, string>;
  keyWork?: string;
  issue?: string;
  monthPlan?: string;
}

export function loadMpData(mkey: string, person: string): MonthPlanData {
  if (!person) return { categories: ['공통','인사(HR)','총무(GA)','기타'], grid: {}, memo: {} };
  const raw = lsGet(`mplan_${person}_${mkey}`);
  if (raw) {
    try { return JSON.parse(raw); } catch (_e) { /* fall through */ }
  }
  return { categories: ['공통','인사(HR)','총무(GA)','기타'], grid: {}, memo: {} };
}

export function saveMpData(mkey: string, person: string, data: MonthPlanData): void {
  if (!person) return;
  lsSet(`mplan_${person}_${mkey}`, JSON.stringify(data));
}

// ── 月 달력 일 목록 ───────────────────────────────────
export interface DayObj {
  key: string;
  label: string;
  dow: string;
  date: Date;
  isOther: boolean;
}

const DOW_KR = ['일','월','화','수','목','금','토'];

export function getMonthDays(mkey: string): DayObj[] {
  const [year, month] = mkey.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month, 0);

  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));

  const endDate = new Date(lastDay);
  if (endDate.getDay() !== 0) {
    endDate.setDate(endDate.getDate() + (7 - endDate.getDay()));
  }

  const days: DayObj[] = [];
  let cur = new Date(startDate);
  let keyIdx = 1;
  while (cur <= endDate) {
    const isOther = cur.getMonth() + 1 !== month;
    days.push({
      key:     String(keyIdx),
      label:   isOther ? `${cur.getMonth()+1}/${cur.getDate()}일` : `${cur.getDate()}일`,
      dow:     DOW_KR[cur.getDay()],
      date:    new Date(cur),
      isOther: isOther
    });
    cur.setDate(cur.getDate() + 1);
    keyIdx++;
  }
  return days;
}

// ── 로컬 데이터 (Supabase 연동 전 임시) ──────────────
export type ReportRow = {
  날짜: string;
  이름: string;
  부서: string;
  주요완료: string;
  주요회의: string;
  진행사항: string;
  이슈리스크: string;
  익일계획: string;
};

export const LOCAL_DATA: ReportRow[] = [
  { 날짜:'2026-06-01', 이름:'유준우', 부서:'커넥트팀', 주요완료:'온라인 몰 주문 건 출고 작업(카카오 선물하기 GWP 수기 등록)\n매장 테스트 사용 건 전환 처리', 주요회의:'', 진행사항:'매장 발주 매크로 파일 보완 작업 중\n월별 물류비 비교 파일 작업 중', 이슈리스크:'', 익일계획:'' },
  { 날짜:'2026-06-01', 이름:'박경현', 부서:'커넥트팀/팀장', 주요완료:'매장 발주 출고 진행\n외부 온라인 채널 발주 등록\n카카오 선물하기 유통가공 관련 파스토 소통', 주요회의:'독서 모임 참석\n경영지원실 주간 회의 참석', 진행사항:'', 이슈리스크:'', 익일계획:'' },
  { 날짜:'2026-06-01', 이름:'박수정', 부서:'재무회계팀', 주요완료:'지출품의 작성 및 지출 등록 진행\n4·5월 급여 관련 자료 전달 요청', 주요회의:'경지실 주간회의 참석', 진행사항:'', 이슈리스크:'', 익일계획:'' },
  { 날짜:'2026-06-01', 이름:'박희진', 부서:'경영지원실/실장', 주요완료:'피플팀 업무현황 보고 수신\nERP 도입비교 보고\n이력서 스크리닝', 주요회의:'독서모임 참석\n주간회의 참석', 진행사항:'', 이슈리스크:'', 익일계획:'' },
  { 날짜:'2026-06-01', 이름:'설한영', 부서:'피플팀/팀장', 주요완료:'교육비 지급 건 팔로업\n근무 규정 노티 자료 보고\n4월 퇴직자 퇴직연금 지급 건 팔로업\n6월 복지포인트 지급 기안 상신', 주요회의:'독서모임 참석\n경지회의 참석\n주간회의 참석', 진행사항:'', 이슈리스크:'', 익일계획:'' },
  { 날짜:'2026-06-08', 이름:'박희진', 부서:'경영지원실/실장', 주요완료:'지점 선물포장 출고 관련 미팅\n기안서 검토 및 승인·반려\nAI 교육업체 계약서 초안 작성', 주요회의:'독서모임 참석\n경지회의 참석\n주간회의 진행', 진행사항:'', 이슈리스크:'', 익일계획:'' },
  { 날짜:'2026-06-08', 이름:'설한영', 부서:'피플팀/팀장', 주요완료:'인센티브·파트타이머 기안 검토 및 승인\n5월 원천세 신고\n채널톡 비즈니스 인증 요청 건 팔로업', 주요회의:'독서모임 참석\n경지회의 참석', 진행사항:'', 이슈리스크:'', 익일계획:'' },
  { 날짜:'2026-06-15', 이름:'박희진', 부서:'경영지원실/실장', 주요완료:'이력서 검토 및 일정 진행 요청\nAI 교육업체 요청사항 공지\n팀원 면담', 주요회의:'독서모임 참석\n주간회의 참석', 진행사항:'', 이슈리스크:'', 익일계획:'' },
  { 날짜:'2026-06-22', 이름:'박희진', 부서:'경영지원실/실장', 주요완료:'조직개편 발표\n예수금 계정 대사\n회계/총무 인터뷰 일정 확정 요청', 주요회의:'독서모임 참석\n경지 회의 참석', 진행사항:'', 이슈리스크:'', 익일계획:'' },
  { 날짜:'2026-06-23', 이름:'박희진', 부서:'경영지원실/실장', 주요완료:'업무/일정 정리\nAI 교육 리뷰 미팅\n회계팀장 채용 면접 진행', 주요회의:'AI 교육 참석\n플레이오토 미팅 참석', 진행사항:'', 이슈리스크:'', 익일계획:'' },
];
