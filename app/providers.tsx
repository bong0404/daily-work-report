'use client';

import { useState } from 'react';
import { SectionContext, SectionId, SECTION_DEFAULT_TABS } from '@/hooks/useSection';

export function Providers({ children }: { children: React.ReactNode }) {
  const [section, setSection] = useState<SectionId>('dashboard');
  const [tab, setTab] = useState<string>('');

  const handleSetSection = (s: SectionId) => {
    setSection(s);
    setTab(SECTION_DEFAULT_TABS[s]);
  };

  return (
    <SectionContext.Provider value={{ section, setSection: handleSetSection, tab, setTab }}>
      {children}
    </SectionContext.Provider>
  );
}
