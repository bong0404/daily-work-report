'use client';

import { useSectionContext } from '@/hooks/useSection';
import { SECTION_TITLES } from '@/lib/constants';

export function Topbar() {
  const { section } = useSectionContext();
  const title = SECTION_TITLES[section] ?? '';

  return (
    <div className="topbar">
      <span className="topbar-title" id="topbar-title">{title}</span>
    </div>
  );
}
