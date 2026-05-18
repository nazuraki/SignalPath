import { useEffect, useState } from 'react';

export function useIsDark(): boolean {
  const [dark, setDark] = useState(
    () => document.documentElement.getAttribute('data-theme') !== 'light',
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.getAttribute('data-theme') !== 'light');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return dark;
}
