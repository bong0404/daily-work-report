'use client';

import { useSectionContext, SectionId } from '@/hooks/useSection';
import { useMyName } from '@/hooks/useMyName';
import { avatarColor, MEMBERS, REPORT_TABS, PLAN_TABS, ADMIN_TABS } from '@/lib/constants';
import { useState } from 'react';

interface NavSubItem { id: string; label: string; }

function NavSubList({ items, sectionId }: { items: NavSubItem[]; sectionId: SectionId }) {
  const { tab, setTab, section, setSection } = useSectionContext();
  return (
    <div className="nav-sub open">
      {items.map(item => (
        <button
          key={item.id}
          className={`nav-sub-item ${section === sectionId && tab === item.id ? 'active' : ''}`}
          onClick={() => { setSection(sectionId); setTab(item.id); }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Sidebar({ onOpenNameModal }: { onOpenNameModal: () => void }) {
  const { section, setSection, setTab } = useSectionContext();
  const { myName } = useMyName();

  const navColor = avatarColor(myName);

  const handleNav = (s: SectionId) => { setSection(s); };

  return (
    <aside className="sidebar" id="sidebar">
      {/* Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="brand-icon">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="7.5" cy="7.5" r="6" stroke="white" strokeWidth="1.4"/>
              <path d="M5 5h3.2c.96 0 1.8.8 1.8 1.8 0 1-.84 1.7-1.8 1.7H5V5z" fill="white"/>
              <path d="M5 8.5l2.8 3" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="brand-text-block">
            <div className="brand-name-main">LA ROSÉE</div>
            <div className="brand-paris">KOREA</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {/* 현황판 */}
        <button
          className={`nav-item ${section === 'dashboard' ? 'active' : ''}`}
          id="nav-dashboard"
          onClick={() => handleNav('dashboard')}
        >
          <span className="nav-icon">🏠</span> 현황판
        </button>

        <div className="nav-group-label">업무 관리</div>

        {/* 업무보고 */}
        <button
          className={`nav-item open ${section === 'report' ? 'active' : ''}`}
          id="nav-report"
          onClick={() => handleNav('report')}
        >
          <span className="nav-icon">📋</span> 업무보고
          <span className="nav-chevron" style={{ display: 'none' }}>▶</span>
        </button>
        <NavSubList items={REPORT_TABS} sectionId="report" />

        {/* 업무계획 */}
        <button
          className={`nav-item open ${section === 'plan' ? 'active' : ''}`}
          id="nav-plan"
          onClick={() => handleNav('plan')}
        >
          <span className="nav-icon">📅</span> 업무계획
          <span className="nav-chevron" style={{ display: 'none' }}>▶</span>
        </button>
        <NavSubList items={PLAN_TABS} sectionId="plan" />

        <div className="nav-group-label">분석</div>

        {/* 인사이트 */}
        <button
          className={`nav-item open ${section === 'admin' ? 'active' : ''}`}
          id="nav-admin"
          onClick={() => handleNav('admin')}
        >
          <span className="nav-icon">📊</span> 인사이트
          <span className="nav-chevron" style={{ display: 'none' }}>▶</span>
        </button>
        <NavSubList items={ADMIN_TABS} sectionId="admin" />

        <div className="nav-group-label">팀</div>

        {/* 라운지 */}
        <button
          className={`nav-item ${section === 'lounge' ? 'active' : ''}`}
          id="nav-lounge"
          onClick={() => handleNav('lounge')}
        >
          <span className="nav-icon">💬</span> 라운지
        </button>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="sidebar-name-btn" onClick={onOpenNameModal} title="내 이름 설정">
          <span
            style={{
              width: 26, height: 26, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.68rem', fontWeight: 700, color: '#fff',
              background: navColor, flexShrink: 0,
            }}
          >
            {myName ? myName[0] : '?'}
          </span>
          <span className="sidebar-name-label">{myName || '내 이름 설정'}</span>
        </button>
      </div>
    </aside>
  );
}
