import React, { useEffect, useMemo, useState } from 'react';
import { Menu, X, ChevronRight } from 'lucide-react';
import { BRAND_NAME } from '../../config/brand';
import { PUBLIC_NAVIGATION } from '../../config/publicNavigation';
import { useScrollSpy } from '../../hooks/useScrollSpy';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

export default function PublicHeader({ go, route = '/', sectionIds = [] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const scrolled = useHeaderScroll();
  const visibleSections = useMemo(() => new Set(sectionIds), [sectionIds]);
  const scrollIds = useMemo(
    () => PUBLIC_NAVIGATION.filter(item => item.type === 'section' && visibleSections.has(item.target)).map(item => item.target),
    [visibleSections]
  );
  const activeSection = useScrollSpy(scrollIds);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = e => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const items = PUBLIC_NAVIGATION.filter(item =>
    item.type === 'route' || visibleSections.has(item.target)
  );

  const isActive = item => {
    if (item.type === 'section') return activeSection === item.target;
    const onRoute = item.href === '/' ? route === '/' || route === '' : route.startsWith(item.href);
    return onRoute && !activeSection;
  };

  const activate = item => {
    setMenuOpen(false);

    if (item.type === 'route') {
      if (route !== item.href) go(item.href);
      return;
    }

    if (scrollToId(item.target)) return;

    if (item.target === 'book' || item.target === 'gallery' || item.target === 'location') {
      go('/');
      setTimeout(() => scrollToId(item.target), 90);
    }
  };

  return (
    <header className={`public-nav public-nav-v2 ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="public-nav-inner">
        <button className="brand public-brand" onClick={() => { setMenuOpen(false); go('/'); }} aria-label={`${BRAND_NAME} home`}>
          <span className="brand-ball">⚽</span>
          <span>{BRAND_NAME}</span>
        </button>

        <nav className="public-desktop-links" aria-label="Primary navigation">
          {items.filter(item => !['contact','payment','facilities','rules'].includes(item.id)).map(item => (
            <button key={item.id} className={isActive(item) ? 'active' : ''} onClick={() => activate(item)}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="public-nav-actions">
          {visibleSections.has('book') && (
            <button className="primary public-book-nav" onClick={() => activate(PUBLIC_NAVIGATION.find(item => item.id === 'book'))}>
              Book Now <ChevronRight />
            </button>
          )}
          <button
            className="public-menu"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      <div className={`public-mobile-shell ${menuOpen ? 'open' : ''}`}>
        <button className="public-mobile-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
        <nav id="public-mobile-menu" className="public-mobile-nav-v2" aria-label="Mobile navigation">
          <div className="mobile-nav-label">EXPLORE {BRAND_NAME.toUpperCase()}</div>
          {items.map(item => (
            <button key={item.id} className={isActive(item) ? 'active' : ''} onClick={() => activate(item)}>
              <span>{item.label}</span>
              <ChevronRight />
            </button>
          ))}
          {visibleSections.has('book') && (
            <button className="primary full mobile-book-cta" onClick={() => activate(PUBLIC_NAVIGATION.find(item => item.id === 'book'))}>
              Book Your Slot <ChevronRight />
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
