import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarCheck, CheckCircle2, Clock3, Plus, ReceiptText, Wallet } from 'lucide-react';
import { useCollection, useDoc } from '../../hooks/useFirestore';
import { bookingDate, bookingStatusExpired, localDate, money } from '../../utils/dateUtils';
import { generateSlots } from '../../utils/slotUtils';
import { getSlotStatus } from '../../utils/slotStatus';
import { AdminPageHeader, EmptyState, LoadingState } from '../../components/ui';

export default function AdminDashboard({ go }) {
  const bookings = useCollection('bookings');
  const payments = useCollection('payments');
  const expenses = useCollection('expenses');
  const [settings, settingsLoading] = useDoc('settings/config');

  const today = localDate();
  const [period, setPeriod] = useState('month');

  const todaySlots = useMemo(() => (
    settingsLoading ? [] : generateSlots(today, settings)
  ), [today, settings, settingsLoading]);

  const todaySlotCounts = useMemo(() => {
    const counts = { total: todaySlots.length, available: 0, pending: 0, booked: 0 };
    todaySlots.forEach((slot) => {
      const matching = bookings.filter((b) => bookingDate(b) === today && b.slotKey === slot.key);
      const booking = matching.find((b) => b.status === 'confirmed') || matching.find((b) => b.status === 'pending_payment_verification' && !bookingStatusExpired(b)) || null;
      counts[getSlotStatus(slot, booking, null)] += 1;
    });
    return counts;
  }, [todaySlots, bookings, today]);

  const pending = bookings.filter((b) => b.status === 'pending_payment_verification' && !bookingStatusExpired(b));
  const todayBookings = bookings.filter((b) => bookingDate(b) === today && b.status === 'confirmed').length;
  const todayRevenue = payments.filter((p) => String(p.paymentDate || '').startsWith(today)).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const todayExpenses = expenses.filter((e) => String(e.date || '').startsWith(today)).reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const prefix = period === 'month' ? today.slice(0, 7) : today.slice(0, 4);
  const periodLabel = period === 'month' ? 'This month' : 'This year';
  const periodBookings = bookings.filter((b) => bookingDate(b).startsWith(prefix) && b.status === 'confirmed').length;
  const periodRevenue = payments.filter((p) => String(p.paymentDate || '').startsWith(prefix)).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  if (settingsLoading) return <LoadingState label="Loading admin home…" />;

  return (
    <>
      <AdminPageHeader
        eyebrow="ADMIN HOME"
        title="Bason Turf City"
        subtitle="A booking-first command center for today’s operations."
        actions={<button className="primary" onClick={() => go('bookings')}><CalendarCheck /> Open bookings</button>}
      />

      <section className="home-alert-card">
        <div className="home-alert-copy">
          <span className="hero-live-dot"><i /> LIVE</span>
          <h3>{pending.length ? `${pending.length} online booking request${pending.length === 1 ? '' : 's'} waiting` : 'No booking requests waiting'}</h3>
          <p>{pending.length ? 'Open Booking Management to verify payment and accept customers immediately.' : 'The request queue is clear. New online requests will appear here automatically.'}</p>
        </div>
        <button className="primary" onClick={() => go('bookings')}>{pending.length ? 'Review requests' : 'Booking management'} <ArrowRight /></button>
      </section>

      <div className="home-stats-grid">
        <div className="home-stat-card"><span>Today’s bookings</span><strong>{todayBookings}</strong><small>Confirmed sessions</small><CalendarCheck /></div>
        <div className="home-stat-card alert"><span>Pending requests</span><strong>{pending.length}</strong><small>Need payment review</small><Clock3 /></div>
        <div className="home-stat-card"><span>Available slots</span><strong>{todaySlotCounts.available}</strong><small>Ready to book today</small><CheckCircle2 /></div>
        <div className="home-stat-card"><span>Today’s revenue</span><strong>{money(todayRevenue)}</strong><small>Recorded payments</small><Wallet /></div>
      </div>

      <section className="home-quick-actions">
        <div className="section-title-row">
          <div><span className="eyebrow">QUICK ACTIONS</span><h3>Run the day faster</h3></div>
        </div>
        <div className="quick-action-grid-v3">
          <button onClick={() => go('bookings')}><CalendarCheck /><span><b>BOOKINGS</b><small>Accept online requests</small></span><ArrowRight /></button>
          <button onClick={() => go('manual-booking')}><Plus /><span><b>MANUAL BOOKING</b><small>Book an offline customer</small></span><ArrowRight /></button>
          <button onClick={() => go('slots')}><Clock3 /><span><b>SLOT AVAILABILITY</b><small>View today’s live slots</small></span><ArrowRight /></button>
        </div>
      </section>

      <section className="home-period-card">
        <div className="section-title-row">
          <div><span className="eyebrow">PERIOD SNAPSHOT</span><h3>Business pulse</h3></div>
          <div className="segmented-control compact">
            <button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Month</button>
            <button className={period === 'year' ? 'active' : ''} onClick={() => setPeriod('year')}>Year</button>
          </div>
        </div>
        <div className="home-period-grid">
          <div><span>{periodLabel} bookings</span><strong>{periodBookings}</strong></div>
          <div><span>{periodLabel} revenue</span><strong>{money(periodRevenue)}</strong></div>
          <div><span>Today expenses</span><strong>{money(todayExpenses)}</strong></div>
          <div><span>Today net</span><strong>{money(todayRevenue - todayExpenses)}</strong></div>
        </div>
      </section>

      <section className="home-link-list">
        <button onClick={() => go('activity')}><ReceiptText /><span><b>RECENT ACTIVITY</b><small>Latest booking and payment events</small></span><ArrowRight /></button>
        <button onClick={() => go('history')}><CalendarCheck /><span><b>BOOKING HISTORY</b><small>View confirmed booking records</small></span><ArrowRight /></button>
      </section>
    </>
  );
}
