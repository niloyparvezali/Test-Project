import React from 'react';

export default function PaymentMethodSelector({ methods, value, onChange }) {
  return <div><div className="bt-eyebrow">PAYMENT METHOD</div><div className="payment-method-picker booking-payment-methods">{methods.map(([method, number]) => { const available = String(number || '').trim(); return <button key={method} type="button" disabled={!available} className={value === method ? 'selected' : ''} onClick={() => onChange(method)}><strong>{method}</strong><small>{available ? 'Available' : 'Not available'}</small></button>; })}</div></div>;
}
