export const ADMIN_PERMISSIONS = Object.freeze({
  VIEW_HOME: 'viewHome',
  VIEW_BOOKINGS: 'viewBookings',
  MANUAL_BOOKING: 'manualBooking',
  ACCEPT_BOOKING: 'acceptBooking',
  REJECT_BOOKING: 'rejectBooking',
  CANCEL_BOOKING: 'cancelBooking',
  VIEW_SLOTS: 'viewSlots',
  VIEW_COLLECTION: 'viewCollection',
  RECORD_PAYMENT: 'recordPayment',
  VIEW_ACTIVITY: 'viewActivity',
  VIEW_HISTORY: 'viewHistory',
  VIEW_FINANCE: 'viewFinance',
  VIEW_TRANSACTIONS: 'viewTransactions',
  MANAGE_EXPENSES: 'manageExpenses',
  MANAGE_TURF_SETTINGS: 'manageTurfSettings',
  MANAGE_PRICING: 'managePricing',
  VIEW_ADMIN_ACCOUNTS: 'viewAdminAccounts',
  CREATE_ADMIN: 'createAdmin',
  EDIT_ADMIN_PERMISSIONS: 'editAdminPermissions',
  PROMOTE_ADMIN: 'promoteAdmin',
  DOWNGRADE_ADMIN: 'downgradeAdmin',
  DELETE_ADMIN: 'deleteAdmin',
});

export const ALL_ADMIN_PERMISSIONS = Object.values(ADMIN_PERMISSIONS);

export const ADMIN_PERMISSION_GROUPS = [
  {
    label: 'OPERATIONS',
    items: [
      [ADMIN_PERMISSIONS.VIEW_HOME, 'Home'],
      [ADMIN_PERMISSIONS.VIEW_BOOKINGS, 'View Bookings'],
      [ADMIN_PERMISSIONS.MANUAL_BOOKING, 'Manual Booking'],
      [ADMIN_PERMISSIONS.ACCEPT_BOOKING, 'Accept Online Requests'],
      [ADMIN_PERMISSIONS.REJECT_BOOKING, 'Reject Online Requests'],
      [ADMIN_PERMISSIONS.CANCEL_BOOKING, 'Cancel Booking'],
      [ADMIN_PERMISSIONS.VIEW_SLOTS, 'View Slots'],
      [ADMIN_PERMISSIONS.VIEW_COLLECTION, 'View Collection'],
      [ADMIN_PERMISSIONS.RECORD_PAYMENT, 'Record Payment'],
      [ADMIN_PERMISSIONS.VIEW_HISTORY, 'Booking History'],
      [ADMIN_PERMISSIONS.VIEW_ACTIVITY, 'Recent Activity'],
    ],
  },
  {
    label: 'FINANCE',
    items: [
      [ADMIN_PERMISSIONS.VIEW_FINANCE, 'View Finance'],
      [ADMIN_PERMISSIONS.VIEW_TRANSACTIONS, 'View Transactions'],
      [ADMIN_PERMISSIONS.MANAGE_EXPENSES, 'Manage Expenses'],
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      [ADMIN_PERMISSIONS.MANAGE_TURF_SETTINGS, 'Turf Settings'],
      [ADMIN_PERMISSIONS.MANAGE_PRICING, 'Pricing'],
    ],
  },
  {
    label: 'ADMIN',
    items: [[ADMIN_PERMISSIONS.VIEW_ADMIN_ACCOUNTS, 'View Admin Accounts']],
  },
];

export function normalizeAdminPermissions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result = {};
  for (const permission of ALL_ADMIN_PERMISSIONS) {
    if (value[permission] === true) result[permission] = true;
  }
  return result;
}

export function hasPermission(profile, permission) {
  if (!profile || profile.role !== 'admin') return false;
  // Legacy admins without accessLevel are treated as Full during migration so nobody loses access.
  if (!profile.accessLevel || profile.accessLevel === 'full') return true;
  if (profile.accessLevel !== 'custom') return false;
  return profile.permissions?.[permission] === true;
}
