import React from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';
import { displayDate, money, timeLabel } from '../../utils/dateUtils';

export default function SlotSummary({ slot, advance }) {
  return (
    <div className="booking-modal-slot-summary">
      <span className="bt-eyebrow">YOUR SLOT</span>
      <div className="booking-modal-slot-main">
        <strong>{displayDate(slot.startDate || slot.date, { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
        <span><CalendarDays aria-hidden="true" /> {timeLabel(slot.start)} – {timeLabel(slot.end)}</span>
        <span><Clock3 aria-hidden="true" /> {slot.duration} Minutes</span>
      </div>
      <div className="booking-modal-slot-money">
        <div><small>Total</small><strong>{money(slot.price)}</strong></div>
        <div><small>Advance</small><strong>{money(advance)}</strong></div>
        <div><small>Remaining</small><strong>{money(Math.max(0, slot.price - advance))}</strong></div>
      </div>
    </div>
  );
}
