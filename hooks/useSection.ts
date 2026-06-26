'use client';

import { createContext, useContext } from 'react';

export type SectionId = 'dashboard' | 'report' | 'plan' | 'admin' | 'lounge';

export interface SectionContextValue {
  section:    SectionId;
  setSection: (s: SectionId) => void;
  tab:        string;
  setTab:     (t: string) => void;
}

export const SectionContext = createContext<SectionContextValue>({
  section:    'dashboard',
  setSection: () => {},
  tab:        '',
  setTab:     () => {},
});

export function useSectionContext() {
  return useContext(SectionContext);
}

// Default first tab per section
export const SECTION_DEFAULT_TABS: Record<SectionId, string> = {
  dashboard: '',
  report:    'write',
  plan:      'weekly-plan',
  admin:     'heatmap',
  lounge:    '',
};
