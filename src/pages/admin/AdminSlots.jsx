import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Moon, Plus, Sun } from 'lucide-react';
import { useCollection, useDoc } from '../../hooks/useFirestore';
import { bookingDate, bookingStatusExpired, dateShift, displayDate, localDate, money, timeLabel } from '../../utils/dateUtils';
import { generateSlots, slotPriceFromPricing } from '../../utils/slotUtils';
import { getSlotStatus } from '../../utils/slotStatus';
import { AdminPageHeader, EmptyState, LoadingState, StatCard } from '../../components/ui';

function SlotCard({ slot, booking, status, onBook, onOpen }) {
  return (
    <div className={`availability-slot-card ${status}`}>
      <div className="availability-slot-top">
        <div><Clock3 /><strong>{timeLabel(slot.start)} – {timeLabel(slot.end)}</strong></div>
        <span className={`slot-status-badge ${status}`}>{status.toUpperCase()}</span>
      </div>
      <div className="availability-slot-meta">
        <span>{slot.duration} min · {slot.shift === 'night' ? 'Night' : 'Day'}</span>
        <strong>{money(slot._price)}</strong>
      </div>
      {booking && <div className="availability-slot-booking"><b>{booking.customerName || 'Customer'}</b><span>{booking.bookingType === 'manual_admin' ? 'Admin booking' : 'Online request'}</span></div>}
      {status === 'available' && <button className="primary slot-book-btn" onClick={() => onBook(slot)}><Plus /> Manual book</button>}
      {status !== 'available' && <button className="slot-detail-btn" onClick={() => onOpen(booking)}>View booking <ArrowRight /></button>}
    </div>
  );
}

export default function AdminSlots() {
  const bookings = useCollection('bookings');
  const [settings, settingsLoading] = useDoc('settings/config');
  const [pricing, pricingLoading] = useDoc('pricing/current');
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [shift, setShift] = useState('day');
  const [filter, setFilter] = useState('all');

  const slots = useMemo(() => {
    if (settingsLoading || pricingLoading) return [];
    return generateSlots(selectedDate, settings)
      .filter((s) => s.shift === shift)
      .map((s) => ({ ...s, _price: slotPriceFromPricing(s, pricing, settings) }));
  }, [selectedDate, shift, settings, settingsLoading, pricing, pricingLoading]);

  const bookingBySlot = useMemo(() => {
    const map = new Map();
    bookings.forEach((b) => {
      if (bookingDate(b) !== selectedDate || !b.slotKey) return;
      const active = b.status === 'confirmed' || (b.status === 'pending_payment_verification' && !bookingStatusExpired(b));
      if (!active) return;
      const previous = map.get(b.slotKey);
      if (!previous || (b.status === 'confirmed' && previous.status !== 'confirmed')) map.set(b.slotKey, b);
    });
    return map;
  }, [bookings, selectedDate]);

  const rows = slots.map((slot) => {
    const booking = bookingBySlot.get(slot.key) || null;
    return { slot, booking, status: getSlotStatus(slot, booking, null) };
  });

  const counts = rows.reduce((acc, row) => {
    acc.total += 1;
    acc[row.status] += 1;
    return acc;
  }, { total: 0, available: 0, pending: 0, booked: 0 });

  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  const openManual = (slot) => {
    window.history.pushState({}, '', `/admin/manual-booking?date=${encodeURIComponent(selectedDate)}&slot=${encodeURIComponent(slot.key)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const openBooking = (booking) => {
    if (!booking) return;
    window.history.pushState({}, '', '/admin/history');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (settingsLoading || pricingLoading) return <LoadingState label="Loading slot availability…" />;

  return (
    <>
      <AdminPageHeader
        eyebrow="SLOT AVAILABILITY"
        title="Slot Availability"
        subtitle="See only the live operational states: available, pending or booked."
        actions={<button className="secondary" onClick={() => window.history.pushState({}, '', '/admin/bookings') || window.dispatchEvent(new PopStateEvent('popstate'))}><ArrowLeft /> Bookings</button>}
      />

      <section className="slot-control-card">
        <div className="slot-date-control">
          <button className="icon-btn" onClick={() => setSelectedDate(dateShift(selectedDate, -1))} aria-label="Previous day"><ChevronLeft /></button>
          <button className="slot-date-main" onClick={() => document.getElementById('admin-slot-date-input')?.showPicker?.()}>
            <span>{displayDate(selectedDate, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <b>{selectedDate}</b>
          </button>
          <button className="icon-btn" onClick={() => setSelectedDate(dateShift(selectedDate, 1))} aria-label="Next day"><ChevronRight /></button>
          <input id="admin-slot-date-input" className="slot-date-hidden" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          <button className="secondary" onClick={() => setSelectedDate(localDate())}><CalendarDays /> Today</button>
        </div>
        <div className="segmented-control" role="group" aria-label="Shift">
          <button className={shift === 'day' ? 'active' : ''} onClick={() => setShift('day')}><Sun /> Day</button>
          <button className={shift === 'night' ? 'active' : ''} onClick={() => setShift('night')}><Moon /> Night</button>
        </div>
      </section>

      <div className="slot-summary-grid">
        <StatCard icon={CalendarDays} label="Total" value={counts.total} meta={selectedDate} />
        <StatCard icon={Plus} label="Available" value={counts.available} meta="Ready" tone="accent" />
        <StatCard icon={Clock3} label="Pending" value={counts.pending} meta="Payment verification" />
        <StatCard icon={CalendarDays} label="Booked" value={counts.booked} meta="Confirmed" />
      </div>

      <section className="slot-availability-panel">
        <div className="slot-panel-head">
          <div>
            <span className="eyebrow">{shift === 'day' ? 'DAY SLOTS' : 'NIGHT SLOTS'}</span>
            <h3>{displayDate(selectedDate, { day: '2-digit', month: 'short', year: 'numeric' })}</h3>
          </div>
          <div className="slot-filter-row">
            {[
              ['all', 'All', counts.total],
              ['available', 'Available', counts.available],
              ['pending', 'Pending', counts.pending],
              ['booked', 'Booked', counts.booked],
            ].map(([id, label, count]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}<b>{count}</b></button>)}
          </div>
        </div>

        {visible.length ? (
          <div className="availability-slot-grid">
            {visible.map(({ slot, booking, status }) => (
              <SlotCard key={slot.key} slot={slot} booking={booking} status={status} onBook={openManual} onOpen={openBooking} />
            ))}
          </div>
        ) : (
          <EmptyState icon={CalendarDays} title="No slots in this view" text="Try a different shift or status filter." />
        )}
      </section>
    </>
  );
}
