import {InventoryCursor} from './inventory-cursor.js';
import {itemIcon,inventoryDetail} from './survival-panels.js';
export function createInventoryUI({panel,survival,active,refresh,choose}){
 let hovered=-1,point={x:0,y:0},gesture=null;
 const content=document.getElementById('panel-content');
 const cursor=new InventoryCursor(()=>survival.game.bag(),(kind,args)=>survival.editInventory(kind,args),()=>{if(active())refresh();});
 function paint(){const el=document.getElementById('inventory-cursor');if(!el)return;el.hidden=!cursor.carry;el.innerHTML=cursor.carry?itemIcon(cursor.carry.id)+`<b>${cursor.carry.count}</b>`:'';el.style.left=point.x+'px';el.style.top=point.y+'px';el.classList.toggle('pending',cursor.pending);panel.classList.toggle('carrying-item',!!cursor.carry);}
 function hover(i){if(i===hovered)return;hovered=i;if(i<0)return;choose(i);const inspect=document.getElementById('kit-inspect');if(inspect)inspect.innerHTML=inventoryDetail(survival.game.bag()[i],i);}
 content.addEventListener('pointerdown',e=>{
  const b=e.target.closest('[data-slot]');if(!active()||!b||cursor.pending||e.button>2)return;
  e.preventDefault();point={x:e.clientX,y:e.clientY};const i=Number(b.dataset.slot);choose(i);hovered=i;
  if(e.shiftKey){gesture=null;cursor.quick(i);return;}
  if(e.button===2){gesture=null;if(cursor.carry)cursor.place(i,true);else cursor.take(i,true);return;}
  if(e.button!==0)return;
  const had=!!cursor.carry;gesture={from:i,had};if(!had)cursor.take(i);paint();
 });
 document.addEventListener('pointermove',e=>{if(!active())return;point={x:e.clientX,y:e.clientY};const b=e.target.closest?.('[data-slot]');hover(b?Number(b.dataset.slot):-1);paint();});
 document.addEventListener('pointerup',e=>{if(!gesture||e.button!==0)return;const g=gesture;gesture=null;if(!active())return;const b=e.target.closest?.('[data-slot]');if(b){const to=Number(b.dataset.slot);if(g.had||to!==g.from)cursor.place(to);}});
 content.addEventListener('contextmenu',e=>{if(active())e.preventDefault();});
 content.addEventListener('focusin',e=>{const b=e.target.closest('[data-slot]');if(b)hover(Number(b.dataset.slot));});
 window.addEventListener('blur',()=>{gesture=null;cursor.cancel();});
 return {cursor,paint,cancel(){gesture=null;hovered=-1;cursor.cancel();panel.classList.remove('carrying-item');},keydown(e){
  if(!active())return false;const focused=document.activeElement?.closest?.('[data-slot]'),i=hovered>=0?hovered:focused?Number(focused.dataset.slot):-1;
  if(/^Digit[1-9]$/.test(e.code)&&i>=0){e.preventDefault();cursor.hotkey(i,Number(e.code.slice(-1))-1);return true;}
  if(['Enter','Space'].includes(e.code)&&i>=0){e.preventDefault();if(e.shiftKey)cursor.quick(i);else if(cursor.carry)cursor.place(i);else cursor.take(i);return true;}
  return false;
 }};
}
