import React,{useEffect,useMemo,useState} from 'react';
import { CalendarCheck,Wallet,ReceiptText,CheckCircle2,Plus,Settings,ChevronRight,ShieldCheck } from 'lucide-react';
import { collection,onSnapshot,query,where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCollection,useDoc } from '../../hooks/useFirestore';
import { generateSlots } from '../../utils/slotUtils';
import { TZ, bookingDate, bookingSlotDate, bookingStatusExpired, bookingDisplayStatus, localDate, money, timeLabel } from '../../utils/dateUtils';
import { AdminPageHeader,StatCard,SectionCard,StatusBadge,EmptyState } from '../../components/ui';

function Dashboard({go}){
 const bookings=useCollection('bookings'),payments=useCollection('payments'),expenses=useCollection('expenses'),[settings]=useDoc('settings/config');
 const today=localDate();
 const [todayLocks,setTodayLocks]=useState([]);
 useEffect(()=>onSnapshot(query(collection(db,'slotLocks'),where('sessionDate','==',today)),s=>setTodayLocks(s.docs.map(d=>({id:d.id,...d.data()}))),()=>setTodayLocks([])),[today]);
 const month=today.slice(0,7),year=today.slice(0,4);
 const bToday=bookings.filter(b=>bookingDate(b)===today&&bookingDisplayStatus(b)!=='cancelled').length;
 const bMonth=bookings.filter(b=>String(bookingDate(b)).startsWith(month)&&bookingDisplayStatus(b)!=='cancelled').length;
 const bYear=bookings.filter(b=>String(bookingDate(b)).startsWith(year)&&bookingDisplayStatus(b)!=='cancelled').length;
 const sumDate=(arr,key,prefix)=>arr.filter(x=>String(x[key]||'').startsWith(prefix)).reduce((a,x)=>a+Number(x.amount||0),0);
 const pToday=sumDate(payments,'paymentDate',today),pMonth=sumDate(payments,'paymentDate',month),pYear=sumDate(payments,'paymentDate',year);
 const eToday=sumDate(expenses,'date',today),eMonth=sumDate(expenses,'date',month),eYear=sumDate(expenses,'date',year);
 const todaySlots=useMemo(()=>generateSlots(today,settings),[today,settings]);
 const todaySlotCounts=useMemo(()=>{
   const now=Date.now();
   return todaySlots.reduce((a,s)=>{
     const l=todayLocks.find(x=>x.id===s.key);
     const active=l?.status==='booked'||(l?.status==='pending_payment_verification'&&((l.expiresAt?.toMillis?.()??0)===0||(l.expiresAt.toMillis()>now)));
     if(l?.status==='booked') a.booked+=1;
     else if(l?.status==='pending_payment_verification'&&active) a.pending+=1;
     else a.available+=1;
     a.total+=1;
     return a;
   },{total:0,available:0,booked:0,pending:0});
 },[todaySlots,todayLocks]);
 const pending=bookings.filter(b=>b.status==='pending_payment_verification'&&!bookingStatusExpired(b)).sort((a,b)=>String(a.sessionDate).localeCompare(String(b.sessionDate))).slice(0,4);
 const recentBookings=[...bookings].sort((a,b)=>String(b.sessionDate||'').localeCompare(String(a.sessionDate||''))||String(b.slotStart||'').localeCompare(String(a.slotStart||''))).slice(0,6);
 const recentPayments=[...payments].slice(0,6);
 const bookingSeries=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const ds=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);return {date:ds,count:bookings.filter(b=>bookingDate(b)===ds&&bookingDisplayStatus(b)!=='cancelled').length}});
 const maxBooking=Math.max(1,...bookingSeries.map(x=>x.count));
 return <>
   <AdminPageHeader eyebrow="LIVE OPERATIONS" title="Bason Turf City Command Centre" subtitle="Real-time oversight of bookings, payments and operating costs." actions={<><button className="secondary" onClick={()=>go('/admin/bookings')}><CalendarCheck/> View bookings</button><button className="primary" onClick={()=>go('/admin/expenses')}><Plus/> Add expense</button></>}/>
   <section className="command-hero"><div><span className="hero-live-dot"><i></i> LIVE OPERATIONS</span><h3>Today’s operational status</h3><p>{pending.length?`${pending.length} booking request${pending.length>1?'s':''} waiting for payment verification.`:'No booking requests are waiting for verification.'}</p><div className="hero-chips"><span><CalendarCheck/> {bToday} bookings</span><span><Wallet/> {money(pToday)} collected</span><span><ReceiptText/> {money(eToday)} expenses</span></div></div><div className="hero-pitch-mini"><div className="pitch-circle"></div><div className="pitch-box"></div><div className="pitch-ball-mini">⚽</div></div></section>

   <SectionCard eyebrow="TODAY · SLOT CONTROL" title="Manage today’s slots" subtitle={`${todaySlotCounts.total} generated · ${todaySlotCounts.available} available · ${todaySlotCounts.booked} booked · ${todaySlotCounts.pending} pending`} actions={<button className="text-action" onClick={()=>go('/admin/bookings')}>Open slot manager <ChevronRight/></button>}>
     <div className="dashboard-slot-strip">
       <div><span>Total slots</span><b>{todaySlotCounts.total}</b></div>
       <div><span>Available</span><b>{todaySlotCounts.available}</b></div>
       <div><span>Booked</span><b>{todaySlotCounts.booked}</b></div>
       <div><span>Pending</span><b>{todaySlotCounts.pending}</b></div>
     </div>
   </SectionCard>

   <div className="stat-grid-4">
     <StatCard icon={CalendarCheck} label="Today bookings" value={bToday} meta="Confirmed + active" />
     <StatCard icon={Wallet} label="Today collected" value={money(pToday)} meta="Payment records" tone="accent"/>
     <StatCard icon={ReceiptText} label="Today expenses" value={money(eToday)} meta="Operating costs"/>
     <StatCard icon={CheckCircle2} label="Today net revenue" value={money(pToday-eToday)} meta="Collected − expenses" tone="net"/>
   </div>

   <div className="period-compare">
     <SectionCard eyebrow="PERIOD OVERVIEW" title="Month & year at a glance" subtitle="Keep the operating picture in one place.">
       <div className="compare-grid">
         {[
           ['THIS MONTH',bMonth,pMonth,eMonth],
           ['THIS YEAR',bYear,pYear,eYear],
         ].map(([label,b,p,e])=><div className="compare-card" key={label}><span>{label}</span><div className="compare-stats"><div><b>{b}</b><small>Bookings</small></div><div><b>{money(p)}</b><small>Collected</small></div><div><b>{money(e)}</b><small>Expenses</small></div><div className="compare-net"><b>{money(p-e)}</b><small>Net revenue</small></div></div></div>)}
       </div>
     </SectionCard>
   </div>

   <div className="dashboard-columns">
     <SectionCard eyebrow="BOOKINGS OVERVIEW" title="Last 7 days" subtitle="Actual booking volume from Firestore.">
       <div className="mini-chart">
         {bookingSeries.map(x=><div className="chart-column" key={x.date} title={`${x.date}: ${x.count} bookings`}><div className="chart-bar" style={{height:`${Math.max(8,Math.round((x.count/maxBooking)*100))}%`}}></div><span>{x.date.slice(5)}</span><b>{x.count}</b></div>)}
       </div>
     </SectionCard>
     <SectionCard eyebrow="REVENUE OVERVIEW" title="Current period" subtitle="Collected vs operating cost.">
       <div className="revenue-snapshot"><div><span>Collected</span><b>{money(pMonth)}</b></div><div><span>Expenses</span><b>{money(eMonth)}</b></div><div className="snapshot-net"><span>Net</span><b>{money(pMonth-eMonth)}</b></div></div>
       <div className="revenue-meter"><span style={{width:`${pMonth?Math.min(100,(Math.max(0,pMonth-eMonth)/pMonth)*100):0}%`}}></span></div><small className="chart-note">Net margin after recorded expenses for {month}.</small>
     </SectionCard>
   </div>

   <div className="dashboard-columns bottom">
     <SectionCard eyebrow="PAYMENT VERIFICATION" title="Needs attention" subtitle="Pending public booking requests." actions={<button className="text-action" onClick={()=>go('/admin/bookings')}>Open bookings <ChevronRight/></button>}>
       {pending.length?pending.map(b=><BookingMini key={b.id} booking={b} onClick={()=>go('/admin/bookings')}/>):<EmptyState icon={ShieldCheck} title="All clear" text="No pending payment verifications right now."/>}
     </SectionCard>
     <SectionCard eyebrow="RECENT PAYMENTS" title="Latest activity" subtitle="Most recent admin-recorded income.">
       {recentPayments.length?<div className="activity-list">{recentPayments.map(p=><PaymentMini key={p.id} payment={p}/>)}</div>:<EmptyState icon={Wallet} title="No payments yet" text="Payment activity will appear here."/>}
     </SectionCard>
   </div>

   <SectionCard eyebrow="RECENT BOOKINGS" title="Latest bookings" subtitle="The newest booking activity across the turf." actions={<button className="text-action" onClick={()=>go('/admin/bookings')}>View all <ChevronRight/></button>}>
      {recentBookings.length?<div className="recent-booking-grid">{recentBookings.slice(0,4).map(b=><BookingMini key={b.id} booking={b}/>)}</div>:<EmptyState icon={CalendarCheck} title="No bookings yet" text="Bookings will appear here once customers submit requests."/>}
   </SectionCard>

   <SectionCard eyebrow="QUICK ACTIONS" title="Run the day faster" subtitle="Jump directly into common management tasks.">
     <div className="quick-actions">
       <button onClick={()=>go('/admin/bookings')}><CalendarCheck/><span><b>Bookings</b><small>Review requests</small></span><ChevronRight/></button>
       <button onClick={()=>go('/admin/expenses')}><ReceiptText/><span><b>Add expense</b><small>Record operating cost</small></span><ChevronRight/></button>
       <button onClick={()=>go('/admin/finance')}><Wallet/><span><b>Payments</b><small>Review finance</small></span><ChevronRight/></button>
       <button onClick={()=>go('/admin/pricing')}><Settings/><span><b>Pricing</b><small>Update slot rates</small></span><ChevronRight/></button>
     </div>
   </SectionCard>
 </>
}
function BookingMini({booking,onClick}){
 return <button className="booking-mini" onClick={onClick}><div className="booking-mini-main"><div className="booking-avatar">{String(booking.customerName||'C').slice(0,1).toUpperCase()}</div><div><b>{booking.customerName||'Customer'}</b><span>{bookingSlotDate(booking)} · {timeLabel(booking.slotStart)}–{timeLabel(booking.slotEnd)}</span></div></div><div className="booking-mini-side"><strong>{money(booking.totalAmount||0)}</strong><StatusBadge status={bookingDisplayStatus(booking)}/></div></button>
}
function PaymentMini({payment}){
 return <div className="payment-mini"><div className="payment-icon"><Wallet/></div><div><b>{payment.note||'Booking payment'}</b><span>{payment.paymentDate||'—'} · {payment.paymentMethod||'—'}</span></div><strong>{money(payment.amount||0)}</strong></div>
}

export default Dashboard;
