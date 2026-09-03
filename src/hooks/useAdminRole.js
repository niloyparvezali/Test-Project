import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

export function useAdminRole() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setRole(null);
      setLoading(false);
      return undefined;
    }

    const ref = doc(db, 'users', user.uid);
    return onSnapshot(ref, snap => {
      setRole(snap.exists() ? (snap.data()?.role || null) : null);
      setLoading(false);
    }, () => {
      setRole(null);
      setLoading(false);
    });
  }, []);

  return {
    role,
    isAdmin: role === 'admin',
    loading,
    uid: auth.currentUser?.uid || null,
    email: auth.currentUser?.email || null
  };
}
