import React from 'react';
import { CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { bookingDate, displayDate, money, timeLabel } from '../../utils/dateUtils';
import { StatusBadge } from '../../components/ui';

function BookingRequestCard({ booking, onAccept, onReject, busy = false }) {
  const paymentAmount = Number(booking.paymentAmount || booking.advanceAmount || 0);

  return (
    <article className="request-card-v3">
      <div className="request-card-head">
        <div className="request-customer">
          <div className="request-avatar">{String(booking.customerName || 'C').slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{booking.customerName || 'Customer'}</strong>
            <span>{booking.phone || 'Phone not provided'}</span>
          </div>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="request-booking-line">
        <Clock3 />
        <div>
          <strong>
            {displayDate(bookingDate(booking), { day: '2-digit', month: 'short', year: 'numeric' })} · {timeLabel(booking.slotStart)} – {timeLabel(booking.slotEnd)}
          </strong>
          <span>{booking.duration || '—'} min · {booking.shift === 'night' ? 'Night' : 'Day'}</span>
        </div>
      </div>

      <div className="request-payment-grid">
        <div>
          <span>Payment</span>
          <strong>{booking.paymentMethod || '—'} · {money(paymentAmount)}</strong>
        </div>
        <div>
          <span>Transaction ID</span>
          <strong className="mono request-txn">{booking.transactionId || '—'}</strong>
        </div>
      </div>

      <div className="request-card-actions">
        <button className="danger-btn" onClick={() => onReject(booking)} disabled={busy}>
          <XCircle /> Reject
        </button>
        <button className="primary" onClick={() => onAccept(booking)} disabled={busy}>
          <CheckCircle2 /> Accept
        </button>
      </div>
    </article>
  );
}

export default BookingRequestCard;
