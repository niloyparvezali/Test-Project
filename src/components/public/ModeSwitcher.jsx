import React from 'react';
import { Home, CalendarDays } from 'lucide-react';

export default function ModeSwitcher({ route, go }) {
  const booking = route === '/book' || route === '/book/';
  return (
    <div className="mode-switcher" role="navigation" aria-label="Public app modes">
      <div className={`mode-switcher-track ${booking ? 'is-booking' : ''}`} aria-hidden="true" />
      <button
        type="button"
        className={`mode-switcher-item ${!booking ? 'active' : ''}`}
        aria-current={!booking ? 'page' : undefined}
        aria-label="Go to Home"
        onClick={() => { if (booking) go('/'); }}
      >
        <Home aria-hidden="true" />
        <span>Home</span>
      </button>
      <button
        type="button"
        className={`mode-switcher-item ${booking ? 'active' : ''}`}
        aria-current={booking ? 'page' : undefined}
        aria-label="Book a Slot"
        onClick={() => { if (!booking) go('/book'); }}
      >
        <CalendarDays aria-hidden="true" />
        <span>Book a Slot</span>
      </button>
    </div>
  );
}
