import React,{useEffect,useMemo,useState} from 'react';
import { CalendarDays,CalendarCheck,Search,Sun,Moon,ChevronLeft,ChevronRight,Plus,CheckCircle2,XCircle,Wallet,Clock3,ArrowLeft,LockKeyhole,ShieldCheck,RefreshCw,Save,X } from 'lucide-react';
import { useCollection,useDoc } from '../../hooks/useFirestore';
import { bookingDisplayStatus, bookingStatusExpired, bookingDate, bookingSlotDate, displayDate, localDate, money, timeLabel, TZ } from '../../utils/dateUtils';
import { generateSlots, slotPriceFromPricing } from '../../utils/slotUtils';
import { getSlotStatus, isBookingHistoryRetained } from '../../utils/slotStatus';
import {
  confirmBookingClient,rejectBookingClient,expireBookingClient,createManualBookingClient,recordPaymentClient,cancelBookingClient
} from '../../services/bookingService';
import { AdminPageHeader,SectionCard,StatusBadge,EmptyState,LoadingState,Modal,StatCard } from '../../components/ui';

function BookingDetailSheet({booking,onClose,onOpenAction}){
 return <div className="overlay admin-overlay-v2" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="detail-sheet"><div className="sheet-handle"></div><div className="sheet-head"><div><span className="eyebrow">BOOKING DETAILS</span><h3>{booking.customerName}</h3></div><button className="icon-btn" onClick={onClose}><X/></button></div><div className="detail-summary"><div><span>Date</span><b>{bookingDate(booking)}</b></div><div><span>Slot</span><b>{timeLabel(booking.slotStart)} – {timeLabel(booking.slotEnd)}</b></div><div><span>Total</span><b>{money(booking.totalAmount)}</b></div><div><span>Advance</span><b>{money(booking.advanceAmount)}</b></div><div><span>Due</span><b>{money(booking.dueAmount)}</b></div><div><span>Status</span><StatusBadge status={bookingDisplayStatus(booking)}/></div></div><div className="detail-list"><div><span>Phone</span><b>{booking.phone||'—'}</b></div><div><span>Payment method</span><b>{booking.paymentMethod||'—'}</b></div><div><span>Receiver number</span><b>{booking.receiverNumberSnapshot||'—'}</b></div><div><span>Send Money number</span><b>{booking.sendMoneyNumber||'—'}</b></div><div><span>Transaction ID</span><b>{booking.transactionId||'—'}</b></div><div><span>Submitted amount</span><b>{money(booking.paymentAmount||0)}</b></div><div><span>Booking source</span><b>{booking.bookingType==='manual_admin'?'Admin direct booking':'Public request'}</b></div>{booking.adminNote&&<div className="detail-note"><span>Admin note</span><b>{booking.adminNote}</b></div>}<div><span>Booking ID</span><b className="mono">{booking.id}</b></div></div><div className="sheet-actions">{booking.status==='pending_payment_verification'&&!bookingStatusExpired(booking)&&<><button className="danger-btn" onClick={()=>onOpenAction('reject')}><XCircle/> Reject</button><button className="primary" onClick={()=>onOpenAction('verify')}><CheckCircle2/> Verify & accept</button></>}{booking.status==='confirmed'&&Number(booking.dueAmount)>0&&<button className="primary" onClick={()=>onOpenAction('payment')}><Wallet/> Record payment</button>}{booking.status!=='cancelled'&&booking.status!=='rejected'&&booking.status!=='pending_payment_verification'&&<button className="danger-btn" onClick={()=>onOpenAction('cancel')}><XCircle/> Cancel booking</button>}</div></div></div>
}

function dateShift(date,delta){
 const d=new Date(`${date}T12:00:00`);
 if(Number.isNaN(d.getTime())) return localDate();
 d.setDate(d.getDate()+delta);
 return new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
}

function SlotStatusBadge({status}){
 const label=status==='available'?'AVAILABLE':status==='booked'?'BOOKED':'PENDING';
 return <span className={`slot-status-badge ${status}`}>{label}</span>;
}

function AdminSlotCard({slot,booking,onBook,onOpen}){
 const status=getSlotStatus(slot, booking, null);
 const price=slot._price;
 return <div className={`admin-slot-card ${status}`}>
   <div className="admin-slot-time"><Clock3/><div><b>{timeLabel(slot.start)} – {timeLabel(slot.end)}</b><span>{slot.duration} min · {slot.shift==='day'?'Day':'Night'}</span></div></div>
   <div className="admin-slot-card-body">
     <div className="admin-slot-price">{money(price)}</div>
     <SlotStatusBadge status={status}/>
     {status==='available'&&<button className="primary slot-book-btn" onClick={()=>onBook(slot)}><Plus/> Book this slot</button>}
     {status==='booked'&&<button className="slot-detail-btn" onClick={()=>onOpen(booking)}> {booking?.bookingType==='manual_admin'?'Admin booking':'View booking'} <ChevronRight/></button>}
     {status==='pending'&&<button className="slot-detail-btn" onClick={()=>onOpen(booking)}>Payment verification <ChevronRight/></button>}
   </div>
   {booking&&<div className="admin-slot-customer"><b>{booking.customerName||'Customer'}</b>{booking.bookingType==='manual_admin'?<small>ADMIN BOOKING</small>:<small>{booking.paymentMethod||'Public request'}</small>}</div>}
 </div>
}

function ManualBookingModal({slot,onClose,onDone}){
 const [form,setForm]=useState({customerName:'',phone:'',adminNote:''}),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const submit=async e=>{e.preventDefault();setBusy(true);setErr('');try{await createManualBookingClient({slot,...form});onDone()}catch(x){setErr(x.message||'Could not create manual booking.')}finally{setBusy(false)}};
 const price=slot?slot._price:0;
 return <Modal title="Book available slot" onClose={onClose}>
  <form className="form manual-booking-form" onSubmit={submit}>
   <div className="booking-summary"><span className="eyebrow">ADMIN DIRECT BOOKING</span><b>{slot?`${displayDate(slot.date,{day:'2-digit',month:'short',year:'numeric'})} · ${timeLabel(slot.start)}–${timeLabel(slot.end)}`:'No slot selected'}</b><span>{slot?`${slot.duration} minutes · ${slot.shift==='day'?'Day':'Night'} · ${money(price)}`:'Select an available slot from the timetable.'}</span><div className="amount-row"><span>Booking amount</span><strong>{money(price)}</strong></div></div>
   <label>CUSTOMER / BOOKING NAME<input autoFocus required minLength="2" value={form.customerName} onChange={e=>setForm({...form,customerName:e.target.value})} placeholder="Customer or team name"/></label>
   <label>PHONE NUMBER <span className="muted-inline">(optional)</span><input inputMode="tel" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="01XXXXXXXXX"/></label>
   <label>ADMIN NOTE <textarea required minLength="2" value={form.adminNote} onChange={e=>setForm({...form,adminNote:e.target.value})} placeholder="Why are you reserving this slot?"/></label>
   <div className="note-preview"><span>History note</span><b>{slot?`[${displayDate(slot.date,{day:'2-digit',month:'short',year:'numeric'})} · ${timeLabel(slot.start)}–${timeLabel(slot.end)}] ${form.adminNote.trim()||'Your note will appear here'}`:'Your note will appear here'}</b></div>
   {err&&<div className="error">{err}</div>}
   <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!slot}>{busy?'Booking…':'Confirm booking'} <CheckCircle2/></button></div>
  </form>
 </Modal>
}

function VerifyModal({booking,onClose,onConfirm,busy,error}){return <Modal title="Verify payment & accept booking" onClose={onClose}><div className="verification-card"><div><span>Customer</span><strong>{booking.customerName}</strong></div><div><span>Booking</span><strong>{booking.sessionDate} · {timeLabel(booking.slotStart)}–{timeLabel(booking.slotEnd)}</strong></div><div><span>Payment method</span><strong>{booking.paymentMethod||'—'}</strong></div><div><span>Send Money</span><strong>{booking.sendMoneyNumber||'—'}</strong></div><div><span>Amount</span><strong>{money(booking.paymentAmount||booking.advanceAmount)}</strong></div><div><span>Transaction ID</span><strong>{booking.transactionId}</strong></div><p>Confirm that the submitted payment is valid. This will confirm the booking and record the payment in the existing financial system.</p>{error&&<div className="error">PAYMENT VERIFICATION FAILED<br/>{error}</div>}</div><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={onConfirm}>{busy?'Verifying…':'Confirm payment & accept'} <CheckCircle2/></button></div></Modal>}

function RejectModal({booking,onClose,onConfirm,busy}){const [reason,setReason]=useState('');return <Modal title="Reject booking request" onClose={onClose}><div className="verification-card"><p>Reject the payment-verification request for <b>{booking.customerName}</b> ({booking.sessionDate} · {timeLabel(booking.slotStart)}–{timeLabel(booking.slotEnd)}).</p><label className="form-label">Reason (optional)<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Optional rejection reason"/></label></div><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="danger-btn" disabled={busy} onClick={()=>onConfirm(reason)}>{busy?'Rejecting…':'Reject request'} <XCircle/></button></div></Modal>}

function PaymentModal({booking,onClose}){const [amount,setAmount]=useState(booking.dueAmount),[method,setMethod]=useState('Cash'),[date,setDate]=useState(localDate()),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');const submit=async e=>{e.preventDefault();setBusy(true);try{await recordPaymentClient({bookingId:booking.id,amount:Number(amount),paymentMethod:method,paymentDate:date,note});onClose()}catch(x){setErr(x.message||'Payment failed.')}finally{setBusy(false)}};return <Modal title="Record payment" onClose={onClose}><form className="form" onSubmit={submit}><div className="booking-summary"><span>Remaining due</span><strong>{money(booking.dueAmount)}</strong></div><label>Amount<input type="number" min="0.001" max={booking.dueAmount} step="0.001" required value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>Method<select value={method} onChange={e=>setMethod(e.target.value)}><option>Cash</option><option>Mobile Banking</option><option>Bank Transfer</option><option>Other</option></select></label><label>Note<input value={note} onChange={e=>setNote(e.target.value)}/></label>{err&&<div className="error">{err}</div>}<button className="primary full" disabled={busy}>{busy?'Saving…':'Record payment'} <Save/></button></form></Modal>}

function ConfirmModal({title,text,onClose,onConfirm}){const [busy,setBusy]=useState(false);return <Modal title={title} onClose={onClose}><p>{text}</p><div className="modal-actions"><button className="secondary" onClick={onClose}>Keep booking</button><button className="danger-btn" disabled={busy} onClick={async()=>{setBusy(true);try{await onConfirm()}finally{setBusy(false)}}}>{busy?'Working…':'Confirm'} <XCircle/></button></div></Modal>}

function Bookings(){
 const bookings=useCollection('bookings');
 const [q,setQ]=useState('');
 const [selectedDate,setSelectedDate]=useState(localDate());
 const [shift,setShift]=useState('day');
 const [slotFilter,setSlotFilter]=useState('all');
 const [modal,setModal]=useState(null);
 const [selected,setSelected]=useState(null);
 const [busyId,setBusyId]=useState('');
 const [actionError,setActionError]=useState('');
 const [success,setSuccess]=useState('');
 const [settings,settingsLoading]=useDoc('settings/config');
 const [pricing,pricingLoading]=useDoc('pricing/current');

 useEffect(()=>{
   bookings.filter(b=>bookingDate(b)===selectedDate&&b.status==='pending_payment_verification').forEach(b=>{
     if(bookingStatusExpired(b)) expireBookingClient(b).catch(()=>{});
   });
 },[bookings,selectedDate]);

 const allSlots=useMemo(()=>{
   if(settingsLoading||pricingLoading) return [];
   return generateSlots(selectedDate,settings).filter(s=>s.shift===shift).map(s=>({...s,_price:slotPriceFromPricing(s,pricing,settings)}));
 },[selectedDate,settings,settingsLoading,pricing,pricingLoading]);

 const bookingBySlot=useMemo(()=>{
   const map=new Map();
   for(const b of bookings){
     if(bookingDate(b)!==selectedDate||!b.slotKey) continue;
     const active=b.status==='confirmed'||(b.status==='pending_payment_verification'&&!bookingStatusExpired(b));
     if(!active) continue;
     const previous=map.get(b.slotKey);
     if(!previous || (b.status==='confirmed'&&previous.status!=='confirmed')) map.set(b.slotKey,b);
   }
   return map;
 },[bookings,selectedDate]);

 const slotRows=allSlots.map(slot=>{
   const booking=bookingBySlot.get(slot.key);
   const status=getSlotStatus(slot,booking,null);
   return {slot,booking,status};
 });
 const filteredSlots=slotRows.filter(x=>slotFilter==='all'||x.status===slotFilter);
 const counts=slotRows.reduce((a,x)=>{a[x.status]+=1; a.total+=1; return a},{total:0,available:0,booked:0,pending:0});

 const pending=bookings.filter(b=>b.status==='pending_payment_verification'&&!bookingStatusExpired(b));
 const pendingCount=pending.length;
 const recentCutoff=Date.now()-7*24*60*60*1000;
 const history=bookings.filter(b=>{
   const status=b.verificationStatus||b.status;
   if (b.status==='confirmed' || b.bookingType==='manual_admin') return isBookingHistoryRetained(b);
   const t=b.createdAt?.toMillis?.()??0;
   return Boolean(t && t>=recentCutoff && ['rejected','expired'].includes(status));
 }).sort((a,b)=>{
   const aTs=(a.status==='confirmed'||a.bookingType==='manual_admin') ? (Date.parse(`${a.sessionDate||a.date}T${a.slotStart||'00:00'}:00`)||0) : (a.createdAt?.toMillis?.()||0);
   const bTs=(b.status==='confirmed'||b.bookingType==='manual_admin') ? (Date.parse(`${b.sessionDate||b.date}T${b.slotStart||'00:00'}:00`)||0) : (b.createdAt?.toMillis?.()||0);
   return bTs-aTs;
 });

 const searchRows=useMemo(()=>bookings.filter(b=>`${b.customerName||''} ${b.phone||''} ${b.id||''} ${b.transactionId||''} ${b.adminNote||''}`.toLowerCase().includes(q.trim().toLowerCase())).sort((a,b)=>String(b.sessionDate||'').localeCompare(String(a.sessionDate||''))||String(b.slotStart||'').localeCompare(String(a.slotStart||''))),[bookings,q]);

 const action=async(type,booking)=>{
  if(type==='verify'){setActionError('');setBusyId('');setModal({type:'verify',booking});setSelected(null)}
   else if(type==='reject'){setModal({type:'reject',booking});setSelected(null)}
   else if(type==='payment'){setModal({type:'payment',booking});setSelected(null)}
   else if(type==='cancel'){setModal({type:'cancel',booking});setSelected(null)}
 };

 return <>
  {success&&<div className="success" role="status">{success}</div>}
  <AdminPageHeader eyebrow="BOOKING CONTROL" title="Date-wise slot management" subtitle="See every generated slot for the selected date, review pending payments and book available times directly." actions={
    <div className="page-head-actions"><button className="secondary" onClick={()=>setSelectedDate(localDate())}><CalendarCheck/> Today</button><button className="primary" onClick={()=>setModal({type:'manual-slot',slot:slotRows.find(x=>x.status==='available')?.slot})} disabled={!slotRows.some(x=>x.status==='available')}><Plus/> Manual booking</button></div>
  }/>

  <SectionCard eyebrow="DATE CONTROL" title="Choose operating date" subtitle="Day/night uses the same generateSlots logic as the public booking flow.">
    <div className="slot-control-toolbar">
      <div className="date-stepper">
        <button className="icon-btn" onClick={()=>setSelectedDate(dateShift(selectedDate,-1))} aria-label="Previous day"><ArrowLeft/></button>
        <div><span>{displayDate(selectedDate,{weekday:'short',day:'2-digit',month:'short',year:'numeric'})}</span><b>{selectedDate}</b></div>
        <button className="icon-btn" onClick={()=>setSelectedDate(dateShift(selectedDate,1))} aria-label="Next day"><ChevronRight/></button>
      </div>
      <div className="segmented-control" role="group" aria-label="Shift">
        <button className={shift==='day'?'active':''} onClick={()=>setShift('day')}><Sun/> Day</button>
        <button className={shift==='night'?'active':''} onClick={()=>setShift('night')}><Moon/> Night</button>
      </div>
    </div>
  </SectionCard>

  <div className="slot-summary-grid">
    <StatCard icon={CalendarDays} label="Total slots" value={counts.total} meta={selectedDate}/>
    <StatCard icon={CheckCircle2} label="Available" value={counts.available} meta="Ready to book" tone="accent"/>
    <StatCard icon={LockKeyhole} label="Booked" value={counts.booked} meta="Confirmed"/>
    <StatCard icon={ShieldCheck} label="Pending" value={counts.pending} meta="Payment verification"/>
  </div>

  <SectionCard eyebrow="SLOT TIMETABLE" title={`${shift==='day'?'Day':'Night'} slots · ${displayDate(selectedDate,{day:'2-digit',month:'short'})}`} subtitle={`${counts.total} generated slots · ${counts.available} available · ${counts.booked} booked · ${counts.pending} pending`}>
    <div className="slot-filter-row">
      {[
        ['all','All',counts.total],
        ['available','Available',counts.available],
        ['booked','Booked',counts.booked],
        ['pending','Pending',counts.pending],
      ].map(([id,label,count])=><button key={id} className={slotFilter===id?'active':''} onClick={()=>setSlotFilter(id)}>{label}<b>{count}</b></button>)}
    </div>
    <div className="admin-slot-grid">
      {filteredSlots.map(({slot,booking,status})=><AdminSlotCard key={slot.key} slot={slot} booking={booking} onBook={s=>setModal({type:'manual-slot',slot:s})} onOpen={b=>setSelected(b)}/>)}
    </div>
    {!filteredSlots.length&&<EmptyState icon={CalendarDays} title="No slots in this view" text="Try another shift or status filter."/>}
  </SectionCard>

  <SectionCard eyebrow="PAYMENT VERIFICATION" title="Requests waiting for review" subtitle={`${pendingCount} active public payment ${pendingCount===1?'request':'requests'}.`} actions={pendingCount>0?<button className="text-action" onClick={()=>setSlotFilter('pending')}>Show pending slots <ChevronRight/></button>:null}>
    {pending.length?<div className="verification-grid">{pending.slice(0,8).map(b=><div className="verification-tile" key={b.id}><div><span>{b.customerName}</span><b>{bookingDate(b)} · {timeLabel(b.slotStart)}–{timeLabel(b.slotEnd)}</b><small>{b.paymentMethod||'—'} · Send Money {b.sendMoneyNumber||'—'} · Txn {b.transactionId||'—'} · {money(b.paymentAmount||b.advanceAmount)}</small></div><div className="verification-actions"><button className="secondary" onClick={()=>setSelected(b)}>Review</button><button className="primary" disabled={busyId===b.id} onClick={()=>action('verify',b)}>Accept</button><button className="danger-btn" disabled={busyId===b.id} onClick={()=>action('reject',b)}>Reject</button></div></div>)}</div>:<EmptyState icon={ShieldCheck} title="No pending payment requests" text="Public booking requests will appear here after customers submit payment details."/>}
  </SectionCard>

  <SectionCard eyebrow="BOOKING HISTORY" title="Recent booking records" subtitle="Search the full authorized booking directory and distinguish public requests from admin direct bookings.">
    <div className="filter-toolbar-v2"><div className="search-v2"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search customer, phone, booking ID or note…"/></div></div>
    <div className="desktop-table-wrap"><table className="admin-table-v2"><thead><tr><th>Date</th><th>Customer</th><th>Slot</th><th>Amount</th><th>Source</th><th>Status</th><th/></tr></thead><tbody>{searchRows.map(b=><tr key={b.id}><td>{bookingDate(b)}</td><td><b>{b.customerName||'—'}</b><small>{b.phone||'—'}</small></td><td>{timeLabel(b.slotStart)}–{timeLabel(b.slotEnd)}</td><td><b>{money(b.totalAmount||0)}</b>{Number(b.paymentAmount)>0&&<small>Paid {money(b.paymentAmount)}</small>}</td><td>{b.bookingType==='manual_admin'?<><span className="manual-badge">ADMIN BOOKING</span><small>{b.adminNote||'—'}</small></>:<><span className="public-badge">PUBLIC REQUEST</span><small>{b.paymentMethod||'—'} · {b.transactionId||'—'}</small></>}</td><td><StatusBadge status={bookingDisplayStatus(b)}/></td><td><div className="table-actions">{b.status==='pending_payment_verification'&&!bookingStatusExpired(b)&&<button className="table-action" onClick={()=>setSelected(b)}><CheckCircle2/> Review</button>}{b.status==='confirmed'&&Number(b.dueAmount)>0&&<button className="table-action" onClick={()=>action('payment',b)}><Wallet/> Payment</button>}{b.status!=='cancelled'&&b.status!=='rejected'&&b.status!=='pending_payment_verification'&&<button className="table-action danger" onClick={()=>action('cancel',b)}>Cancel</button>}</div></td></tr>)}</tbody></table></div>
    <div className="mobile-record-list">{searchRows.map(b=><button className="booking-record-card" key={b.id} onClick={()=>setSelected(b)}><div className="record-top"><span>{bookingDate(b)} · {timeLabel(b.slotStart)}–{timeLabel(b.slotEnd)}</span><StatusBadge status={bookingDisplayStatus(b)}/></div><div className="record-main"><b>{b.customerName||'—'}</b><strong>{money(b.totalAmount||0)}</strong></div><div className="record-meta"><span>{b.bookingType==='manual_admin'?'ADMIN BOOKING':`${b.paymentMethod||'Payment'} · ${b.transactionId||'No transaction ID'}`}</span><span>{b.adminNote||b.phone||'—'}</span></div></button>)}</div>
    {!searchRows.length&&<EmptyState icon={CalendarCheck} title="No booking records found" text="Try another search term."/>}
  </SectionCard>

  <SectionCard eyebrow="LAST 7 DAYS" title="Recent booking & request history" subtitle="Rolling 7 × 24 hour window. Older records are intentionally hidden from this view.">
   <div className="history-list-v2">
    {history.slice(0,50).map(b=><div className="history-row-v2" key={b.id}><div><span>{b.bookingType==='manual_admin'?'ADMIN BOOKING':'PUBLIC REQUEST'}</span><b>{bookingDate(b)} · {timeLabel(b.slotStart)}–{timeLabel(b.slotEnd)}</b><small>{b.customerName||'—'} · {b.paymentMethod||'—'} · {b.transactionId||'No transaction ID'}</small></div><div className="history-mid"><strong>{b.bookingType==='manual_admin'?money(b.totalAmount||0):money(b.paymentAmount||b.paidAmount||0)}</strong>{b.adminNote&&<span className="history-note">{b.adminNote}</span>}</div><StatusBadge status={b.bookingType==='manual_admin'?'confirmed':(b.verificationStatus||b.status)}/></div>)}
    {!history.length&&<EmptyState icon={RefreshCw} title="No activity in the last 7 days" text="Recent booking activity will appear here."/>}
   </div>
  </SectionCard>

  {selected&&<BookingDetailSheet booking={selected} onClose={()=>setSelected(null)} onOpenAction={type=>action(type,selected)}/>}
  {modal?.type==='payment'&&<PaymentModal booking={modal.booking} onClose={()=>setModal(null)}/>}
  {modal?.type==='cancel'&&<ConfirmModal title="Cancel booking?" text="The booking will become cancelled and its slot will become available again." onClose={()=>setModal(null)} onConfirm={async()=>{await cancelBookingClient(modal.booking.id);setModal(null)}}/>}
  {modal?.type==='verify'&&<VerifyModal booking={modal.booking} onClose={()=>{setActionError('');setModal(null)}} onConfirm={async()=>{setBusyId(modal.booking.id);setActionError('');try{await confirmBookingClient(modal.booking);setModal(null);setSelected(null);setSuccess('Booking confirmed. Payment verified successfully.');setTimeout(()=>setSuccess(''),4000)}catch(e){setActionError(e?.message||'Could not confirm booking.')}finally{setBusyId('')}}} busy={busyId===modal.booking.id} error={actionError}/>} 
  {modal?.type==='reject'&&<RejectModal booking={modal.booking} onClose={()=>setModal(null)} onConfirm={async reason=>{setBusyId(modal.booking.id);try{await rejectBookingClient(modal.booking,reason);setModal(null)}catch(e){alert(e.message||'Could not reject booking.')}finally{setBusyId('')}}} busy={busyId===modal.booking.id}/>}
  {modal?.type==='manual-slot'&&modal.slot&&<ManualBookingModal slot={modal.slot} pricing={pricing} onClose={()=>setModal(null)} onDone={()=>setModal(null)}/>}
 </>
}

export default Bookings;
