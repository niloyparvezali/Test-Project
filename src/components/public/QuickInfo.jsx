import React from 'react';
import { CalendarClock, Clock3, Zap } from 'lucide-react';

function valueOrComingSoon(value) {
  return String(value || '').trim() ? value : 'Coming Soon…';
}

export default function QuickInfo({ hours, duration, availability }) {
  const liveAvailability =
    availability == null
      ? 'Live availability'
      : `${availability} ${availability === 1 ? 'slot' : 'slots'} open today`;

  return (
    <section className="bt-quick-wrap" aria-labelledby="snapshot-title">
      <div className="container-public">
        <div className="bt-section-label-row bt-snapshot-label">
          <span id="snapshot-title" className="bt-eyebrow">TURF SNAPSHOT</span>
          <span className="bt-section-rule" />
        </div>

        <div className="bt-quick-grid">
          <div className="bt-quick-item">
            <span className="bt-quick-icon"><Clock3 aria-hidden="true" /></span>
            <div>
              <small>Operating Hours</small>
              <strong>{valueOrComingSoon(hours)}</strong>
            </div>
          </div>

          <div className="bt-quick-item">
            <span className="bt-quick-icon"><CalendarClock aria-hidden="true" /></span>
            <div>
              <small>Session Length</small>
              <strong>{duration ? `${duration} Minutes` : 'Coming Soon…'}</strong>
            </div>
          </div>

          <div className="bt-quick-item bt-quick-live">
            <span className="bt-quick-icon"><Zap aria-hidden="true" /></span>
            <div>
              <small>Live Availability</small>
              <strong>{liveAvailability}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
