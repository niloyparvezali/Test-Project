import React, { useMemo, useState, useEffect } from 'react';
import { Bell, CalendarDays, Clock3, ListFilter, ReceiptText, ShieldCheck, XCircle } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import {} from '../../utils/dateUtils';
import { confirmBookingClient, rejectBookingClient } from '../../services/bookingService';
import { AdminPageHeader, EmptyState, Modal } from '../../components/ui';
import BookingRequestCard from './BookingRequestCard';
import VerifyBookingModal from './VerifyBookingModal';
import { useAdminRole } from '../../hooks/useAdminRole';
import { ADMIN_PERMISSIONS } from '../../config/adminPermissions';

function navigateAdmin(path) {
  window.history.pushState({}, '', `/admin/${path}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
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
  const { can } = useAdminRole();
  const canAccept = can(ADMIN_PERMISSIONS.ACCEPT_BOOKING);
  const canReject = can(ADMIN_PERMISSIONS.REJECT_BOOKING);
  const [filter, setFilter] = useState('pending');
  const [modal, setModal] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const requestRecords = useMemo(() => {
    const toMillis = (value) => {
      if (value?.toMillis) return value.toMillis();
      if (value instanceof Date) return value.getTime();
      const parsed = Date.parse(value || '');
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return bookings
      .filter((b) => b.bookingType === 'public_payment_request' || b.createdBy === 'public')
      .slice()
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [bookings]);

  const pending = useMemo(() => requestRecords.filter((b) => b.status === 'pending_payment_verification'), [requestRecords]);
  const confirmed = useMemo(() => requestRecords.filter((b) => b.status === 'confirmed'), [requestRecords]);
  const rejected = useMemo(() => requestRecords.filter((b) => b.status === 'rejected'), [requestRecords]);

  const visible = useMemo(() => {
    if (filter === 'confirmed') return confirmed;
    if (filter === 'rejected') return rejected;
    if (filter === 'all') return requestRecords;
    return pending;
  }, [filter, requestRecords, pending, confirmed, rejected]);

  async function accept() {
    const booking = modal?.booking;
    if (!booking) return;
    setBusyId(booking.id);
    setError('');
    try {
      await confirmBookingClient(booking);
      setModal(null);
    } catch (e) {
      setError(e?.message || 'Could not confirm this request.');
    } finally {
      setBusyId('');
    }
  }

  async function reject(reason) {
    const booking = modal?.booking;
    if (!booking) return;
    setBusyId(booking.id);
    setError('');
    try {
      await rejectBookingClient(booking, reason);
      setModal(null);
    } catch (e) {
      setError(e?.message || 'Could not reject this request.');
    } finally {
      setBusyId('');
    }
  }

  const filters = [
    ['pending', 'Pending', pending.length],
    ['all', 'All Requests', requestRecords.length],
    ['confirmed', 'Confirmed', confirmed.length],
    ['rejected', 'Rejected', rejected.length],
  ];

  return (
    <>
      <AdminPageHeader
        eyebrow="BOOKING MANAGEMENT"
        title="Online Booking Requests"
        subtitle="Review customer requests, verify payments, and confirm bookings."
        actions={
          <div className="online-request-pending-badge">
            <Bell />
            <span className="online-request-pending-count">{pending.length}</span>
            <span><b>Pending</b> Requests</span>
          </div>
        }
      />

      <section className="online-request-hero">
        <div>
          <span className="eyebrow">BOOKING MANAGEMENT</span>
          <h3>Online Booking Requests</h3>
          <p>Review customer requests, verify payments, and confirm bookings.</p>
        </div>
        <div className="online-request-hero-count">
          <span>{pending.length}</span>
          <small>customer requests waiting</small>
        </div>
      </section>

      <div className="online-request-filters" role="tablist" aria-label="Request filters">
        {filters.map(([id, label, count]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
            {label} <span>{count}</span>
          </button>
        ))}
      </div>

      <section className="online-request-summary">
        <div className="online-request-summary-icon"><ListFilter /></div>
        <div>
          <strong>{pending.length} customer request{pending.length === 1 ? '' : 's'} waiting</strong>
          <p>These requests need payment verification before booking confirmation.</p>
        </div>
      </section>

      <div className="online-request-list-head">
        <div>
          <span className="eyebrow">REQUEST QUEUE</span>
          <h3>{filter === 'pending' ? 'Pending Requests' : filters.find(([id]) => id === filter)?.[1] || 'Requests'} <span>{visible.length}</span></h3>
        </div>
        <div className="online-request-sort"><ListFilter /> Newest First</div>
      </div>

      {visible.length ? (
        <div className="online-request-grid">
          {visible.map((booking) => (
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
        <section className="online-request-empty">
          <EmptyState icon={ShieldCheck} title={filter === 'pending' ? 'ALL CLEAR' : 'No requests found'} text={filter === 'pending' ? 'No booking requests are waiting for review.' : 'There are no requests in this status yet.'} />
        </section>
      )}

      <div className="online-request-shortcuts">
        <button type="button" onClick={() => navigateAdmin('slots')}><Clock3 /><span>Slot Availability</span><b>→</b></button>
        <button type="button" onClick={() => navigateAdmin('activity')}><ReceiptText /><span>Recent Activity</span><b>→</b></button>
        <button type="button" onClick={() => navigateAdmin('history')}><CalendarDays /><span>Booking History</span><b>→</b></button>
      </div>

      {modal?.type === 'accept' && <VerifyBookingModal key={modal.booking.id} booking={modal.booking} busy={busyId === modal.booking.id} error={error} onClose={() => { setError(''); setModal(null); }} onConfirm={accept} />}
      {modal?.type === 'reject' && <RequestReject booking={modal.booking} busy={busyId === modal.booking.id} onClose={() => { setError(''); setModal(null); }} onConfirm={reject} />}
    </>
  );
}

