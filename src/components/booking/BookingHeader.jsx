import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function BookingHeader({ go }) {
  return (
    <div className="booking-page-header">
      <button type="button" className="booking-back" onClick={() => go('/')}>
        <ArrowLeft aria-hidden="true" />
        <span>Back to Home</span>
      </button>

      <div className="booking-heading-block">
        <span className="bt-eyebrow">BOOK YOUR SLOT</span>
        <h1>Find your next game.</h1>
        <p>Pick a date, choose a session, and select an available slot.</p>
      </div>
    </div>
  );
}
