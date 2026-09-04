import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { hasPermission } from '../config/adminPermissions';

export function useAdminRole() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setProfile(null);
      setLoading(false);
      return undefined;
    }

    const ref = doc(db, 'users', user.uid);
    return onSnapshot(ref, snap => {
      setProfile(snap.exists() ? (snap.data() || null) : null);
      setLoading(false);
    }, () => {
      setProfile(null);
      setLoading(false);
    });
  }, []);

  const isAdmin = profile?.role === 'admin';
  const isFullAdmin = isAdmin && (!profile?.accessLevel || profile.accessLevel === 'full');
  const isCustomAdmin = isAdmin && profile?.accessLevel === 'custom';
  const permissions = profile?.permissions && typeof profile.permissions === 'object' ? profile.permissions : {};

  return {
    role: profile?.role || null,
    accessLevel: isAdmin ? (profile?.accessLevel || 'full') : null,
    permissions,
    profile,
    isAdmin,
    isFullAdmin,
    isCustomAdmin,
    can: (permission) => hasPermission(profile, permission),
    loading,
    uid: auth.currentUser?.uid || null,
    email: auth.currentUser?.email || null,
  };
}
