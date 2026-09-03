import React from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';
import { money, timeLabel } from '../../utils/dateUtils';

export default function BookingSummary({ slot, advance }) {
  return <div className="booking-modal-summary"><span className="bt-eyebrow">YOUR SESSION</span><div className="booking-summary-main"><strong>{slot.date}</strong><span><CalendarDays /> {timeLabel(slot.start)} — {timeLabel(slot.end)}</span><span><Clock3 /> {slot.duration} Minutes</span></div><div className="booking-summary-money"><span><small>Total</small><strong>{money(slot.price)}</strong></span><span><small>Advance</small><strong>{money(advance)}</strong></span><span><small>Remaining</small><strong>{money(Math.max(0, slot.price - advance))}</strong></span></div></div>;
}
