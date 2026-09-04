import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  ReceiptText,
  ShieldCheck,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';
import { bookingDate, displayDate, timeLabel } from '../../utils/dateUtils';
import { Modal } from '../../components/ui';

function VerifyBookingModal({ booking, onClose, onConfirm, busy, error }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  useEffect(() => {
    setCopied(false);
    setCopyError(false);
  }, [booking?.id]);

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

  const bookingDateValue = bookingDate(booking);
  const bookingDateLabel = displayDate(
    bookingDateValue,
    { day: '2-digit', month: 'short', year: 'numeric' }
  );
  const bookingTimeLabel = booking.slotStart
    ? `${timeLabel(booking.slotStart)}${booking.slotEnd ? ` – ${timeLabel(booking.slotEnd)}` : ''}`
    : '—';
  const durationLabel = booking.duration ? `${booking.duration} min` : '—';
  const shiftLabel = booking.shift === 'night' ? 'Night' : 'Day';
  const transactionId = String(booking?.transactionId || '').trim();
  const advanceAmount = Number(booking.paymentAmount || booking.advanceAmount || 0);

  return (
    <Modal
      title={
        <span className="verify-dialog-title">
          <span className="verify-dialog-title-icon" aria-hidden="true">
            <Wallet />
          </span>
          <span className="verify-dialog-title-copy">
            <span className="verify-dialog-title-text">Verify payment &amp; accept booking</span>
            <span className="verify-dialog-title-subtitle">Review the payment details and confirm the booking.</span>
          </span>
        </span>
      }
      onClose={onClose}
    >
      <div className="verify-dialog-shell">
        <div className="verify-dialog-body">
          <section className="verify-info-card" aria-label="Payment verification details">
            <div className="verify-info-row">
              <div className="verify-info-icon"><User /></div>
              <div className="verify-info-content">
                <span className="verify-info-label">Customer</span>
                <strong className="verify-info-value verify-customer-name">{booking.customerName || '—'}</strong>
                <span className="verify-info-secondary">{booking.phone || 'Phone not provided'}</span>
              </div>
            </div>

            <div className="verify-info-row">
              <div className="verify-info-icon"><CalendarDays /></div>
              <div className="verify-info-content">
                <span className="verify-info-label">Booking</span>
                <strong className="verify-info-value">{bookingDateLabel}</strong>
                <span className="verify-info-secondary">
                  {bookingTimeLabel} · {durationLabel} · {shiftLabel}
                </span>
              </div>
            </div>

            <div className="verify-info-row">
              <div className="verify-info-icon"><CreditCard /></div>
              <div className="verify-info-content">
                <span className="verify-info-label">Payment Method</span>
                <strong className="verify-info-value">{booking.paymentMethod || '—'}</strong>
              </div>
            </div>

            <div className="verify-info-row">
              <div className="verify-info-icon"><ReceiptText /></div>
              <div className="verify-info-content">
                <span className="verify-info-label">Advance Amount</span>
                <strong className="verify-info-value verify-amount-value">
                  ৳{advanceAmount.toLocaleString('en-BD')}
                </strong>
              </div>
            </div>

            <div className="verify-info-row verify-transaction-info-row">
              <div className="verify-info-icon"><ReceiptText /></div>
              <div className="verify-info-content">
                <span className="verify-info-label">Transaction ID</span>
                <div className="verify-transaction-line">
                  <strong className="verify-info-value verify-transaction-id mono">
                    {transactionId || '—'}
                  </strong>
                  <button
                    type="button"
                    className={`verify-copy-button${copied ? ' copied' : ''}`}
                    onClick={copyTransactionId}
                    disabled={!transactionId || busy}
                    aria-label="Copy transaction ID"
                    title={copied ? 'Copied' : 'Copy transaction ID'}
                  >
                    <Copy aria-hidden="true" />
                    <span>{copied ? '✓ Copied' : 'Copy'}</span>
                  </button>
                </div>
                {!transactionId && (
                  <span className="verify-info-secondary">No transaction ID was submitted with this request.</span>
                )}
                {copyError && (
                  <span className="verify-copy-feedback error" role="status">Unable to copy</span>
                )}
              </div>
            </div>
          </section>

          <section className="verify-confirmation-card">
            <div className="verify-confirmation-icon"><ShieldCheck /></div>
            <div>
              <strong>Confirm payment details</strong>
              <p>
                Make sure the submitted payment is valid. The existing booking service will confirm the booking and record the payment.
              </p>
            </div>
          </section>

          {error && (
            <section className="verify-error-card" role="alert" aria-live="polite">
              <div className="verify-error-icon"><XCircle /></div>
              <div>
                <strong>
                  {String(error).toLowerCase().includes('transaction id already used')
                    ? 'Transaction ID already used'
                    : 'Verification failed'}
                </strong>
                <p>{error}</p>
              </div>
            </section>
          )}
        </div>

        <div className="verify-dialog-footer">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={busy || !transactionId}
            aria-label="Confirm and accept booking"
          >
            {busy ? 'Confirming…' : 'Confirm & accept'}
            <CheckCircle2 aria-hidden="true" />
          </button>
        </div>
      </div>
    </Modal>
  );
}


export default VerifyBookingModal;
