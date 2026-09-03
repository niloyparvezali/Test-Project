import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { displayDate, timeLabel } from '../../utils/dateUtils';

export default function BookingSuccess({ slot, onClose }) {
  return (
    <div className="booking-wizard-success" role="status" aria-live="polite">
      <CheckCircle2 aria-hidden="true" />
      <span className="bt-eyebrow">BOOKING REQUEST SENT</span>
      <h3>Your request is now pending.</h3>
      <div className="booking-success-slot">
        <small>YOUR SLOT</small>
        <strong>{displayDate(slot.startDate || slot.date, { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
        <span>{timeLabel(slot.start)} – {timeLabel(slot.end)}</span>
        <b>PENDING</b>
      </div>
      <p>Your slot will be confirmed after the turf admin verifies the payment.</p>
      <button type="button" className="bt-btn bt-btn-primary booking-success-close" onClick={onClose}>Done</button>
    </div>
  );
}
