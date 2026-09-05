import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus, Trash2, ShieldCheck, LockKeyhole, Pencil, Crown, CheckCircle2 } from 'lucide-react';
import { createUserWithEmailAndPassword, deleteUser, getAuth, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { getApps, initializeApp } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { auth, db } from '../../firebase';
import { functions } from '../../firebaseFunctions';
import { collection, doc, getFirestore, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { AdminPageHeader, SectionCard, Modal, LoadingState } from '../../components/ui';
import { useAdminRole } from '../../hooks/useAdminRole';
import { ADMIN_PERMISSION_GROUPS, normalizeAdminPermissions } from '../../config/adminPermissions';


// Spark-compatible Admin account creation.
// Firebase Auth supports client-side email/password account creation on Spark.
// A secondary Firebase App keeps the new account creation isolated from the
// currently signed-in Admin, so creating an Admin does not sign the current
// Admin out.
const ADMIN_CREATOR_APP_NAME = 'admin-account-creator';

function getAdminCreatorApp() {
  const existing = getApps().find(app => app.name === ADMIN_CREATOR_APP_NAME);
  return existing || initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  }, ADMIN_CREATOR_APP_NAME);
}

function getAdminCreatorAuth() {
  return getAuth(getAdminCreatorApp());
}

function getAdminCreatorDb() {
  return getFirestore(getAdminCreatorApp());
}

function normalizeCreateAdminError(error) {
  const code = String(error?.code || '');
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'Only Full Admin can create Admin accounts.';
  }
  return error?.message || 'Could not create the Admin account.';
}

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

    setLoading(true);
    setError('');

    // Spark-compatible account listing: use the existing protected Firestore
    // read for Admin profiles instead of the currently undeployed callable.
    // This does NOT replace any privileged create/update/delete operation.
    const q = query(collection(db, 'users'), where('role', '==', 'admin'));

    return onSnapshot(
      q,
      snapshot => {
        const nextAdmins = snapshot.docs.map(docSnap => {
          const data = docSnap.data() || {};
          return {
            ...data,
            uid: docSnap.id,
            permissions: normalizeAdminPermissions(data.permissions),
            createdAt: data.createdAt ?? null,
          };
        });

        setAdmins(nextAdmins);
        setLoading(false);
        setError('');
      },
      err => {
        setAdmins([]);
        setLoading(false);
        setError(
          err?.code === 'permission-denied'
            ? 'You do not have permission to manage Admin accounts.'
            : (err?.message || 'Could not load Admin accounts. Please try again.')
        );
      }
    );
  }, [enabled, retryKey]);

  return {
    admins,
    loading,
    error,
    refresh: () => setRetryKey(v => v + 1),
  };
}

function getCreatedAtValue(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function AccessBadge({ admin }) {
  const full = !admin?.accessLevel || admin.accessLevel === 'full';
  const permissions = Object.keys(normalizeAdminPermissions(admin?.permissions));
  return (
    <div className={`admin-premium-access-badge ${full ? 'full' : 'custom'}`}>
      <span>{full ? 'FULL ADMIN' : 'CUSTOM ADMIN'}</span>
      <small>{full ? 'Full access' : `${permissions.length} permission${permissions.length === 1 ? '' : 's'}`}</small>
    </div>
  );
}

function PermissionSummary({ admin }) {
  const full = !admin?.accessLevel || admin.accessLevel === 'full';
  if (full) return <span className="admin-premium-summary">All Admin pages & supported actions</span>;
  const labels = ADMIN_PERMISSION_GROUPS.flatMap(group => group.items.filter(([key]) => admin?.permissions?.[key] === true).map(([, label]) => label));
  if (!labels.length) return <span className="admin-premium-summary muted">No operational permissions granted</span>;
  return <span className="admin-premium-summary">{labels.slice(0, 4).join(' · ')}{labels.length > 4 ? ` +${labels.length - 4} more` : ''}</span>;
}

function PermissionEditor({ value, onChange }) {
  const toggle = (key) => onChange({ ...value, [key]: !value[key] });
  const toggleGroup = (items) => {
    const keys = items.map(([key]) => key);
    const nextValue = keys.every(key => value[key] === true);
    onChange({ ...value, ...Object.fromEntries(keys.map(key => [key, !nextValue])) });
  };
  return (
    <div className="admin-premium-permission-editor">
      {ADMIN_PERMISSION_GROUPS.map(group => {
        const keys = group.items.map(([key]) => key);
        const allOn = keys.every(key => value[key] === true);
        return (
          <section className="admin-premium-permission-group" key={group.label}>
            <div className="admin-premium-group-head">
              <div>
                <span className="eyebrow">{group.label}</span>
                <p>{group.label === 'OPERATIONS' ? 'Daily turf operations and booking actions.' : group.label === 'FINANCE' ? 'Financial visibility and expense management.' : group.label === 'SETTINGS' ? 'Business configuration and pricing controls.' : 'Administrator visibility.'}</p>
              </div>
              <button type="button" className="admin-premium-select-all" onClick={() => toggleGroup(group.items)}>{allOn ? 'Clear all' : 'Select all'}</button>
            </div>
            <div className="admin-premium-permission-list">
              {group.items.map(([key, label]) => {
                const descriptions = {
                  viewHome: 'Access the Admin dashboard.',
                  viewBookings: 'View booking records.',
                  manualBooking: 'Create offline customer bookings.',
                  acceptBooking: 'Accept online booking requests.',
                  rejectBooking: 'Reject online booking requests.',
                  cancelBooking: 'Cancel confirmed bookings.',
                  viewSlots: 'View slot availability.',
                  viewCollection: 'Access customer payment collection.',
                  recordPayment: 'Record customer payments.',
                  viewHistory: 'Inspect booking history.',
                  viewActivity: 'View Admin activity.',
                  viewFinance: 'Access the Financial Command Center.',
                  viewTransactions: 'View financial transactions.',
                  manageExpenses: 'Add, edit and delete expenses.',
                  manageTurfSettings: 'Manage turf and operational settings.',
                  managePricing: 'Manage current pricing.',
                  viewAdminAccounts: 'View administrator accounts.'
                };
                return (
                  <label className="admin-premium-permission-row" key={key}>
                    <span className="admin-premium-permission-copy">
                      <b>{label}</b>
                      <small>{descriptions[key] || 'Access this Admin capability.'}</small>
                    </span>
                    <input type="checkbox" checked={value[key] === true} onChange={() => toggle(key)} aria-label={label} />
                    <span className="admin-premium-switch" aria-hidden="true"><i /></span>
                  </label>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CreateAdminModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', accessLevel: 'full', permissions: {} });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmFull, setConfirmFull] = useState(false);

  const submit = async e => {
    e.preventDefault(); setErr('');
    if (form.password.length < 6) return setErr('Password must be at least 6 characters.');
    if (form.password !== form.confirm) return setErr('Passwords do not match.');
    if (form.accessLevel === 'full') { setConfirmFull(true); return; }
    await create();
  };
  const create = async () => {
    setBusy(true); setErr('');
    let creatorAuth = null;
    let createdAuthUser = null;

    try {
      const name = form.name.trim();
      const email = form.email.trim().toLowerCase();
      const accessLevel = form.accessLevel === 'custom' ? 'custom' : 'full';
      const permissions = accessLevel === 'custom'
        ? normalizeAdminPermissions(form.permissions)
        : {};

      if (!name) throw new Error('Admin name is required.');
      if (!email) throw new Error('Admin email is required.');

      // Step 1: create a one-time Admin invitation with the currently
      // authenticated Full Admin. This is the security bridge required on
      // the Spark plan because the browser cannot create another user's
      // Firebase Auth account through the Admin SDK.
      const inviteRef = doc(db, 'adminInvites', email);
      await setDoc(inviteRef, {
        email,
        name,
        accessLevel,
        permissions,
        status: 'pending',
        createdBy: auth.currentUser?.uid || '',
        createdByEmail: auth.currentUser?.email || '',
        createdAt: serverTimestamp(),
      });

      creatorAuth = getAdminCreatorAuth();

      // Step 2: create the Firebase Authentication account in a secondary app
      // so the current Full Admin session is not replaced.
      const credential = await createUserWithEmailAndPassword(
        creatorAuth,
        email,
        form.password
      );
      createdAuthUser = credential.user;

      // Step 3: the newly-created Auth user claims the invitation. Firestore
      // rules only permit this exact user/email to atomically create the Admin
      // profile and mark the invitation as claimed.
      const creatorDb = getAdminCreatorDb();
      const batch = writeBatch(creatorDb);
      batch.set(doc(creatorDb, 'users', createdAuthUser.uid), {
        name,
        email,
        role: 'admin',
        accessLevel,
        permissions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(creatorDb, 'adminInvites', email), {
        status: 'claimed',
        claimedBy: createdAuthUser.uid,
        claimedAt: serverTimestamp(),
      });
      await batch.commit();

      await signOut(creatorAuth);
      setConfirmFull(false);
      onCreated();
    } catch (x) {
      try {
        if (creatorAuth?.currentUser) await signOut(creatorAuth);
      } catch (_) {}

      // If Auth creation succeeded but the atomic Firestore claim failed,
      // remove the just-created Auth account to avoid an orphaned account.
      try {
        if (createdAuthUser) await deleteUser(createdAuthUser);
      } catch (_) {}

      setConfirmFull(false);
      setErr(normalizeCreateAdminError(x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={confirmFull ? 'Confirm Full Admin Access' : 'Create Admin'} onClose={() => { if (!busy) onClose(); }}>
      {confirmFull ? (
        <div className="admin-form-premium">
          <div className="admin-premium-confirm">
            <div className="admin-premium-confirm-icon"><Crown /></div>
            <div><span className="eyebrow">AUTHORITY CONFIRMATION</span><h4>FULL ADMIN ACCESS</h4><p>This account will have complete Admin access, including Admin management, permission changes and Admin account deletion.</p></div>
          </div>
          <div className="admin-premium-modal-footer"><button className="secondary" type="button" onClick={() => setConfirmFull(false)} disabled={busy}>Back</button><button className="primary" type="button" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create Full Admin'} <CheckCircle2 /></button></div>
        </div>
      ) : (
        <form className="admin-form-premium" onSubmit={submit}>
          <div className="admin-premium-section-head"><span className="eyebrow">ACCOUNT DETAILS</span><p>Create a secure administrator account.</p></div>
          <div className="admin-premium-field-grid">
            <label><span>Name</span><input autoComplete="name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter full name" /></label>
            <label><span>Email</span><input autoComplete="email" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@example.com" /></label>
            <label><span>Password</span><input autoComplete="new-password" type="password" required minLength="6" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Minimum 6 characters" /></label>
            <label><span>Confirm Password</span><input autoComplete="new-password" type="password" required minLength="6" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} placeholder="Repeat password" /></label>
          </div>

          <div className="admin-premium-form-section">
            <div className="admin-premium-section-head"><span className="eyebrow">ACCESS LEVEL</span><p>Choose the authority this account will receive.</p></div>
            <div className="admin-premium-access-grid">
              <button type="button" className={form.accessLevel === 'full' ? 'active' : ''} onClick={() => setForm({ ...form, accessLevel: 'full' })}><span className="admin-premium-option-icon"><Crown /></span><span><b>Full Admin</b><small>Complete authority</small></span><span className="admin-premium-option-check">{form.accessLevel === 'full' ? '✓' : ''}</span></button>
              <button type="button" className={form.accessLevel === 'custom' ? 'active' : ''} onClick={() => setForm({ ...form, accessLevel: 'custom' })}><span className="admin-premium-option-icon"><ShieldCheck /></span><span><b>Custom Admin</b><small>Selected permissions only</small></span><span className="admin-premium-option-check">{form.accessLevel === 'custom' ? '✓' : ''}</span></button>
            </div>
          </div>

          {form.accessLevel === 'full' ? (
            <div className="admin-premium-full-note"><CheckCircle2 /><div><b>FULL ACCESS</b><span>All Admin pages and supported actions are enabled automatically.</span></div></div>
          ) : (
            <div className="admin-premium-form-section"><div className="admin-premium-section-head"><span className="eyebrow">PERMISSIONS</span><p>Grant only the capabilities this Custom Admin needs.</p></div><PermissionEditor value={form.permissions} onChange={permissions => setForm({ ...form, permissions })} /></div>
          )}

          {err && <div className="admin-premium-form-error" role="alert">{err}</div>}
          <div className="admin-premium-modal-footer"><button className="secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Creating…' : 'Create Admin'} <UserPlus /></button></div>
        </form>
      )}
    </Modal>
  );
}

function AccessModal({ admin, onClose, onSaved }) {
  const isFull = !admin?.accessLevel || admin.accessLevel === 'full';
  const [level, setLevel] = useState(isFull ? 'full' : 'custom');
  const [permissions, setPermissions] = useState(normalizeAdminPermissions(admin?.permissions));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true); setErr('');
    try {
      await updateDoc(doc(db, 'users', admin.uid), {
        accessLevel: level,
        permissions: level === 'full' ? {} : normalizeAdminPermissions(permissions),
        updatedAt: serverTimestamp(),
      });
      onSaved();
    } catch (x) {
      setErr(
        x?.code === 'permission-denied'
          ? 'Only Full Admin can update Admin access.'
          : (x?.message || 'Could not update Admin access.')
      );
    } finally { setBusy(false); }
  };
  return <Modal title="Edit Admin Access" onClose={() => { if (!busy) onClose(); }}>
    <div className="admin-form-premium">
      <div className="admin-premium-profile">
        <div className="admin-account-avatar admin-premium-avatar">{String(admin.name || admin.email || 'A').slice(0,1).toUpperCase()}</div>
        <div><span className="eyebrow">ADMIN</span><h4>{admin.name || admin.email || 'Administrator'}</h4><p>{admin.email}</p></div>
        <AccessBadge admin={admin} />
      </div>

      <div className="admin-premium-form-section"><div className="admin-premium-section-head"><span className="eyebrow">ACCESS LEVEL</span><p>Update this Admin's authority level.</p></div><div className="admin-premium-access-grid">
        <button type="button" className={level === 'full' ? 'active' : ''} onClick={() => setLevel('full')}><span className="admin-premium-option-icon"><Crown /></span><span><b>Full Admin</b><small>Complete authority</small></span><span className="admin-premium-option-check">{level === 'full' ? '✓' : ''}</span></button>
        <button type="button" className={level === 'custom' ? 'active' : ''} onClick={() => setLevel('custom')}><span className="admin-premium-option-icon"><ShieldCheck /></span><span><b>Custom Admin</b><small>Explicit permissions</small></span><span className="admin-premium-option-check">{level === 'custom' ? '✓' : ''}</span></button>
      </div></div>

      {level === 'full' ? <div className="admin-premium-full-note"><CheckCircle2 /><div><b>FULL ACCESS</b><span>All valid Admin permissions are enabled automatically.</span></div></div> : <div className="admin-premium-form-section"><div className="admin-premium-section-head"><span className="eyebrow">PERMISSIONS</span><p>Grant only the capabilities this Custom Admin needs.</p></div><PermissionEditor value={permissions} onChange={setPermissions} /></div>}
      {err && <div className="admin-premium-form-error" role="alert">{err}</div>}
      <div className="admin-premium-modal-footer"><button className="secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary" type="button" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Changes'} <CheckCircle2 /></button></div>
    </div>
  </Modal>;
}

function ChangePasswordModal({ onClose }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const email = String(auth.currentUser?.email || '').trim();
  const sendReset = async () => {
    if (busy || !email) return;
    setBusy(true); setResult('');
    try { await sendPasswordResetEmail(auth, email); setResult('Password reset email sent successfully. Check your email to create a new password.'); }
    catch (error) { setResult(error?.code === 'auth/too-many-requests' ? 'Too many requests. Please wait and try again later.' : 'Could not send the password reset email. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Modal title="Change Password" onClose={() => { if (!busy) onClose(); }}>{result ? <div className={result.startsWith('Could not') || result.startsWith('Too many') ? 'error' : 'success'} role="status"><p>{result}</p></div> : <><div className="verification-card"><p>A password reset link will be sent to:</p><strong>{email || 'Unavailable'}</strong></div><div className="modal-actions"><button className="secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary" type="button" onClick={sendReset} disabled={busy || !email}>{busy ? 'Sending…' : 'Send Reset Email'}</button></div></>}</Modal>;
}

export default function AdminAccounts({ user }) {
  const { isAdmin, isFullAdmin, loading: roleLoading } = useAdminRole();
  const { admins, loading: accountsLoading, error, refresh } = useAdminAccounts(isFullAdmin);
  const sortedAdmins = useMemo(() => [...admins].sort((a, b) => {
    if ((a.uid || a.id) === user?.uid) return -1;
    if ((b.uid || b.id) === user?.uid) return 1;
    return getCreatedAtValue(b.createdAt) - getCreatedAtValue(a.createdAt) || String(a.email || a.uid || '').localeCompare(String(b.email || b.uid || ''));
  }), [admins, user?.uid]);
  const [modal, setModal] = useState(null);
  const [message, setMessage] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  if (roleLoading) return <LoadingState label="Checking Admin authority…"/>;
  if (!isAdmin || !isFullAdmin) return <div className="error"><p>Admin Management is restricted to Full Admin.</p></div>;
  if (accountsLoading) return <LoadingState label="Loading Admin accounts…"/>;
  if (error) return <section className="section-card"><div className="empty-state-v2"><b>{error}</b><button className="secondary" type="button" onClick={refresh}>Retry</button></div></section>;
  if (!sortedAdmins.length) return <section className="section-card"><div className="empty-state-v2"><b>No Admin accounts found.</b><button className="secondary" type="button" onClick={refresh}>Retry</button></div></section>;

  const deleteAdmin = async (target) => {
    if (deleteBusy) return;
    const targetName = target.name || target.email || 'this Admin';
    if (sortedAdmins.length <= 1) { setMessage('You cannot delete the last remaining Admin account.'); return; }
    if (!window.confirm(`Delete Admin?\n\n${targetName}\n${target.email || ''}\n\nThe Admin profile and Firebase Authentication account will be deleted. Booking history, payment records and activity history will be preserved.`)) return;
    setDeleteBusy(true); setMessage('');
    try {
      await httpsCallable(functions, 'deleteAdminAccount')({ targetUid: target.uid });

      setMessage(`${targetName} was removed from Admin access.`);
      refresh();
      if (target.uid === user?.uid) { await auth.signOut(); }
    } catch (e) {
      setMessage(
        e?.code === 'permission-denied'
          ? 'Only Full Admin can remove Admin access.'
          : (e?.message || 'Could not remove Admin access.')
      );
    } finally { setDeleteBusy(false); }
  };

  return <div className="admin-accounts-premium">
    <AdminPageHeader eyebrow="ADMIN / ACCOUNT" title="Manage Admins" subtitle="Full Admins can create, change and remove Admin access." actions={<button className="primary" type="button" onClick={() => { setMessage(''); setModal('create'); }}><UserPlus/> Create Admin</button>}/>
    {message && <div className="admin-premium-feedback" role="status">{message}</div>}

    <SectionCard eyebrow="ADMIN DIRECTORY" title={`${sortedAdmins.length} administrator${sortedAdmins.length === 1 ? '' : 's'}`} subtitle="Admin authority is enforced by Firestore rules. Custom Admins never gain Admin-management authority.">
      <div className="admin-premium-directory">
        {sortedAdmins.map(admin => {
          const self = admin.uid === user?.uid;
          return <article className="admin-premium-card" key={admin.uid}>
            <div className="admin-premium-card-identity">
              <div className="admin-account-avatar">{String(admin.name || admin.email || 'A').slice(0,1).toUpperCase()}</div>
              <div className="admin-premium-identity-copy"><b>{admin.name || 'Administrator'}</b><span>{admin.email}</span><small>{self ? 'YOU · CURRENT ADMIN' : 'ACTIVE ADMIN'}</small></div>
            </div>
            <AccessBadge admin={admin}/>
            <PermissionSummary admin={admin}/>
            <div className="admin-premium-card-actions">
              <button className="secondary" type="button" onClick={() => setModal({ type: 'access', admin })}><Pencil/> Manage Access</button>
              <button className="danger-btn" type="button" onClick={() => deleteAdmin(admin)} disabled={deleteBusy || sortedAdmins.length <= 1}><Trash2/> Remove Admin</button>
            </div>
          </article>;
        })}
      </div>
    </SectionCard>

    <SectionCard eyebrow="ACCOUNT" title="Your account" subtitle="Every Admin can securely change their own password.">
      <div className="admin-premium-account-row"><div className="admin-premium-account-copy"><b>{auth.currentUser?.email || user?.email || 'Administrator'}</b><span>Your signed-in administrator account</span></div><button className="secondary" type="button" onClick={() => setModal('password')}><LockKeyhole/> Change Password</button></div>
    </SectionCard>

    <div className="admin-premium-security-note"><ShieldCheck/><span>Full Admin is the highest authority. Admin-management actions are protected by Firestore rules.</span></div>

    {modal === 'create' && <CreateAdminModal onClose={() => setModal(null)} onCreated={() => { setModal(null); setMessage('Admin account created successfully.'); refresh(); }}/>}    
    {modal?.type === 'access' && <AccessModal admin={modal.admin} onClose={() => setModal(null)} onSaved={() => { setModal(null); setMessage('Admin access updated successfully.'); refresh(); }}/>}    
    {modal === 'password' && <ChangePasswordModal onClose={() => setModal(null)}/>} 
  </div>;
}
