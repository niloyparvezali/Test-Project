import React,{useEffect,useState} from 'react';
import { Save } from 'lucide-react';
import { doc,getDoc,setDoc,serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { displayBrand } from '../../config/brand';
import { getActivePricing, isValidRate } from '../../utils/pricingUtils';
import { useAdminRole } from '../../hooks/useAdminRole';
import { AdminPageHeader,SectionCard,LoadingState } from '../../components/ui';
import { logAdminActivity } from '../../services/adminActivityService';

function SettingCard({eyebrow,title,description,children}){return <section className="setting-card"><div className="setting-head"><span className="eyebrow">{eyebrow}</span><h3>{title}</h3><p>{description}</p></div><div className="setting-body">{children}</div></section>}

function AdminTurf(){
 const {isAdmin,loading:roleLoading,uid,email}=useAdminRole();
 const [turf,setTurf]=useState({}),[settings,setSettings]=useState({advanceType:'percentage',advanceValue:30,slotDuration:60}),[loadedDuration,setLoadedDuration]=useState(60),[saving,setSaving]=useState(false),[loaded,setLoaded]=useState(false);
 useEffect(()=>{Promise.all([getDoc(doc(db,'turf/main')),getDoc(doc(db,'settings/config'))]).then(([a,b])=>{setTurf(a.exists()?{...a.data(),name:displayBrand(a.data()?.name)}:{});const nextSettings=b.exists()?{advanceType:'percentage',advanceValue:30,slotDuration:60,...b.data()}:{advanceType:'percentage',advanceValue:30,slotDuration:60};setSettings(nextSettings);setLoadedDuration(Number(nextSettings.slotDuration)===90?90:60);setLoaded(true)}).catch(()=>setLoaded(true))},[]);
 const set=(k,v)=>setTurf(x=>({...x,[k]:v})),setS=(k,v)=>setSettings(x=>({...x,[k]:v}));
 const save=async()=>{
  if(!isAdmin){
    alert(`Your account is signed in, but it is not registered as an Admin. Ask the project owner to assign role = admin to your Firebase user.`);
    return;
  }
  const duration=Number(settings.slotDuration);
  if(![60,90].includes(duration)){
    alert('Please select a playing time.');
    return;
  }
  setSaving(true);
  try{
    if(duration!==loadedDuration){
      const pricingSnap=await getDoc(doc(db,'pricing/current'));
      const pricing=pricingSnap.exists()?pricingSnap.data():{};
      const active=getActivePricing(pricing,{...settings,slotDuration:duration});
      if(!isValidRate(active.dayRate)){
        alert(`${duration}-minute Day price is required before this playing time can become active. Open Pricing and configure the Day rate first.`);
        setSaving(false);
        return;
      }
      if(!isValidRate(active.nightRate)){
        alert(`${duration}-minute Night price is required before this playing time can become active. Open Pricing and configure the Night rate first.`);
        setSaving(false);
        return;
      }
    }
    await setDoc(doc(db,'turf/main'),{...turf,updatedAt:serverTimestamp()},{merge:true});
    await setDoc(doc(db,'settings/config'),{
      ...settings,
      slotDuration:duration,
      advanceType:settings.advanceType==='fixed'?'fixed':'percentage',
      advanceValue:Number(settings.advanceValue)||0,
      updatedAt:serverTimestamp()
    },{merge:true});
    setLoadedDuration(duration);
    await logAdminActivity({ action:'turf_settings_updated', targetType:'settings', targetId:'turf/main', description:`Updated Turf Settings`, metadata:{ section:'turf', slotDuration:duration } });
    alert('Turf configuration saved.');
  }catch(x){
    if(x?.code==='permission-denied'){
      alert('Your account is not authorized to update Turf Settings. Please verify your Firebase users profile has role = admin.');
    }else{
      alert(x?.message||'Could not save Turf configuration.');
    }
  }finally{
    setSaving(false);
  }
 };
 if(roleLoading||!loaded)return <LoadingState label={roleLoading?'Checking admin access…':'Loading Turf settings…'}/>;
 return <>
   {!isAdmin&&<div className="error" style={{marginBottom:16}}>
     Your Firebase account is signed in, but it is not registered as an Admin. The current user is <b>{email||'unknown'}</b>{uid?<> (UID: <code>{uid}</code>)</>:null}. Ask the project owner to create <code>users/{uid}</code> with <code>role: "admin"</code> in Firestore.
   </div>}
   <AdminPageHeader eyebrow="TURF MANAGEMENT" title="Turf settings" subtitle="Keep every public-facing turf detail and booking rule in one organized workspace." actions={<button className="primary" onClick={save} disabled={saving}><Save/> {saving?'Saving…':'Save changes'}</button>}/>
   <div className="settings-grid-v2">
     <SettingCard eyebrow="PUBLIC PROFILE" title="Turf identity" description="The core information visitors see on the public Konabari Turf page."><div className="form setting-form"><label>Turf name<input value={displayBrand(turf.name)} onChange={e=>set('name',e.target.value)}/></label><label>Owner name<input value={turf.ownerName||''} onChange={e=>set('ownerName',e.target.value)}/></label><label>Turf size<input value={turf.turfSize||''} onChange={e=>set('turfSize',e.target.value)}/></label><label>Turf type / surface<input value={turf.turfType||''} onChange={e=>set('turfType',e.target.value)}/></label><label className="full-span">Description<textarea value={turf.description||''} onChange={e=>set('description',e.target.value)}/></label><label className="full-span">Additional information<textarea value={turf.additionalInfo||''} onChange={e=>set('additionalInfo',e.target.value)}/></label></div></SettingCard>
     <SettingCard eyebrow="CONTACT" title="How customers reach you" description="Contact information used throughout the public page."><div className="form setting-form"><label>Phone<input inputMode="tel" value={turf.phone||''} onChange={e=>set('phone',e.target.value)}/></label><label>WhatsApp<input inputMode="tel" value={turf.whatsapp||''} onChange={e=>set('whatsapp',e.target.value)}/></label></div></SettingCard>
     <SettingCard eyebrow="PAYMENTS" title="Advance collection" description="Configure the payment numbers shown to customers and the advance required for booking requests."><div className="form setting-form"><label>bKash number<input inputMode="tel" value={turf.bkashNumber||''} onChange={e=>set('bkashNumber',e.target.value)}/></label><label>Nagad number<input inputMode="tel" value={turf.nagadNumber||''} onChange={e=>set('nagadNumber',e.target.value)}/></label><label>Rocket number<input inputMode="tel" value={turf.rocketNumber||''} onChange={e=>set('rocketNumber',e.target.value)}/></label><div className="advance-config-v2 full-span"><span className="eyebrow">BOOKING ADVANCE</span><div className="form"><label>Advance type<select value={settings.advanceType||'percentage'} onChange={e=>setS('advanceType',e.target.value)}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></label><label>Advance value<input type="number" min="0" step="0.001" value={settings.advanceValue??30} onChange={e=>setS('advanceValue',e.target.value)}/></label></div></div></div></SettingCard>
     <SettingCard eyebrow="LOCATION" title="Find the turf" description="Public location and map information."><div className="form setting-form"><label className="full-span">Address<input value={turf.address||''} onChange={e=>set('address',e.target.value)}/></label><label className="full-span">Google Maps URL<input type="url" placeholder="https://maps.google.com/…" value={turf.mapsUrl||''} onChange={e=>set('mapsUrl',e.target.value)}/></label><label className="full-span">Location note<textarea value={turf.locationNote||''} onChange={e=>set('locationNote',e.target.value)}/></label></div></SettingCard>
     <SettingCard eyebrow="FACILITIES" title="What players get" description="One facility per line; stored as the existing array in Firestore."><label className="textarea-only">Facilities<textarea value={(turf.facilities||[]).join('\n')} onChange={e=>set('facilities',e.target.value.split('\n').map(x=>x.trim()).filter(Boolean))}/></label></SettingCard>
     <SettingCard eyebrow="RULES" title="Turf rules" description="One rule per line; keep player-facing policies clear."><label className="textarea-only">Rules<textarea value={(turf.rules||[]).join('\n')} onChange={e=>set('rules',e.target.value.split('\n').map(x=>x.trim()).filter(Boolean))}/></label></SettingCard>
     <SettingCard eyebrow="OPERATING HOURS" title="Slot generation" description="Playing time is the single active duration used by public booking, admin slots, and direct bookings."><div className="form setting-form"><label className="full-span">PLAYING TIME<div className="duration-choice-grid"><button type="button" className={`duration-choice ${Number(settings.slotDuration)===60?'active':''}`} onClick={()=>{if(Number(settings.slotDuration)!==60&&window.confirm('Change playing time to 60 minutes? This changes future public slots, admin slots, booking duration, and active pricing.'))setSettings(x=>({...x,slotDuration:60}))}}><span>60 MINUTES</span><strong>Standard session</strong>{Number(settings.slotDuration)===60&&<span aria-hidden="true">✓</span>}</button><button type="button" className={`duration-choice ${Number(settings.slotDuration)===90?'active':''}`} onClick={()=>{if(Number(settings.slotDuration)!==90&&window.confirm('Change playing time to 90 minutes? This changes future public slots, admin slots, booking duration, and active pricing.'))setSettings(x=>({...x,slotDuration:90}))}}><span>90 MINUTES</span><strong>Extended session</strong>{Number(settings.slotDuration)===90&&<span aria-hidden="true">✓</span>}</button></div></label><label>Opening time<input type="time" value={settings.openingTime||'06:00'} onChange={e=>setS('openingTime',e.target.value)}/></label><label>Closing time<input type="time" value={settings.closingTime||'04:00'} onChange={e=>setS('closingTime',e.target.value)}/></label><label>Day boundary<input type="time" value={settings.dayBoundary||'18:00'} onChange={e=>setS('dayBoundary',e.target.value)}/></label></div></SettingCard>
   </div>
 </>
}

export default AdminTurf;
