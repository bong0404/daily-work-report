'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ReportRow, LOCAL_DATA, parseItems } from '@/lib/constants';

export async function fetchReports(): Promise<ReportRow[]> {
  try {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .order('date', { ascending: true });
    if (error) throw error;
    return (data || []).map((r: Record<string, string>) => ({
      날짜:      r.date      || '',
      이름:      r.name      || '',
      부서:      r.dept      || '',
      주요완료:  r.done      || '',
      주요회의:  r.meeting   || '',
      진행사항:  r.progress  || '',
      이슈리스크: r.issue    || '',
      익일계획:  r.tomorrow  || '',
    }));
  } catch (e: unknown) {
    console.warn('Supabase fetch 실패, 로컬 데이터 사용:', (e as Error).message);
    return LOCAL_DATA;
  }
}

export function useReportFetch() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReports();
      setRows(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { rows, loading, error, load };
}

export type { ReportRow };
export { parseItems };
