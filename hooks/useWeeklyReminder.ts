'use client';
import { useEffect } from 'react';

const LS_KEY = 'weekly_reminder_last_notified';

export async function fireReminderNotification(): Promise<string> {
  if (!('Notification' in window)) return '미지원 브라우저';

  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return '권한 거부됨';
  }

  if (Notification.permission === 'denied') return '차단됨';
  if (Notification.permission !== 'granted') return `권한 상태: ${Notification.permission}`;

  new Notification('📅 차주 타임라인 작성 시간!', {
    body: '퇴근 전 다음 주 타임라인을 작성해주세요 ✅',
    icon: '/favicon.ico',
  });
  return 'ok';
}

export function useWeeklyReminder() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    function check() {
      const now = new Date();
      const isFriday = now.getDay() === 5;
      const isTargetTime = now.getHours() === 17 && now.getMinutes() === 0;

      if (!isFriday || !isTargetTime) return;

      const today = now.toISOString().slice(0, 10);
      if (localStorage.getItem(LS_KEY) === today) return;

      if (Notification.permission === 'granted') {
        new Notification('📅 차주 타임라인 작성 시간!', {
          body: '퇴근 전 다음 주 타임라인을 작성해주세요 ✅',
          icon: '/favicon.ico',
          tag: 'weekly-timeline-reminder',
        });
        localStorage.setItem(LS_KEY, today);
      }
    }

    // 매 분 정각에 체크 (다음 분 00초에 맞춰 시작)
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      check();
      interval = setInterval(check, 60_000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);
}
