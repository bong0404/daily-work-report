'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useSectionContext } from '@/hooks/useSection';
import { MyNameModal } from '@/components/ui/MyNameModal';
import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('@/components/sections/Dashboard').then(m => ({ default: m.Dashboard })));
const Report    = dynamic(() => import('@/components/sections/Report').then(m => ({ default: m.Report })));
const Plan      = dynamic(() => import('@/components/sections/Plan').then(m => ({ default: m.Plan })));
const Insights  = dynamic(() => import('@/components/sections/Insights').then(m => ({ default: m.Insights })));
const Lounge    = dynamic(() => import('@/components/sections/Lounge').then(m => ({ default: m.Lounge })));

export function AppShell() {
  const { section } = useSectionContext();
  const [nameModalOpen, setNameModalOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar onOpenNameModal={() => setNameModalOpen(true)} />

      <div className="app-body">
        <Topbar />
        <main>
          {section === 'dashboard' && <Dashboard />}
          {section === 'report'    && <Report />}
          {section === 'plan'      && <Plan />}
          {section === 'admin'     && <Insights />}
          {section === 'lounge'    && <Lounge />}
        </main>
      </div>

      <MyNameModal open={nameModalOpen} onClose={() => setNameModalOpen(false)} />
    </div>
  );
}
