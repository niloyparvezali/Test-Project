import React from 'react';

export default function AvailabilitySummary({ total = 0, available = 0, pending = 0, booked = 0, loading = false }) {
  return (
    <div className="booking-availability" aria-label="Session availability summary" aria-live="polite">
      <div className="availability-total"><small>TOTAL</small><strong>{loading ? '—' : total}</strong></div>
      <div><small>AVAILABLE</small><strong>{loading ? '—' : available}</strong></div>
      <div><small>PENDING</small><strong>{loading ? '—' : pending}</strong></div>
      <div><small>BOOKED</small><strong>{loading ? '—' : booked}</strong></div>
    </div>
  );
}
