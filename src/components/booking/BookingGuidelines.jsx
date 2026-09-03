import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function BookingGuidelines({ rules = [] }) {
  const items = rules.filter(Boolean).map(rule => String(rule).trim()).filter(Boolean).slice(0, 5);
  if (!items.length) return null;
  return (
    <aside className="booking-guidelines">
      <div className="booking-guidelines-head">
        <ShieldCheck aria-hidden="true" />
        <div><span>IMPORTANT</span><strong>Before you play</strong></div>
      </div>
      <ul>{items.map((rule, index) => <li key={`${rule}-${index}`}>{rule}</li>)}</ul>
    </aside>
  );
}
