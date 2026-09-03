import React, { useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateShift, displayDate, localDate, validDateInput } from '../../utils/dateUtils';

function normalizeDate(value, today) {
  const candidate = String(value || '').trim();
  if (!validDateInput(candidate) || candidate < today) return today;
  return candidate;
}

export default function DateSelector({ date, setDate }) {
  const inputRef = useRef(null);
  const today = localDate();
  const selectedDate = normalizeDate(date, today);
  const isToday = selectedDate === today;
  const dayName = displayDate(selectedDate, { weekday: 'long' });

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
      else input.click();
    } catch {
      input.click();
    }
  };

  const chooseDate = value => setDate(normalizeDate(value, today));

  return (
    <div className="booking-control-card booking-date-card">
      <div className="booking-control-label">
        <span>DATE</span>
      </div>

      <input
        ref={inputRef}
        className="booking-date-native-input"
        type="date"
        value={selectedDate}
        min={today}
        onChange={event => chooseDate(event.target.value)}
        aria-label="Select booking date"
      />

      <div className="booking-date-row">
        <button
          type="button"
          className="booking-circle-btn"
          aria-label="Previous date"
          disabled={isToday}
          onClick={() => setDate(dateShift(selectedDate, -1))}
        >
          <ChevronLeft aria-hidden="true" />
        </button>

        <button
          type="button"
          className="booking-date-display"
          aria-label={`Select booking date, currently ${displayDate(selectedDate, { day: '2-digit', month: 'short', year: 'numeric' })}`}
          onClick={openPicker}
        >
          <strong>{displayDate(selectedDate, { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
          <span>{isToday ? `${dayName.toUpperCase()} · TODAY` : dayName.toUpperCase()}</span>
        </button>

        <button
          type="button"
          className="booking-circle-btn"
          aria-label="Next date"
          onClick={() => setDate(dateShift(selectedDate, 1))}
        >
          <ChevronRight aria-hidden="true" />
        </button>

        <button type="button" className="booking-calendar-btn" aria-label="Select booking date" onClick={openPicker}>
          <CalendarDays aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
