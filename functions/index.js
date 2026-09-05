const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const auth = getAuth();

const ALL_ADMIN_PERMISSIONS = new Set([
  'viewHome', 'viewBookings', 'manualBooking', 'acceptBooking', 'rejectBooking', 'cancelBooking',
  'viewSlots', 'viewCollection', 'recordPayment', 'viewActivity', 'viewHistory', 'viewFinance',
  'viewTransactions', 'manageExpenses', 'manageTurfSettings', 'managePricing', 'viewAdminAccounts',
  'createAdmin', 'editAdminPermissions', 'promoteAdmin', 'downgradeAdmin', 'deleteAdmin'
]);

function normalizePermissions(value = {}) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const permission of ALL_ADMIN_PERMISSIONS) if (value[permission] === true) result[permission] = true;
  return result;
}

function isFullAdmin(profile) {
  return !!profile && profile.role === 'admin' && (!profile.accessLevel || profile.accessLevel === 'full');
}

function hasPermission(profile, permission) {
  if (!profile || profile.role !== 'admin') return false;
  if (isFullAdmin(profile)) return true;
  return profile.accessLevel === 'custom' && profile.permissions?.[permission] === true;
}

async function migrateLegacyAdminAccounts() {
  const snap = await db.collection('users').where('role', '==', 'admin').get();
  const batch = db.batch();
  let changed = 0;
  snap.docs.forEach(doc => {
    const data = doc.data() || {};
    if (!data.accessLevel) {
      batch.set(doc.ref, { accessLevel: 'full', permissions: {}, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      changed += 1;
    }
  });
  if (changed) await batch.commit();
  await db.doc('adminState/metadata').set({ adminCount: snap.size, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return snap.size;
}

async function getAdminProfile(uid) {
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (data.role !== 'admin') return null;

  if (!data.accessLevel) {
    const migrated = { ...data, accessLevel: 'full', permissions: {} };
    await ref.set({ accessLevel: 'full', permissions: {}, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return migrated;
  }
  return { ...data, permissions: normalizePermissions(data.permissions) };
}

function requireAuth(context) {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
}

async function requireFullAdmin(context) {
  requireAuth(context);
  const actor = await getAdminProfile(context.auth.uid);
  if (!isFullAdmin(actor)) throw new functions.https.HttpsError('permission-denied', 'Full Admin access required.');
  return actor;
}


async function ensureAdminState() {
  const snap = await db.collection('users').where('role', '==', 'admin').get();
  const count = snap.size;
  await db.doc('adminState/metadata').set({ adminCount: count, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return count;
}

async function getAdminCount() {
  const stateSnap = await db.doc('adminState/metadata').get();
  if (stateSnap.exists && Number.isFinite(Number(stateSnap.data()?.adminCount))) return Number(stateSnap.data().adminCount);
  const snap = await db.collection('users').where('role', '==', 'admin').get();
  return snap.size;
}

function assertValidAccessPayload(data = {}) {
  const accessLevel = data.accessLevel === 'full' ? 'full' : data.accessLevel === 'custom' ? 'custom' : null;
  if (!accessLevel) throw new functions.https.HttpsError('invalid-argument', 'Access level must be Full Admin or Custom Admin.');
  const incoming = normalizePermissions(data.permissions);
  const rawKeys = data.permissions && typeof data.permissions === 'object' && !Array.isArray(data.permissions) ? Object.keys(data.permissions) : [];
  const unknown = rawKeys.filter(key => !ALL_ADMIN_PERMISSIONS.has(key));
  if (unknown.length) throw new functions.https.HttpsError('invalid-argument', `Unknown permission: ${unknown[0]}`);
  return { accessLevel, permissions: accessLevel === 'full' ? {} : incoming };
}

async function writeAdminAudit({ actor, action, target, description, metadata = {}, tx }) {
  const ref = db.collection('adminActivity').doc();
  const payload = {
    actorUid: actor.uid || actor.actorUid,
    actorEmail: actor.email || actor.actorEmail || '',
    actorName: actor.name || actor.actorName || actor.email || actor.actorEmail || 'Administrator',
    action,
    targetType: 'admin',
    targetId: String(target?.uid || target?.id || ''),
    description: String(description || ''),
    metadata,
    createdAt: FieldValue.serverTimestamp()
  };
  if (tx) tx.set(ref, payload); else await ref.set(payload);
  return ref;
}


function callableError(err, fallback) {
  if (err instanceof functions.https.HttpsError) return err;
  functions.logger.error(fallback, err);
  return new functions.https.HttpsError('internal', fallback);
}

function parseMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
}

function minutes(value) {
  const [h, m] = String(value || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
}

function addMinutes(time, amount) {
  const total = (minutes(time) + amount) % 1440;
  const safe = (total + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function getServerSlotPrice(slot, pricing = {}, settings = {}) {
  const duration = Number(slot.duration || settings.slotDuration);
  const shift = slot.shift === 'night' ? 'night' : 'day';
  const rules = pricing && pricing.rules && pricing.rules[String(duration)];
  if (rules && rules[shift] != null) {
    const direct = parseMoney(rules[shift]);
    if (direct >= 0) return direct;
  }
  const rate = shift === 'night' ? pricing.nightRate : pricing.dayRate;
  if (rate != null) {
    const n = parseMoney(rate);
    if (n >= 0) return n;
  }
  const start = minutes(slot.start);
  const ranges = Array.isArray(pricing.timeRanges) ? pricing.timeRanges : [];
  const range = ranges.find(x => x && Number(x.duration) === duration && start >= minutes(x.start) && start < minutes(x.end));
  return range ? parseMoney(range.price) : 0;
}

function validateManualSlot(slot, settings) {
  const duration = Number(slot?.duration || settings?.slotDuration);
  if (![60, 90].includes(duration)) throw new functions.https.HttpsError('invalid-argument', 'Slot duration is not configured correctly.');
  const date = String(slot?.date || slot?.sessionDate || '');
  const start = String(slot?.start || '');
  const key = String(slot?.key || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !key) {
    throw new functions.https.HttpsError('invalid-argument', 'A valid slot must be selected.');
  }
  const open = String(settings.openingTime || '06:00');
  const close = String(settings.closingTime || '04:00');
  const opening = minutes(open);
  const closingRaw = minutes(close);
  const closeElapsed = closingRaw > opening ? closingRaw : closingRaw + 1440;
  const startMinutes = minutes(start);
  const elapsed = startMinutes >= opening ? startMinutes - opening : startMinutes + 1440 - opening;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed + duration > closeElapsed - opening || ![60, 90].includes(duration)) {
    throw new functions.https.HttpsError('failed-precondition', 'This slot is outside the current operating schedule.');
  }
  const end = addMinutes(start, duration);
  const boundary = minutes(settings.dayBoundary || (duration === 60 ? '18:00' : '16:30'));
  const boundaryAdjusted = boundary <= opening ? boundary + 1440 : boundary;
  const startAdjusted = startMinutes < opening ? startMinutes + 1440 : startMinutes;
  const shift = startAdjusted < boundaryAdjusted ? 'day' : 'night';
  const expectedKey = `${date}_${start.replace(':', '')}_${duration}`;
  if (key !== expectedKey) throw new functions.https.HttpsError('failed-precondition', 'This slot is no longer valid. Please select it again.');
  return { date, start, end, duration, shift, key };
}


exports.createPublicBooking = functions.region('us-central1').https.onCall(async (data, context) => {
  // Public booking intentionally does not require Firebase Authentication.
  // All pricing, payment receiver, slot and lock validation is authoritative here.
  const customerName = String(data?.customerName || '').trim();
  const phone = String(data?.phone || '').trim();
  const paymentMethod = String(data?.paymentMethod || '').trim();
  const sendMoneyNumber = String(data?.sendMoneyNumber || '').trim();
  const transactionId = String(data?.transactionId || '').trim();
  if (customerName.length < 2) throw new functions.https.HttpsError('invalid-argument', 'Please enter your name.');
  if (phone.length < 5) throw new functions.https.HttpsError('invalid-argument', 'Please enter a valid phone number.');
  if (!['bKash', 'Nagad', 'Rocket'].includes(paymentMethod)) throw new functions.https.HttpsError('invalid-argument', 'Please select a payment method.');
  if (sendMoneyNumber.length < 5) throw new functions.https.HttpsError('invalid-argument', 'Please enter your send money number.');
  if (transactionId.length < 5) throw new functions.https.HttpsError('invalid-argument', 'Please enter your transaction ID.');
  try {
    const [settingsSnap, pricingSnap, turfSnap] = await Promise.all([
      db.doc('settings/config').get(), db.doc('pricing/current').get(), db.doc('turf/main').get()
    ]);
    const settings = settingsSnap.data() || {};
    const pricing = pricingSnap.data() || {};
    const turf = turfSnap.data() || {};
    const slot = validateManualSlot(data?.slot, settings);
    const price = getServerSlotPrice(slot, pricing, settings);
    if (price <= 0) throw new functions.https.HttpsError('failed-precondition', 'This slot does not have a configured price.');
    const advanceType = settings.advanceType === 'fixed' ? 'fixed' : 'percentage';
    const advanceValue = Number(settings.advanceValue != null ? settings.advanceValue : advanceType === 'fixed' ? 0 : 30);
    const requiredAdvance = advanceType === 'fixed'
      ? Math.min(price, Math.max(0, parseMoney(advanceValue)))
      : Math.min(price, Math.max(0, Math.round((price * advanceValue / 100) * 1000) / 1000));
    if (!Number.isFinite(requiredAdvance) || requiredAdvance <= 0) throw new functions.https.HttpsError('failed-precondition', 'The required booking advance is not configured.');
    const receiverMap = { bKash: turf.bkashNumber, Nagad: turf.nagadNumber, Rocket: turf.rocketNumber };
    const receiverNumber = String(receiverMap[paymentMethod] || '').trim();
    if (!receiverNumber) throw new functions.https.HttpsError('failed-precondition', `${paymentMethod} payment number is not configured.`);
    const slotKey = slot.key;
    const remainingAmount = price - requiredAdvance;
    const lockRef = db.doc(`slotLocks/${slotKey}`);
    const bookingRef = db.collection('bookings').doc();
    await db.runTransaction(async tx => {
      const lockSnap = await tx.get(lockRef);
      if (lockSnap.exists) {
        const status = lockSnap.data()?.status;
        if (status === 'booked' || status === 'pending_payment_verification') throw new functions.https.HttpsError('already-exists', 'That slot is no longer available. Please choose another slot.');
      }
      const now = FieldValue.serverTimestamp();
      tx.set(lockRef, {
        status: 'pending_payment_verification', slotKey, sessionDate: slot.date, slotStart: slot.start, slotEnd: slot.end,
        slotStartDate: slot.date, slotEndDate: minutes(slot.start) + slot.duration >= 1440 ? new Date(Date.parse(`${slot.date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10) : slot.date,
        slotStartDateTime: `${slot.date}T${slot.start}:00`,
        slotEndDateTime: `${minutes(slot.start) + slot.duration >= 1440 ? new Date(Date.parse(`${slot.date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10) : slot.date}T${slot.end}:00`,
        duration: slot.duration, shift: slot.shift, expiresAt: null
      });
      tx.set(bookingRef, {
        customerName, phone, date: slot.date, sessionDate: slot.date, slotStart: slot.start, slotEnd: slot.end,
        slotStartDate: slot.date, slotEndDate: minutes(slot.start) + slot.duration >= 1440 ? new Date(Date.parse(`${slot.date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10) : slot.date,
        slotStartDateTime: `${slot.date}T${slot.start}:00`,
        slotEndDateTime: `${minutes(slot.start) + slot.duration >= 1440 ? new Date(Date.parse(`${slot.date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10) : slot.date}T${slot.end}:00`,
        duration: slot.duration, shift: slot.shift, slotPrice: price, totalAmount: price, paidAmount: 0,
        advanceAmount: requiredAdvance, remainingAmount, dueAmount: remainingAmount, paymentMethod,
        receiverNumberSnapshot: receiverNumber, sendMoneyNumber, transactionId, paymentAmount: requiredAdvance,
        status: 'pending_payment_verification', slotKey, createdBy: 'public', bookingType: 'public_payment_request',
        createdAt: now, updatedAt: now, expiresAt: null, verificationStatus: 'pending'
      });
    });
    return { bookingId: bookingRef.id, slotEnd: slot.end, slotPrice: price, advanceAmount: requiredAdvance, remainingAmount, transactionId, status: 'pending_payment_verification', paymentMethod, paymentAmount: requiredAdvance };
  } catch (err) { throw callableError(err, 'Booking request failed. Please try again.'); }
});

exports.acceptBooking = functions.region('us-central1').https.onCall(async (data, context) => {
  const actor = await requireAuth(context);
  const profile = await getAdminProfile(context.auth.uid);
  if (!hasPermission(profile, 'acceptBooking')) throw new functions.https.HttpsError('permission-denied', 'You do not have permission to accept booking requests.');
  const bookingId = String(data?.bookingId || '').trim();
  if (!bookingId) throw new functions.https.HttpsError('invalid-argument', 'Booking request is required.');
  try {
    const bookingRef = db.doc(`bookings/${bookingId}`);
    let result = null;
    await db.runTransaction(async tx => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Booking request no longer exists.');
      const b = snap.data() || {};
      if (b.status !== 'pending_payment_verification') throw new functions.https.HttpsError('failed-precondition', `This request is already ${b.status || 'handled'}.`);
      const slotKey = String(b.slotKey || '').trim();
      const txnId = String(b.transactionId || '').trim();
      if (!slotKey || !txnId) throw new functions.https.HttpsError('failed-precondition', 'The booking request is missing slot or transaction information.');
      const lockRef = db.doc(`slotLocks/${slotKey}`);
      const paymentRef = db.doc(`payments/txn_${encodeURIComponent(txnId).slice(0, 300)}`);
      const transactionRef = db.doc(`transactions/txn_${encodeURIComponent(txnId).slice(0, 300)}`);
      const lockSnap = await tx.get(lockRef);
      if (!lockSnap.exists || lockSnap.data()?.status !== 'pending_payment_verification') throw new functions.https.HttpsError('failed-precondition', 'The slot lock is no longer active.');
      const paymentSnap = await tx.get(paymentRef);
      if (paymentSnap.exists) {
        const existingBookingId = String(paymentSnap.data()?.bookingId || '');
        if (existingBookingId !== bookingId) throw new functions.https.HttpsError('already-exists', 'Transaction ID already used by another confirmed payment.');
        throw new functions.https.HttpsError('failed-precondition', 'This payment has already been recorded.');
      }
      const amount = parseMoney(b.paymentAmount || b.advanceAmount);
      const total = parseMoney(b.totalAmount || b.slotPrice);
      const required = parseMoney(b.advanceAmount);
      if (amount <= 0 || amount < required || amount > total) throw new functions.https.HttpsError('failed-precondition', 'The submitted payment amount is not valid for this booking.');
      const now = FieldValue.serverTimestamp();
      tx.update(bookingRef, {
        status: 'confirmed', paidAmount: amount, remainingAmount: total - amount, dueAmount: total - amount,
        updatedAt: now, reviewedAt: now, verificationStatus: 'accepted', confirmedAt: now, expiresAt: null,
        confirmedBy: context.auth.uid, confirmedByEmail: context.auth.token.email || '', confirmedByName: profile.name || profile.email || 'Administrator'
      });
      tx.set(lockRef, { ...lockSnap.data(), status: 'booked', expiresAt: null, updatedAt: now });
      tx.set(paymentRef, { bookingId, amount, paymentMethod: String(b.paymentMethod || 'Other'), note: 'Public booking payment', transactionId: txnId, createdAt: now, createdBy: context.auth.uid, actor: { uid: context.auth.uid, email: context.auth.token.email || '', name: profile.name || profile.email || 'Administrator' } });
      tx.set(transactionRef, { type: 'income', amount, category: 'Booking payment', referenceId: bookingId, description: `Payment for booking ${bookingId}`, transactionId: txnId, createdAt: now, createdBy: context.auth.uid, actorUid: context.auth.uid, actorEmail: context.auth.token.email || '', actorName: profile.name || profile.email || 'Administrator', paymentMethod: String(b.paymentMethod || 'Other') });
      writeAdminAudit({ actor: { ...profile, uid: context.auth.uid }, target: { uid: bookingId }, action: 'booking_confirmed', description: `${profile.name || profile.email || 'Administrator'} accepted the booking request for ${b.customerName || 'Customer'}`, metadata: { customerName: b.customerName || '', sessionDate: b.sessionDate || b.date || '', slotStart: b.slotStart || '', slotEnd: b.slotEnd || '' }, tx });
      result = { bookingId, amount };
    });
    return result;
  } catch (err) { throw callableError(err, 'Could not confirm this booking request.'); }
});

exports.rejectBooking = functions.region('us-central1').https.onCall(async (data, context) => {
  requireAuth(context);
  const profile = await getAdminProfile(context.auth.uid);
  if (!hasPermission(profile, 'rejectBooking')) throw new functions.https.HttpsError('permission-denied', 'You do not have permission to reject booking requests.');
  const bookingId = String(data?.bookingId || '').trim();
  const reason = String(data?.reason || '').trim();
  if (!bookingId || !reason) throw new functions.https.HttpsError('invalid-argument', 'A rejection reason is required.');
  try {
    await db.runTransaction(async tx => {
      const bookingRef = db.doc(`bookings/${bookingId}`);
      const snap = await tx.get(bookingRef);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Booking request no longer exists.');
      const b = snap.data() || {};
      if (b.status !== 'pending_payment_verification') throw new functions.https.HttpsError('failed-precondition', `This request is already ${b.status || 'handled'}.`);
      const now = FieldValue.serverTimestamp();
      tx.update(bookingRef, { status: 'rejected', verificationStatus: 'rejected', rejectionReason: reason, reviewedAt: now, updatedAt: now, rejectedBy: context.auth.uid, rejectedByEmail: context.auth.token.email || '', rejectedByName: profile.name || profile.email || 'Administrator' });
      if (b.slotKey) tx.delete(db.doc(`slotLocks/${b.slotKey}`));
      writeAdminAudit({ actor: { ...profile, uid: context.auth.uid }, target: { uid: bookingId }, action: 'booking_rejected', description: `${profile.name || profile.email || 'Administrator'} rejected the booking request for ${b.customerName || 'Customer'}`, metadata: { customerName: b.customerName || '', sessionDate: b.sessionDate || b.date || '', slotStart: b.slotStart || '', slotEnd: b.slotEnd || '', reason }, tx });
    });
    return { ok: true };
  } catch (err) { throw callableError(err, 'Could not reject this booking request.'); }
});

exports.createManualBooking = functions.region('us-central1').https.onCall(async (data, context) => {
  requireAuth(context);
  const profile = await getAdminProfile(context.auth.uid);
  if (!hasPermission(profile, 'manualBooking')) throw new functions.https.HttpsError('permission-denied', 'You do not have permission to create manual bookings.');
  const customerName = String(data?.customerName || '').trim();
  const phone = String(data?.phone || '').trim();
  const adminNote = String(data?.adminNote || '').trim();
  const advance = parseMoney(data?.advanceAmount);
  if (customerName.length < 2) throw new functions.https.HttpsError('invalid-argument', 'Customer or booking name is required.');
  if (adminNote.length < 2) throw new functions.https.HttpsError('invalid-argument', 'Admin note is required.');
  if (advance < 0) throw new functions.https.HttpsError('invalid-argument', 'Advance payment must be a valid non-negative amount.');
  try {
    const [settingsSnap, pricingSnap] = await Promise.all([db.doc('settings/config').get(), db.doc('pricing/current').get()]);
    const settings = settingsSnap.data() || {};
    const pricing = pricingSnap.data() || {};
    const slot = validateManualSlot(data?.slot, settings);
    const price = getServerSlotPrice(slot, pricing, settings);
    if (price <= 0) throw new functions.https.HttpsError('failed-precondition', 'Pricing is not configured for this slot.');
    if (advance > price) throw new functions.https.HttpsError('invalid-argument', 'Advance cannot be greater than the total amount.');
    const lockRef = db.doc(`slotLocks/${slot.key}`);
    const bookingRef = db.collection('bookings').doc();
    await db.runTransaction(async tx => {
      const lockSnap = await tx.get(lockRef);
      if (lockSnap.exists) {
        const status = lockSnap.data()?.status;
        if (status === 'booked') throw new functions.https.HttpsError('already-exists', 'That slot is already booked.');
        if (status === 'pending_payment_verification') throw new functions.https.HttpsError('already-exists', 'That slot is currently reserved by a payment request.');
      }
      const now = FieldValue.serverTimestamp();
      const fullNote = `${slot.date} · ${slot.start}–${slot.end} · ${adminNote}`;
      const startDate = slot.date;
      const endDate = minutes(slot.start) + slot.duration >= 1440
        ? new Date(`${slot.date}T12:00:00Z`).toISOString().slice(0, 10) === slot.date
          ? new Date(Date.parse(`${slot.date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)
          : slot.date
        : slot.date;
      tx.set(lockRef, { status: 'booked', slotKey: slot.key, sessionDate: slot.date, slotStart: slot.start, slotEnd: slot.end, slotStartDate: startDate, slotEndDate: endDate, slotStartDateTime: `${startDate}T${slot.start}:00`, slotEndDateTime: `${endDate}T${slot.end}:00`, duration: slot.duration, shift: slot.shift, expiresAt: null, updatedAt: now });
      tx.set(bookingRef, {
        customerName, phone, date: slot.date, sessionDate: slot.date, slotStart: slot.start, slotEnd: slot.end,
        duration: slot.duration, shift: slot.shift, slotPrice: price, totalAmount: price, paidAmount: advance,
        advanceAmount: advance, remainingAmount: price - advance, dueAmount: price - advance, paymentMethod: 'Manual',
        receiverNumberSnapshot: '', sendMoneyNumber: '', transactionId: '', paymentAmount: advance, status: 'confirmed',
        slotKey: slot.key, createdBy: context.auth.uid, bookingType: 'manual_admin', bookingSource: 'admin', adminNote: fullNote,
        createdAt: now, updatedAt: now, confirmedAt: now, createdByEmail: context.auth.token.email || '', createdByName: profile.name || profile.email || 'Administrator',
        confirmedBy: context.auth.uid, confirmedByEmail: context.auth.token.email || '', confirmedByName: profile.name || profile.email || 'Administrator', expiresAt: null
      });
      if (advance > 0) {
        const paymentRef = db.collection('payments').doc();
        const transactionRef = db.collection('transactions').doc();
        tx.set(paymentRef, { bookingId: bookingRef.id, amount: advance, paymentMethod: 'Manual', note: 'Manual booking advance payment', transactionId: '', createdAt: now, createdBy: context.auth.uid, recordedByUid: context.auth.uid, recordedByName: profile.name || profile.email || 'Administrator', recordedByEmail: context.auth.token.email || '' });
        tx.set(transactionRef, { type: 'income', amount: advance, category: 'Booking payment', referenceId: bookingRef.id, description: `Advance payment for manual booking ${bookingRef.id}`, transactionId: '', createdAt: now, createdBy: context.auth.uid, recordedByUid: context.auth.uid, recordedByName: profile.name || profile.email || 'Administrator', recordedByEmail: context.auth.token.email || '', paymentMethod: 'Manual' });
      }
      writeAdminAudit({ actor: { ...profile, uid: context.auth.uid }, target: { uid: bookingRef.id }, action: 'manual_booking_created', description: `${profile.name || profile.email || 'Administrator'} created manual booking for ${customerName}`, metadata: { customerName, sessionDate: slot.date, slotStart: slot.start, slotEnd: slot.end, advance }, tx });
    });
    return { bookingId: bookingRef.id, slotKey: slot.key, totalAmount: price, paidAmount: advance, dueAmount: price - advance };
  } catch (err) { throw callableError(err, 'Could not create the manual booking.'); }
});

exports.migrateLegacyAdminAccounts = functions.region('us-central1').https.onCall(async (data, context) => {
  await requireFullAdmin(context);
  const count = await migrateLegacyAdminAccounts();
  return { count };
});

exports.createAdminAccount = functions.region('us-central1').https.onCall(async (data, context) => {
  const actor = await requireFullAdmin(context);
  const { accessLevel, permissions } = assertValidAccessPayload(data);
  const name = String(data?.name || '').trim();
  const email = String(data?.email || '').trim().toLowerCase();
  const password = String(data?.password || '');
  if (name.length < 1 || !email || password.length < 6) {
    throw new functions.https.HttpsError('invalid-argument', 'Please provide a valid name, email and password.');
  }

  let newUser = null;
  let auditRef = null;
  let profileCreated = false;
  try {
    // Auth creation is necessarily outside Firestore transactions. If any later
    // step fails, every created resource is rolled back before returning.
    try {
      newUser = await auth.createUser({ email, password, displayName: name });
    } catch (err) {
      if (err?.code === 'auth/email-already-exists') {
        throw new functions.https.HttpsError('already-exists', 'An account with this email already exists.');
      }
      if (err?.code === 'auth/invalid-email') {
        throw new functions.https.HttpsError('invalid-argument', 'Please enter a valid email address.');
      }
      if (err?.code === 'auth/password-does-not-meet-requirements') {
        throw new functions.https.HttpsError('invalid-argument', 'The password does not meet Firebase password requirements.');
      }
      if (err?.code === 'auth/operation-not-allowed') {
        throw new functions.https.HttpsError('failed-precondition', 'Email/password authentication is not enabled for this Firebase project.');
      }
      functions.logger.error('createAdminAccount auth.createUser failed', { code: err?.code, message: err?.message });
      throw new functions.https.HttpsError('internal', 'Firebase could not create the Admin authentication account.');
    }

    const userRef = db.doc(`users/${newUser.uid}`);
    auditRef = db.collection('adminActivity').doc();
    const batch = db.batch();
    const now = FieldValue.serverTimestamp();
    batch.set(userRef, {
      uid: newUser.uid, name, email, role: 'admin', accessLevel, permissions,
      createdAt: now, createdBy: context.auth.uid, createdByEmail: context.auth.token.email || '', updatedAt: now
    });
    batch.set(auditRef, {
      actorUid: context.auth.uid,
      actorEmail: context.auth.token.email || '',
      actorName: actor.name || context.auth.token.email || 'Administrator',
      action: 'admin_created',
      targetType: 'admin',
      targetId: newUser.uid,
      description: `${actor.name || context.auth.token.email || 'Administrator'} created ${accessLevel === 'full' ? 'Full Admin' : 'Custom Admin'} ${name || email}`,
      metadata: { email, name, accessLevel, permissions },
      createdAt: now
    });
    await batch.commit();
    profileCreated = true;

    // Reconcile from the source of truth instead of incrementing a possibly
    // stale counter. This also makes concurrent creates converge correctly.
    await ensureAdminState();
    return { uid: newUser.uid };
  } catch (err) {
    functions.logger.error('createAdminAccount failed', { code: err?.code, message: err?.message });
    if (profileCreated && newUser) {
      try { await db.doc(`users/${newUser.uid}`).delete(); } catch (cleanupErr) { functions.logger.error('createAdminAccount profile cleanup failed', cleanupErr); }
      if (auditRef) {
        try { await auditRef.delete(); } catch (cleanupErr) { functions.logger.error('createAdminAccount audit cleanup failed', cleanupErr); }
      }
      try { await ensureAdminState(); } catch (stateErr) { functions.logger.error('createAdminAccount state reconcile failed', stateErr); }
    }
    if (newUser) {
      try { await auth.deleteUser(newUser.uid); } catch (cleanupErr) { functions.logger.error('createAdminAccount auth cleanup failed', cleanupErr); }
    }
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', 'Could not create the Admin account. Please try again.');
  }
});

exports.listAdminAccounts = functions.region('us-central1').https.onCall(async (data, context) => {
  await requireFullAdmin(context);
  try {
    await migrateLegacyAdminAccounts();
    const snap = await db.collection('users').where('role', '==', 'admin').get();
    return { admins: snap.docs.map(doc => ({ ...doc.data(), uid: doc.id, permissions: normalizePermissions(doc.data()?.permissions), createdAt: doc.data()?.createdAt?.toMillis?.() ?? null })) };
  } catch (err) {
    functions.logger.error('listAdminAccounts error', err);
    throw new functions.https.HttpsError('internal', 'Could not load Admin accounts.');
  }
});

exports.updateAdminAccess = functions.region('us-central1').https.onCall(async (data, context) => {
  const actor = await requireFullAdmin(context);
  const targetUid = String(data?.targetUid || '').trim();
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'Target Admin is required.');
  const targetRef = db.doc(`users/${targetUid}`);
  const access = assertValidAccessPayload(data);
  try {
    await db.runTransaction(async tx => {
      const targetSnap = await tx.get(targetRef);
      if (!targetSnap.exists || targetSnap.data()?.role !== 'admin') throw new functions.https.HttpsError('not-found', 'Admin account not found.');
      const target = targetSnap.data();
      const beforeLevel = target.accessLevel || 'full';
      const beforePermissions = normalizePermissions(target.permissions);
      const now = FieldValue.serverTimestamp();
      tx.update(targetRef, { accessLevel: access.accessLevel, permissions: access.permissions, updatedAt: now, updatedBy: context.auth.uid, updatedByEmail: context.auth.token.email || '' });
      writeAdminAudit({
        actor: { ...actor, uid: context.auth.uid }, target: { uid: targetUid }, action: 'admin_access_changed',
        description: `${actor.name || context.auth.token.email || 'Administrator'} changed Admin access for ${target.name || target.email || targetUid}`,
        metadata: { previousAccessLevel: beforeLevel, newAccessLevel: access.accessLevel, previousPermissions: beforePermissions, newPermissions: access.permissions }, tx
      });
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    functions.logger.error('updateAdminAccess error', err);
    throw new functions.https.HttpsError('internal', 'Could not update Admin access.');
  }
});

exports.deleteAdminAccount = functions.region('us-central1').https.onCall(async (data, context) => {
  const actor = await requireFullAdmin(context);
  const targetUid = String(data?.targetUid || '').trim();
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'Target Admin is required.');

  const targetRef = db.doc(`users/${targetUid}`);
  let targetData = null;
  let auditRef = null;
  try {
    await db.runTransaction(async tx => {
      const targetSnap = await tx.get(targetRef);
      if (!targetSnap.exists || targetSnap.data()?.role !== 'admin') throw new functions.https.HttpsError('not-found', 'Admin account not found.');
      targetData = { ...targetSnap.data(), uid: targetUid };
      const stateRef = db.doc('adminState/metadata');
      const adminsSnap = await tx.get(db.collection('users').where('role', '==', 'admin'));
      const count = adminsSnap.size;
      if (count <= 1) throw new functions.https.HttpsError('failed-precondition', 'You cannot delete the last remaining Admin account.');
      const now = FieldValue.serverTimestamp();
      tx.set(stateRef, { adminCount: count - 1, updatedAt: now });
      auditRef = await writeAdminAudit({
        actor: { ...actor, uid: context.auth.uid }, target: targetData, action: 'admin_deleted',
        description: `${actor.name || context.auth.token.email || 'Administrator'} deleted Admin ${targetData.name || targetData.email || targetUid}`,
        metadata: { targetEmail: targetData.email || '', targetAccessLevel: targetData.accessLevel || 'full', selfDelete: targetUid === context.auth.uid }, tx
      });
      tx.delete(targetRef);
    });
    if (targetUid === context.auth.uid) {
      await auth.deleteUser(targetUid);
    } else {
      await auth.deleteUser(targetUid);
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    // Restore the profile/count if Auth deletion failed after the Firestore transaction.
    if (targetData) {
      try {
        await db.runTransaction(async tx => {
          const stateRef = db.doc('adminState/metadata');
          const stateSnap = await tx.get(stateRef);
          const current = Number(stateSnap.data()?.adminCount || 0);
          tx.set(stateRef, { adminCount: current + 1, updatedAt: FieldValue.serverTimestamp() });
          const { uid, ...profile } = targetData;
          tx.set(targetRef, profile);
          if (auditRef) tx.delete(auditRef);
        });
      } catch (rollbackErr) { functions.logger.error('deleteAdminAccount rollback error', rollbackErr); }
    }
    functions.logger.error('deleteAdminAccount error', err);
    throw new functions.https.HttpsError('internal', 'Could not delete the Admin account.');
  }
});

exports.deleteOwnAdminAccount = functions.region('us-central1').https.onCall(async (data, context) => {
  requireAuth(context);
  const uid = context.auth.uid;
  const actor = await getAdminProfile(uid);
  if (!actor) throw new functions.https.HttpsError('permission-denied', 'Admin access required.');

  let reserved = false;
  let stateBefore = null;
  let auditRef = null;
  let actorProfile = { ...actor, uid };
  try {
    await db.runTransaction(async tx => {
      const stateRef = db.doc('adminState/metadata');
      const stateSnap = await tx.get(stateRef);
      let count = stateSnap.exists ? Number(stateSnap.data().adminCount || 0) : await getAdminCount();
      if (count <= 1) throw new functions.https.HttpsError('failed-precondition', 'You cannot delete the last remaining Admin account.');
      const now = FieldValue.serverTimestamp();
      stateBefore = count;
      tx.set(stateRef, { adminCount: count - 1, updatedAt: now });
      auditRef = await writeAdminAudit({ actor: actorProfile, target: actorProfile, action: 'admin_self_deleted', description: `${actor.name || context.auth.token.email || 'Administrator'} deleted their own Admin account`, metadata: { email: actor.email || '', name: actor.name || '' }, tx });
      tx.delete(db.doc(`users/${uid}`));
      reserved = true;
    });
    await auth.deleteUser(uid);
    return { ok: true };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    if (reserved) {
      try {
        await db.runTransaction(async tx => {
          const stateRef = db.doc('adminState/metadata');
          const snap = await tx.get(stateRef);
          const current = Number(snap.data()?.adminCount || 0);
          tx.set(stateRef, { adminCount: current + 1, updatedAt: FieldValue.serverTimestamp() });
          const { uid: ignoredUid, ...profile } = actorProfile;
          tx.set(db.doc(`users/${uid}`), profile, { merge: true });
          if (auditRef) tx.delete(auditRef);
        });
      } catch (rollbackErr) { functions.logger.error('deleteOwnAdminAccount rollback error', rollbackErr); }
    }
    functions.logger.error('deleteOwnAdminAccount error', err);
    throw new functions.https.HttpsError('internal', 'Could not delete your Admin account.');
  }
});
