import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { bookingStatusExpired } from '../../utils/dateUtils';
import { confirmBookingClient, rejectBookingClient } from '../../services/bookingService';
import { AdminPageHeader, EmptyState, Modal } from '../../components/ui';
import BookingRequestCard from './BookingRequestCard';

function RequestReview({ booking, onClose, onConfirm, busy, error }) {
  return (
    <Modal title="Verify payment & accept booking" onClose={onClose}>
      <div className="verification-card">
        <div><span>Customer</span><strong>{booking.customerName || '—'}</strong></div>
        <div><span>Payment</span><strong>{booking.paymentMethod || '—'} · ৳{Number(booking.paymentAmount || booking.advanceAmount || 0).toLocaleString('en-BD')}</strong></div>
        <div><span>Transaction ID</span><strong className="mono">{booking.transactionId || '—'}</strong></div>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-actions">
        <button className="secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="primary" onClick={onConfirm} disabled={busy}>{busy ? 'Verifying…' : 'Confirm & accept'} <CheckCircle2 /></button>
      </div>
    </Modal>
  );
}

function RequestReject({ booking, onClose, onConfirm, busy }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Reject booking request" onClose={onClose}>
      <div className="verification-card">
        <div><span>Customer</span><strong>{booking.customerName || '—'}</strong></div>
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
        <button className="danger-btn" onClick={() => onConfirm(reason)} disabled={busy || !reason}>{busy ? 'Rejecting…' : 'Reject request'} <XCircle /></button>
      </div>
    </Modal>
  );
}

export default function AdminRequests() {
  const bookings = useCollection('bookings');
  const pending = useMemo(() => bookings.filter((b) => b.status === 'pending_payment_verification' && !bookingStatusExpired(b)), [bookings]);
  const [modal, setModal] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  async function accept() {
    const booking = modal?.booking;
    if (!booking) return;
    setBusyId(booking.id);
    setError('');
    try { await confirmBookingClient(booking); setModal(null); }
    catch (e) { setError(e?.message || 'Could not confirm this request.'); }
    finally { setBusyId(''); }
  }

  async function reject(reason) {
    const booking = modal?.booking;
    if (!booking) return;
    setBusyId(booking.id);
    try { await rejectBookingClient(booking, reason); setModal(null); }
    catch (e) { setError(e?.message || 'Could not reject this request.'); }
    finally { setBusyId(''); }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="BOOKING MANAGEMENT"
        title="Online Booking Requests"
        subtitle={`${pending.length} active payment-verification request${pending.length === 1 ? '' : 's'}.`}
        actions={<button className="secondary" onClick={() => { window.history.pushState({}, '', '/admin/bookings'); window.dispatchEvent(new PopStateEvent('popstate')); }}><ArrowLeft /> Booking management</button>}
      />

      {pending.length ? (
        <div className="request-grid-v3 request-grid-all">
          {pending.map((booking) => (
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
        <section className="request-empty-page">
          <EmptyState icon={ShieldCheck} title="No pending requests" text="All online booking requests have been handled." />
        </section>
      )}

      {modal?.type === 'accept' && <RequestReview booking={modal.booking} busy={busyId === modal.booking.id} error={error} onClose={() => { setError(''); setModal(null); }} onConfirm={accept} />}
      {modal?.type === 'reject' && <RequestReject booking={modal.booking} busy={busyId === modal.booking.id} onClose={() => { setError(''); setModal(null); }} onConfirm={reject} />}
    </>
  );
}
