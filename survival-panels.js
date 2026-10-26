import {ITEMS,RECIPES,GOALS} from './survival-state.js';
import {itemIcon} from './item-icons.js';
import {HOTBAR_SIZE,stackLimit} from './inventory.js';
export {itemIcon};
export function inventoryDetail(stack,index){const item=ITEMS[stack?.id];return item?`${itemIcon(stack.id)}<div><span class="kit-eyebrow">物品手记</span><h3>${item.name}<small>× ${stack.count}</small></h3><p>${item.note}</p><span class="kit-stack">每格最多 ${stackLimit(stack.id)}${stackLimit(stack.id)===1?' · 装备':' · 可堆叠'}</span></div>${item.food||item.water||item.health?`<button class="secondary" data-eat="${stack.id}" data-index="${index}">使用一份</button>`:''}`:`<span class="kit-empty-icon">${itemIcon('pack')}</span><div><span class="kit-eyebrow">ISLAND FIELD KIT</span><h3>带上需要的，轻装出发</h3><p>把物品放进下方九格，就能拿在手里。空格位就是空手。</p></div>`;}
export function inventoryHTML(survival,player,chosen=0,carry=null,pending=false){
 const bag=survival.game.bag(),filled=bag.slice(HOTBAR_SIZE).filter(Boolean).length;
 const cell=(v,i)=>{const count=(v?.count||0)-(carry?.from===i?carry.count:0),shown=count>0?v:null;return `<button type="button" class="kit-slot ${shown?'filled':''} ${i===survival.selected?'equipped':''} ${carry?.from===i?'reserved':''}" data-slot="${i}" aria-label="${i<HOTBAR_SIZE?'快捷栏 '+(i+1):'背包 '+(i-HOTBAR_SIZE+1)}${shown?' '+ITEMS[v.id].name+' '+count:' 空'}" ${pending?'aria-disabled="true"':''}>${i<HOTBAR_SIZE?`<kbd>${i+1}</kbd>`:''}${shown?itemIcon(v.id)+(count>1?`<b>${count}</b>`:''):''}</button>`;};
 return `<div class="kit-inspect" id="kit-inspect">${inventoryDetail(bag[chosen],chosen)}</div><div class="kit-section-head"><span>背包 <small>${filled} / ${bag.length-HOTBAR_SIZE}</small></span><button class="kit-sort" data-sort="1" ${pending||carry?'disabled':''}>整理背包</button></div><div class="kit-grid" role="group" aria-label="背包物品">${bag.slice(HOTBAR_SIZE).map((s,i)=>cell(s,i+HOTBAR_SIZE)).join('')}</div><div class="kit-section-head kit-hotbar-head"><span>快捷栏 <small>数字键 1–9 / 滚轮</small></span><span class="kit-caption">和屏幕下方一一对应</span></div><div class="kit-grid kit-hotbar" role="group" aria-label="背包中的快捷栏">${bag.slice(0,HOTBAR_SIZE).map(cell).join('')}</div><div class="kit-instructions"><span><kbd>左键</kbd> 拿起 / 放下</span><span><kbd>右键</kbd> 拿一半 / 放一个</span><span><kbd>Shift</kbd> 点击快速转移</span><span><kbd>1–9</kbd> 悬停换格</span></div><div id="inventory-cursor" class="inventory-cursor" hidden aria-hidden="true"></div>`;
}
export function craftHTML(survival,player){
  const game=survival.game,s=game.state;
  return `<div class="recipe-grid">${Object.entries(RECIPES).map(([id,r])=>{
    const owned=['axe','pickaxe','torch'].includes(id)&&s.inventory[id],fire=!r.station||game.near(r.station,player.getState());
    const can=game.canAfford(r.cost)&&!owned&&fire;
    return `<article class="recipe">${itemIcon(id)}<div class="recipe-copy"><h3>${r.name}${r.amount?' ×'+r.amount:''}</h3><p>${r.note}</p><div class="recipe-cost">${Object.entries(r.cost).map(([k,n])=>`<span class="${s.inventory[k]>=n?'enough':'short'}">${ITEMS[k].name} ${s.inventory[k]}/${n}</span>`).join('')}</div></div><button ${r.build?'data-build':'data-craft'}="${id}" ${can?'':'disabled'}>${owned?'已拥有':!fire?'需要'+RECIPES[r.station].name:r.build?'选择位置':'制作'}</button></article>`;
  }).join('')}</div>`;
}
export function journalHTML(survival){const s=survival.game.state;return `<p class="journal-heading">第一个营地 <span>· ${GOALS.filter(([id])=>s.goals[id]).length} / ${GOALS.length}</span></p>${GOALS.map(([id,title,note],i)=>`<div class="journal-row ${s.goals[id]?'done':''}"><span class="journal-check">${s.goals[id]?itemIcon('check'):'0'+(i+1)}</span><div><h3>${title}</h3><p>${note}</p></div></div>`).join('')}<p class="journal-note">这是一个慢节奏的营地体验。暂停时饱食和水分不减少；体力耗尽会返回营地，物品不会丢失。进度只保存在当前浏览器，不跨设备。</p>`;}
