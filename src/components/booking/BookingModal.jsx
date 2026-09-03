import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { createBookingClient } from '../../services/bookingService';
import { requiredAdvanceFromSettings } from '../../utils/slotUtils';
import { sanitizeCustomerForm, sanitizePaymentForm, validateCustomerForm, validatePaymentForm } from '../../utils/validation';
import BookingStepIndicator from './BookingStepIndicator';
import SlotSummary from './SlotSummary';
import CustomerDetailsStep from './CustomerDetailsStep';
import PaymentDetailsStep from './PaymentDetailsStep';
import BookingSuccess from './BookingSuccess';

export default function BookingModal({ slot, onClose, turf, settings, returnFocusEl }) {
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState({});
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const advance = requiredAdvanceFromSettings(slot.price, settings);

  const methods = useMemo(() => [
    ['bKash', turf?.bkashNumber],
    ['Nagad', turf?.nagadNumber],
    ['Rocket', turf?.rocketNumber],
  ], [turf]);

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    paymentMethod: '',
    sendMoneyNumber: '',
    transactionId: '',
  });

  const selectedReceiver = String(methods.find(([method]) => method === form.paymentMethod)?.[1] || '').trim();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);

    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busy) onClose();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), [href], select, textarea');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusEl?.focus?.();
    };
  }, []);

  const validateCustomer = () => {
    const sanitized = sanitizeCustomerForm(form);
    const next = validateCustomerForm(sanitized);
    setForm(current => ({ ...current, ...sanitized }));
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goToPayment = () => {
    if (validateCustomer()) {
      setErrors({});
      setStep(2);
    }
  };

  const selectMethod = method => {
    setForm(current => ({ ...current, paymentMethod: method }));
    setCopied(false);
    setErrors({});
  };

  const copyReceiver = async () => {
    if (!selectedReceiver) return;
    try {
      await navigator.clipboard.writeText(selectedReceiver);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setErrors({ form: 'Could not copy the payment number. Please copy it manually.' });
    }
  };

  const submit = async () => {
    const sanitizedForm = sanitizeCustomerForm(sanitizePaymentForm(form));
    const next = {
      ...validateCustomerForm(sanitizedForm),
      ...validatePaymentForm(sanitizedForm),
    };

    if (!sanitizedForm.paymentMethod || !selectedReceiver) {
      next.form = 'Please select an available payment method.';
    }

    setForm(current => ({ ...current, ...sanitizedForm }));
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setBusy(true);
    setErrors({});
    try {
      await createBookingClient(slot, { ...sanitizedForm, paymentAmount: advance }, turf);
      setSuccess(true);
    } catch (error) {
      setErrors({ form: error?.message || 'Booking request failed. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="booking-modal-overlay" onMouseDown={e => e.target === e.currentTarget && !busy && onClose()}>
      <div
        className="booking-wizard-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-wizard-title"
      >
        <div className="booking-wizard-head">
          <div>
            <span className="bt-eyebrow">BOOKING</span>
            <h2 id="booking-wizard-title">Complete Your Booking</h2>
          </div>
          <button ref={closeRef} type="button" className="booking-wizard-close" onClick={() => !busy && onClose()} aria-label="Close booking popup">
            <X aria-hidden="true" />
          </button>
        </div>

        {!success && <BookingStepIndicator step={step} />}
        {!success && step === 1 && <SlotSummary slot={slot} advance={advance} />}

        {success ? (
          <BookingSuccess slot={slot} onClose={onClose} />
        ) : step === 1 ? (
          <CustomerDetailsStep form={form} setForm={setForm} errors={errors} onNext={goToPayment} />
        ) : (
          <PaymentDetailsStep
            methods={methods}
            selectedMethod={form.paymentMethod}
            onSelectMethod={selectMethod}
            selectedReceiver={selectedReceiver}
            copied={copied}
            onCopy={copyReceiver}
            form={form}
            setForm={setForm}
            errors={errors}
            advance={advance}
            busy={busy}
            onBack={() => { setErrors({}); setStep(1); }}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  );
}
