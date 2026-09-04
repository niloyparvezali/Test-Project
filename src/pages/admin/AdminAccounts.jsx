import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Trash2, ShieldCheck, LockKeyhole } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth } from '../../firebase';
import { functions } from '../../firebaseFunctions';
import { AdminPageHeader, SectionCard, Modal, LoadingState } from '../../components/ui';
import { useAdminRole } from '../../hooks/useAdminRole';

function useAdminAccounts(enabled) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setAdmins([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');

    const load = async () => {
      try {
        const fn = httpsCallable(functions, 'listAdminAccounts');
        const result = await fn({});
        if (!active) return;
        setAdmins(Array.isArray(result?.data?.admins) ? result.data.admins : []);
        setLoading(false);
        setError('');
      } catch (error) {
        if (!active) return;
        setAdmins([]);
        setLoading(false);
        if (error?.code === 'functions/permission-denied') {
          setError('You do not have permission to view Admin accounts.');
        } else {
          setError('Could not load Admin accounts. Please try again.');
        }
      }
    };

    load();
    return () => { active = false; };
  }, [enabled, retryKey]);

  const refresh = () => setRetryKey(value => value + 1);
  return { admins, loading, error, refresh };
}

function getCreatedAtValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function CreateAdminModal({ onClose, onCreated }) {
  const [form,setForm]=useState({name:'',email:'',password:'',confirm:''});
  const [busy,setBusy]=useState(false),[err,setErr]=useState('');
  const submit=async e=>{
    e.preventDefault(); setErr('');
    if(form.password.length<6){setErr('Password must be at least 6 characters.');return;}
    if(form.password!==form.confirm){setErr('Passwords do not match.');return;}
    setBusy(true);
    try{
      const fn=httpsCallable(functions,'createAdminAccount');
      await fn({name:form.name.trim(),email:form.email.trim(),password:form.password});
      onCreated();
    }catch(x){
      if(x?.code==='functions/already-exists') setErr('An account with this email already exists.');
      else if(x?.code==='functions/invalid-argument') setErr(x?.message||'Please check the Admin details.');
      else setErr('Could not create the Admin account. Please try again.');
    }finally{setBusy(false);}
  };
  return <Modal title="Create Admin" onClose={()=>{if(!busy)onClose();}}>
    <form className="form" onSubmit={submit}>
      <label>Name<input autoComplete="name" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <label>Email<input autoComplete="email" type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
      <label>Password<input autoComplete="new-password" type="password" required minLength="6" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
      <label>Confirm Password<input autoComplete="new-password" type="password" required minLength="6" value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})}/></label>
      {err&&<div className="error">{err}</div>}
      <div className="modal-actions"><button className="secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary" disabled={busy}>{busy?'Creating…':'Create Admin'} <UserPlus/></button></div>
    </form>
  </Modal>
}

function ChangePasswordModal({ onClose }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const email = String(auth.currentUser?.email || '').trim();

  const sendReset = async () => {
    if (busy || !email) return;
    setBusy(true);
    setResult('');
    try {
      await sendPasswordResetEmail(auth, email);
      setResult('Password reset email sent successfully. Check your email to create a new password.');
    } catch (error) {
      if (error?.code === 'auth/too-many-requests') {
        setResult('Too many requests. Please wait and try again later.');
      } else {
        setResult('Could not send the password reset email. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Change Password" onClose={() => { if (!busy) onClose(); }}>
      {result ? (
        <div className={result.startsWith('Could not') || result.startsWith('Too many') ? 'error' : 'success'} role="status">
          <p>{result}</p>
        </div>
      ) : (
        <>
          <div className="verification-card">
            <p>A password reset link will be sent to:</p>
            <strong>{email || 'Unavailable'}</strong>
          </div>
          <div className="modal-actions">
            <button className="secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="primary" type="button" onClick={sendReset} disabled={busy || !email}>
              {busy ? 'Sending…' : 'Send Reset Email'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function AdminAccounts({user}){
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const { admins, loading: accountsLoading, error, refresh } = useAdminAccounts(isAdmin);
  const sortedAdmins = useMemo(() => [...admins].sort((a,b)=>{
    if((a.uid||a.id)===user?.uid)return -1;
    if((b.uid||b.id)===user?.uid)return 1;
    const createdDiff = getCreatedAtValue(b.createdAt) - getCreatedAtValue(a.createdAt);
    if (createdDiff) return createdDiff;
    return String(a.email || a.uid || a.id || '').localeCompare(String(b.email || b.uid || b.id || ''));
  }),[admins,user?.uid]);
  const current=sortedAdmins.find(x=>(x.uid||x.id)===user?.uid);
  const [modal,setModal]=useState(null),[message,setMessage]=useState(''),[deleteBusy,setDeleteBusy]=useState(false);

  if (roleLoading) return <LoadingState label="Checking admin access…"/>;
  if (!isAdmin) return <div className="error"><p>You do not have permission to view Admin accounts.</p></div>;
  if (accountsLoading) return <LoadingState label="Checking admin access…"/>;
  if (error) {
    return (
      <section className="section-card">
        <div className="empty-state-v2">
          <b>{error}</b>
          <button className="secondary" type="button" onClick={refresh}>Retry</button>
        </div>
      </section>
    );
  }
  if (!sortedAdmins.length) {
    return (
      <section className="section-card">
        <div className="empty-state-v2">
          <b>No Admin accounts found.</b>
          <p>Please try again or contact the project owner.</p>
          <button className="secondary" type="button" onClick={refresh}>Retry</button>
        </div>
      </section>
    );
  }
  if (!current) {
    return (
      <section className="section-card">
        <div className="empty-state-v2">
          <b>Your Admin profile could not be found.</b>
          <p>Please try again.</p>
          <button className="secondary" type="button" onClick={refresh}>Retry</button>
        </div>
      </section>
    );
  }

  return <>
    <AdminPageHeader eyebrow="ADMIN / ACCOUNT" title="Admin Accounts" subtitle="Manage the administrators who have full access to Konabari Turf." actions={<button className="primary" onClick={()=>{setMessage('');setModal('create')}}><UserPlus/> Create Admin</button>}/>
    {message&&<div className="success" role="status"><p>{message}</p></div>}
    <SectionCard eyebrow="ADMIN ACCOUNTS" title={`${sortedAdmins.length} administrator${sortedAdmins.length===1?'':'s'}`}>
      <div className="admin-account-list">
        {sortedAdmins.map(a=><div className="admin-account-row" key={a.uid||a.id}>
          <div className="admin-account-avatar">{String(a.name||a.email||'A').slice(0,1).toUpperCase()}</div>
          <div className="admin-account-copy"><b>{a.name||'Administrator'}</b><span>{a.email}</span><small>{(a.uid||a.id)===user?.uid?'You':'Active'}</small></div>
        </div>)}
      </div>
      <div className="admin-account-actions">
        <button className="secondary" type="button" onClick={()=>{setMessage('');setModal('password')}}><LockKeyhole/> Change Password</button>
      </div>
    </SectionCard>
    <section className="admin-self-delete-section">
      {sortedAdmins.length>1 ? (
        <button className="danger-btn" onClick={()=>{setMessage('');setModal('delete')}}><Trash2/> Delete my account</button>
      ) : (
        <p className="muted-inline"><ShieldCheck/> Last administrator — your account cannot be deleted while you are the only Admin.</p>
      )}
    </section>
    {modal==='create'&&<CreateAdminModal onClose={()=>setModal(null)} onCreated={()=>{setModal(null);setMessage('Admin account created successfully.');refresh();}}/>}
    {modal==='password'&&<ChangePasswordModal onClose={()=>{setModal(null);setMessage('')}}/>}
    {modal==='delete'&&<Modal title="Delete your admin account?" onClose={()=>{if(!deleteBusy)setModal(null);}}>
      <div className="verification-card"><p>You will lose access to the Konabari Turf Admin panel.</p><p>This action only deletes your own Admin account. Existing bookings, payments and audit history remain.</p></div>
      <div className="modal-actions"><button className="secondary" onClick={()=>setModal(null)} disabled={deleteBusy}>Cancel</button><button className="danger-btn" onClick={async()=>{
        try{
          const fn=httpsCallable(functions,'deleteOwnAdminAccount');
          setDeleteBusy(true);
          await fn({});
          window.history.pushState({},'','/admin');
          window.dispatchEvent(new PopStateEvent('popstate'));
          await auth.signOut();
        }catch(e){
          setMessage(e?.code==='functions/failed-precondition'?'You cannot delete the last administrator account.':'Could not delete your Admin account. Please try again.');
          setModal(null);
        } finally { setDeleteBusy(false); }
      }} disabled={deleteBusy}>{deleteBusy?'Deleting…':'Delete my account'}</button></div>
    </Modal>}
  </>;
}
