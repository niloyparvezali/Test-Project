import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CalendarCheck, ChevronDown, ChevronUp, Phone, Search,
  UserRound, CreditCard
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import {
  bookingDate, displayDate, money, timeLabel, TZ
} from '../../utils/dateUtils';
import { zonedSlotStartMs } from '../../utils/slotStatus';
import { AdminPageHeader, EmptyState, Modal, StatusBadge } from '../../components/ui';
import { cancelBookingClient, recordPaymentClient } from '../../services/bookingService';

const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;

function slotStartMs(booking) {
  return zonedSlotStartMs(
    booking?.slotStartDate || bookingDate(booking),
    booking?.slotStart,
    TZ
  );
}

function isRetained(booking, nowMs) {
  const start = slotStartMs(booking);
  if (!start) return false;
  if (start > nowMs) return true;
  return nowMs <= start + FIFTEEN_DAYS;
}

function isUpcoming(booking, nowMs) {
  const start = slotStartMs(booking);
  return start > nowMs;
}

function paymentValues(booking) {
  const total = Number(booking?.totalAmount ?? booking?.slotPrice ?? 0) || 0;
  const paid = Number(booking?.paidAmount ?? booking?.paymentAmount ?? booking?.advanceAmount ?? 0) || 0;
  const due = Math.max(0, Number(booking?.dueAmount ?? booking?.remainingAmount ?? (total - paid)) || 0);
  return { total, paid, due };
}

function bookingTypeLabel(booking) {
  return booking?.bookingType === 'manual_admin' ? 'Admin Booking' : 'Public Booking';
}

function actorLabel(booking) {
  if (booking?.status === 'cancelled' && booking?.cancelledByName) return `Cancelled by: ${booking.cancelledByName}`;
  if (booking?.status === 'confirmed' && booking?.confirmedByName) return `Accepted by: ${booking.confirmedByName}`;
  if (booking?.rejectedByName) return `Rejected by: ${booking.rejectedByName}`;
  if (booking?.createdByName) return `Created by: ${booking.createdByName}`;
  return '';
}

export default function AdminHistory() {
  const bookings = useCollection('bookings');
  const payments = useCollection('payments');
  const [q, setQ] = useState('');
  const [date, setDate] = useState('');
  const [source, setSource] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState({ q: '', date: '', source: 'all' });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [upcomingOpen, setUpcomingOpen] = useState(true);
  const [playedOpen, setPlayedOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState(null);
  const [cancelBooking, setCancelBooking] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    const query = appliedFilters.q.trim().toLowerCase();
    return bookings
      .filter((b) => (b.status === 'confirmed' || b.status === 'cancelled') && isRetained(b, nowMs))
      .filter((b) => appliedFilters.source === 'all' || (appliedFilters.source === 'admin'
        ? b.bookingType === 'manual_admin'
        : b.bookingType !== 'manual_admin'))
      .filter((b) => !appliedFilters.date || bookingDate(b) === appliedFilters.date)
      .filter((b) => !query || `${b.customerName || ''} ${b.phone || ''} ${b.id || ''} ${b.transactionId || ''}`.toLowerCase().includes(query))
      .filter((b) => bookingDate(b));
  }, [bookings, appliedFilters, nowMs]);

  const upcoming = useMemo(
    () => filtered
      .filter((b) => isUpcoming(b, nowMs))
      .sort((a, b) => (slotStartMs(a) || 0) - (slotStartMs(b) || 0)),
    [filtered, nowMs]
  );

  const played = useMemo(
    () => filtered
      .filter((b) => !isUpcoming(b, nowMs))
      .sort((a, b) => (slotStartMs(b) || 0) - (slotStartMs(a) || 0)),
    [filtered, nowMs]
  );

  const applySearch = () => setAppliedFilters({
    q,
    date,
    source
  });

  const openCancel = (booking) => {
    if (booking?.status !== 'confirmed' || !isUpcoming(booking, nowMs)) return;
    setCancelSuccess('');
    setCancelError('');
    setCancelBooking(booking);
  };

  const cancel = async () => {
    if (!cancelBooking || cancelBusy || cancelBooking.status !== 'confirmed' || !isUpcoming(cancelBooking, Date.now())) return;
    setCancelBusy(true);
    setCancelError('');
    try {
      await cancelBookingClient(cancelBooking.id);
      setCancelBooking(null);
      setDetailBooking(null);
      setCancelSuccess('Booking cancelled successfully.');
      setNowMs(Date.now());
    } catch (e) {
      setCancelError(
        e?.code === 'permission-denied'
          ? 'You do not have permission to cancel this booking.'
          : 'Could not cancel this booking. Please try again.'
      );
    } finally {
      setCancelBusy(false);
    }
  };

  const detail = detailBooking ? (bookings.find((b) => b.id === detailBooking.id) || detailBooking) : null;
  const detailPayments = useMemo(() => {
    if (!detail) return [];
    return payments
      .filter((p) => String(p.bookingId || '') === String(detail.id))
      .sort((a, b) => {
        const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : (Date.parse(a.createdAt || a.paymentDate || '') || 0);
        const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : (Date.parse(b.createdAt || b.paymentDate || '') || 0);
        return aMs - bMs;
      });
  }, [payments, detail]);

  const openPayment = (booking) => {
    const { due } = paymentValues(booking);
    if (booking?.status === 'cancelled' || due <= 0) return;
    setPaymentBooking(booking);
    setPaymentAmount(String(due));
    setPaymentMethod('');
    setPaymentError('');
    setPaymentSuccess('');
  };

  const recordPayment = async () => {
    if (!paymentBooking || paymentBusy) return;
    const current = bookings.find((b) => b.id === paymentBooking.id) || paymentBooking;
    const due = paymentValues(current).due;
    const amount = Math.round(Number(paymentAmount || 0) * 1000) / 1000;
    setPaymentError('');
    if (!Number.isFinite(amount) || amount <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }
    if (amount > due) {
      setPaymentError('Payment cannot be greater than the remaining due amount.');
      return;
    }
    if (!['Cash', 'bKash', 'Nagad', 'Rocket'].includes(paymentMethod)) {
      setPaymentError('Please select a payment method.');
      return;
    }
    setPaymentBusy(true);
    try {
      await recordPaymentClient({
        bookingId: current.id,
        amount,
        paymentMethod,
        paymentDate: new Date().toISOString().slice(0, 10),
        note: `${paymentMethod} payment recorded from Booking History`
      });
      setPaymentBooking(null);
      setPaymentSuccess('Payment recorded successfully.');
      setNowMs(Date.now());
    } catch (e) {
      setPaymentError(
        e?.code === 'permission-denied'
          ? 'You do not have permission to record this payment.'
          : e?.message === 'Payment exceeds the remaining due.'
            ? 'Payment cannot be greater than the remaining due amount.'
            : 'Could not record the payment. Please try again.'
      );
    } finally {
      setPaymentBusy(false);
    }
  };

  const renderBooking = (b) => {
    const { total, paid, due } = paymentValues(b);
    const upcomingBooking = isUpcoming(b, nowMs);
    const paymentState = due <= 0 ? 'FULLY PAID' : 'PAYMENT DUE';
    return (
      <article
        className="history-booking-card"
        key={b.id}
        role="button"
        tabIndex={0}
        onClick={() => setDetailBooking(b)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setDetailBooking(b);
          }
        }}
      >
        <div className="history-booking-main">
          <div className="history-avatar"><UserRound /></div>
          <div>
            <strong>{b.customerName || 'Customer'}</strong>
            <span>{displayDate(bookingDate(b), { day: '2-digit', month: 'short', year: 'numeric' })} · {timeLabel(b.slotStart)} – {timeLabel(b.slotEnd)}</span>
            <small>{b.phone || 'No phone'} · {bookingTypeLabel(b)}</small>
            {actorLabel(b) && <small>{actorLabel(b)}</small>}
          </div>
        </div>
        <div className="history-booking-side">
          <strong>{money(total)}</strong>
          <div className="history-payment-mini">
            <span>Paid {money(paid)}</span>
            <span>Due {money(due)}</span>
          </div>
          <div className="history-badge-row">
            <StatusBadge status={b.status} />
            <span className={`history-payment-badge ${due <= 0 ? 'paid' : 'due'}`}>{paymentState}</span>
          </div>
          <small className="history-time-state">{upcomingBooking ? 'UPCOMING' : 'PLAYED'}</small>
        </div>
      </article>
    );
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="BOOKING HISTORY"
        title="Booking History"
        subtitle="Past matches are retained for 15 days from their scheduled slot start time."
        actions={
          <button
            className="secondary"
            onClick={() => {
              window.history.pushState({}, '', '/admin/bookings');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          >
            <ArrowLeft /> Bookings
          </button>
        }
      />

      <section className="history-filter-panel">
        <div className="history-search">
          <Search />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
            placeholder="Search customer, phone, booking ID or transaction ID…"
          />
        </div>
        <div className="history-filter-grid-v2">
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Source<select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All sources</option>
            <option value="public">Public Booking</option>
            <option value="admin">Admin Booking</option>
          </select></label>
          <button className="secondary history-search-action" type="button" onClick={applySearch}><Search /> Search</button>
        </div>
      </section>

      {(cancelSuccess || paymentSuccess) && <div className="success" role="status"><p>{cancelSuccess || paymentSuccess}</p></div>}

      <section className="history-results-panel history-section-panel">
        <button className="history-section-toggle" type="button" onClick={() => setUpcomingOpen(v => !v)} aria-expanded={upcomingOpen}>
          <span><strong>UPCOMING MATCHES</strong><em>{upcoming.length}</em></span>
          {upcomingOpen ? <ChevronUp /> : <ChevronDown />}
        </button>
        {upcomingOpen && (
          upcoming.length
            ? <div className="history-list-v3">{upcoming.map(renderBooking)}</div>
            : <EmptyState icon={CalendarCheck} title="No upcoming matches found." text="" />
        )}
      </section>

      <section className="history-results-panel history-section-panel">
        <button className="history-section-toggle" type="button" onClick={() => setPlayedOpen(v => !v)} aria-expanded={playedOpen}>
          <span><strong>PLAYED MATCHES</strong><em>{played.length}</em></span>
          {playedOpen ? <ChevronUp /> : <ChevronDown />}
        </button>
        {playedOpen && (
          played.length
            ? <div className="history-list-v3">{played.map(renderBooking)}</div>
            : <EmptyState icon={CalendarCheck} title="No played matches found." text="" />
        )}
      </section>

      {detail && (
        <Modal title="Booking Details" onClose={() => setDetailBooking(null)}>
          <div className="history-detail-card">
            <div className="history-detail-head">
              <div>
                <span>CUSTOMER</span>
                <strong>{detail.customerName || '—'}</strong>
              </div>
              {detail.phone ? (
                <a className="small history-call-button" href={`tel:${String(detail.phone).replace(/[^\d+]/g, '')}`} onClick={(e) => e.stopPropagation()}>
                  <Phone /> Call
                </a>
              ) : null}
            </div>
            <div className="history-detail-grid">
              <div><span>Phone</span><strong>{detail.phone || '—'}</strong></div>
              <div><span>Date</span><strong>{displayDate(bookingDate(detailBooking), { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
              <div><span>Time</span><strong>{timeLabel(detail.slotStart)} – {timeLabel(detail.slotEnd)}</strong></div>
              <div><span>Duration</span><strong>{Number(detail.duration || 0)} minutes</strong></div>
              <div><span>Shift</span><strong>{detail.shift ? String(detail.shift).replace(/^./, x => x.toUpperCase()) : '—'}</strong></div>
              <div><span>Booking Type</span><strong>{bookingTypeLabel(detailBooking)}</strong></div>
              <div><span>Total</span><strong>{money(paymentValues(detailBooking).total)}</strong></div>
              <div><span>Paid</span><strong>{money(paymentValues(detailBooking).paid)}</strong></div>
              <div><span>Due</span><strong>{money(paymentValues(detailBooking).due)}</strong></div>
              <div><span>Booking ID</span><strong>{detail.id || '—'}</strong></div>
              <div><span>Transaction ID</span><strong>{detail.transactionId || '—'}</strong></div>
              <div><span>Status</span><strong><StatusBadge status={detail.status} /></strong></div>
            </div>
          </div>
          <div className="history-payment-history">
            <div className="history-payment-history-head">
              <strong>PAYMENT HISTORY</strong>
              {detail.status !== 'cancelled' && paymentValues(detail).due > 0 && (
                <button className="secondary small" type="button" onClick={() => openPayment(detail)}>
                  <CreditCard /> Update Payment
                </button>
              )}
            </div>
            {detailPayments.length ? detailPayments.map((payment) => (
              <div className="history-payment-entry" key={payment.id}>
                <div>
                  <strong>{payment.note?.toLowerCase().includes('advance') ? 'Advance' : 'Payment'}</strong>
                  <span>{money(Number(payment.amount || 0))} · {payment.paymentMethod || '—'}</span>
                </div>
                <small>{payment.createdAt?.toDate ? payment.createdAt.toDate().toLocaleString('en-BD') : (payment.paymentDate || '—')}</small>
                {(payment.recordedByName || payment.recordedByEmail || payment.createdBy) && (
                  <small>{payment.recordedByName || payment.recordedByEmail || 'Admin'}</small>
                )}
              </div>
            )) : (
              <div className="history-payment-entry"><span>No payment records found.</span></div>
            )}
          </div>
          {detail.status === 'confirmed' && isUpcoming(detail, nowMs) && (
            <div className="modal-actions">
              <button className="danger-btn" type="button" onClick={() => { setDetailBooking(null); openCancel(detail); }}>
                Cancel booking
              </button>
            </div>
          )}
        </Modal>
      )}

      {paymentBooking && (
        <Modal title="Update Payment" onClose={() => { if (!paymentBusy) { setPaymentBooking(null); setPaymentError(''); } }}>
          <div className="verification-card">
            <div><span>Current outstanding amount</span><strong>{money(paymentValues(paymentBooking).due)}</strong></div>
            <label>Amount Paid<input type="number" min="0.01" max={paymentValues(paymentBooking).due} step="0.01" inputMode="decimal" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></label>
            <label>Payment Method<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="">Select payment method</option>
              <option value="Cash">Cash</option>
              <option value="bKash">bKash</option>
              <option value="Nagad">Nagad</option>
              <option value="Rocket">Rocket</option>
            </select></label>
            {paymentError && <p className="error">{paymentError}</p>}
          </div>
          <div className="modal-actions">
            <button className="secondary" type="button" onClick={() => setPaymentBooking(null)} disabled={paymentBusy}>Cancel</button>
            <button className="primary" type="button" onClick={recordPayment} disabled={paymentBusy}>
              {paymentBusy ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </Modal>
      )}

      {cancelBooking && (
        <Modal title="Cancel booking?" onClose={() => { if (!cancelBusy) { setCancelBooking(null); setCancelError(''); } }}>
          <div className="verification-card">
            <div><span>Customer</span><strong>{cancelBooking.customerName || '—'}</strong></div>
            <div><span>Date</span><strong>{displayDate(bookingDate(cancelBooking), { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
            <div><span>Time</span><strong>{timeLabel(cancelBooking.slotStart)} – {timeLabel(cancelBooking.slotEnd)}</strong></div>
            <div><span>Amount</span><strong>{money(paymentValues(cancelBooking).total)}</strong></div>
            <p className="error" style={{ marginTop: 10 }}>This will cancel the confirmed booking and release the slot.</p>
            {cancelError && <p className="error">{cancelError}</p>}
          </div>
          <div className="modal-actions">
            <button className="secondary" type="button" onClick={() => { setCancelBooking(null); setCancelError(''); }} disabled={cancelBusy}>Keep booking</button>
            <button className="danger-btn" type="button" onClick={cancel} disabled={cancelBusy}>
              {cancelBusy ? 'Cancelling…' : 'Cancel booking'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
