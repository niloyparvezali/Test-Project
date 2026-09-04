import React,{useMemo,useState} from 'react';
import { CalendarDays,Wallet,ReceiptText,CheckCircle2,CalendarCheck } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { localDate, money, bookingDate, bookingDisplayStatus, timestampToMs, transactionDateKey, transactionDateTimeLabel } from '../../utils/dateUtils';
import { AdminPageHeader,StatCard,SectionCard,EmptyState } from '../../components/ui';

function Finance(){
 const payments=useCollection('payments');
 const expenses=useCollection('expenses');
 const bookings=useCollection('bookings');
 const [date,setDate]=useState(localDate());
 const [visiblePayments,setVisiblePayments]=useState(10);
 const month=date.slice(0,7),year=date.slice(0,4);

 const paymentDate=(item)=>transactionDateKey(item.createdAt) || String(item.paymentDate || '').slice(0,10);
 const expenseDate=(item)=>transactionDateKey(item.createdAt) || String(item.date || '').slice(0,10);

 const pDay=payments.filter(x=>paymentDate(x)===date).reduce((a,x)=>a+Number(x.amount||0),0);
 const eDay=expenses.filter(x=>expenseDate(x)===date).reduce((a,x)=>a+Number(x.amount||0),0);
 const pMonth=payments.filter(x=>paymentDate(x).startsWith(month)).reduce((a,x)=>a+Number(x.amount||0),0);
 const eMonth=expenses.filter(x=>expenseDate(x).startsWith(month)).reduce((a,x)=>a+Number(x.amount||0),0);
 const pYear=payments.filter(x=>paymentDate(x).startsWith(year)).reduce((a,x)=>a+Number(x.amount||0),0);
 const eYear=expenses.filter(x=>expenseDate(x).startsWith(year)).reduce((a,x)=>a+Number(x.amount||0),0);

 const cats={};
 expenses.filter(x=>expenseDate(x).startsWith(month)).forEach(x=>{
   const key=x.category||'Other';
   cats[key]=(cats[key]||0)+Number(x.amount||0);
 });

 const ledger=useMemo(()=>[...payments.map(x=>({
   id:x.id,type:'income',createdAt:x.createdAt,label:x.note||'Booking payment',
   method:x.paymentMethod||'—',amount:Number(x.amount||0)
 })),...expenses.map(x=>({
   id:x.id,type:'expense',createdAt:x.createdAt,label:x.reason||'Expense',
   method:x.category||'—',amount:Number(x.amount||0)
 }))].sort((a,b)=>timestampToMs(b.createdAt)-timestampToMs(a.createdAt)).slice(0,40),[payments,expenses]);

 const orderedPayments=useMemo(()=>[...payments].sort((a,b)=>timestampToMs(b.createdAt)-timestampToMs(a.createdAt)),[payments]);

 return <>
   <AdminPageHeader eyebrow="PAYMENTS / FINANCE" title="Financial command centre" subtitle="Income, operating costs and transaction activity from recorded transaction timestamps." actions={<label className="date-filter-inline"><CalendarDays/><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>}/>
   <div className="stat-grid-4">
     <StatCard icon={Wallet} label="Total collected" value={money(pMonth)} meta={month} tone="accent"/>
     <StatCard icon={ReceiptText} label="Total expenses" value={money(eMonth)} meta={month}/>
     <StatCard icon={CheckCircle2} label="Net revenue" value={money(pMonth-eMonth)} meta="Collected − expenses" tone="net"/>
     <StatCard icon={CalendarCheck} label="Bookings" value={bookings.filter(x=>String(bookingDate(x)).startsWith(month)&&bookingDisplayStatus(x)!=='cancelled').length} meta={month}/>
   </div>
   <div className="finance-periods">
     {[['TODAY',pDay,eDay],['THIS MONTH',pMonth,eMonth],['THIS YEAR',pYear,eYear]].map(([label,p,e])=>
       <div className="finance-period-card" key={label}><span>{label}</span><strong>{money(p-e)}</strong><div><span>Collected <b>{money(p)}</b></span><span>Expenses <b>{money(e)}</b></span></div></div>
     )}
   </div>
   <div className="dashboard-columns">
     <SectionCard eyebrow="EXPENSE BREAKDOWN" title={month} subtitle="Recorded operating costs by category.">
       {Object.keys(cats).length?<div className="breakdown-list">{Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>
         <div className="breakdown-row" key={k}><span>{k}</span><div className="breakdown-bar"><i style={{width:`${eMonth?Math.min(100,(v/eMonth)*100):0}%`}}></i></div><b>{money(v)}</b></div>
       )}</div>:<EmptyState icon={ReceiptText} title="No expenses yet" text="Expense activity will appear here."/>}
     </SectionCard>
     <SectionCard eyebrow="TRANSACTION LEDGER" title="Recent transactions" subtitle="Sorted by actual transaction creation time.">
       {ledger.length?<div className="ledger-list">{ledger.map(x=><div className="ledger-row" key={`${x.type}-${x.id}`}>
         <div className={`ledger-mark ${x.type}`}>{x.type==='income'?'+':'−'}</div>
         <div><b>{x.label}</b><span>{transactionDateTimeLabel(x.createdAt)} · {x.method}</span></div>
         <strong className={x.type}>{x.type==='income'?'+':'−'}{money(x.amount)}</strong>
       </div>)}</div>:<EmptyState icon={Wallet} title="No transactions yet" text="Transactions will appear once payments or expenses are recorded."/>}
     </SectionCard>
   </div>
   <SectionCard eyebrow="RECENT PAYMENTS" title="Payment activity" subtitle="Newest recorded transactions first.">
     {orderedPayments.length?<div className="finance-payment-activity">
       <div className="desktop-table-wrap finance-payment-desktop">
         <table className="admin-table-v2"><thead><tr><th>Date</th><th>Payment</th><th>Method</th><th>Amount</th><th>Booking</th></tr></thead>
         <tbody>{orderedPayments.slice(0,visiblePayments).map(p=><tr key={p.id}>
           <td>{transactionDateTimeLabel(p.createdAt)}</td><td><b>{p.note||'Booking payment'}</b><small>{p.transactionId||''}</small></td>
           <td>{p.paymentMethod||'—'}</td><td><b>+{money(p.amount)}</b></td><td className="mono">{p.bookingId||'—'}</td>
         </tr>)}</tbody></table>
       </div>
       <div className="finance-payment-mobile">{orderedPayments.slice(0,visiblePayments).map(p=><div className="finance-payment-mobile-row" key={p.id}>
         <div className="finance-payment-mobile-main"><b>{p.note||'Booking payment'}</b><span>{transactionDateTimeLabel(p.createdAt)} · {p.paymentMethod||'—'}</span>{p.bookingId?<span>Booking {p.bookingId}</span>:null}</div>
         <strong>+{money(p.amount)}</strong>
       </div>)}</div>
       <div className="finance-payment-footer"><span>Showing {Math.min(visiblePayments,orderedPayments.length)} of {orderedPayments.length} payments</span>
         {visiblePayments<orderedPayments.length?<button type="button" className="finance-payment-more" onClick={()=>setVisiblePayments(v=>Math.min(v+10,orderedPayments.length))}>Show more</button>:null}
       </div>
     </div>:<EmptyState icon={Wallet} title="No payments yet" text="Payment activity will appear here."/>}
   </SectionCard>
 </>
}
export default Finance;
