'use client';

import { useState } from 'react';
import { useMyName } from '@/hooks/useMyName';
import { MEMBERS } from '@/lib/constants';

interface Props { open: boolean; onClose: () => void; }

export function MyNameModal({ open, onClose }: Props) {
  const { myName, setMyName } = useMyName();
  const [selected, setSelected] = useState(myName);

  const handleSave = () => {
    if (selected) { setMyName(selected); onClose(); }
  };

  if (!open) return null;

  return (
    <div
      style={{
        display: 'flex', position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.3)', zIndex: 1000,
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 14, padding: '28px 28px 24px',
        width: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 16 }}>
          내 이름 설정
        </div>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={{
            width: '100%', padding: '9px 12px', border: '1px solid #e8eaf0',
            borderRadius: 8, fontSize: '0.85rem', color: '#333', marginBottom: 18,
          }}
        >
          <option value="">선택하세요</option>
          {MEMBERS.map(m => (
            <option key={m.name} value={m.name}>{m.name} ({m.dept})</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', border: '1px solid #e8eaf0', borderRadius: 8,
              background: '#fff', fontSize: '0.85rem', color: '#888', cursor: 'pointer',
            }}
          >취소</button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 20px', border: 'none', borderRadius: 8,
              background: '#4f46e5', color: '#fff', fontSize: '0.85rem',
              fontWeight: 700, cursor: 'pointer',
            }}
          >저장</button>
        </div>
      </div>
    </div>
  );
}
