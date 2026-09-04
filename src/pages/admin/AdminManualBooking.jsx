import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Moon, Plus, Sun } from 'lucide-react';
import { useCollection, useDoc } from '../../hooks/useFirestore';
import { createManualBookingClient } from '../../services/bookingService';
import { bookingDate, bookingStatusExpired, dateShift, displayDate, localDate, money, timeLabel } from '../../utils/dateUtils';
import { generateSlots, slotPriceFromPricing } from '../../utils/slotUtils';
import { getSlotStatus } from '../../utils/slotStatus';
import { AdminPageHeader, EmptyState, LoadingState } from '../../components/ui';

export default function AdminManualBooking() {
  const params = new URLSearchParams(window.location.search);
  const initialDate = params.get('date') || localDate();
  const initialSlotKey = params.get('slot') || '';

  const bookings = useCollection('bookings');
  const [settings, settingsLoading] = useDoc('settings/config');
  const [pricing, pricingLoading] = useDoc('pricing/current');
  const today = localDate();
  const [selectedDate, setSelectedDate] = useState(initialDate < today ? today : initialDate);
  const formatSessionDate = (value) => new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }).format(new Date(`${value}T12:00:00`));
  const formatSessionWeekday = (value) => new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'Asia/Dhaka' }).format(new Date(`${value}T12:00:00`));
  const [shift, setShift] = useState('day');
  const [selectedSlotKey, setSelectedSlotKey] = useState(initialSlotKey);
  const [form, setForm] = useState({ customerName: '', phone: '', adminNote: '', advanceAmount: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);

  useEffect(() => {
    if (!showCustomerDetails) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showCustomerDetails]);

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

  const availableSlots = slots.filter((slot) => getSlotStatus(slot, bookingBySlot.get(slot.key) || null, null) === 'available');
  const selectedSlot = availableSlots.find((s) => s.key === selectedSlotKey) || null;

  async function submit(e) {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Choose an available slot first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createManualBookingClient({ slot: selectedSlot, ...form });
      setDone(true);
      setForm({ customerName: '', phone: '', adminNote: '', advanceAmount: '' });
      setSelectedSlotKey('');
    } catch (e) {
      setError(e?.message || 'Could not create the manual booking.');
    } finally {
      setBusy(false);
    }
  }

  if (settingsLoading || pricingLoading) return <LoadingState label="Loading manual booking…" />;

  if (done) {
    return (
      <section className="manual-success-page">
        <div className="manual-success-icon"><CheckCircle2 /></div>
        <span className="eyebrow">BOOKING CONFIRMED</span>
        <h2>Manual booking created</h2>
        <p>The slot is now booked and the live availability has updated.</p>
        <div className="manual-success-actions">
          <button className="secondary" onClick={() => setDone(false)}>Create another</button>
          <button className="primary" onClick={() => { window.history.pushState({}, '', '/admin/bookings'); window.dispatchEvent(new PopStateEvent('popstate')); }}>Back to bookings <ArrowLeft /></button>
        </div>
      </section>
    );
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="MANUAL BOOKING"
        title="Create a Manual Booking"
        subtitle="Reserve an available slot for a walk-in, phone customer or offline customer."
        actions={<button className="secondary" onClick={() => { window.history.pushState({}, '', '/admin/bookings'); window.dispatchEvent(new PopStateEvent('popstate')); }}><ArrowLeft /> Booking management</button>}
      />

      <div className="manual-step-flow">
        <span className="active">01 DATE</span><i /> <span className="active">02 SHIFT</span><i /> <span className={selectedSlot ? 'active' : ''}>03 SLOT</span><i /> <span className={form.customerName && selectedSlot ? 'active' : ''}>04 CUSTOMER</span>
      </div>

      <section className="manual-booking-layout">
        <div className="manual-selection-panel">
          <div className="manual-section-head">
            <div><span className="eyebrow">DATE & SHIFT</span><h3>Choose the session</h3></div>
          </div>
          <div className="slot-date-control manual-date-control">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous date"
              onClick={() => {
                const previous = dateShift(selectedDate, -1);
                if (previous >= today) setSelectedDate(previous);
              }}
              disabled={selectedDate <= today}
            ><ChevronLeft /></button>

            <div className="slot-date-main manual-date-picker-box">
              <span>{formatSessionDate(selectedDate)}</span>
              <b>{formatSessionWeekday(selectedDate)}</b>
              <input
                className="manual-date-native-input"
                type="date"
                value={selectedDate}
                min={today}
                aria-label="Choose session date"
                onChange={(e) => {
                  const nextDate = e.target.value;
                  if (nextDate && nextDate >= today) {
                    setSelectedDate(nextDate);
                    setSelectedSlotKey('');
                  }
                }}
              />
            </div>

            <button
              type="button"
              className="icon-btn"
              aria-label="Next date"
              onClick={() => setSelectedDate(dateShift(selectedDate, 1))}
            ><ChevronRight /></button>
          </div>
          <div className="segmented-control" role="group" aria-label="Shift">
            <button className={shift === 'day' ? 'active' : ''} onClick={() => { setShift('day'); setSelectedSlotKey(''); }}><Sun /> Day</button>
            <button className={shift === 'night' ? 'active' : ''} onClick={() => { setShift('night'); setSelectedSlotKey(''); }}><Moon /> Night</button>
          </div>

          <div className="manual-slot-selection">
            <div className="manual-section-head compact"><div><span className="eyebrow">AVAILABLE SLOT</span><h3>{availableSlots.length} ready</h3></div></div>
            {availableSlots.length ? (
              <div className="manual-slot-grid">
                {availableSlots.map((slot) => (
                  <button key={slot.key} className={`manual-slot-choice ${selectedSlotKey === slot.key ? 'active' : ''}`} onClick={() => { setSelectedSlotKey(slot.key); setError(''); setShowCustomerDetails(true); }}>
                    <span><Clock3 /> {timeLabel(slot.start)} – {timeLabel(slot.end)}</span>
                    <strong>{money(slot._price)}</strong>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState icon={CalendarDays} title="No available slots" text="Try another date or shift." />
            )}
          </div>
        </div>

      {showCustomerDetails && selectedSlot && (
        <div className="manual-customer-overlay" role="dialog" aria-modal="true" aria-label="Customer Details">
          <form className="manual-customer-panel manual-form-panel" onSubmit={submit}>
            <div className="manual-customer-panel-head">
              <button type="button" className="manual-customer-back" onClick={() => setShowCustomerDetails(false)} aria-label="Back to available slots">
                <ArrowLeft /> Back
              </button>
              <button type="button" className="icon-btn manual-customer-close" onClick={() => setShowCustomerDetails(false)} aria-label="Close customer details">
                ×
              </button>
            </div>

            <div className="manual-section-head">
              <div><span className="eyebrow">CUSTOMER DETAILS</span><h3>Enter customer information</h3></div>
            </div>

            <div className="manual-customer-session">
              <span>SELECTED SESSION</span>
              <strong>{displayDate(selectedDate, { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
              <b>{timeLabel(selectedSlot.start)} – {timeLabel(selectedSlot.end)}</b>
              <small>{selectedSlot.duration} minutes · {selectedSlot.shift === 'night' ? 'Night' : 'Day'} · {money(selectedSlot._price)}</small>
            </div>

            <label style={{ marginTop: 11 }}>CUSTOMER / BOOKING NAME
              <input
                style={{ minHeight: 44, borderRadius: 10, padding: '0 11px', fontSize: 16 }}
                autoFocus required minLength="2" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Customer or team name"
              />
            </label>
            <label style={{ marginTop: 10 }}>PHONE NUMBER <span className="muted-inline">(optional)</span>
              <input
                style={{ minHeight: 44, borderRadius: 10, padding: '0 11px', fontSize: 16 }}
                inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX"
              />
            </label>
            <label style={{ marginTop: 10 }}>ADVANCE PAYMENT
              <input
                style={{ minHeight: 44, borderRadius: 10, padding: '0 11px', fontSize: 16 }}
                type="number" inputMode="decimal" min="0" max={selectedSlot._price} step="0.01"
                value={form.advanceAmount} onChange={(e) => setForm({ ...form, advanceAmount: e.target.value })}
                placeholder="৳ 0"
              />
            </label>
            <div className="manual-payment-summary">
              <span>PAYMENT SUMMARY</span>
              <div><span>Total</span><strong>{money(selectedSlot._price)}</strong></div>
              <div><span>Advance</span><strong>{money(Math.max(0, Math.min(Number(form.advanceAmount || 0), Number(selectedSlot._price || 0))))}</strong></div>
              <div><span>Due</span><strong>{money(Math.max(0, Number(selectedSlot._price || 0) - Math.max(0, Number(form.advanceAmount || 0))))}</strong></div>
            </div>
            <label style={{ marginTop: 10 }}>OPTIONAL NOTE
              <textarea
                style={{ minHeight: 78, borderRadius: 10, padding: '10px 11px', fontSize: 16, lineHeight: 1.45, resize: 'vertical' }}
                required minLength="2" value={form.adminNote} onChange={(e) => setForm({ ...form, adminNote: e.target.value })} placeholder="Add a short booking note"
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="primary full" type="submit" disabled={busy || !selectedSlot} style={{ marginTop: 12, minHeight: 44 }}>
              {busy ? 'Creating booking…' : 'Confirm booking'} <CheckCircle2 />
            </button>
          </form>
        </div>
      )}
      </section>
    </>
  );
}
