import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function FinalBookingCTA({ go }) {
  return (
    <section className="bt-final-cta" aria-labelledby="ready-title">
      <div className="container-public bt-final-cta-inner">
        <div>
          <span className="bt-eyebrow">READY FOR YOUR NEXT SESSION?</span>
          <h2 id="ready-title">Choose your date, select an available session, and submit your booking request in a few simple steps.</h2>
        </div>
        <button type="button" className="bt-btn bt-btn-primary bt-btn-large" onClick={() => go('/book')}>
          Book Your Slot <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
