import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { bookingDate, displayDate, money, timeLabel } from '../../utils/dateUtils';
import { StatusBadge } from '../../components/ui';

function RequestHeader({ booking }) {
  const initial = String(booking.customerName || 'C').trim().slice(0, 1).toUpperCase() || 'C';

  return (
    <header className="request-card-v3__header">
      <div className="request-card-v3__customer">
        <div className="request-card-v3__avatar" aria-hidden="true">{initial}</div>

        <div className="request-card-v3__customer-copy">
          <strong>{booking.customerName || 'Customer'}</strong>
          <span>{booking.phone || 'Phone not provided'}</span>
        </div>
      </div>

      <StatusBadge status={booking.status} />
    </header>
  );
}

function BookingMetaGrid({ booking }) {
  const date = bookingDate(booking);
  const dateLabel = displayDate(date, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const timeLabelValue = booking.slotStart
    ? `${timeLabel(booking.slotStart)}${booking.slotEnd ? ` – ${timeLabel(booking.slotEnd)}` : ''}`
    : '—';

  const shiftLabel = booking.shift === 'night' ? 'Night' : 'Day';
  const paymentAmount = Number(booking.paymentAmount || booking.advanceAmount || 0);

  return (
    <section className="request-card-v3__meta-grid" aria-label="Booking information">
      <div className="request-card-v3__meta-block">
        <div className="request-card-v3__meta-label">
          <span className="request-card-v3__meta-icon"><CalendarDays aria-hidden="true" /></span>
          <span>DATE</span>
        </div>
        <strong>{dateLabel}</strong>
      </div>

      <div className="request-card-v3__meta-block request-card-v3__time-block">
        <div className="request-card-v3__meta-label">
          <span className="request-card-v3__meta-icon"><Clock3 aria-hidden="true" /></span>
          <span>TIME</span>
        </div>
        <strong>{timeLabelValue}</strong>
      </div>

      <div className="request-card-v3__meta-block">
        <div className="request-card-v3__meta-label">
          <span className="request-card-v3__meta-icon"><ShieldCheck aria-hidden="true" /></span>
          <span>SHIFT</span>
        </div>
        <strong>{shiftLabel}</strong>
      </div>

      <div className="request-card-v3__meta-block request-card-v3__payment-block">
        <div className="request-card-v3__meta-label">
          <span className="request-card-v3__meta-icon"><Wallet aria-hidden="true" /></span>
          <span>PAYMENT</span>
        </div>
        <div className="request-card-v3__payment-value">
          <strong>{booking.paymentMethod || '—'}</strong>
          <b>{money(paymentAmount)}</b>
        </div>
      </div>
    </section>
  );
}

function TransactionRow({ booking }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    setCopied(false);
    setCopyError(false);
  }, [booking?.id, booking?.transactionId]);

  async function copyTransactionId() {
    const value = String(booking?.transactionId || '').trim();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopyError(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setCopyError(true);
      window.setTimeout(() => setCopyError(false), 1800);
    }
  }

  const transactionId = String(booking?.transactionId || '').trim();

  return (
    <section className="request-card-v3__transaction" aria-label="Transaction ID">
      <div className="request-card-v3__transaction-content">
        <span className="request-card-v3__transaction-label">TRANSACTION ID</span>
        <strong className="mono">{transactionId || '—'}</strong>
        {copyError && (
          <small className="request-card-v3__copy-error" role="status">Unable to copy</small>
        )}
      </div>

      <button
        type="button"
        className={`request-card-v3__copy-btn${copied ? ' is-copied' : ''}`}
        onClick={copyTransactionId}
        disabled={!transactionId}
        aria-label="Copy transaction ID"
        title={copied ? 'Copied' : 'Copy transaction ID'}
      >
        <Copy aria-hidden="true" />
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </section>
  );
}

function RequestActions({ booking, onAccept, onReject, busy, canAccept, canReject }) {
  return (
    <footer className="request-card-v3__actions">
      {canReject && (
        <button
          type="button"
          className="request-card-v3__reject"
          onClick={() => onReject(booking)}
          disabled={busy}
          aria-label="Reject booking request"
        >
          <XCircle aria-hidden="true" />
          <span>Reject</span>
        </button>
      )}

      {canAccept && (
        <button
          type="button"
          className="request-card-v3__accept"
          onClick={() => onAccept(booking)}
          disabled={busy}
          aria-label="Accept booking request"
        >
          <CheckCircle2 aria-hidden="true" />
          <span>Accept</span>
        </button>
      )}
    </footer>
  );
}

function BookingRequestCard({
  booking,
  onAccept,
  onReject,
  busy = false,
  canAccept = true,
  canReject = true,
}) {
  const hasActions = canReject || canAccept;

  return (
    <article className="request-card-v3">
      <RequestHeader booking={booking} />
      <BookingMetaGrid booking={booking} />
      <TransactionRow booking={booking} />

      {hasActions && (
        <RequestActions
          booking={booking}
          onAccept={onAccept}
          onReject={onReject}
          busy={busy}
          canAccept={canAccept}
          canReject={canReject}
        />
      )}
    </article>
  );
}

export default BookingRequestCard;
