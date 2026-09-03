import React,{useEffect,useState} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseMissingConfig } from './firebase';
import { Loading } from './components/ui';
import AdminLogin from './pages/admin/AdminLogin';
import AdminShell from './pages/admin/AdminShell';
import PublicSite from './pages/public/PublicSite';
import { pageTitle, BRAND_NAME } from './config/brand';

const ADMIN_TITLES = {
  bookings: 'Bookings',
  finance: 'Finance',
  expenses: 'Expenses',
  turf: 'Turf Settings',
  pricing: 'Pricing',
};

export default function App(){
  const [route,setRoute]=useState(window.location.pathname);
  const [admin,setAdmin]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);

  useEffect(()=>onAuthStateChanged(auth,user=>{setAdmin(user);setAuthLoading(false)}),[]);
  useEffect(()=>{
    const onPop=()=>setRoute(window.location.pathname);
    window.addEventListener('popstate',onPop);
    return ()=>window.removeEventListener('popstate',onPop);
  },[]);
  useEffect(()=>{
    const path=window.location.pathname;
    const key=path.split('/')[2]||'';
    document.title=path.startsWith('/admin')
      ? pageTitle(ADMIN_TITLES[key] || 'Admin')
      : path === '/book' || path === '/book/' ? pageTitle('Book a Slot') : BRAND_NAME;
  },[route]);

  const go=path=>{
    window.history.pushState({},'',path);
    setRoute(path);
  };

  if(firebaseMissingConfig.length){
    return <div className="config-error"><h1>{BRAND_NAME}</h1><p>Firebase configuration is missing.</p><code>{firebaseMissingConfig.join('\n')}</code><p>Add the values from <b>.env.example</b> to your deployment environment.</p></div>;
  }
  if(authLoading) return <Loading/>;
  if(route.startsWith('/admin')){
    return admin ? <AdminShell user={admin} go={go}/> : <AdminLogin/>;
  }
  return <PublicSite go={go} route={route}/>;
}
