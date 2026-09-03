import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Plus, ShieldCheck, Clock3, CheckCircle2, X, XCircle } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { bookingDate, bookingStatusExpired, displayDate, localDate, timeLabel, money } from '../../utils/dateUtils';
import { confirmBookingClient, expireBookingClient, rejectBookingClient } from '../../services/bookingService';
import { AdminPageHeader, EmptyState, LoadingState, Modal } from '../../components/ui';
import BookingRequestCard from './BookingRequestCard';

function ReviewModal({ booking, onClose, onConfirm, busy, error }) {
  return (
    <Modal title="Verify payment & accept booking" onClose={onClose}>
      <div className="verification-card">
        <div><span>Customer</span><strong>{booking.customerName || '—'}</strong></div>
        <div><span>Booking</span><strong>{displayDate(bookingDate(booking), { day: '2-digit', month: 'short', year: 'numeric' })} · {timeLabel(booking.slotStart)} – {timeLabel(booking.slotEnd)}</strong></div>
        <div><span>Payment method</span><strong>{booking.paymentMethod || '—'}</strong></div>
        <div><span>Advance</span><strong>{money(booking.paymentAmount || booking.advanceAmount || 0)}</strong></div>
        <div><span>Transaction ID</span><strong className="mono">{booking.transactionId || '—'}</strong></div>
        <p>Confirm the submitted payment is valid. The existing secure booking service will confirm the booking and record the payment.</p>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-actions">
        <button className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="primary" onClick={onConfirm} disabled={busy}>
          {busy ? 'Verifying…' : 'Confirm & accept'} <CheckCircle2 />
        </button>
      </div>
    </Modal>
  );
}

function RejectModal({ booking, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Reject booking request" onClose={onClose}>
      <div className="verification-card">
        <div><span>Customer</span><strong>{booking.customerName || '—'}</strong></div>
        <div><span>Slot</span><strong>{displayDate(bookingDate(booking), { day: '2-digit', month: 'short', year: 'numeric' })} · {timeLabel(booking.slotStart)} – {timeLabel(booking.slotEnd)}</strong></div>
        <label className="form-label">Reason (optional)
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional rejection reason" />
        </label>
      </div>
      <div className="modal-actions">
        <button className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="danger-btn" onClick={() => onConfirm(reason)} disabled={busy}>
          {busy ? 'Rejecting…' : 'Reject request'} <XCircle />
        </button>
      </div>
    </Modal>
  );
}

function BookingManagement() {
  const bookings = useCollection('bookings');
  const pending = useMemo(
    () => bookings
      .filter((b) => b.status === 'pending_payment_verification' && !bookingStatusExpired(b))
      .sort((a, b) => {
        const ad = String(a.createdAt?.toMillis?.() || 0);
        const bd = String(b.createdAt?.toMillis?.() || 0);
        return bd.localeCompare(ad);
      }),
    [bookings]
  );

  const [modal, setModal] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    bookings
      .filter((b) => b.status === 'pending_payment_verification' && bookingStatusExpired(b))
      .forEach((b) => expireBookingClient(b).catch(() => {}));
  }, [bookings]);

  const accept = async () => {
    const booking = modal?.booking;
    if (!booking) return;
    setBusyId(booking.id);
    setError('');
    try {
      await confirmBookingClient(booking);
      setModal(null);
    } catch (e) {
      setError(e?.message || 'Could not confirm this booking.');
    } finally {
      setBusyId('');
    }
  };

  const reject = async (reason) => {
    const booking = modal?.booking;
    if (!booking) return;
    setBusyId(booking.id);
    try {
      await rejectBookingClient(booking, reason);
      setModal(null);
    } catch (e) {
      setError(e?.message || 'Could not reject this request.');
    } finally {
      setBusyId('');
    }
  };

  const preview = pending.slice(0, 3);

  return (
    <>
      <AdminPageHeader
        eyebrow="BOOKING MANAGEMENT"
        title="Booking Management"
        subtitle="Handle online requests first, then jump to manual bookings, slots, activity or history."
      />

      <section className="booking-focus-hero">
        <div>
          <span className="hero-live-dot"><i /> ONLINE BOOKING QUEUE</span>
          <h3>Customer requests waiting for you</h3>
          <p>{pending.length ? `${pending.length} active request${pending.length === 1 ? '' : 's'} need payment verification.` : 'No pending requests. New customer bookings will appear here automatically.'}</p>
        </div>
        <div className="booking-focus-count">{pending.length}</div>
      </section>

      <section className="request-section-v3">
        <div className="request-section-head">
          <div>
            <span className="eyebrow">ONLINE BOOKING REQUESTS</span>
            <h3>{pending.length} pending {pending.length === 1 ? 'request' : 'requests'}</h3>
          </div>

        </div>

        {preview.length ? (
          <div className="request-grid-v3">
            {preview.map((booking) => (
              <BookingRequestCard
                key={booking.id}
                booking={booking}
                busy={busyId === booking.id}
                onAccept={(b) => { setError(''); setModal({ type: 'accept', booking: b }); }}
                onReject={(b) => { setError(''); setModal({ type: 'reject', booking: b }); }}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={ShieldCheck} title="No pending requests" text="The online booking queue is clear." />
        )}

        {pending.length > 3 && (
          <button className="request-more-button" onClick={() => window.history.pushState({}, '', '/admin/requests') || window.dispatchEvent(new PopStateEvent('popstate'))}>
            VIEW ALL REQUESTS ({pending.length}) <ArrowRight />
          </button>
        )}
      </section>

      <section className="management-link-list">
        <button onClick={() => window.history.pushState({}, '', '/admin/manual-booking') || window.dispatchEvent(new PopStateEvent('popstate'))}>
          <span className="management-link-icon"><Plus /></span>
          <span><b>MANUAL BOOKING</b><small>Create a booking for a walk-in, phone customer or offline customer</small></span>
          <ArrowRight />
        </button>

        <button onClick={() => window.history.pushState({}, '', '/admin/slots') || window.dispatchEvent(new PopStateEvent('popstate'))}>
          <span className="management-link-icon"><CalendarDays /></span>
          <span><b>SLOT AVAILABILITY</b><small>View today’s and upcoming slot status</small></span>
          <ArrowRight />
        </button>

        <button onClick={() => window.history.pushState({}, '', '/admin/activity') || window.dispatchEvent(new PopStateEvent('popstate'))}>
          <span className="management-link-icon"><ClipboardList /></span>
          <span><b>RECENT ACTIVITY</b><small>Latest booking and payment events</small></span>
          <ArrowRight />
        </button>

        <button onClick={() => window.history.pushState({}, '', '/admin/history') || window.dispatchEvent(new PopStateEvent('popstate'))}>
          <span className="management-link-icon"><Clock3 /></span>
          <span><b>BOOKING HISTORY</b><small>View confirmed booking records</small></span>
          <ArrowRight />
        </button>
      </section>

      {modal?.type === 'accept' && (
        <ReviewModal
          booking={modal.booking}
          busy={busyId === modal.booking.id}
          error={error}
          onClose={() => { setError(''); setModal(null); }}
          onConfirm={accept}
        />
      )}

      {modal?.type === 'reject' && (
        <RejectModal
          booking={modal.booking}
          busy={busyId === modal.booking.id}
          onClose={() => { setError(''); setModal(null); }}
          onConfirm={reject}
        />
      )}
    </>
  );
}

export default BookingManagement;
