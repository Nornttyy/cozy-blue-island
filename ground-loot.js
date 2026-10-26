import {stackLimit} from './inventory.js';
export const MAX_GROUND_PILES=1024;
const validPosition=p=>p&&[p.x,p.z].every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7);
// Plan on copies: overflow must not consume the source or partially award loot.
export function planGroundLoot(state,items,position,sample,catalog){
 if(!validPosition(position)||!items||!Object.keys(items).length)return null;
 const drops=(state.drops||[]).map(d=>({...d})),ids=[];let nextDrop=Math.max(state.nextDrop||0,0,...drops.map(d=>Number(d.id.slice(4))+1)),ordinal=0;
 for(const [item,count]of Object.entries(items)){
  if(!catalog[item]||!Number.isSafeInteger(count)||count<=0||count>999)return null;
  let left=count;const limit=stackLimit(item);
  for(const d of drops)if(left&&d.item===item&&d.count<limit&&Math.hypot(d.x-position.x,d.z-position.z)<.7){const take=Math.min(left,limit-d.count);d.count+=take;left-=take;ids.push(d.id);}
  while(left){if(drops.length>=MAX_GROUND_PILES)return null;
   const angle=ordinal*2.399963,radius=ordinal===0?0:.38+Math.floor(ordinal/6)*.18;
   let x=position.x+Math.cos(angle)*radius,z=position.z+Math.sin(angle)*radius,y=sample(x,z);ordinal++;
   const base=sample(position.x,position.z);if(!Number.isFinite(base))return null;
   if(!Number.isFinite(y)||Math.abs(y-base)>.65){x=position.x;z=position.z;y=base;}
   const count=Math.min(left,limit),id='drop'+nextDrop++;left-=count;
   drops.push({id,type:'drop',item,count,x,y,z,bornAt:state.elapsed||0});ids.push(id);
  }
 }
 return {drops,nextDrop,ids};
}
export function restoreGroundLoot(saved,sample,catalog,elapsed){
 const drops=[],seen=new Set();
 for(const d of Array.isArray(saved)?saved:[]){
  if(drops.length>=MAX_GROUND_PILES)break;
  if(!d||!catalog[d.item]||!Number.isInteger(d.count)||d.count<1||d.count>64||!validPosition(d)||!/^drop\d{1,12}$/.test(d.id)||seen.has(d.id))continue;
  const y=sample(d.x,d.z);if(!Number.isFinite(y))continue;seen.add(d.id);
  drops.push({id:d.id,type:'drop',item:d.item,count:d.count,x:d.x,y,z:d.z,bornAt:Math.min(elapsed-1,Number(d.bornAt)||0)});
 }
 return drops;
}
// A small single landing bounce. Old/reloaded piles stay still on the ground.
export function lootLift(age){if(age<0||age>=.55)return 0;const t=age/.55;return .28*(1-t)*(1-t)+.06*Math.sin(t*Math.PI*2)**2*(1-t);}
