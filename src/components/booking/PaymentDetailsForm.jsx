import React from 'react';
import { Check, Copy } from 'lucide-react';
import { money } from '../../utils/dateUtils';

export default function PaymentDetailsForm({ selectedMethod, selectedReceiver, copied, onCopy, form, setForm, advance }) {
  return <>
    {selectedMethod && <div className="payment-instruction-card booking-payment-instruction"><div><span className="bt-eyebrow">PAY WITH {selectedMethod.toUpperCase()}</span><h3>Send the required advance</h3></div><div className="receiver-row"><div><small>Send Money to</small><strong>{selectedReceiver || 'Payment number unavailable for this method.'}</strong></div>{selectedReceiver && <button type="button" className="bt-outline-btn" onClick={onCopy}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy number'}</button>}</div><ol><li>Open your mobile payment app.</li><li>Choose Send Money.</li><li>Send <b>{money(advance)}</b> to the number above.</li><li>Complete the payment, then enter the details below.</li></ol></div>}
    {selectedMethod && <div className="payment-details-block"><span className="bt-eyebrow">PAYMENT DETAILS</span><label>Send Money Number<input required minLength="5" inputMode="tel" value={form.sendMoneyNumber} onChange={e => setForm(x => ({ ...x, sendMoneyNumber: e.target.value }))} placeholder="Number you used to send the money" /></label><label>Transaction ID<input required minLength="5" autoCapitalize="characters" value={form.transactionId} onChange={e => setForm(x => ({ ...x, transactionId: e.target.value }))} placeholder="Enter transaction ID" /></label><label>Amount<input required type="number" min="0.001" step="0.001" inputMode="decimal" value={form.paymentAmount} onChange={e => setForm(x => ({ ...x, paymentAmount: e.target.value }))} placeholder="Amount sent" /></label></div>}
  </>;
}
