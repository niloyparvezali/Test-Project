import React,{useState} from 'react';
import { Plus,Search,ReceiptText,Pencil,Trash2,Wallet,Save } from 'lucide-react';
import { useCollection } from '../../hooks/useFirestore';
import { localDate,money,transactionDateKey,transactionDateTimeLabel } from '../../utils/dateUtils';
import { createExpenseClient,updateExpenseClient,deleteExpenseClient } from '../../services/expenseService';
import { AdminPageHeader,SectionCard,EmptyState,Modal,StatCard } from '../../components/ui';
import { useAdminRole } from '../../hooks/useAdminRole';
import { ADMIN_PERMISSIONS } from '../../config/adminPermissions';

function ExpenseModal({item,onClose}){const [f,setF]=useState(item||{reason:'',amount:'',date:localDate(),category:'Other',note:''}),[busy,setBusy]=useState(false),[err,setErr]=useState('');const save=async e=>{e.preventDefault();setBusy(true);try{item?await updateExpenseClient(item,{...f,amount:Number(f.amount)}):await createExpenseClient({...f,amount:Number(f.amount)});onClose()}catch(x){setErr(x.message||'Could not save expense.')}finally{setBusy(false)}};return <Modal title={item?'Edit expense':'Add expense'} onClose={onClose}><form className="form" onSubmit={save}><label>Reason<input required value={f.reason} onChange={e=>setF({...f,reason:e.target.value})}/></label><label>Amount<input type="number" min="0.001" step="0.001" required value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/></label><label>Date<input type="date" required value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></label><label>Category<select value={f.category} onChange={e=>setF({...f,category:e.target.value})}>{['Staff Cost','Electricity Cost','Rent','Maintenance','Equipment','Cleaning','Marketing','Other'].map(x=><option key={x}>{x}</option>)}</select></label><label>Note<input value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></label>{err&&<div className="error">{err}</div>}<button className="primary full" disabled={busy}>{busy?'Saving…':'Save expense'} <Save/></button></form></Modal>}

function Expenses(){
 const {can}=useAdminRole();
 const canManageExpenses=can(ADMIN_PERMISSIONS.MANAGE_EXPENSES);
 const expenses=useCollection('expenses'),[modal,setModal]=useState(null),[q,setQ]=useState(''),today=localDate(),month=today.slice(0,7),year=today.slice(0,4);
 const todayTotal=expenses.filter(x=>transactionDateKey(x.createdAt)===today).reduce((a,x)=>a+Number(x.amount||0),0),monthTotal=expenses.filter(x=>transactionDateKey(x.createdAt).startsWith(month)).reduce((a,x)=>a+Number(x.amount||0),0),yearTotal=expenses.filter(x=>transactionDateKey(x.createdAt).startsWith(year)).reduce((a,x)=>a+Number(x.amount||0),0);
 const rows=expenses.filter(x=>`${x.reason} ${x.category} ${x.note}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>transactionDateKey(b.createdAt).localeCompare(transactionDateKey(a.createdAt)));
 return <>
   <AdminPageHeader eyebrow="EXPENSES" title="Operating costs" subtitle="Record and review the costs that keep the turf running." actions={canManageExpenses?<button className="primary" onClick={()=>setModal({})}><Plus/> Add expense</button>:null}/>
   <div className="stat-grid-3"><StatCard icon={ReceiptText} label="Today's expenses" value={money(todayTotal)} meta={today}/><StatCard icon={ReceiptText} label="This month" value={money(monthTotal)} meta={month}/><StatCard icon={ReceiptText} label="This year" value={money(yearTotal)} meta={year}/></div>
   <SectionCard eyebrow="EXPENSE DIRECTORY" title="All expenses" subtitle="Search, edit and remove operating cost records." actions={<div className="record-count">{rows.length} records</div>}>
      <div className="filter-toolbar-v2"><div className="search-v2"><Search/><input placeholder="Search reason, category or note" value={q} onChange={e=>setQ(e.target.value)}/></div></div>
      <div className="desktop-table-wrap"><table className="admin-table-v2"><thead><tr><th>Date</th><th>Reason</th><th>Category</th><th>Amount</th><th/></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{x.date}</td><td><b>{x.reason}</b><small>{x.note}</small></td><td>{x.category}</td><td><b>{money(x.amount)}</b></td><td>{canManageExpenses&&<div className="table-actions"><button className="table-action" onClick={()=>setModal(x)}><Pencil/> Edit</button><button className="table-action danger" onClick={async()=>{if(confirm('Delete this expense?'))await deleteExpenseClient(x.id)}}><Trash2/> Delete</button></div>}</td></tr>)}</tbody></table></div>
      <div className="mobile-record-list">{rows.map(x=><div className="expense-record-card" key={x.id}><div><span>{x.date} · {x.category}</span><b>{x.reason}</b><small>{x.note||'No note'}</small></div><strong>{money(x.amount)}</strong>{canManageExpenses&&<div className="card-inline-actions"><button className="secondary" onClick={()=>setModal(x)}><Pencil/> Edit</button><button className="danger-btn" onClick={async()=>{if(confirm('Delete this expense?'))await deleteExpenseClient(x.id)}}><Trash2/> Delete</button></div>}</div>)}</div>
      {!rows.length&&<EmptyState icon={ReceiptText} title="No expenses yet" text="Your operating expenses will appear here."/>}
   </SectionCard>
   {modal&&<ExpenseModal item={modal.id?modal:null} onClose={()=>setModal(null)}/>}
 </>
}

export default Expenses;
