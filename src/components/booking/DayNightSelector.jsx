import React from 'react';
import { Moon, Sun } from 'lucide-react';

export default function DayNightSelector({ shift, setShift }) {
  return (
    <div className="booking-control-card booking-session-card">
      <div className="booking-shift" role="tablist" aria-label="Session type selector">
        <button
          type="button"
          className={shift === 'day' ? 'active' : ''}
          onClick={() => setShift('day')}
          role="tab"
          aria-selected={shift === 'day'}
        >
          <Sun aria-hidden="true" />
          <span>Day</span>
        </button>

        <button
          type="button"
          className={shift === 'night' ? 'active' : ''}
          onClick={() => setShift('night')}
          role="tab"
          aria-selected={shift === 'night'}
        >
          <Moon aria-hidden="true" />
          <span>Night</span>
        </button>
      </div>

      <p>Uses the turf’s configured day/night boundary.</p>
    </div>
  );
}

