import React from 'react';
import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';
import { X } from 'lucide-react';

function Loading(){return <div className="loading"><div className="ball">⚽</div><span>Loading Konabari Turf…</span></div>}
function Empty({title='No data available',text=''}){return <div className="empty"><div className="empty-icon">⚽</div><b>{title}</b>{text&&<span>{text}</span>}</div>}
function Modal({title,onClose,children}){
 useEffect(()=>{
  const previousBody = document.body.style.overflow;
  const previousHtml = document.documentElement.style.overflow;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  return () => {
   document.body.style.overflow = previousBody;
   document.documentElement.style.overflow = previousHtml;
  };
 },[]);
 return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><div><h3>{title}</h3></div><button className="icon-btn" onClick={onClose}><X/></button></div>{children}</div></div>
}
function PendingPill({count=0}){return count?<span className="pending-pill">{count}</span>:null;}
function AdminPageHeader({eyebrow='OVERVIEW',title,subtitle,actions}){
 return <div className="admin-page-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{actions&&<div className="page-head-actions">{actions}</div>}</div>
}
function StatCard({icon:Icon,label,value,meta,tone='default'}){
 return <div className={`stat-card ${tone}`}><div className="stat-icon"><Icon/></div><div className="stat-copy"><span>{label}</span><strong>{value}</strong>{meta&&<small>{meta}</small>}</div></div>
}
function SectionCard({eyebrow,title,subtitle,actions,children,className='' }){
 return <section className={`section-card ${className}`}><div className="section-card-head">{<div><span className="eyebrow">{eyebrow}</span>{title&&<h3>{title}</h3>}{subtitle&&<p>{subtitle}</p>}</div>}{actions&&<div className="section-card-actions">{actions}</div>}</div>{children}</section>
}
function StatusBadge({status}){
 const map={pending_payment_verification:['Pending Payment','pending'],confirmed:['Confirmed','confirmed'],rejected:['Rejected','rejected'],cancelled:['Cancelled','cancelled'],expired:['Expired','expired']};
 const [label,cls]=map[status]||[status||'Unknown','default'];
 return <span className={`status-badge ${cls}`}>{label}</span>
}
function EmptyState({icon:Icon=Info,title='No data yet',text='',action}){
 return <div className="empty-state-v2"><div className="empty-state-icon"><Icon/></div><b>{title}</b>{text&&<p>{text}</p>}{action}</div>
}
function LoadingState({label='Loading Konabari Turf…'}){return <div className="loading-state-v2"><div className="loading-ring"></div><span>{label}</span></div>}

export { Loading, Empty, Modal, PendingPill, AdminPageHeader, StatCard, SectionCard, StatusBadge, EmptyState, LoadingState };
