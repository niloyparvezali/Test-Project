import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, UserRound } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { bookingDate, dateShift, localDate, money, timeLabel, TZ } from '../../utils/dateUtils';
import { zonedSlotStartMs } from '../../utils/slotStatus';
import { recordPaymentClient } from '../../services/bookingService';

function moneyValue(value) {
  return Number(value ?? 0) || 0;
}

function getBookingAmounts(booking) {
  const total = moneyValue(booking.totalAmount ?? booking.slotPrice);
  const paid = moneyValue(booking.paidAmount ?? booking.paymentAmount ?? booking.advanceAmount);
  const due = Math.max(0, moneyValue(booking.dueAmount ?? booking.remainingAmount ?? (total - paid)));
  return { total, paid, due };
}

function getOperationalDate(nowMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(nowMs));
  const current = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = `${current.year}-${current.month}-${current.day}`;
  const minutes = Number(current.hour) * 60 + Number(current.minute);
  if (minutes < 240) return dateShift(date, -1);
  if (minutes < 360) return dateShift(date, 1);
  return date;
}

function formatOperationalLabel(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: TZ
  }).format(new Date(`${date}T12:00:00`)).toUpperCase();
}

export default function AdminCollection() {
  const bookings = useCollection('bookings');
  const [view, setView] = useState('today');
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const operationalDate = getOperationalDate(nowMs);
  const startMs = zonedSlotStartMs(operationalDate, '06:00', TZ);
  const endMs = zonedSlotStartMs(dateShift(operationalDate, 1), '04:00', TZ);

  const dueEntries = useMemo(() => bookings
    .filter((booking) => booking?.id && booking.status !== 'cancelled')
    .map((booking) => {
      const startDate = String(booking.slotStartDate || bookingDate(booking) || '');
      const start = startDate && booking.slotStart ? zonedSlotStartMs(startDate, booking.slotStart, TZ) : Number.NaN;
      const amounts = getBookingAmounts(booking);
      return { booking, ...amounts, start, startDate };
    })
    .filter((entry) => entry.due > 0 && Number.isFinite(entry.start)), [bookings]);

  const todayEntries = useMemo(() => dueEntries
    .filter((entry) => entry.start >= startMs && entry.start < endMs)
    .sort((a, b) => a.start - b.start), [dueEntries, startMs, endMs]);

  const archiveEntries = useMemo(() => dueEntries
    .filter((entry) => !(entry.start >= startMs && entry.start < endMs))
    .sort((a, b) => {
      const aFuture = a.start >= endMs;
      const bFuture = b.start >= endMs;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return aFuture ? a.start - b.start : b.start - a.start;
    }), [dueEntries, startMs, endMs]);

  const openPayment = (entry, fromView) => {
    if (!entry?.booking || entry.due <= 0) return;
    setView('payment');
    setSelected({ ...entry, fromView });
    setAmount(String(entry.due));
    setMethod('Cash');
    setNote('');
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const goBack = () => {
    if (busy) return;
    const destination = selected?.fromView || (view === 'archive' ? 'archive' : 'today');
    setSelected(null);
    setAmount('');
    setNote('');
    setError('');
    setView(destination);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const recordPayment = async () => {
    if (!selected?.booking || busy) return;
    const liveAmounts = getBookingAmounts(selected.booking);
    const value = Math.round(Number(amount || 0) * 1000) / 1000;
    setError('');
    if (!Number.isFinite(value) || value <= 0) return setError('Payment amount must be greater than zero.');
    if (value > liveAmounts.due) return setError('Payment cannot be greater than the remaining due amount.');
    if (!['Cash', 'bKash', 'Nagad', 'Rocket'].includes(method)) return setError('Please select a payment method.');
    setBusy(true);
    try {
      await recordPaymentClient({
        bookingId: selected.booking.id,
        amount: value,
        paymentMethod: method,
        paymentDate: new Date().toISOString().slice(0, 10),
        note: note.trim() || `${method} payment recorded from Collection`
      });
      setSuccess('Payment recorded successfully.');
      const destination = selected.fromView || 'today';
      setSelected(null);
      setAmount('');
      setNote('');
      setError('');
      setView(destination);
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (err) {
      setError(err?.code === 'permission-denied' ? 'You do not have permission to record this payment.' : 'Could not record the payment. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (view === 'payment' && selected) {
    const b = selected.booking;
    const live = getBookingAmounts(b);
    return (
      <section className="admin-collection-page admin-collection-payment-page">
        <div className="collection-page-heading">
          <button className="collection-back-button" type="button" onClick={goBack} disabled={busy}><ArrowLeft /> Back</button>
          <div>
            <span className="eyebrow">COLLECTION</span>
            <h2>Update Payment</h2>
            <p>Record an outstanding customer payment.</p>
          </div>
        </div>

        <div className="collection-payment-shell">
          <div className="collection-payment-summary">
            <div className="collection-summary-heading"><UserRound /><div><span className="collection-kicker">CUSTOMER / BOOKING</span><h3>{b.customerName || 'Customer'}</h3><p>{b.phone || 'No phone on record'} · {b.bookingType === 'manual_admin' ? 'Admin Booking' : 'Public Booking'}</p></div></div>
            <div className="collection-booking-grid">
              <div><span>Date</span><strong>{b.slotStartDate || bookingDate(b)}</strong></div>
              <div><span>Time</span><strong>{timeLabel(b.slotStart)} – {timeLabel(b.slotEnd)}</strong></div>
              <div><span>Duration</span><strong>{b.duration || b.slotDuration || '—'}</strong></div>
              <div><span>Shift</span><strong>{b.shift || '—'}</strong></div>
              <div><span>Source</span><strong>{b.bookingType === 'manual_admin' ? 'Admin Booking' : 'Public Booking'}</strong></div>
            </div>
          </div>

          <div className="collection-payment-summary">
            <div className="collection-kicker">PAYMENT SUMMARY</div>
            <div className="collection-financial-grid">
              <div><span>Total</span><strong>{money(live.total)}</strong></div>
              <div><span>Paid</span><strong>{money(live.paid)}</strong></div>
              <div className="due"><span>Due</span><strong>{money(live.due)}</strong></div>
            </div>
          </div>

          <div className="collection-payment-form">
            <label><span>AMOUNT TO COLLECT</span><input className="collection-input" type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label><span>PAYMENT METHOD</span><select className="collection-input" value={method} onChange={(e) => setMethod(e.target.value)}><option value="Cash">Cash</option><option value="bKash">bKash</option><option value="Nagad">Nagad</option><option value="Rocket">Rocket</option></select></label>
            <label><span>OPTIONAL NOTE</span><textarea className="collection-input collection-note" rows="3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note..." /></label>
            {error && <p className="error">{error}</p>}
            <div className="collection-payment-actions"><button className="secondary" type="button" onClick={goBack} disabled={busy}><ArrowLeft /> Back</button><button className="primary" type="button" onClick={recordPayment} disabled={busy}>{busy ? 'Recording…' : 'Record Payment'}</button></div>
          </div>
        </div>
      </section>
    );
  }

  const entries = view === 'archive' ? archiveEntries : todayEntries;
  const isArchive = view === 'archive';

  return (
    <section className="admin-collection-page">
      <div className="collection-page-heading">
        <div>
          <span className="eyebrow">COLLECTION</span>
          <h2>{isArchive ? 'Payment Archive' : 'Collect customer payments'}</h2>
          <p>{isArchive ? 'Unpaid and partially paid bookings.' : 'Collect outstanding payments from today’s operational day.'}</p>
        </div>
        {isArchive && <button className="collection-back-button" type="button" onClick={() => { setView('today'); setSuccess(''); window.scrollTo({ top: 0, behavior: 'auto' }); }}><ArrowLeft /> Today</button>}
      </div>

      {!isArchive && (
        <div className="collection-operational-banner">
          <div><span className="collection-kicker">TODAY</span><strong>{formatOperationalLabel(operationalDate)}</strong></div>
          <span>6:00 AM → 4:00 AM next day</span>
        </div>
      )}

      {success && <div className="success collection-success" role="status"><p>{success}</p></div>}

      {!isArchive && <div className="collection-section-title">DUE TODAY · {todayEntries.length} BOOKINGS</div>}
      <div className="collection-queue">
        {entries.length ? entries.map((entry) => {
          const b = entry.booking;
          const archiveDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', timeZone: TZ }).format(new Date(`${entry.startDate}T12:00:00`));
          return (
            <div className="collection-queue-row" key={b.id}>
              <div className="collection-queue-customer"><b>{b.customerName || 'Customer'}</b>{isArchive && <small>{archiveDate} · {timeLabel(b.slotStart)} – {timeLabel(b.slotEnd)}</small>}{!isArchive && <small>{timeLabel(b.slotStart)} – {timeLabel(b.slotEnd)}</small>}</div>
              <div className="collection-queue-due"><span>Due</span><strong>{money(entry.due)}</strong></div>
              <button className="primary small collection-collect-button" type="button" onClick={() => openPayment(entry, isArchive ? 'archive' : 'today')}>Collect</button>
            </div>
          );
        }) : <div className="collection-empty">{isArchive ? 'No unpaid or due bookings.' : 'No due bookings in today’s operational day.'}</div>}
      </div>

      {!isArchive && (
        <button className="collection-archive-entry" type="button" onClick={() => { setView('archive'); setSuccess(''); window.scrollTo({ top: 0, behavior: 'auto' }); }}>
          <span><b>ARCHIVE</b><small>All unpaid / due bookings</small></span><span aria-hidden="true">›</span>
        </button>
      )}
    </section>
  );
}
