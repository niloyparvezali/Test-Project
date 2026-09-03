import React from 'react';
import { sanitizeName, sanitizePhone } from '../../utils/validation';

export default function CustomerDetailsStep({ form, setForm, errors, onNext }) {
  const handleNameChange = event => {
    const nextValue = sanitizeName(event.target.value);
    setForm(current => ({ ...current, customerName: nextValue }));
  };

  const handlePhoneChange = event => {
    const nextValue = sanitizePhone(event.target.value);
    setForm(current => ({ ...current, phone: nextValue }));
  };

  return (
    <div className="booking-wizard-step">
      <div className="booking-step-section-head">
        <span className="bt-eyebrow">YOUR DETAILS</span>
        <p>We’ll use these details for your booking request.</p>
      </div>

      <div className="booking-field-stack">
        <label>
          <span>NAME</span>
          <input
            autoFocus
            type="text"
            autoComplete="name"
            value={form.customerName}
            onChange={handleNameChange}
            onPaste={event => {
              event.preventDefault();
              const pasted = sanitizeName(event.clipboardData.getData('text'));
              setForm(current => ({ ...current, customerName: pasted }));
            }}
            placeholder="Enter your full name"
            aria-invalid={Boolean(errors.customerName)}
            aria-describedby={errors.customerName ? 'booking-name-error' : undefined}
          />
          {errors.customerName && <small id="booking-name-error" className="booking-field-error">{errors.customerName}</small>}
        </label>

        <label>
          <span>CONTACT NUMBER</span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={11}
            value={form.phone}
            onChange={handlePhoneChange}
            onPaste={event => {
              event.preventDefault();
              const pasted = sanitizePhone(event.clipboardData.getData('text'));
              setForm(current => ({ ...current, phone: pasted }));
            }}
            placeholder="01XXXXXXXXX"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'booking-phone-error' : undefined}
          />
          {errors.phone && <small id="booking-phone-error" className="booking-field-error">{errors.phone}</small>}
        </label>
      </div>

      <button type="button" className="bt-btn bt-btn-primary booking-wizard-primary" onClick={onNext}>
        Next <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
