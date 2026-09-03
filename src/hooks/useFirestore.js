import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

function useDoc(path, initial = {}) {
  const [data,setData] = useState(initial);
  const [loading,setLoading] = useState(true);
  useEffect(() => {
    const ref = doc(db, ...path.split('/'));
    return onSnapshot(ref, snap => {
      setData(snap.exists() ? snap.data() : initial);
      setLoading(false);
    }, () => setLoading(false));
  }, [path]); // initial objects in this app are stable defaults.
  return [data,loading];
}

function useCollection(name, enabled = true) {
  const [data,setData] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    return onSnapshot(
      query(collection(db,name),orderBy('createdAt','desc')),
      snap => setData(snap.docs.map(d => ({id:d.id,...d.data()}))),
      () => setData([])
    );
  }, [name,enabled]);
  return data;
}

export { useDoc, useCollection };
