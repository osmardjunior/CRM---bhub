import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'notification-sound-enabled';

export function useNotificationSound() {
  const [enabled, setEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/sounds/notification.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  const play = useCallback(() => {
    if (!enabled || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled(prev => !prev);
  }, []);

  return { enabled, toggle, play };
}
