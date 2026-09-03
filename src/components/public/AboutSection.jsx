import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function AboutSection({ turf = {} }) {
  const facilities = Array.isArray(turf.facilities)
    ? turf.facilities.filter(Boolean).map(item => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];

  const description =
    String(turf.description || '').trim() ||
    'Bason Turf City provides dedicated playing space for friendly matches, team sessions, and competitive football. The focus is a well-organized venue where players can meet, play, and make the most of their booked session.';

  return (
    <section id="about" className="bt-section bt-about-section">
      <div className="container-public bt-section-grid">
        <div className="about-home-copy">
          <span className="bt-eyebrow">ABOUT THE TURF</span>
          <h2>A dedicated venue for regular football sessions, team matches, and competitive play.</h2>
          <p>{description}</p>
        </div>

        <div className="bt-facilities">
          <div className="bt-mini-heading">PLAYER FACILITIES</div>
          {facilities.length ? (
            facilities.map((item, index) => (
              <div className="bt-facility" key={`${item}-${index}`}>
                <CheckCircle2 aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))
          ) : (
            <div className="bt-empty-line">Coming Soon…</div>
          )}
        </div>
      </div>
    </section>
  );
}
