import {sameStack,HOTBAR_SIZE} from './inventory.js';
const copy=s=>s?{...s}:null;
// A cursor reserves a visible part of a slot until the atomic move succeeds.
// Closing, losing focus or disconnecting never removes items from the saved bag.
export class InventoryCursor {
 constructor(getBag,edit,changed=()=>{}){this.getBag=getBag;this.edit=edit;this.changed=changed;this.carry=null;this.pending=false;this.epoch=0;}
 cancel(){this.carry=null;this.epoch++;this.changed();}
 validate(){if(this.carry&&!this.pending&&!sameStack(this.getBag()[this.carry.from],this.carry.expected))this.cancel();}
 take(from,half=false){if(this.pending)return;const s=this.getBag()[from];if(!s)return;this.carry={from,id:s.id,count:half?Math.ceil(s.count/2):s.count,expected:copy(s)};this.changed();}
 async place(to,one=false){
  if(this.pending||!this.carry)return;this.validate();if(!this.carry)return;
  const c={...this.carry},bag=this.getBag();if(to===c.from){if(one&&c.count>1){this.carry.count--;this.changed();}else this.cancel();return;}
  const before=copy(bag[to]),epoch=this.epoch;this.pending=true;this.changed();let r;
  try{r=await this.edit('transfer',{from:c.from,to,count:one?1:c.count,swap:!one,expected:{from:copy(bag[c.from]),to:before}});}finally{this.pending=false;}
  if(this.epoch!==epoch){this.changed();return;}
  if(r?.ok){const src=this.getBag()[c.from];this.carry=r.swapped?{from:c.from,id:src.id,count:src.count,expected:copy(src)}:c.count>r.moved&&src?{...c,count:c.count-r.moved,expected:copy(src)}:null;}
  else this.carry=null;
  this.changed();
 }
 async quick(from){if(this.pending)return;this.cancel();const s=this.getBag()[from];if(!s)return;this.pending=true;this.changed();try{await this.edit('quickMove',{from,expected:copy(s)});}finally{this.pending=false;this.changed();}}
 async hotkey(from,to){if(this.pending||to<0||to>=HOTBAR_SIZE||from===to)return;this.cancel();const bag=this.getBag(),a=bag[from],b=bag[to];if(!a&&!b)return;this.pending=true;this.changed();try{await this.edit('transfer',a?{from,to,count:a.count,expected:{from:copy(a),to:copy(b)}}:{from:to,to:from,count:b.count,expected:{from:copy(b),to:null}});}finally{this.pending=false;this.changed();}}
}
