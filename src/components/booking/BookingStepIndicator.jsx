import React from 'react';

export default function BookingStepIndicator({ step }) {
  return (
    <div className="booking-step-indicator" aria-label={`Step ${step} of 2`}>
      <div className={`booking-step-dot ${step >= 1 ? 'active' : ''}`}><span>1</span></div>
      <div className={`booking-step-line ${step >= 2 ? 'active' : ''}`} aria-hidden="true" />
      <div className={`booking-step-dot ${step >= 2 ? 'active' : ''}`}><span>2</span></div>
      <div className="booking-step-copy">
        <div><small>STEP 1 OF 2</small><strong>Customer Details</strong></div>
        <div><small>STEP 2 OF 2</small><strong>Payment</strong></div>
      </div>
    </div>
  );
}
