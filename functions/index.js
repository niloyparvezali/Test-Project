const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const auth = getAuth();

async function getAdminProfile(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists || snap.data().role !== 'admin') return null;
  return snap.data();
}



exports.createAdminAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  const actor = await getAdminProfile(context.auth.uid);
  if (!actor) throw new functions.https.HttpsError('permission-denied', 'Admin access required.');

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
    if (err?.code === 'auth/email-already-exists') {
      throw new functions.https.HttpsError('already-exists', 'An account with this email already exists.');
    }
    functions.logger.error('createAdminAccount auth error', err);
    throw new functions.https.HttpsError('internal', 'Could not create the Admin account.');
  }

  try {
    await db.runTransaction(async tx => {
      const stateRef = db.doc('adminState/metadata');
      const stateSnap = await tx.get(stateRef);
      let count = stateSnap.exists ? Number(stateSnap.data().adminCount || 0) : 0;
      if (!stateSnap.exists) {
        const adminSnap = await tx.get(db.collection('users').where('role', '==', 'admin'));
        count = adminSnap.size;
      }
      const now = FieldValue.serverTimestamp();
      tx.set(stateRef, { adminCount: count + 1, updatedAt: now });
      tx.set(db.doc(`users/${newUser.uid}`), {
        uid: newUser.uid,
        name,
        email,
        role: 'admin',
        createdAt: now,
        createdBy: context.auth.uid,
        createdByEmail: context.auth.token.email || '',
        updatedAt: now
      });
      const activityRef = db.collection('adminActivity').doc();
      tx.set(activityRef, {
        actorUid: context.auth.uid,
        actorEmail: context.auth.token.email || '',
        actorName: String(actor.name || context.auth.token.email || 'Administrator'),
        action: 'admin_created',
        targetType: 'admin',
        targetId: newUser.uid,
        description: `${String(actor.name || context.auth.token.email || 'Administrator')} created Admin ${name || email}`,
        metadata: { email, name },
        createdAt: now
      });
    });
    return { uid: newUser.uid };
  } catch (err) {
    try { await auth.deleteUser(newUser.uid); } catch (cleanupErr) { functions.logger.error('createAdminAccount cleanup error', cleanupErr); }
    functions.logger.error('createAdminAccount Firestore error', err);
    throw new functions.https.HttpsError('internal', 'Could not create the Admin account.');
  }
});


exports.listAdminAccounts = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  const actor = await getAdminProfile(context.auth.uid);
  if (!actor) throw new functions.https.HttpsError('permission-denied', 'Admin access required.');

  try {
    const snap = await db.collection('users').where('role', '==', 'admin').get();
    return {
      admins: snap.docs.map(doc => {
        const value = doc.data() || {};
        return {
          ...value,
          uid: doc.id,
          createdAt: value.createdAt && typeof value.createdAt.toMillis === 'function'
            ? value.createdAt.toMillis()
            : null
        };
      })
    };
  } catch (err) {
    functions.logger.error('listAdminAccounts error', err);
    throw new functions.https.HttpsError('internal', 'Could not load Admin accounts.');
  }
});

exports.deleteOwnAdminAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  const uid = context.auth.uid;
  const actor = await getAdminProfile(uid);
  if (!actor) throw new functions.https.HttpsError('permission-denied', 'Admin access required.');

  let reserved = false;
  let stateBefore = null;
  try {
    await db.runTransaction(async tx => {
      const stateRef = db.doc('adminState/metadata');
      const stateSnap = await tx.get(stateRef);
      let count = stateSnap.exists ? Number(stateSnap.data().adminCount || 0) : 0;
      if (!stateSnap.exists) {
        const adminSnap = await tx.get(db.collection('users').where('role', '==', 'admin'));
        count = adminSnap.size;
      }
      if (count <= 1) throw new functions.https.HttpsError('failed-precondition', 'You cannot delete the last administrator account.');
      const now = FieldValue.serverTimestamp();
      stateBefore = count;
      tx.set(stateRef, { adminCount: count - 1, updatedAt: now });
      tx.set(db.collection('adminActivity').doc(), {
        actorUid: uid,
        actorEmail: actor.email || context.auth.token.email || '',
        actorName: String(actor.name || context.auth.token.email || 'Administrator'),
        action: 'admin_self_deleted',
        targetType: 'admin',
        targetId: uid,
        description: `${String(actor.name || context.auth.token.email || 'Administrator')} deleted their own Admin account`,
        metadata: { email: actor.email || context.auth.token.email || '', name: actor.name || '' },
        createdAt: now
      });
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
          tx.set(db.doc(`users/${uid}`), {
            uid,
            name: actor.name || 'Administrator',
            email: actor.email || context.auth.token.email || '',
            role: 'admin',
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        });
      } catch (rollbackErr) {
        functions.logger.error('deleteOwnAdminAccount rollback error', rollbackErr);
      }
    }
    functions.logger.error('deleteOwnAdminAccount auth error', err);
    throw new functions.https.HttpsError('internal', 'Could not delete your Admin account.');
  }
});
