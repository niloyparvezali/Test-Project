import React, { useEffect, useState } from 'react';
import {
  CalendarCheck,
  Clock3,
  CreditCard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Wallet,
  X
} from 'lucide-react';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import { useCollection } from '../../hooks/useFirestore';
import { bookingStatusExpired } from '../../utils/dateUtils';
import { PendingPill } from '../../components/ui';
import AdminDashboard from './AdminDashboard';
import AdminCollection from './AdminCollection';
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
  ['collection', 'Collection', Wallet],
];

const SECONDARY_GROUPS = [
  {
    label: 'OPERATIONS',
    items: [
      ['manual-booking', 'Manual Booking', CalendarCheck],
      ['requests', 'Online Requests', ListChecks],
      ['activity', 'Recent Activity', ReceiptText],
      ['history', 'Booking History', CalendarCheck],
    ]
  },
  {
    label: 'FINANCE',
    items: [
      ['finance', 'Payments / Finance', Wallet],
      ['expenses', 'Expenses', ReceiptText],
    ]
  },
  {
    label: 'SETTINGS',
    items: [
      ['turf', 'Turf Settings', Settings],
      ['pricing', 'Pricing', CreditCard],
    ]
  }
];

const DESKTOP_GROUPS = [
  {
    label: 'OPERATIONS',
    items: PRIMARY.concat(SECONDARY_GROUPS[0].items)
  },
  SECONDARY_GROUPS[1],
  SECONDARY_GROUPS[2],
];

const TITLES = {
  home: 'Home',
  bookings: 'Bookings',
  slots: 'Slots',
  collection: 'Collection',
  'manual-booking': 'Manual Booking',
  requests: 'Online Requests',
  activity: 'Recent Activity',
  history: 'Booking History',
  finance: 'Payments / Finance',
  expenses: 'Expenses',
  turf: 'Turf Settings',
  pricing: 'Pricing',
  'admin-accounts': 'Manage Admins',
};

const SECONDARY_IDS = new Set(
  SECONDARY_GROUPS.flatMap((group) => group.items.map(([id]) => id))
);

const SUPPORTED_PAGES = new Set([
  ...PRIMARY.map(([id]) => id),
  ...SECONDARY_IDS,
  'admin-accounts',
]);

function getRoutePart() {
  const value = window.location.pathname.split('/')[2] || 'home';
  return value === 'dashboard' ? 'home' : value;
}

function AdminShell({ user, go }) {
  const { isAdmin, loading: roleLoading, uid } = useAdminRole();
  const [page, setPage] = useState(getRoutePart());
  const [menuOpen, setMenuOpen] = useState(false);
  const bookings = useCollection('bookings');

  const pendingCount = bookings.filter((b) => (
    b.status === 'pending_payment_verification' && !bookingStatusExpired(b)
  )).length;

  useEffect(() => {
    const sync = () => {
      const next = getRoutePart();
      setPage(SUPPORTED_PAGES.has(next) ? next : 'home');
      setMenuOpen(false);
    };
    window.addEventListener('popstate', sync);
    sync();
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const navigate = (path) => {
    go(`/admin/${path}`);
    setPage(path);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

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

  const renderNavItem = ([id, label, Icon], variant = '') => (
    <button
      key={id}
      type="button"
      className={`admin-nav-final-item ${page === id ? 'active' : ''} ${variant}`}
      onClick={() => navigate(id)}
      aria-current={page === id ? 'page' : undefined}
    >
      <span className="admin-nav-final-icon"><Icon /></span>
      <span className="admin-nav-final-label">{label}</span>
      {id === 'bookings' && pendingCount > 0 && <PendingPill count={pendingCount} />}
      <span className="admin-nav-final-chevron" aria-hidden="true">›</span>
    </button>
  );

  return (
    <div className="admin-app-v3">
      <aside className="admin-sidebar-v3 admin-nav-final-sidebar" aria-label="Admin navigation">
        <button className="admin-brand-v3 admin-nav-final-brand" onClick={() => navigate('home')} aria-label={`${BRAND_NAME} home`}>
          <span className="brand-mark-v3">⚽</span>
          <span><b>{BRAND_NAME}</b><small>ADMIN</small></span>
        </button>

        <div className="admin-nav-final-scroll">
          {DESKTOP_GROUPS.map((group) => (
            <section className="admin-nav-final-section" key={group.label}>
              <span className="admin-nav-final-section-label">{group.label}</span>
              {group.items.map((item) => renderNavItem(item))}
            </section>
          ))}

          <section className="admin-nav-final-section admin-nav-final-account">
            <span className="admin-nav-final-section-label">ADMIN / ACCOUNT</span>
            <div className="admin-nav-final-profile">
              <span className="admin-nav-final-profile-avatar">{initials}</span>
              <div>
                <b>{user?.email || 'Administrator'}</b>
                <small>Administrator</small>
              </div>
            </div>
            {renderNavItem(['admin-accounts', 'Manage Admins', UserRoundCog])}
            <button type="button" className="admin-nav-final-item admin-nav-final-logout" onClick={() => signOut(auth)}>
              <span className="admin-nav-final-icon"><LogOut /></span>
              <span className="admin-nav-final-label">Logout</span>
            </button>
          </section>
        </div>
      </aside>

      {menuOpen && (
        <div className="admin-nav-final-drawer-layer">
          <button
            className="admin-nav-final-drawer-overlay"
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="admin-nav-final-drawer" role="dialog" aria-modal="true" aria-label="Admin menu">
            <div className="admin-nav-final-drawer-head">
              <div>
                <b>{BRAND_NAME}</b>
                <span>ADMIN MENU</span>
              </div>
              <button
                className="admin-nav-final-close"
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                <X />
              </button>
            </div>

            <div className="admin-nav-final-drawer-scroll">
              {SECONDARY_GROUPS.map((group) => (
                <section className="admin-nav-final-section" key={group.label}>
                  <span className="admin-nav-final-section-label">{group.label}</span>
                  {group.items.map((item) => renderNavItem(item))}
                </section>
              ))}

              <section className="admin-nav-final-section admin-nav-final-account">
                <span className="admin-nav-final-section-label">ADMIN / ACCOUNT</span>
                <div className="admin-nav-final-profile">
                  <span className="admin-nav-final-profile-avatar">{initials}</span>
                  <div>
                    <b>{user?.email || 'Administrator'}</b>
                    <small>Administrator</small>
                  </div>
                </div>
                {renderNavItem(['admin-accounts', 'Manage Admins', UserRoundCog])}
                <button
                  type="button"
                  className="admin-nav-final-item admin-nav-final-logout"
                  onClick={() => { setMenuOpen(false); signOut(auth); }}
                >
                  <span className="admin-nav-final-icon"><LogOut /></span>
                  <span className="admin-nav-final-label">Logout</span>
                </button>
              </section>
            </div>
          </aside>
        </div>
      )}

      <main className="admin-main-v3">
        <header className="admin-topbar-v3">
          <div className="topbar-title-v3">
            <div className="admin-nav-final-mobile-header">
              <button
                className="admin-nav-final-menu-btn"
                type="button"
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
              >
                <Menu />
              </button>
              <div>
                <span className="eyebrow">KONABARI TURF · ADMIN</span>
                <h1>{currentTitle}</h1>
              </div>
            </div>
            <div className="admin-nav-final-desktop-header">
              <span className="eyebrow">KONABARI TURF · ADMIN</span>
              <h1>{currentTitle}</h1>
            </div>
          </div>
          <div className="topbar-meta-v3">
            {pendingCount > 0 && (
              <button className="topbar-pending" onClick={() => navigate('bookings')}>
                <span>{pendingCount}</span> pending request{pendingCount === 1 ? '' : 's'}
              </button>
            )}
            <span className="topbar-date-v3">{new Intl.DateTimeFormat('en-BD', { dateStyle: 'medium' }).format(new Date())}</span>
            <span className="avatar">{initials}</span>
          </div>
        </header>

        <div className="admin-content-v3">
          {page === 'home' && <AdminDashboard go={navigate} />}
          {page === 'bookings' && <AdminBookings />}
          {page === 'slots' && <AdminSlots />}
          {page === 'collection' && <AdminCollection />}
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
        <button className={page === 'home' ? 'active' : ''} onClick={() => navigate('home')}>
          <LayoutDashboard /><span>Home</span>
        </button>
        <button className={page === 'bookings' ? 'active' : ''} onClick={() => navigate('bookings')}>
          <span className="bottom-icon-wrap"><CalendarCheck />{pendingCount > 0 && <i>{pendingCount > 9 ? '9+' : pendingCount}</i>}</span>
          <span>Bookings</span>
        </button>
        <button className={page === 'slots' ? 'active' : ''} onClick={() => navigate('slots')}>
          <Clock3 /><span>Slots</span>
        </button>
        <button className={page === 'collection' ? 'active' : ''} onClick={() => navigate('collection')}>
          <Wallet /><span>Collection</span>
        </button>
      </nav>
    </div>
  );
}

export default AdminShell;
