import React,{useEffect,useState} from 'react';
import { Check, Clock3, Sun, Moon, Info, Save } from 'lucide-react';
import { doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAdminRole } from '../../hooks/useAdminRole';
import { AdminPageHeader, SectionCard, LoadingState } from '../../components/ui';
import { getActiveDuration, getActivePricing, isValidRate } from '../../utils/pricingUtils';

function PricingAdmin(){
 const {isAdmin,loading:roleLoading}=useAdminRole();
 const [p,setP]=useState({rules:{'60':{day:'',night:''},'90':{day:'',night:''}},timeRanges:[]});
 const [settings,setSettings]=useState({});
 const [loaded,setLoaded]=useState(false);
 const [saving,setSaving]=useState(false);
 const [err,setErr]=useState('');

 useEffect(()=>{
   Promise.all([getDoc(doc(db,'pricing/current')),getDoc(doc(db,'settings/config'))]).then(([pricingSnap,settingsSnap])=>{
     if(pricingSnap.exists())setP(data=>({
       rules:{'60':{day:'',night:'',...(data.rules?.['60']||{})},'90':{day:'',night:'',...(data.rules?.['90']||{})}},
       ...data
     }));
     if(settingsSnap.exists())setSettings(settingsSnap.data());
     setLoaded(true);
   }).catch(()=>setLoaded(true));
 },[]);

 const duration=getActiveDuration(settings,p);
 const active=getActivePricing(p,{...settings,slotDuration:duration});
 const updateRate=(shift,value)=>setP(x=>({
   ...x,
   dayRate:shift==='day'?value:x.dayRate,
   nightRate:shift==='night'?value:x.nightRate,
   rules:{
     ...x.rules,
     [String(duration)]:{
       ...(x.rules?.[String(duration)]||{}),
       [shift]:value
     }
   }
 }));

 const chooseDuration=next=>{
   const nextDuration=Number(next);
   if(nextDuration===duration)return;
   const ok=window.confirm(`Change playing time from ${duration} minutes to ${nextDuration} minutes? This changes future public slots, admin slots, booking duration, and active pricing.`);
   if(!ok)return;
   setSettings(x=>({...x,slotDuration:nextDuration}));
   setErr('');
 };

 const save=async()=>{
   setErr('');
   if(!isAdmin){
     setErr('Your account is not registered as an Admin.');
     return;
   }
   const day=Number(active.dayRate),night=Number(active.nightRate);
   if(!isValidRate(day)){setErr(`${duration}-minute Day price is required.`);return;}
   if(!isValidRate(night)){setErr(`${duration}-minute Night price is required.`);return;}
   setSaving(true);
   try{
     const batch=writeBatch(db);
     const pricingRef=doc(db,'pricing/current');
     const normalizedRules=Object.fromEntries(Object.entries(p.rules||{}).map(([key,rule])=>[
       key,
       ['day','night'].reduce((next,shift)=>{
         const value=rule?.[shift];
         return {...next,[shift]:isValidRate(value)?Number(value):value};
       },{...rule})
     ]));
     const nextRules={
       ...normalizedRules,
       [String(duration)]:{
         ...(normalizedRules[String(duration)]||{}),
         day:Number(active.dayRate),
         night:Number(active.nightRate)
       }
     };
     batch.set(pricingRef,{...p,rules:nextRules,duration,dayRate:Number(active.dayRate),nightRate:Number(active.nightRate),updatedAt:serverTimestamp()},{merge:true});
     batch.set(doc(db,'settings/config'),{slotDuration:duration,updatedAt:serverTimestamp()},{merge:true});
     await batch.commit();
     setP(x=>({...x,dayRate:Number(active.dayRate),nightRate:Number(active.nightRate),rules:nextRules}));
     setSettings(x=>({...x,slotDuration:duration}));
     alert('Active playing time and pricing saved.');
   }catch(x){
     if(x?.code==='permission-denied') setErr('Your account is not authorized to update Pricing or Turf Settings. Please verify your Firebase users profile has role = admin.');
     else setErr(x?.message||'Could not save pricing.');
   }finally{setSaving(false);}
 };

 if(roleLoading||!loaded)return <LoadingState/>;
 return <>
  <AdminPageHeader eyebrow="SYSTEM" title="Slot pricing" subtitle="One active playing time controls public slots, admin slots, and booking calculations." actions={<button className="primary" onClick={save} disabled={saving}><Save/> {saving?'Saving…':'Save pricing'}</button>}/>
  <SectionCard eyebrow="ACTIVE PLAYING TIME" title={`${duration}-minute session`} subtitle="Choose exactly one duration. The same slotDuration powers the public and admin booking systems.">
   <div className="duration-choice-grid">
    {[60,90].map(d=><button type="button" key={d} className={`duration-choice ${duration===d?'active':''}`} onClick={()=>chooseDuration(d)}><span>{d} MINUTES</span><strong>{d===60?'Standard session':'Extended session'}</strong>{duration===d&&<Check/>}</button>)}
   </div>
  </SectionCard>
  <SectionCard eyebrow="SLOT PRICING" title={`${duration}-minute session rates`} subtitle="Only the currently active playing time is editable. Inactive duration pricing is not exposed here.">
   {!isValidRate(active.dayRate)||!isValidRate(active.nightRate)?<div className="pricing-warning"><Info/><div><strong>{duration}-minute pricing is incomplete.</strong><span>{!isValidRate(active.dayRate)?`Day rate required. `:''}{!isValidRate(active.nightRate)?'Night rate required.':''}</span></div></div>:null}
   <div className="pricing-active-card">
    <div className="pricing-rate-row"><div><Sun/><span>DAY</span></div><label><span>৳</span><input aria-label={`${duration}-minute Day price`} type="number" min="0" step="0.001" value={active.dayRate??''} onChange={e=>updateRate('day',e.target.value)}/></label></div>
    <div className="pricing-rate-row"><div><Moon/><span>NIGHT</span></div><label><span>৳</span><input aria-label={`${duration}-minute Night price`} type="number" min="0" step="0.001" value={active.nightRate??''} onChange={e=>updateRate('night',e.target.value)}/></label></div>
    {err&&<div className="error pricing-error">{err}</div>}
   </div>
   <div className="pricing-note"><Info/><span>Active playing time is stored in Turf Settings as <b>slotDuration</b>. Changing it updates future slot generation only; historical bookings keep their original duration and price.</span></div>
  </SectionCard>
 </>
}

export default PricingAdmin;
