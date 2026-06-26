'use client';

import { useState, useEffect } from 'react';
import { lsGet, lsSet } from '@/lib/constants';

export function useMyName() {
  const [myName, setMyNameState] = useState<string>('');

  useEffect(() => {
    const stored = lsGet('my_name') || '';
    setMyNameState(stored);
  }, []);

  const setMyName = (name: string) => {
    lsSet('my_name', name);
    setMyNameState(name);
  };

  return { myName, setMyName };
}
