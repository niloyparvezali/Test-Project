import { auth, db } from '../firebase';
import { collection, doc, getDoc, getDocs, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getCurrentAdminActor, logAdminActivity } from './adminActivityService';

async function createExpenseClient(f){
 const actor=await getCurrentAdminActor();
 const expenseRef=doc(collection(db,'expenses')),txRef=doc(collection(db,'transactions'));
 await runTransaction(db,async tx=>{
   const now=serverTimestamp();
   tx.set(expenseRef,{reason:String(f.reason||'').trim(),amount:Number(f.amount),date:String(f.date),category:String(f.category||'Other'),note:String(f.note||''),createdAt:now,updatedAt:now,createdBy:auth.currentUser.uid,createdByEmail:actor.actorEmail,createdByName:actor.actorName});
   tx.set(txRef,{type:'expense',amount:Number(f.amount),category:String(f.category||'Other'),referenceId:expenseRef.id,description:String(f.reason||'').trim(),date:String(f.date),createdAt:now,createdBy:auth.currentUser.uid});
 });
 await logAdminActivity({action:'expense_created',targetType:'expense',targetId:expenseRef.id,description:`${actor.actorName} created expense`,metadata:{reason:String(f.reason||'').trim(),amount:Number(f.amount)}});
}
async function updateExpenseClient(item,f){
 const actor=await getCurrentAdminActor();
 const expenseRef=doc(db,'expenses',item.id);
 const qs=await getDocs(query(collection(db,'transactions'),where('referenceId','==',item.id),where('type','==','expense')));
 const txRef=qs.empty?doc(collection(db,'transactions')):qs.docs[0].ref;
 const changed=Object.keys({reason:1,amount:1,date:1,category:1,note:1}).filter(k=>String(item?.[k]??'')!==String(f?.[k]??''));
 await runTransaction(db,async tx=>{
   const now=serverTimestamp();
   tx.update(expenseRef,{reason:String(f.reason||'').trim(),amount:Number(f.amount),date:String(f.date),category:String(f.category||'Other'),note:String(f.note||''),updatedAt:now,updatedBy:auth.currentUser.uid,updatedByEmail:actor.actorEmail,updatedByName:actor.actorName});
   tx.set(txRef,{type:'expense',amount:Number(f.amount),category:String(f.category||'Other'),referenceId:item.id,description:String(f.reason||'').trim(),date:String(f.date),updatedAt:now,createdAt:item.createdAt||now,createdBy:item.createdBy||auth.currentUser.uid,updatedBy:auth.currentUser.uid},{merge:true});
 });
 await logAdminActivity({action:'expense_updated',targetType:'expense',targetId:item.id,description:`${actor.actorName} edited expense`,metadata:{changedFields:changed}});
}
async function deleteExpenseClient(id){
 const actor=await getCurrentAdminActor();
 const expenseRef=doc(db,'expenses',id);
 const snap=await getDocs(query(collection(db,'expenses')));
 const item=snap.docs.find(x=>x.id===id)?.data()||{};
 const qs=await getDocs(query(collection(db,'transactions'),where('referenceId','==',id),where('type','==','expense')));
 await runTransaction(db,async tx=>{tx.delete(expenseRef);qs.forEach(x=>tx.delete(x.ref));});
 await logAdminActivity({action:'expense_deleted',targetType:'expense',targetId:id,description:`${actor.actorName} deleted expense`,metadata:{reason:item.reason||'',amount:Number(item.amount||0)}});
}
export { createExpenseClient, updateExpenseClient, deleteExpenseClient };
