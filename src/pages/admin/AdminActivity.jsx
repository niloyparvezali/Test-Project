import React, { useMemo } from 'react';
import { ArrowLeft, CalendarCheck, CreditCard, UserRound, XCircle, CheckCircle2, Wallet } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { bookingDate, bookingDisplayStatus, displayDate, money, timeLabel } from '../../utils/dateUtils';
import { AdminPageHeader, EmptyState } from '../../components/ui';

function ts(v) {
  return v && typeof v.toMillis === 'function' ? v.toMillis() : 0;
}

function activityFromBooking(b) {
  if (b.status === 'rejected' || b.verificationStatus === 'rejected') return { type: 'rejected', time: ts(b.reviewedAt) || ts(b.updatedAt) || ts(b.createdAt), title: 'Booking request rejected', meta: `${b.customerName || 'Customer'} · ${displayDate(bookingDate(b), { day: '2-digit', month: 'short' })} · ${timeLabel(b.slotStart)}–${timeLabel(b.slotEnd)}` };
  if (b.bookingType === 'manual_admin') return { type: 'manual', time: ts(b.createdAt), title: 'Manual booking created', meta: `${b.customerName || 'Customer'} · ${displayDate(bookingDate(b), { day: '2-digit', month: 'short' })} · ${timeLabel(b.slotStart)}–${timeLabel(b.slotEnd)}` };
  if (b.status === 'confirmed') return { type: 'accepted', time: ts(b.confirmedAt) || ts(b.updatedAt) || ts(b.createdAt), title: 'Online booking accepted', meta: `${b.customerName || 'Customer'} · ${displayDate(bookingDate(b), { day: '2-digit', month: 'short' })} · ${timeLabel(b.slotStart)}–${timeLabel(b.slotEnd)}` };
  return { type: 'request', time: ts(b.createdAt), title: 'Online booking request received', meta: `${b.customerName || 'Customer'} · ${displayDate(bookingDate(b), { day: '2-digit', month: 'short' })} · ${timeLabel(b.slotStart)}–${timeLabel(b.slotEnd)}` };
}

export default function AdminActivity() {
  const bookings = useCollection('bookings');
  const payments = useCollection('payments');

  const events = useMemo(() => {
    const bookingEvents = bookings.map((b) => activityFromBooking(b));
    const paymentEvents = payments.map((p) => ({
      type: 'payment',
      time: ts(p.createdAt),
      title: 'Payment verified / recorded',
      meta: `${p.paymentMethod || 'Payment'} · ${p.transactionId || 'No transaction ID'} · ${money(p.amount || 0)}`,
    }));
    return [...bookingEvents, ...paymentEvents].filter((x) => x.time).sort((a, b) => b.time - a.time).slice(0, 100);
  }, [bookings, payments]);

  const icon = {
    request: UserRound,
    accepted: CheckCircle2,
    rejected: XCircle,
    manual: CalendarCheck,
    payment: Wallet,
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="RECENT ACTIVITY"
        title="Recent Activity"
        subtitle="Latest booking and payment events from the existing Firestore records."
        actions={<button className="secondary" onClick={() => { window.history.pushState({}, '', '/admin/bookings'); window.dispatchEvent(new PopStateEvent('popstate')); }}><ArrowLeft /> Bookings</button>}
      />
      <section className="activity-page-card">
        {events.length ? (
          <div className="activity-timeline-v3">
            {events.map((event, i) => {
              const Icon = icon[event.type] || CreditCard;
              return (
                <div className="activity-event-v3" key={`${event.type}-${event.time}-${i}`}>
                  <div className={`activity-event-icon ${event.type}`}><Icon /></div>
                  <div className="activity-event-copy">
                    <b>{event.title}</b>
                    <span>{event.meta}</span>
                  </div>
                  <time>{new Date(event.time).toLocaleString('en-BD', { dateStyle: 'short', timeStyle: 'short' })}</time>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={CalendarCheck} title="No activity yet" text="New booking and payment events will appear here." />
        )}
      </section>
    </>
  );
}
