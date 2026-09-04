import React from 'react';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { money } from '../../utils/dateUtils';
import { sanitizeSendMoneyNumber, sanitizeTransactionId } from '../../utils/validation';

export default function PaymentDetailsStep({
  methods,
  selectedMethod,
  onSelectMethod,
  selectedReceiver,
  copied,
  onCopy,
  form,
  setForm,
  errors,
  advance,
  busy,
  onBack,
  onSubmit,
}) {
  const configuredMethods = methods.filter(([, number]) => String(number || '').trim());
  const hasAnyMethod = configuredMethods.length > 0;

  const handleSendMoneyChange = event => {
    const nextValue = sanitizeSendMoneyNumber(event.target.value);
    setForm(current => ({ ...current, sendMoneyNumber: nextValue }));
  };

  const handleTransactionIdChange = event => {
    const nextValue = sanitizeTransactionId(event.target.value);
    setForm(current => ({ ...current, transactionId: nextValue }));
  };

  return (
    <div className="booking-wizard-step">
      <div className="booking-step-section-head">
        <span className="bt-eyebrow">PAYMENT METHOD</span>
        <p>Choose how you will send the required advance.</p>
      </div>

      {hasAnyMethod ? (
        <>
          <div className="payment-method-picker booking-payment-picker" role="group" aria-label="Payment method">
            {methods.map(([method, number]) => {
              const available = Boolean(String(number || '').trim());
              return (
                <button
                  key={method}
                  type="button"
                  disabled={!available}
                  aria-pressed={selectedMethod === method}
                  className={selectedMethod === method ? 'selected' : ''}
                  onClick={() => available && onSelectMethod(method)}
                >
                  <strong>{method}</strong>
                  <small>{available ? 'Available' : 'Not available'}</small>
                </button>
              );
            })}
          </div>

          {selectedMethod ? (
            <div className="booking-payment-panel">
              <div className="booking-payment-panel-head">
                <span className="bt-eyebrow">PAY WITH {selectedMethod.toUpperCase()}</span>
                <strong>Send {money(advance)}</strong>
              </div>

              <div className="booking-receiver-row">
                <div>
                  <small>Send Money To</small>
                  <strong>{selectedReceiver}</strong>
                </div>
                <button type="button" className="bt-outline-btn booking-copy-btn" onClick={onCopy}>
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copied ? 'Copied' : 'Copy Number'}
                </button>
              </div>

              <p className="booking-payment-copy">
                Send the required advance to the number above using Send Money.
              </p>

              <div className="booking-field-stack">
                <label>
                  <span>SEND MONEY NUMBER</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={11}
                    value={form.sendMoneyNumber}
                    onChange={handleSendMoneyChange}
                    onPaste={event => {
                      event.preventDefault();
                      const pasted = sanitizeSendMoneyNumber(event.clipboardData.getData('text'));
                      setForm(current => ({ ...current, sendMoneyNumber: pasted }));
                    }}
                    placeholder="Number used to send the payment"
                    aria-invalid={Boolean(errors.sendMoneyNumber)}
                    aria-describedby={errors.sendMoneyNumber ? 'booking-send-number-error' : undefined}
                  />
                  {errors.sendMoneyNumber && <small id="booking-send-number-error" className="booking-field-error">{errors.sendMoneyNumber}</small>}
                </label>

                <label>
                  <span>TRANSACTION ID</span>
                  <input
                    type="text"
                    autoCapitalize="characters"
                    value={form.transactionId}
                    onChange={handleTransactionIdChange}
                    onPaste={event => {
                      event.preventDefault();
                      const pasted = sanitizeTransactionId(event.clipboardData.getData('text'));
                      setForm(current => ({ ...current, transactionId: pasted }));
                    }}
                    placeholder="Enter transaction ID"
                    aria-invalid={Boolean(errors.transactionId)}
                    aria-describedby={errors.transactionId ? 'booking-transaction-error' : undefined}
                  />
                  {errors.transactionId && <small id="booking-transaction-error" className="booking-field-error">{errors.transactionId}</small>}
                </label>
              </div>
            </div>
          ) : (
            <div className="booking-form-hint">Select a payment method to continue.</div>
          )}
        </>
      ) : (
        <div className="booking-payment-unavailable">
          <strong>ONLINE PAYMENT IS CURRENTLY UNAVAILABLE</strong>
          <span>Please contact TestWeb Turf for booking assistance.</span>
        </div>
      )}

      {errors.form && <div className="booking-error" role="alert">{errors.form}</div>}

      <div className="booking-wizard-actions">
        <button type="button" className="bt-outline-btn" onClick={onBack} disabled={busy}>
          <ArrowLeft aria-hidden="true" /> Back
        </button>
        <button
          type="button"
          className="bt-btn bt-btn-primary booking-submit"
          disabled={busy || !selectedMethod || !selectedReceiver}
          onClick={onSubmit}
        >
          {busy ? 'Submitting…' : 'Submit Booking Request'}
        </button>
      </div>
    </div>
  );
}
