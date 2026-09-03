import React,{useEffect,useState} from 'react';
import { CalendarCheck,Wallet,ReceiptText,Info,Settings,LayoutDashboard,LogOut,Menu,X } from 'lucide-react';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import { useCollection } from '../../hooks/useFirestore';
import { bookingStatusExpired, TZ } from '../../utils/dateUtils';
import { PendingPill } from '../../components/ui';
import AdminDashboard from './AdminDashboard';
import AdminBookings from './AdminBookings';
import AdminFinance from './AdminFinance';
import AdminExpenses from './AdminExpenses';
import AdminTurf from './AdminTurf';
import AdminPricing from './AdminPricing';
import { BRAND_NAME } from '../../config/brand';
import { useAdminRole } from '../../hooks/useAdminRole';

const ADMIN_NAV=[
  ['dashboard','Dashboard',LayoutDashboard],
  ['bookings','Bookings',CalendarCheck],
  ['finance','Payments / Finance',Wallet],
  ['expenses','Expenses',ReceiptText],
  ['turf','Turf',Info],
  ['pricing','Pricing',Settings],
];

function AdminShell({user,go}){
 const {isAdmin,loading:roleLoading,uid,email}=useAdminRole();
 const routePart=window.location.pathname.split('/')[2]||'dashboard';
 const [page,setPage]=useState(routePart==='settings'?'turf':routePart);
 const [menuOpen,setMenuOpen]=useState(false);
 const shellBookings=useCollection('bookings');
 const pendingCount=shellBookings.filter(b=>b.status==='pending_payment_verification'&&!bookingStatusExpired(b)).length;
 const select=p=>{setPage(p);go('/admin/'+p);setMenuOpen(false)};
 useEffect(()=>{
   const raw=window.location.pathname.split('/')[2]||'dashboard';
   const p=raw==='settings'?'turf':raw;
   if(!ADMIN_NAV.some(([id])=>id===p)){
     if(raw==='gallery') go('/admin');
     setPage('dashboard');
     return;
   }
   setPage(p);
 },[window.location.pathname]);
 const current=ADMIN_NAV.find(n=>n[0]===page)||ADMIN_NAV[0];
 const initials=String(user?.email||'A').slice(0,1).toUpperCase();
 if(roleLoading) return <div className="admin-app-v2"><main className="admin-main-v2"><div className="admin-content-v2"><div className="loading-state-v2"><div className="loading-ring"></div><span>Checking admin access…</span></div></div></main></div>;
 if(!isAdmin) return <div className="admin-login-v2"><div className="admin-login-card"><div className="brand"><span className="brand-ball">⚽</span><span>{BRAND_NAME}</span></div><span className="eyebrow">ADMIN ACCESS</span><h1>Admin access required</h1><p>Your Firebase account is signed in, but it is not registered as an Admin.</p><div className="error"><b>UID:</b> <code>{uid||'Unavailable'}</code><br/>Ask the project owner to create <code>users/{uid||'<UID>'}</code> in Firestore with <code>role: "admin"</code>.</div><button className="primary full" onClick={()=>signOut(auth)}>Sign out <LogOut/></button></div></div>;
 return <div className="admin-app-v2">
   <aside className="admin-sidebar">
     <div className="sidebar-top">
       <button className="brand" onClick={()=>select('dashboard')} aria-label="Bason Turf City dashboard"><span className="brand-ball">⚽</span><span>{BRAND_NAME}</span></button>
       <div className="sidebar-status"><i></i><span>COMMAND CENTRE</span></div>
     </div>
     <nav className="sidebar-nav" aria-label="Admin navigation">
       <div className="nav-group-label">MAIN</div>
       {ADMIN_NAV.slice(0,4).map(([id,label,I])=><button key={id} className={page===id?'active':''} onClick={()=>select(id)}><I/><span>{label}</span>{id==='bookings'&&<PendingPill count={pendingCount}/>}</button>)}
       <div className="nav-group-label">CONTENT</div>
       {ADMIN_NAV.slice(4,6).map(([id,label,I])=><button key={id} className={page===id?'active':''} onClick={()=>select(id)}><I/><span>{label}</span></button>)}
       <div className="nav-group-label">SYSTEM</div>
       {ADMIN_NAV.slice(6).map(([id,label,I])=><button key={id} className={page===id?'active':''} onClick={()=>select(id)}><I/><span>{label}</span></button>)}
     </nav>
     <div className="sidebar-user">
       <div className="avatar">{initials}</div><div><b>{user?.email||'Administrator'}</b><span>Administrator</span></div>
       <button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={()=>signOut(auth)}><LogOut/></button>
     </div>
   </aside>

   {menuOpen&&<button className="admin-scrim" aria-label="Close menu" onClick={()=>setMenuOpen(false)}/>}
   <main className="admin-main-v2">
     <header className="admin-topbar-v2">
       <div className="topbar-left">
         <button className="icon-btn mobile-menu-v2" aria-label="Open menu" onClick={()=>setMenuOpen(true)}><Menu/></button>
         <div><span className="eyebrow">TURF MANAGEMENT</span><h1>{current[1]}</h1></div>
       </div>
       <div className="topbar-right">
         <span className="topbar-date">{new Intl.DateTimeFormat('en-BD',{dateStyle:'medium',timeZone:TZ}).format(new Date())}</span>
         <div className="profile-mini"><span className="avatar">{initials}</span><span className="profile-copy"><b>{user?.email||'Admin'}</b><small>Administrator</small></span></div>
       </div>
     </header>

     <div className="admin-content-v2">
       {page==='dashboard'&&<AdminDashboard go={go}/>}
       {page==='bookings'&&<AdminBookings/>}
       {page==='finance'&&<AdminFinance/>}
       {page==='expenses'&&<AdminExpenses/>}
       
       {page==='turf'&&<AdminTurf/>}
       {page==='pricing'&&<AdminPricing/>}
     </div>
   </main>

   <nav className="admin-bottom-nav" aria-label="Mobile admin navigation">
     {ADMIN_NAV.slice(0,2).map(([id,label,I])=><button key={id} className={page===id?'active':''} onClick={()=>select(id)}><I/><span>{id==='bookings'?<PendingPill count={pendingCount}/>:null}{label==='Bookings'?'Bookings':label}</span></button>)}
     <button className={page==='finance'?'active':''} onClick={()=>select('finance')}><Wallet/><span>Payments</span></button>
     <button onClick={()=>setMenuOpen(true)}><Menu/><span>More</span></button>
   </nav>

   {menuOpen&&<div className="mobile-more-sheet">
     <div className="mobile-more-head"><span><span className="eyebrow">TURF MANAGEMENT</span><b>More controls</b></span><button className="icon-btn" onClick={()=>setMenuOpen(false)}><X/></button></div>
     {ADMIN_NAV.slice(3).map(([id,label,I])=><button key={id} className={page===id?'active':''} onClick={()=>select(id)}><I/><span>{label}</span></button>)}
     <button className="more-signout" onClick={()=>signOut(auth)}><LogOut/><span>Sign out</span></button>
   </div>}
 </div>
}

export default AdminShell;
