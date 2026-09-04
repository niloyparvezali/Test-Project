import React, { useEffect, useState } from 'react';
import { CalendarCheck, Clock3, Ellipsis, LayoutDashboard, LogOut, ReceiptText, Settings, Wallet, X } from 'lucide-react';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import { useCollection } from '../../hooks/useFirestore';
import { bookingStatusExpired } from '../../utils/dateUtils';
import { PendingPill, Modal } from '../../components/ui';
import AdminDashboard from './AdminDashboard';
import AdminBookings from './AdminBookings';
import AdminSlots from './AdminSlots';
import AdminManualBooking from './AdminManualBooking';
import AdminRequests from './AdminRequests';
import AdminActivity from './AdminActivity';
import AdminHistory from './AdminHistory';
import AdminFinance from './AdminFinance';
import AdminExpenses from './AdminExpenses';
import AdminTurf from './AdminTurf';
import AdminPricing from './AdminPricing';
import AdminAccounts from './AdminAccounts';
import { BRAND_NAME } from '../../config/brand';
import { useAdminRole } from '../../hooks/useAdminRole';

const PRIMARY = [
  ['home', 'Home', LayoutDashboard],
  ['bookings', 'Bookings', CalendarCheck],
  ['slots', 'Slots', Clock3],
];

const MORE = [
  ['manual-booking', 'Manual Booking', CalendarCheck],
  ['requests', 'Online Requests', CalendarCheck],
  ['activity', 'Recent Activity', ReceiptText],
  ['history', 'Booking History', CalendarCheck],
  ['finance', 'Payments / Finance', Wallet],
  ['expenses', 'Expenses', ReceiptText],
  ['turf', 'Turf Settings', Settings],
  ['pricing', 'Pricing', Settings],
];

const TITLES = {
  home: 'Home',
  bookings: 'Bookings',
  slots: 'Slots',
  'manual-booking': 'Manual Booking',
  requests: 'Online Requests',
  activity: 'Recent Activity',
  history: 'Booking History',
  finance: 'Payments / Finance',
  expenses: 'Expenses',
  turf: 'Turf Settings',
  pricing: 'Pricing',
  'admin-accounts': 'Admin Accounts',
};

function getRoutePart() {
  const value = window.location.pathname.split('/')[2] || 'home';
  return value === 'dashboard' ? 'home' : value;
}

function AdminShell({ user, go }) {
  const { isAdmin, loading: roleLoading, uid } = useAdminRole();
  const [page, setPage] = useState(getRoutePart());
  const [moreOpen, setMoreOpen] = useState(false);
  const bookings = useCollection('bookings');

  const pendingCount = bookings.filter((b) => (
    b.status === 'pending_payment_verification' && !bookingStatusExpired(b)
  )).length;

  useEffect(() => {
    const sync = () => {
      const next = getRoutePart();
      const supported = ['home', 'bookings', 'slots', ...MORE.map(([id]) => id), 'admin-accounts'];
      setPage(supported.includes(next) ? next : 'home');
    };
    window.addEventListener('popstate', sync);
    sync();
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const navigate = (path) => {
    go(`/admin/${path}`);
    setPage(path);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const openMore = () => {
    setMoreOpen(true);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const closeMore = () => setMoreOpen(false);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeMore();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [moreOpen]);

  const initials = String(user?.email || 'A').slice(0, 1).toUpperCase();
  const currentTitle = TITLES[page] || 'Home';

  if (roleLoading) {
    return <div className="admin-app-v3"><div className="admin-loading-screen">Checking admin access…</div></div>;
  }

  if (!isAdmin) {
    return (
      <div className="admin-login-v2">
        <div className="admin-login-card">
          <div className="brand"><span className="brand-ball">⚽</span><span>{BRAND_NAME}</span></div>
          <span className="eyebrow">ADMIN ACCESS</span>
          <h1>Admin access required</h1>
          <p>Your Firebase account is signed in, but it is not registered as an Admin.</p>
          <div className="error"><b>UID:</b> <code>{uid || 'Unavailable'}</code><br />Ask the project owner to create <code>users/{uid || '<UID>'}</code> with <code>role: "admin"</code> in Firestore.</div>
          <button className="primary full" onClick={() => signOut(auth)}>Sign out <LogOut /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app-v3">
      <aside className="admin-sidebar-v3">
        <button className="admin-brand-v3" onClick={() => navigate('home')} aria-label={`${BRAND_NAME} home`}>
          <span className="brand-mark-v3">⚽</span>
          <span><b>{BRAND_NAME}</b><small>ADMIN</small></span>
        </button>

        <div className="admin-live-pill"><i /> LIVE OPERATIONS</div>

        <nav className="admin-primary-nav-v3" aria-label="Primary admin navigation">
          {PRIMARY.map(([id, label, Icon]) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}>
              <Icon />
              <span>{label}</span>
              {id === 'bookings' && <PendingPill count={pendingCount} />}
            </button>
          ))}
        </nav>

        <button className="admin-more-trigger" onClick={openMore}>
          <Ellipsis /><span>More</span>
        </button>

        <div className="admin-sidebar-spacer" />

        <div className="admin-user-v3">
          <span className="avatar">{initials}</span>
          <div><b>{user?.email || 'Administrator'}</b><small>Administrator</small></div>
          <button className="icon-btn" title="Sign out" onClick={() => signOut(auth)}><LogOut /></button>
        </div>
      </aside>

      {moreOpen && (
        <div className="admin-more-drawer-layer" aria-label="More admin navigation">
          <button className="admin-more-drawer-overlay" aria-label="Close More navigation" onClick={closeMore} />
          <aside className="admin-more-drawer" role="dialog" aria-modal="true" aria-label="Admin menu">
            <div className="admin-more-drawer-head">
              <div>
                <b>{BRAND_NAME}</b>
                <span>Admin Menu</span>
              </div>
              <button className="admin-more-drawer-close" type="button" onClick={closeMore} aria-label="Close More navigation">
                <X />
              </button>
            </div>

            <div className="admin-more-drawer-scroll">
              <section className="admin-more-drawer-section">
                <span className="admin-more-drawer-section-label">OPERATIONS</span>
                {MORE.slice(0, 4).map(([id, label, Icon]) => (
                  <button key={id} className="admin-more-drawer-item" type="button" onClick={() => navigate(id)}>
                    <span className="admin-more-drawer-icon"><Icon /></span>
                    <span className="admin-more-drawer-label">{label}</span>
                    {id === 'requests' && pendingCount > 0 && <PendingPill count={pendingCount} />}
                    <span className="admin-more-drawer-arrow" aria-hidden="true">›</span>
                  </button>
                ))}
              </section>

              <section className="admin-more-drawer-section">
                <span className="admin-more-drawer-section-label">FINANCE</span>
                {MORE.slice(4, 6).map(([id, label, Icon]) => (
                  <button key={id} className="admin-more-drawer-item" type="button" onClick={() => navigate(id)}>
                    <span className="admin-more-drawer-icon"><Icon /></span>
                    <span className="admin-more-drawer-label">{label}</span>
                    <span className="admin-more-drawer-arrow" aria-hidden="true">›</span>
                  </button>
                ))}
              </section>

              <section className="admin-more-drawer-section">
                <span className="admin-more-drawer-section-label">SETTINGS</span>
                {MORE.slice(6).map(([id, label, Icon]) => (
                  <button key={id} className="admin-more-drawer-item" type="button" onClick={() => navigate(id)}>
                    <span className="admin-more-drawer-icon"><Icon /></span>
                    <span className="admin-more-drawer-label">{label}</span>
                    <span className="admin-more-drawer-arrow" aria-hidden="true">›</span>
                  </button>
                ))}
              </section>

              <section className="admin-more-drawer-section admin-more-drawer-account">
                <span className="admin-more-drawer-section-label">ADMIN / ACCOUNT</span>
                <div className="admin-more-drawer-user">
                  <span className="avatar">{initials}</span>
                  <div><b>{user?.email || 'Administrator'}</b><small>Administrator</small></div>
                </div>
                <button className="admin-more-drawer-item" type="button" onClick={() => navigate('admin-accounts')}>
                  <span className="admin-more-drawer-icon"><Settings /></span>
                  <span className="admin-more-drawer-label">Manage Admins</span>
                  <span className="admin-more-drawer-arrow" aria-hidden="true">›</span>
                </button>
                <button className="admin-more-drawer-item admin-more-drawer-logout" type="button" onClick={() => { closeMore(); signOut(auth); }}>
                  <span className="admin-more-drawer-icon"><LogOut /></span>
                  <span className="admin-more-drawer-label">Logout</span>
                </button>
              </section>
            </div>
          </aside>
        </div>
      )}

      <main className="admin-main-v3">
        <header className="admin-topbar-v3">
          <div className="topbar-title-v3">
            <span className="eyebrow">BASON TURF CITY · ADMIN</span>
            <h1>{currentTitle}</h1>
          </div>
          <div className="topbar-meta-v3">
            {pendingCount > 0 && <button className="topbar-pending" onClick={() => navigate('bookings')}><span>{pendingCount}</span> pending request{pendingCount === 1 ? '' : 's'}</button>}
            <span className="topbar-date-v3">{new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium' }).format(new Date())}</span>
            <span className="avatar">{initials}</span>
          </div>
        </header>

        <div className="admin-content-v3">
          {page === 'home' && <AdminDashboard go={navigate} />}
          {page === 'bookings' && <AdminBookings />}
          {page === 'slots' && <AdminSlots />}
          {page === 'manual-booking' && <AdminManualBooking />}
          {page === 'requests' && <AdminRequests />}
          {page === 'activity' && <AdminActivity />}
          {page === 'history' && <AdminHistory />}
          {page === 'finance' && <AdminFinance />}
          {page === 'expenses' && <AdminExpenses />}
          {page === 'turf' && <AdminTurf />}
          {page === 'pricing' && <AdminPricing />}
          {page === 'admin-accounts' && <AdminAccounts user={user} />}
        </div>
      </main>

      <nav className="admin-bottom-nav-v3" aria-label="Mobile admin navigation">
        <button className={page === 'home' ? 'active' : ''} onClick={() => navigate('home')}><LayoutDashboard /><span>Home</span></button>
        <button className={page === 'bookings' ? 'active' : ''} onClick={() => navigate('bookings')}>
          <span className="bottom-icon-wrap"><CalendarCheck />{pendingCount > 0 && <i>{pendingCount > 9 ? '9+' : pendingCount}</i>}</span>
          <span>Bookings</span>
        </button>
        <button className={page === 'slots' ? 'active' : ''} onClick={() => navigate('slots')}><Clock3 /><span>Slots</span></button>
        <button onClick={openMore}><Ellipsis /><span>More</span></button>
      </nav>
    </div>
  );
}

export default AdminShell;
