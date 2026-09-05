import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarCheck, ChevronDown, ChevronUp,
  Download, Search, UserRound
} from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { bookingDate, displayDate, money, timeLabel, TZ } from '../../utils/dateUtils';
import { zonedSlotStartMs } from '../../utils/slotStatus';
import { AdminPageHeader, EmptyState, Modal, StatusBadge } from '../../components/ui';

const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;

function slotStartMs(booking) {
  return zonedSlotStartMs(
    booking?.slotStartDate || bookingDate(booking),
    booking?.slotStart,
    TZ
  );
}

function slotEndMs(booking) {
  return zonedSlotStartMs(
    booking?.slotEndDate || booking?.slotStartDate || bookingDate(booking),
    booking?.slotEnd,
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
  const end = slotEndMs(booking);
  return end ? end > nowMs : start > nowMs;
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

function formatTimestamp(value) {
  if (!value) return '—';
  if (value?.toDate) return value.toDate().toLocaleString('en-BD');
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('en-BD');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function downloadBookingRecord(booking, detailPayments) {
  if (!booking) return;
  const { total, paid, due } = paymentValues(booking);
  const paymentsHtml = detailPayments.length
    ? detailPayments.map((payment, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(payment.note?.toLowerCase().includes('advance') ? 'Advance' : 'Payment')}</td>
          <td>${escapeHtml(money(Number(payment.amount || 0)))}</td>
          <td>${escapeHtml(payment.paymentMethod || '—')}</td>
          <td>${escapeHtml(formatTimestamp(payment.createdAt || payment.paymentDate))}</td>
          <td>${escapeHtml(payment.recordedByName || payment.recordedByEmail || '—')}</td>
        </tr>`).join('')
    : '<tr><td colspan="6">No payment records found.</td></tr>';

  const adminEvents = [
    ['Created by', booking.createdByName || booking.createdByEmail, booking.createdAt],
    ['Accepted by', booking.confirmedByName || booking.confirmedByEmail, booking.confirmedAt],
    ['Rejected by', booking.rejectedByName || booking.rejectedByEmail, booking.rejectedAt],
    ['Cancelled by', booking.cancelledByName || booking.cancelledByEmail, booking.cancelledAt],
    ['Edited by', booking.updatedByEmail || booking.updatedByName, booking.updatedAt],
  ].filter(([, actor, timestamp]) => actor || timestamp);
  const activityHtml = adminEvents.length
    ? adminEvents.map(([label, actor, timestamp]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(actor || '—')}</td><td>${escapeHtml(formatTimestamp(timestamp))}</td></tr>`).join('')
    : '<tr><td colspan="3">No admin activity fields are available.</td></tr>';

  const dateText = displayDate(bookingDate(booking), { day: '2-digit', month: 'short', year: 'numeric' });
  const filename = `testweb-turf-booking-${String(booking.id || 'record').replace(/[^a-z0-9_-]/gi, '-')}.html`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>TestWeb Turf — Booking Record</title>
<style>body{font-family:Arial,sans-serif;color:#132019;max-width:900px;margin:36px auto;padding:0 20px}h1{margin:0;font-size:24px}h2{font-size:15px;margin:28px 0 10px;border-bottom:1px solid #d8e1db;padding-bottom:7px}p{margin:6px 0;color:#526159}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}.item{padding:8px 0}.item b{display:block;color:#68766f;font-size:11px;text-transform:uppercase;letter-spacing:.06em}.item span{display:block;margin-top:3px;font-size:14px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:8px;border-bottom:1px solid #e4ebe6}th{color:#526159;font-size:11px;text-transform:uppercase} @media(max-width:640px){.grid{grid-template-columns:1fr}}</style></head><body>
<h1>TestWeb Turf</h1><p>Booking Record</p>
<h2>Customer & Booking</h2><div class="grid">
<div class="item"><b>Customer</b><span>${escapeHtml(booking.customerName || '—')}</span></div>
<div class="item"><b>Phone</b><span>${escapeHtml(booking.phone || '—')}</span></div>
<div class="item"><b>Date</b><span>${escapeHtml(dateText)}</span></div>
<div class="item"><b>Time</b><span>${escapeHtml(`${timeLabel(booking.slotStart)} – ${timeLabel(booking.slotEnd)}`)}</span></div>
<div class="item"><b>Duration</b><span>${escapeHtml(`${Number(booking.duration || 0)} minutes`)}</span></div>
<div class="item"><b>Shift</b><span>${escapeHtml(booking.shift ? String(booking.shift).replace(/^./, x => x.toUpperCase()) : '—')}</span></div>
<div class="item"><b>Booking Type</b><span>${escapeHtml(bookingTypeLabel(booking))}</span></div>
<div class="item"><b>Status</b><span>${escapeHtml(booking.status || '—')}</span></div>
<div class="item"><b>Booking ID</b><span>${escapeHtml(booking.id || '—')}</span></div>
<div class="item"><b>Transaction ID</b><span>${escapeHtml(booking.transactionId || '—')}</span></div>
</div>
<h2>Financial Summary</h2><div class="grid">
<div class="item"><b>Total</b><span>${escapeHtml(money(total))}</span></div><div class="item"><b>Paid</b><span>${escapeHtml(money(paid))}</span></div><div class="item"><b>Due</b><span>${escapeHtml(money(due))}</span></div>
</div>
<h2>Payment History</h2><table><thead><tr><th>#</th><th>Type</th><th>Amount</th><th>Method</th><th>Date</th><th>Recorded By</th></tr></thead><tbody>${paymentsHtml}</tbody></table>
<h2>Admin Activity</h2><table><thead><tr><th>Activity</th><th>Admin</th><th>Timestamp</th></tr></thead><tbody>${activityHtml}</tbody></table>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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

  const upcoming = useMemo(() => filtered
    .filter((b) => isUpcoming(b, nowMs))
    .sort((a, b) => (slotStartMs(a) || 0) - (slotStartMs(b) || 0)), [filtered, nowMs]);

  const played = useMemo(() => filtered
    .filter((b) => !isUpcoming(b, nowMs))
    .sort((a, b) => (slotStartMs(b) || 0) - (slotStartMs(a) || 0)), [filtered, nowMs]);

  const applySearch = () => setAppliedFilters({ q, date, source });
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

  const renderBooking = (b) => {
    const { total, paid, due } = paymentValues(b);
    const paymentState = due <= 0 ? 'FULLY PAID' : 'PAYMENT DUE';
    const dateText = displayDate(bookingDate(b), { day: '2-digit', month: 'short', year: 'numeric' });
    return (
      <article className="history-ref-card" key={b.id}>
        <div className="history-ref-booking">
          <div className="history-ref-avatar" aria-hidden="true"><UserRound /></div>
          <div className="history-ref-customer">
            <strong>{b.customerName || 'Customer'}</strong>
            <span>{dateText} · {timeLabel(b.slotStart)} – {timeLabel(b.slotEnd)}</span>
            <small>{b.phone || '—'} · {bookingTypeLabel(b)}</small>
          </div>
        </div>
        <div className="history-ref-financial">
          <div><span>Total</span><strong>{money(total)}</strong></div>
          <div><span>Paid</span><strong>{money(paid)}</strong></div>
          <div><span>Due</span><strong>{money(due)}</strong></div>
        </div>
        <div className="history-ref-status">
          <StatusBadge status={b.status} />
          <span className={`history-ref-payment ${due <= 0 ? 'paid' : 'due'}`}>{paymentState}</span>
        </div>
        <div className="history-ref-action">
          <button className="secondary small" type="button" onClick={() => setDetailBooking(b)}>
            View <ArrowRight />
          </button>
        </div>
      </article>
    );
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="TESTWEB TURF · ADMIN"
        title="Booking History"
        subtitle="Past matches are retained for 15 days from their scheduled slot start time."
        actions={<button className="secondary" onClick={() => { window.history.pushState({}, '', '/admin/bookings'); window.dispatchEvent(new PopStateEvent('popstate')); }}><ArrowLeft /> Bookings</button>}
      />

      <section className="history-ref-filters">
        <div className="history-ref-search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applySearch(); }}
            placeholder="Search customer, phone, booking ID or transaction ID..."
            aria-label="Search bookings"
          />
          <button type="button" onClick={applySearch} aria-label="Search bookings"><Search /></button>
        </div>
        <label className="history-ref-filter-field">DATE<input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Filter by date" /></label>
        <label className="history-ref-filter-field">SOURCE<select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source">
          <option value="all">All sources</option><option value="public">Public Booking</option><option value="admin">Admin Booking</option>
        </select></label>
      </section>

      <section className="history-ref-section">
        <button className="history-ref-section-head" type="button" onClick={() => setUpcomingOpen(v => !v)} aria-expanded={upcomingOpen}>
          <span><strong>UPCOMING MATCHES</strong><em>{upcoming.length}</em></span>
          {upcomingOpen ? <ChevronUp /> : <ChevronDown />}
        </button>
        {upcomingOpen && (
          upcoming.length ? <div className="history-ref-list">{upcoming.map(renderBooking)}</div> : <EmptyState icon={CalendarCheck} title="No upcoming matches found." text="" />
        )}
      </section>

      <section className="history-ref-section">
        <button className="history-ref-section-head" type="button" onClick={() => setPlayedOpen(v => !v)} aria-expanded={playedOpen}>
          <span><strong>PLAYED MATCHES</strong><em>{played.length}</em></span>
          {playedOpen ? <ChevronUp /> : <ChevronDown />}
        </button>
        {playedOpen && (
          played.length ? <div className="history-ref-list">{played.map(renderBooking)}</div> : <EmptyState icon={CalendarCheck} title="No played matches found." text="" />
        )}
      </section>

      {detail && (
        <Modal title="Booking Details" onClose={() => setDetailBooking(null)}>
          <div className="history-ref-detail-grid">
            <section className="history-ref-detail-block">
              <div className="history-ref-block-title">CUSTOMER INFORMATION</div>
              <div className="history-ref-info-grid">
                <div><span>Name</span><strong>{detail.customerName || '—'}</strong></div>
                <div><span>Phone</span><strong>{detail.phone || '—'}</strong></div>
                <div><span>Date</span><strong>{displayDate(bookingDate(detail), { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
                <div><span>Time</span><strong>{timeLabel(detail.slotStart)} – {timeLabel(detail.slotEnd)}</strong></div>
                <div><span>Duration</span><strong>{Number(detail.duration || 0)} minutes</strong></div>
                <div><span>Shift</span><strong>{detail.shift ? String(detail.shift).replace(/^./, x => x.toUpperCase()) : '—'}</strong></div>
                <div><span>Booking Type</span><strong>{bookingTypeLabel(detail)}</strong></div>
                <div><span>Status</span><strong><StatusBadge status={detail.status} /></strong></div>
              </div>
            </section>

            <section className="history-ref-detail-block">
              <div className="history-ref-block-title">FINANCIAL SUMMARY</div>
              <div className="history-ref-finance-stack">
                <div><span>Total</span><strong>{money(paymentValues(detail).total)}</strong></div>
                <div><span>Paid</span><strong>{money(paymentValues(detail).paid)}</strong></div>
                <div className="due"><span>Due</span><strong>{money(paymentValues(detail).due)}</strong></div>
              </div>
              <div className="history-ref-block-title history-ref-identifiers-title">IDENTIFIERS</div>
              <div className="history-ref-info-grid">
                <div><span>Booking ID</span><strong className="history-ref-mono">{detail.id || '—'}</strong></div>
                <div><span>Transaction ID</span><strong className="history-ref-mono">{detail.transactionId || '—'}</strong></div>
              </div>
            </section>
          </div>

          <section className="history-ref-detail-block history-ref-detail-wide">
            <div className="history-ref-block-title">PAYMENT HISTORY <em>{detailPayments.length}</em></div>
            {detailPayments.length ? detailPayments.map((payment) => (
              <div className="history-ref-payment-row" key={payment.id}>
                <div><strong>{payment.note?.toLowerCase().includes('advance') ? 'Advance' : 'Payment'}</strong><span>{money(Number(payment.amount || 0))} · {payment.paymentMethod || '—'}</span></div>
                <small>{formatTimestamp(payment.createdAt || payment.paymentDate)}</small>
              </div>
            )) : <div className="history-ref-empty-row">No payment records found.</div>}
          </section>

          <section className="history-ref-detail-block history-ref-detail-wide">
            <div className="history-ref-block-title">ACTIVITY</div>
            <div className="history-ref-activity">
              {[
                ['Created by', detail.createdByName || detail.createdByEmail, detail.createdAt],
                ['Accepted by', detail.confirmedByName || detail.confirmedByEmail, detail.confirmedAt],
                ['Rejected by', detail.rejectedByName || detail.rejectedByEmail, detail.rejectedAt],
                ['Cancelled by', detail.cancelledByName || detail.cancelledByEmail, detail.cancelledAt],
                ['Edited by', detail.updatedByName || detail.updatedByEmail, detail.updatedAt],
              ].filter(([, actor, timestamp]) => actor || timestamp).map(([label, actor, timestamp]) => (
                <div key={label}><span>{label}</span><strong>{actor || '—'}</strong><small>{formatTimestamp(timestamp)}</small></div>
              ))}
              {![detail.createdAt, detail.confirmedAt, detail.rejectedAt, detail.cancelledAt, detail.updatedAt].some(Boolean) && <div className="history-ref-empty-row">No admin activity fields available.</div>}
            </div>
          </section>

          <div className="modal-actions history-ref-download-actions">
            <button className="primary" type="button" onClick={() => downloadBookingRecord(detail, detailPayments)}><Download /> Download Booking Record</button>
          </div>
        </Modal>
      )}
    </>
  );
}
