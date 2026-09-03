import { useEffect, useState } from 'react';

export function useScrollSpy(ids = []) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const validIds = ids.filter(Boolean);
    if (!validIds.length || typeof IntersectionObserver === 'undefined') return undefined;

    const elements = validIds
      .map(id => document.getElementById(id))
      .filter(Boolean);

    if (!elements.length) return undefined;

    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
    }, {
      root: null,
      rootMargin: '-96px 0px -55% 0px',
      threshold: [0.12, 0.3, 0.55],
    });

    elements.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [ids.join('|')]);

  return activeId;
}
