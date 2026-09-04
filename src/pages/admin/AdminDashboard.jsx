import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarCheck, CheckCircle2, Clock3, Plus, ReceiptText, Wallet, CreditCard, Search, Phone } from 'lucide-react';
import { useCollection, useDoc } from '../../hooks/useFirestore';
import { bookingDate, bookingStatusExpired, localDate, money, timeLabel, dateShift, displayDate, TZ } from '../../utils/dateUtils';
import { zonedSlotStartMs } from '../../utils/slotStatus';
import { generateSlots } from '../../utils/slotUtils';
import { getSlotStatus } from '../../utils/slotStatus';
import { AdminPageHeader, EmptyState, LoadingState, Modal } from '../../components/ui';

export default function AdminDashboard({ go }) {
  const bookings = useCollection('bookings');
  const payments = useCollection('payments');
  const expenses = useCollection('expenses');
  const [settings, settingsLoading] = useDoc('settings/config');

  const today = localDate();
  const [period, setPeriod] = useState('month');
  const [callsOpen, setCallsOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);


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
  const periodTrend = useMemo(() => {
    if (period === 'month') {
      const year = Number(today.slice(0, 4));
      const month = Number(today.slice(5, 7));
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      return Array.from({ length: daysInMonth }, (_, index) => {
        const day = String(index + 1).padStart(2, '0');
        const key = `${today.slice(0, 7)}-${day}`;
        const value = payments
          .filter((p) => String(p.paymentDate || '').slice(0, 10) === key)
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        return { key, label: (index === 0 || (index + 1) % 5 === 0 || index === daysInMonth - 1) ? String(index + 1) : '', value };
      });
    }

    return Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, '0');
      const key = `${today.slice(0, 4)}-${month}`;
      const value = payments
        .filter((p) => String(p.paymentDate || '').startsWith(key))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      return {
        key,
        label: new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: TZ }).format(new Date(`${key}-01T00:00:00`)),
        value
      };
    });
  }, [period, today, payments]);


  const upcomingCallQueue = useMemo(() => {
    const currentParts = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(nowMs));
    const current = Object.fromEntries(currentParts.map((part) => [part.type, part.value]));
    const calendarDate = `${current.year}-${current.month}-${current.day}`;
    const currentMinutes = Number(current.hour) * 60 + Number(current.minute);

    // The operational day is 06:00 through 04:00 next day.
    // During the 04:00–06:00 gap, move to the next operational day.
    const operationalDate = currentMinutes < 240
      ? dateShift(calendarDate, -1)
      : currentMinutes < 360
        ? dateShift(calendarDate, 1)
        : calendarDate;

    const operationalStartMs = zonedSlotStartMs(operationalDate, '06:00', TZ);
    const operationalEndMs = zonedSlotStartMs(dateShift(operationalDate, 1), '04:00', TZ);

    const calls = bookings
      .filter((booking) => booking.status === 'confirmed' && String(booking.phone || '').trim())
      .map((booking) => {
        const startDate = booking.slotStartDate || bookingDate(booking);
        const start = zonedSlotStartMs(startDate, booking.slotStart, TZ);
        return { booking, start, startDate };
      })
      .filter(({ start }) => (
        start > nowMs &&
        start >= operationalStartMs &&
        start < operationalEndMs
      ))
      .sort((a, b) => a.start - b.start)
      .slice(0, 25);

    return { operationalDate, calls };
  }, [bookings, nowMs]);

  const upcomingCalls = upcomingCallQueue.calls;
  const upcomingCallsLabel = useMemo(() => new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: TZ
  }).format(new Date(`${upcomingCallQueue.operationalDate}T12:00:00`)).toUpperCase(), [upcomingCallQueue.operationalDate]);

  if (settingsLoading) return <LoadingState label="Loading admin home…" />;

  return (
    <>
      <AdminPageHeader
        eyebrow="ADMIN HOME"
        title="Konabari Turf"
        subtitle="Good Evening, Admin · Here’s what’s happening today."
        actions={<button className="primary" onClick={() => go('slots')}><CalendarCheck /> Open bookings</button>}
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
        <div className="home-stat-card"><span>Available slots</span><strong>{todaySlotCounts.available}</strong><small>Ready to book today</small><CheckCircle2 /></div>
        <div className="home-stat-card"><span>Today’s revenue</span><strong>{money(todayRevenue)}</strong><small>Recorded payments</small><Wallet /></div>
      </div>

      <section className="home-actions">
        <div className="section-title-row">
          <div><span className="eyebrow">QUICK ACTIONS</span><h3>Run the day faster</h3></div>
        </div>
        <div className="quick-action-grid-v3">
          <button onClick={() => go('manual-booking')}><Plus /><span><b>MANUAL BOOKING</b><small>Book an offline customer</small></span><ArrowRight /></button>
          <button className="home-more-tool-action" onClick={() => setCallsOpen(true)}>
            <Phone /><span><b>UPCOMING CALLS</b><small>{upcomingCalls.length ? `${upcomingCalls.length} customer${upcomingCalls.length === 1 ? '' : 's'} · Call upcoming customers` : 'No upcoming customers to call'}</small></span><ArrowRight />
          </button>
          <button className="home-more-tool-action" onClick={() => go('collection')}>
            <CreditCard /><span><b>COLLECT PAYMENT</b><small>Record a customer's payment</small></span><ArrowRight />
          </button>
        </div>
      </section>

      {callsOpen && (
        <Modal title="Upcoming Calls" onClose={() => setCallsOpen(false)}>
          <div className="upcoming-calls-panel">
            <div className="upcoming-calls-day">TODAY · {upcomingCallsLabel}</div>
            <p className="upcoming-calls-intro">Next customers to contact</p>
            {upcomingCalls.length ? upcomingCalls.map(({ booking }) => (
              <div key={booking.id} className="upcoming-call-item">
                <div>
                  <b>{booking.customerName || 'Customer'}</b>
                  <span>{timeLabel(booking.slotStart)} – {timeLabel(booking.slotEnd)}</span>
                  {String(booking.slotStartDate || bookingDate(booking)) !== upcomingCallQueue.operationalDate && (
                    <small>{booking.slotStartDate || bookingDate(booking)}</small>
                  )}
                  <small>{booking.phone}</small>
                </div>
                <a className="small" href={`tel:${String(booking.phone).replace(/[^+\d]/g, '')}`}><Phone /> Call</a>
              </div>
            )) : <div className="quick-payment-empty">No upcoming customers to call.</div>}
          </div>
        </Modal>
      )}

      <section className="home-period-card home-period-card-v2">
        <div className="home-period-head-v2">
          <div className="home-period-title-v2">
            <span className="eyebrow">PERIOD SNAPSHOT</span>
            <h3>Business pulse</h3>
            <p>Key numbers for your selected period.</p>
          </div>
          <div className="home-period-mode">
            <div className="segmented-control compact">
              <button type="button" className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>Month</button>
              <button type="button" className={period === 'year' ? 'active' : ''} onClick={() => setPeriod('year')}>Year</button>
            </div>
            <div className="home-period-label" aria-live="polite">
              <CalendarCheck size={14} aria-hidden="true" />
              <span>{period === 'month' ? new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(`${today.slice(0, 7)}-01T00:00:00`)) : today.slice(0, 4)}</span>
            </div>
          </div>
        </div>

        <div className="home-period-grid home-period-grid-v2">
          <div className="home-period-metric">
            <CalendarCheck aria-hidden="true" />
            <span>Total bookings</span>
            <strong>{periodBookings}</strong>
          </div>
          <div className="home-period-metric">
            <Wallet aria-hidden="true" />
            <span>Total revenue</span>
            <strong>{money(periodRevenue)}</strong>
          </div>
          <div className="home-period-metric">
            <ReceiptText aria-hidden="true" />
            <span>Today's expenses</span>
            <strong>{money(todayExpenses)}</strong>
          </div>
          <div className="home-period-metric">
            <Wallet aria-hidden="true" />
            <span>Today's net</span>
            <strong>{money(todayRevenue - todayExpenses)}</strong>
          </div>
        </div>

        <div className="home-period-trend">
          <div className="home-period-trend-head">
            <div>
              <span className="home-period-trend-eyebrow">REVENUE TREND</span>
              <small>{period === 'month' ? 'Daily revenue' : 'Monthly revenue'}</small>
            </div>
            <span className="home-period-trend-total">{money(periodRevenue)}</span>
          </div>
          <div className="home-period-chart" role="img" aria-label={`Revenue trend for ${period === 'month' ? 'the selected month' : 'the selected year'}`}>
            {periodTrend.length ? (
              <>
                <svg className="home-period-chart-svg" viewBox="0 0 720 190" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="homePeriodArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--ad-lime)" stopOpacity=".28" />
                      <stop offset="100%" stopColor="var(--ad-lime)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0, 1, 2, 3].map((line) => {
                    const y = 22 + line * 42;
                    return <line key={line} x1="42" x2="708" y1={y} y2={y} className="home-period-gridline" />;
                  })}
                  {(() => {
                    const values = periodTrend.map((item) => item.value);
                    const max = Math.max(...values, 1);
                    const min = Math.min(...values, 0);
                    const span = Math.max(max - min, 1);
                    const points = periodTrend.map((item, index) => {
                      const x = periodTrend.length === 1 ? 375 : 42 + (index / (periodTrend.length - 1)) * 666;
                      const y = 150 - ((item.value - min) / span) * 112;
                      return { ...item, x, y };
                    });
                    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
                    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} 150 L ${points[0].x.toFixed(2)} 150 Z`;
                    return (
                      <>
                        <path d={areaPath} className="home-period-area" />
                        <path d={linePath} className="home-period-line" />
                        {points.map((point) => <circle key={point.key} cx={point.x} cy={point.y} r="3.2" className="home-period-point" />)}
                      </>
                    );
                  })()}
                </svg>
                <div className="home-period-chart-axis">
                  {periodTrend.map((item) => <span key={item.key}>{item.label}</span>)}
                </div>
              </>
            ) : (
              <div className="home-period-chart-empty">No payment revenue recorded for this period.</div>
            )}
          </div>
        </div>
      </section>

      <section className="home-link-list">
        <button onClick={() => go('activity')}><ReceiptText /><span><b>RECENT ACTIVITY</b><small>Latest booking and payment events</small></span><ArrowRight /></button>
        <button onClick={() => go('history')}><CalendarCheck /><span><b>BOOKING HISTORY</b><small>View confirmed booking records</small></span><ArrowRight /></button>
      </section>
    </>
  );
}
