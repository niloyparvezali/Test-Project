import React,{useState} from 'react';
import { ShieldCheck, LockKeyhole } from 'lucide-react';
import { auth } from '../../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { BRAND_NAME } from '../../config/brand';

function AdminLogin(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const submit=async e=>{e.preventDefault();setBusy(true);setErr('');try{await signInWithEmailAndPassword(auth,email,password)}catch(x){setErr('Sign-in failed. Check your admin credentials.')}finally{setBusy(false)}};
 return <div className="admin-login-v2">
   <div className="admin-login-art"><div className="pitch-lines"></div><div className="login-orbit">⚽</div></div>
   <div className="admin-login-card">
     <div className="brand"><span className="brand-ball">⚽</span><span>{BRAND_NAME}</span></div>
     <span className="eyebrow">ADMIN PORTAL</span>
     <h1>Owner sign in</h1>
     <p>Manage bookings, payments and turf operations securely.</p>
     <form className="form" onSubmit={submit}>
       <label>Email<input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@example.com"/></label>
       <label>Password<input autoComplete="current-password" type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/></label>
       {err&&<div className="error">{err}</div>}
       <button className="primary full" disabled={busy}>{busy?'Signing in…':'Sign in'} <LockKeyhole/></button>
     </form>
     <div className="login-security"><ShieldCheck/><span>Protected Bason Turf City management area</span></div>
   </div>
 </div>
}

export default AdminLogin;
