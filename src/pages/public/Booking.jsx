import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateSlots, slotPriceFromPricing } from '../../utils/slotUtils';
import { getOperatingInterval, localDate, timeLabel, validDateInput } from '../../utils/dateUtils';
import { getSlotStatus } from '../../utils/slotStatus';
import PublicHeader from '../../components/public/PublicHeader';
import ModeSwitcher from '../../components/public/ModeSwitcher';
import BookingHeader from '../../components/booking/BookingHeader';
import DateSelector from '../../components/booking/DateSelector';
import DayNightSelector from '../../components/booking/DayNightSelector';
import AvailabilitySummary from '../../components/booking/AvailabilitySummary';
import SlotCard from '../../components/booking/SlotCard';
import BookingGuidelines from '../../components/booking/BookingGuidelines';
import BookingModal from '../../components/booking/BookingModal';

function SkeletonSlot() {
  return <div className="booking-slot-skeleton" aria-hidden="true"><i /><i /><i /><i /></div>;
}

export default function Booking({ go, turf = {}, settings = {}, pricing = {} }) {
  const [date, setDate] = useState(localDate());
  const [shift, setShift] = useState('day');
  const [locks, setLocks] = useState([]);
  const [locksLoading, setLocksLoading] = useState(true);
  const [locksError, setLocksError] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const today = localDate();
    if (!validDateInput(date) || date < today) setDate(today);
  }, [date]);

  useEffect(() => {
    setLocksLoading(true);
    setLocksError(false);
    return onSnapshot(
      query(collection(db, 'slotLocks'), where('sessionDate', '==', date)),
      snap => {
        setLocks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLocksLoading(false);
      },
      () => {
        setLocks([]);
        setLocksLoading(false);
        setLocksError(true);
      }
    );
  }, [date]);

  const slots = useMemo(
    () => generateSlots(date, settings).filter(slot => slot.shift === shift),
    [date, settings, shift]
  );

  const pricedSlots = useMemo(
    () => slots.map(slot => ({ ...slot, price: slotPriceFromPricing(slot, pricing, settings) })),
    [slots, pricing, settings]
  );

  const lockMap = useMemo(() => new Map(locks.map(lock => [lock.id, lock])), [locks]);
  const rows = useMemo(
    () => pricedSlots.map(slot => ({ slot, status: getSlotStatus(slot, null, lockMap.get(slot.key)) })),
    [pricedSlots, lockMap]
  );

  const counts = useMemo(
    () => rows.reduce((acc, row) => {
      acc[row.status] += 1;
      acc.total += 1;
      return acc;
    }, { total: 0, available: 0, pending: 0, booked: 0 }),
    [rows]
  );

  const operatingInterval = settings.openingTime && settings.closingTime
    ? getOperatingInterval(date, settings.openingTime, settings.closingTime)
    : null;
  const sessionStart = shift === 'day' ? operatingInterval?.startTime : settings.dayBoundary;
  const sessionEnd = shift === 'day' ? settings.dayBoundary : operatingInterval?.endTime;
  const hours = operatingInterval && sessionStart && sessionEnd
    ? `${timeLabel(sessionStart)} — ${timeLabel(sessionEnd)}${shift === 'night' && operatingInterval.startDate !== operatingInterval.endDate ? ' (next day)' : ''}`
    : '';

  const allBooked = counts.total > 0 && counts.booked === counts.total;
  const allPending = counts.total > 0 && counts.pending === counts.total;

  return (
    <div className="bt-app bt-booking-page">
      <PublicHeader />
      <main className="booking-main container-public">
        <BookingHeader go={go} />
        <div className="booking-planning-grid">
          <DateSelector date={date} setDate={setDate} />
          <DayNightSelector shift={shift} setShift={setShift} />
        </div>

        <div className="booking-results-head">
          <div>
            <span className="bt-eyebrow">{shift === 'day' ? 'DAY' : 'NIGHT'} SESSIONS</span>
            <h2>Available sessions</h2>
          </div>
          {hours && <span className="booking-hours">{hours}</span>}
        </div>

        <AvailabilitySummary
          total={counts.total}
          available={counts.available}
          booked={counts.booked}
          pending={counts.pending}
          loading={locksLoading}
        />

        <section className="booking-slots-section" aria-labelledby="slots-title">
          <div className="booking-slots-title">
            <h2 id="slots-title">Slots</h2>
            <span>{date}</span>
          </div>

          {locksError ? (
            <div className="booking-state-card error-state" role="alert">
              <strong>Unable to load session availability.</strong>
              <span>Please try again.</span>
            </div>
          ) : locksLoading ? (
            <div className="booking-slot-grid" aria-busy="true">
              {Array.from({ length: Math.min(Math.max(slots.length, 4), 8) }).map((_, index) => <SkeletonSlot key={index} />)}
            </div>
          ) : !rows.length ? (
            <div className="booking-state-card">
              <strong>NO SESSIONS AVAILABLE</strong>
              <span>There are currently no bookable sessions for this selection.</span>
            </div>
          ) : allBooked ? (
            <div className="booking-state-card">
              <strong>NO AVAILABLE SESSIONS</strong>
              <span>All sessions for this period have been booked.</span>
            </div>
          ) : allPending ? (
            <div className="booking-state-card">
              <strong>ALL SESSIONS ARE AWAITING CONFIRMATION</strong>
              <span>Please check another session or date.</span>
            </div>
          ) : (
            <div className="booking-slot-grid">
              {rows.map(({ slot, status }) => (
                <SlotCard
                  key={slot.key}
                  slot={slot}
                  price={slot.price}
                  status={status}
                  onBook={event => setSelected({ slot, opener: event?.currentTarget || null })}
                />
              ))}
            </div>
          )}
        </section>

        <div className="booking-support-grid">
          <BookingGuidelines rules={Array.isArray(turf.rules) ? turf.rules : []} />
          <div className="booking-note">
            <span className="bt-eyebrow">BOOKING FLOW</span>
            <h3>Choose a slot, send the required advance, and submit your request.</h3>
            <p>Your booking remains pending until the turf admin verifies the payment.</p>
          </div>
        </div>
      </main>

      <ModeSwitcher route="/book" go={go} />

      {selected && (
        <BookingModal
          slot={selected.slot}
          turf={turf}
          settings={settings}
          returnFocusEl={selected.opener}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
