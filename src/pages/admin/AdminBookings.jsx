import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ClipboardList, ShieldCheck, Clock3, XCircle } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { bookingDate, displayDate, timeLabel } from '../../utils/dateUtils';
import { confirmBookingClient, rejectBookingClient } from '../../services/bookingService';
import { AdminPageHeader, EmptyState, LoadingState, Modal } from '../../components/ui';
import BookingRequestCard from './BookingRequestCard';
import VerifyBookingModal from './VerifyBookingModal';
import { useAdminRole } from '../../hooks/useAdminRole';
import { ADMIN_PERMISSIONS } from '../../config/adminPermissions';

function RejectModal({ booking, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Reject booking request" onClose={onClose}>
      <div className="verification-card">
        <div><span>Customer</span><strong>{booking.customerName || '—'}</strong></div>
        <div><span>Slot</span><strong>{displayDate(bookingDate(booking), { day: '2-digit', month: 'short', year: 'numeric' })} · {timeLabel(booking.slotStart)} – {timeLabel(booking.slotEnd)}</strong></div>
        <label className="form-label">Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Select reason</option>
            <option value="We Didnt get the payment">We Didnt get the payment</option>
            <option value="Transection not match">Transection not match</option>
            <option value="slot is already booked">slot is already booked</option>
          </select>
        </label>
      </div>
      <div className="modal-actions">
        <button className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="danger-btn" onClick={() => onConfirm(reason)} disabled={busy || !reason}>
          {busy ? 'Rejecting…' : 'Reject request'} <XCircle />
        </button>
      </div>
    </Modal>
  );
}

function BookingManagement() {
  const bookings = useCollection('bookings');
  const { can } = useAdminRole();
  const canAccept = can(ADMIN_PERMISSIONS.ACCEPT_BOOKING);
  const canReject = can(ADMIN_PERMISSIONS.REJECT_BOOKING);
  const pending = useMemo(
    () => bookings
      .filter((b) => b.status === 'pending_payment_verification')
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
                canAccept={canAccept}
                canReject={canReject}
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
        <VerifyBookingModal
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
