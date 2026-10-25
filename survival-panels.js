import {ITEMS,RECIPES,GOALS} from './survival-state.js';
import {itemIcon} from './item-icons.js';
export {itemIcon};
export function inventoryHTML(survival,player,chosen=0){
  const s=survival.game.state,bag=survival.game.bag(),stack=bag[chosen],item=ITEMS[stack?.id];
  return `<div class="bag-toolbar"><span>随身背包 <b>${bag.filter(Boolean).length}/${bag.length}</b></span><button data-sort="1">一键整理</button><button data-hand="1">空手</button></div><p class="bag-tip">拖动交换 / 合并 · Shift 点击拆半 · 选中物品后绑定 1–8</p><div class="bag-layout"><div class="bag-grid">${bag.map((v,i)=>`<button class="bag-cell ${i===chosen?'chosen':''} ${v?'filled':''}" data-slot="${i}" draggable="${!!v}" aria-label="格子 ${i+1}${v?' '+ITEMS[v.id].name+' '+v.count:' 空'}"><span class="cell-index">${i+1}</span>${v?itemIcon(ITEMS[v.id].icon)+`<b>${v.count}</b><small>${ITEMS[v.id].name}</small>`:''}</button>`).join('')}</div><aside class="bag-detail">${item?itemIcon(item.icon)+`<h3>${item.name}</h3><p>${item.note}</p><strong>数量 ${stack.count}</strong><div class="bag-actions">${item.food||item.water||item.health?`<button data-eat="${stack.id}">使用一份</button>`:''}<button data-split="${chosen}" ${stack.count<2?'disabled':''}>拆分一半</button><button data-drop="${chosen}">放下一个</button></div><small>绑定快捷键</small><div class="bind-grid">${s.hotbar.map((id,i)=>`<button data-bind="${stack.id}" data-index="${i}" title="${ITEMS[id]?.name||'空手'}">${i+1}</button>`).join('')}</div>`:'<h3>选一件物品</h3><p>点击有物品的格子查看用途。点击空格可移动当前选中的整组物品。</p>'}</aside></div><p class="inventory-help">材料每格 50，水壶每格 10，工具每格 1。快捷栏只是背包物品的绑定，不会复制物品。左键使用选中物品，F 使用消耗品，Q 放下一个。</p><div class="supply-heading"><span>手工制作</span><small>绿色数字表示材料充足</small></div>${craftHTML(survival,player)}`;
}
export function craftHTML(survival,player){
  const game=survival.game,s=game.state;
  return `<div class="recipe-grid">${Object.entries(RECIPES).map(([id,r])=>{
    const owned=['axe','pickaxe','torch'].includes(id)&&s.inventory[id],fire=!r.station||game.near(r.station,player.getState());
    const can=game.canAfford(r.cost)&&!owned&&fire;
    return `<article class="recipe">${itemIcon(r.icon)}<div class="recipe-copy"><h3>${r.name}${r.amount?' ×'+r.amount:''}</h3><p>${r.note}</p><div class="recipe-cost">${Object.entries(r.cost).map(([k,n])=>`<span class="${s.inventory[k]>=n?'enough':'short'}">${ITEMS[k].name} ${s.inventory[k]}/${n}</span>`).join('')}</div></div><button ${r.build?'data-build':'data-craft'}="${id}" ${can?'':'disabled'}>${owned?'已拥有':!fire?'需要'+RECIPES[r.station].name:r.build?'选择位置':'制作'}</button></article>`;
  }).join('')}</div>`;
}
export function journalHTML(survival){const s=survival.game.state;return `<p class="journal-heading">第一个营地 <span>· ${GOALS.filter(([id])=>s.goals[id]).length} / ${GOALS.length}</span></p>${GOALS.map(([id,title,note],i)=>`<div class="journal-row ${s.goals[id]?'done':''}"><span class="journal-check">${s.goals[id]?itemIcon('check'):'0'+(i+1)}</span><div><h3>${title}</h3><p>${note}</p></div></div>`).join('')}<p class="journal-note">这是一个慢节奏的营地体验。暂停时饱食和水分不减少；体力耗尽会返回营地，物品不会丢失。进度只保存在当前浏览器，不跨设备。</p>`;}
