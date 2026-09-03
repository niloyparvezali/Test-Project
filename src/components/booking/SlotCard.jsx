import React from 'react';
import { ArrowRight, CircleDot, Clock3, LockKeyhole } from 'lucide-react';
import { money, timeLabel } from '../../utils/dateUtils';

const statusMeta = {
  available: { label: 'AVAILABLE', icon: CircleDot },
  pending: { label: 'PENDING', icon: Clock3 },
  booked: { label: 'BOOKED', icon: LockKeyhole },
};

export default function SlotCard({ slot, price, status, onBook }) {
  const meta = statusMeta[status] || statusMeta.available;
  const StatusIcon = meta.icon;
  const isBooked = status === 'booked';
  const isPending = status === 'pending';

  return (
    <article className={`booking-slot-card ${status}`}>
      <div className="booking-slot-time">
        <strong>{timeLabel(slot.start)}</strong>
        <span>— {timeLabel(slot.end)}</span>
      </div>
      <div className="booking-slot-meta">
        <span><Clock3 /> {slot.duration} min</span>
        <strong>{money(price)}</strong>
      </div>
      <div className={`booking-slot-status ${status}`}>
        <StatusIcon aria-hidden="true" /> {meta.label}
      </div>
      {status === 'available' ? (
        <button type="button" className="bt-btn bt-btn-primary booking-slot-book" disabled={!price} onClick={onBook}>
          Book Now <ArrowRight aria-hidden="true" />
        </button>
      ) : isPending ? (
        <div className="booking-slot-state-note pending">Awaiting confirmation</div>
      ) : isBooked ? (
        <div className="booking-slot-state-note booked">Session already booked</div>
      ) : null}
    </article>
  );
}
