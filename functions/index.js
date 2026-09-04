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

  let newUser;
  try {
    newUser = await auth.createUser({ email, password, displayName: name });
  } catch (err) {
    if (err?.code === 'auth/email-already-exists') throw new functions.https.HttpsError('already-exists', 'An account with this email already exists.');
    functions.logger.error('createAdminAccount auth error', err);
    throw new functions.https.HttpsError('internal', 'Could not create the Admin account.');
  }

  try {
    await db.runTransaction(async tx => {
      const stateRef = db.doc('adminState/metadata');
      const stateSnap = await tx.get(stateRef);
      const adminsSnap = await tx.get(db.collection('users').where('role', '==', 'admin'));
      const count = adminsSnap.size;
      const now = FieldValue.serverTimestamp();
      tx.set(stateRef, { adminCount: count + 1, updatedAt: now });
      tx.set(db.doc(`users/${newUser.uid}`), {
        uid: newUser.uid, name, email, role: 'admin', accessLevel, permissions,
        createdAt: now, createdBy: context.auth.uid, createdByEmail: context.auth.token.email || '', updatedAt: now
      });
      writeAdminAudit({
        actor: { ...actor, uid: context.auth.uid }, target: { uid: newUser.uid }, action: 'admin_created',
        description: `${actor.name || context.auth.token.email || 'Administrator'} created ${accessLevel === 'full' ? 'Full Admin' : 'Custom Admin'} ${name || email}`,
        metadata: { email, name, accessLevel, permissions }, tx
      });
    });
    return { uid: newUser.uid };
  } catch (err) {
    try { await auth.deleteUser(newUser.uid); } catch (cleanupErr) { functions.logger.error('createAdminAccount cleanup error', cleanupErr); }
    if (err instanceof functions.https.HttpsError) throw err;
    functions.logger.error('createAdminAccount Firestore error', err);
    throw new functions.https.HttpsError('internal', 'Could not create the Admin account.');
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
