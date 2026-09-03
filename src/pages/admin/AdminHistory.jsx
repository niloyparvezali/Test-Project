import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, CalendarCheck, UserRound } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { bookingDate, displayDate, money, timeLabel } from '../../utils/dateUtils';
import { isBookingHistoryRetained as retainedBySlot } from '../../utils/slotStatus';
import { AdminPageHeader, EmptyState, StatusBadge } from '../../components/ui';

export default function AdminHistory() {
  const bookings = useCollection('bookings');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [source, setSource] = useState('all');

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return bookings
      .filter((b) => b.status === 'confirmed' && retainedBySlot(b))
      .filter((b) => source === 'all' || (source === 'admin' ? b.bookingType === 'manual_admin' : b.bookingType !== 'manual_admin'))
      .filter((b) => !from || bookingDate(b) >= from)
      .filter((b) => !to || bookingDate(b) <= to)
      .filter((b) => !query || `${b.customerName || ''} ${b.phone || ''} ${b.id || ''} ${b.transactionId || ''} ${b.adminNote || ''}`.toLowerCase().includes(query))
      .sort((a, b) => String(b.sessionDate || b.date || '').localeCompare(String(a.sessionDate || a.date || '')) || String(b.slotStart || '').localeCompare(String(a.slotStart || '')));
  }, [bookings, q, from, to, source]);

  return (
    <>
      <AdminPageHeader
        eyebrow="BOOKING HISTORY"
        title="Booking History"
        subtitle="Confirmed bookings retained through actual scheduled slot start + 7 days."
        actions={<button className="secondary" onClick={() => { window.history.pushState({}, '', '/admin/bookings'); window.dispatchEvent(new PopStateEvent('popstate')); }}><ArrowLeft /> Bookings</button>}
      />

      <section className="history-filter-panel">
        <div className="history-search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, phone, booking ID or transaction ID…" /></div>
        <div className="history-filter-grid">
          <label>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label>Source<select value={source} onChange={(e) => setSource(e.target.value)}><option value="all">All sources</option><option value="public">Public bookings</option><option value="admin">Admin bookings</option></select></label>
        </div>
      </section>

      {rows.length ? (
        <section className="history-results-panel">
          <div className="history-results-head"><span>{rows.length} retained booking{rows.length === 1 ? '' : 's'}</span></div>
          <div className="history-list-v3">
            {rows.map((b) => (
              <article className="history-booking-card" key={b.id}>
                <div className="history-booking-main">
                  <div className="history-avatar"><UserRound /></div>
                  <div>
                    <strong>{b.customerName || 'Customer'}</strong>
                    <span>{displayDate(bookingDate(b), { day: '2-digit', month: 'short', year: 'numeric' })} · {timeLabel(b.slotStart)} – {timeLabel(b.slotEnd)}</span>
                    <small>{b.phone || 'No phone'} · {b.bookingType === 'manual_admin' ? 'Admin booking' : 'Public booking'}</small>
                  </div>
                </div>
                <div className="history-booking-side">
                  <strong>{money(b.totalAmount || b.slotPrice || 0)}</strong>
                  <StatusBadge status="confirmed" />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="history-results-panel"><EmptyState icon={CalendarCheck} title="No retained bookings found" text="Adjust your search or date filters." /></section>
      )}
    </>
  );
}
