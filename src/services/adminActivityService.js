import { auth, db } from '../firebase';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';

export async function getCurrentAdminActor() {
  const user = auth.currentUser;
  if (!user) throw new Error('Admin session expired. Please sign in again.');
  const profileSnap = await getDoc(doc(db, 'users', user.uid));
  const profile = profileSnap.exists() ? profileSnap.data() : {};
  return {
    actorUid: user.uid,
    actorEmail: user.email || '',
    actorName: String(profile.name || user.displayName || user.email || 'Administrator')
  };
}

export async function logAdminActivity({ action, targetType, targetId = '', description, metadata = {} }) {
  const actor = await getCurrentAdminActor();
  return addDoc(collection(db, 'adminActivity'), {
    ...actor,
    action: String(action || ''),
    targetType: String(targetType || ''),
    targetId: String(targetId || ''),
    description: String(description || ''),
    metadata,
    createdAt: serverTimestamp()
  });
}
