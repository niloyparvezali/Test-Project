import React,{useState} from 'react';
import { CalendarDays,Wallet,ReceiptText,ArrowLeft,ArrowRight,CheckCircle2,CalendarCheck } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { localDate, money, bookingDate, bookingDisplayStatus } from '../../utils/dateUtils';
import { AdminPageHeader,StatCard,SectionCard,StatusBadge,EmptyState } from '../../components/ui';

function Finance(){
 const payments=useCollection('payments'),expenses=useCollection('expenses'),bookings=useCollection('bookings'),[date,setDate]=useState(localDate());
 const month=date.slice(0,7),year=date.slice(0,4);
 const pDay=payments.filter(x=>x.paymentDate===date).reduce((a,x)=>a+Number(x.amount||0),0), eDay=expenses.filter(x=>x.date===date).reduce((a,x)=>a+Number(x.amount||0),0);
 const pMonth=payments.filter(x=>String(x.paymentDate||'').startsWith(month)).reduce((a,x)=>a+Number(x.amount||0),0),eMonth=expenses.filter(x=>String(x.date||'').startsWith(month)).reduce((a,x)=>a+Number(x.amount||0),0);
 const pYear=payments.filter(x=>String(x.paymentDate||'').startsWith(year)).reduce((a,x)=>a+Number(x.amount||0),0),eYear=expenses.filter(x=>String(x.date||'').startsWith(year)).reduce((a,x)=>a+Number(x.amount||0),0);
 const cats={};expenses.filter(x=>String(x.date||'').startsWith(month)).forEach(x=>cats[x.category]=(cats[x.category]||0)+Number(x.amount||0));
 const ledger=[...payments.map(x=>({id:x.id,type:'income',date:x.paymentDate,amount:Number(x.amount||0),label:x.note||'Booking payment',method:x.paymentMethod||'—'})),...expenses.map(x=>({id:x.id,type:'expense',date:x.date,amount:Number(x.amount||0),label:x.reason,method:x.category||'—'}))].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,40);
 return <>
   <AdminPageHeader eyebrow="PAYMENTS / FINANCE" title="Financial command centre" subtitle="Income, operating costs and transaction activity from Firestore." actions={<label className="date-filter-inline"><CalendarDays/><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>}/>
   <div className="stat-grid-4"><StatCard icon={Wallet} label="Total collected" value={money(pMonth)} meta={month} tone="accent"/><StatCard icon={ReceiptText} label="Total expenses" value={money(eMonth)} meta={month}/><StatCard icon={CheckCircle2} label="Net revenue" value={money(pMonth-eMonth)} meta="Collected − expenses" tone="net"/><StatCard icon={CalendarCheck} label="Bookings" value={bookings.filter(x=>String(bookingDate(x)).startsWith(month)&&bookingDisplayStatus(x)!=='cancelled').length} meta={month}/></div>
   <div className="finance-periods">
     {[
       ['TODAY',pDay,eDay],
       ['THIS MONTH',pMonth,eMonth],
       ['THIS YEAR',pYear,eYear],
     ].map(([label,p,e])=><div className="finance-period-card" key={label}><span>{label}</span><strong>{money(p-e)}</strong><div><span>Collected <b>{money(p)}</b></span><span>Expenses <b>{money(e)}</b></span></div></div>)}
   </div>
   <div className="dashboard-columns">
     <SectionCard eyebrow="EXPENSE BREAKDOWN" title={month} subtitle="Recorded operating costs by category.">{Object.keys(cats).length?<div className="breakdown-list">{Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div className="breakdown-row" key={k}><span>{k}</span><div className="breakdown-bar"><i style={{width:`${eMonth?Math.min(100,(v/eMonth)*100):0}%`}}></i></div><b>{money(v)}</b></div>)}</div>:<EmptyState icon={ReceiptText} title="No expenses yet" text="Expense activity will appear here."/>}</SectionCard>
     <SectionCard eyebrow="TRANSACTION LEDGER" title="Recent transactions" subtitle="Combined payment and expense activity.">{ledger.length?<div className="ledger-list">{ledger.map(x=><div className="ledger-row" key={`${x.type}-${x.id}`}><div className={`ledger-mark ${x.type}`}>{x.type==='income'?'+':'−'}</div><div><b>{x.label}</b><span>{x.date} · {x.method}</span></div><strong className={x.type}>{x.type==='income'?'+':'−'}{money(x.amount)}</strong></div>)}</div>:<EmptyState icon={Wallet} title="No transactions yet" text="Transactions will appear once payments or expenses are recorded."/>}</SectionCard>
   </div>
   <SectionCard eyebrow="RECENT PAYMENTS" title="Payment activity" subtitle="The latest verified and admin-recorded payments.">{payments.length?<div className="desktop-table-wrap"><table className="admin-table-v2"><thead><tr><th>Date</th><th>Payment</th><th>Method</th><th>Amount</th><th>Booking</th></tr></thead><tbody>{payments.slice(0,20).map(p=><tr key={p.id}><td>{p.paymentDate||'—'}</td><td><b>{p.note||'Booking payment'}</b><small>{p.transactionId||''}</small></td><td>{p.paymentMethod||'—'}</td><td><b>{money(p.amount)}</b></td><td className="mono">{p.bookingId||'—'}</td></tr>)}</tbody></table></div>:<EmptyState icon={Wallet} title="No payments yet" text="Payment activity will appear here."/>}</SectionCard>
 </>
}

export default Finance;
