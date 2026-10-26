export const BAG_SIZE=36,HOTBAR_SIZE=9;
export const stackLimit=id=>['axe','pickaxe','torch','spear','bow','ironaxe','ironpick','leathervest','compass'].includes(id)?1:id==='flask'||id==='water'?16:64;
export const defaultHotbar=()=>Array(HOTBAR_SIZE).fill('hand');
export function totals(slots){const result={};for(const s of slots||[])if(s)result[s.id]=(result[s.id]||0)+s.count;return result;}
export function packCounts(counts,size=BAG_SIZE,expand=false){const bag=Array(size).fill(null);let p=0;for(const [id,n]of Object.entries(counts)){let left=n;while(left>0){if(p>=bag.length){if(!expand)return null;bag.push(null);}const count=Math.min(left,stackLimit(id));bag[p++]={id,count};left-=count;}}return bag;}
export function validBag(bag,counts,items,min=BAG_SIZE){if(!Array.isArray(bag)||bag.length<min||bag.length>512)return false;for(const s of bag)if(s&&(!items[s.id]||!Number.isInteger(s.count)||s.count<1||s.count>stackLimit(s.id)))return false;const sum=totals(bag);return Object.keys(items).every(k=>(sum[k]||0)===(counts[k]||0));}
// Slots 0–8 ARE the hotbar. Legacy bindings are migrated once, without duplicating items.
export function migrateInventory(state,items){
 if(state.inventoryVersion===2&&validBag(state.bag,state.inventory,items)){syncHotbar(state);return;}
 const old=validBag(state.bag,state.inventory,items,0)?state.bag.map(s=>s?{...s}:null):packCounts(state.inventory,BAG_SIZE,true);
 const bag=Array(BAG_SIZE).fill(null);
 if(state.inventoryVersion!==2)for(let i=0;i<HOTBAR_SIZE;i++){const id=state.hotbar?.[i],at=old.findIndex(s=>s?.id===id);if(at>=0){bag[i]=old[at];old[at]=null;}}
 let at=HOTBAR_SIZE;for(const s of old)if(s){if(at>=bag.length)bag.push(...Array(HOTBAR_SIZE).fill(null));bag[at++]=s;}
 state.bag=bag;state.inventoryVersion=2;syncHotbar(state);
}
export function syncHotbar(state){state.hotbar=state.bag.slice(0,HOTBAR_SIZE).map(s=>s?.id||'hand');}
export const sameStack=(a,b)=>!a&&!b||!!a&&!!b&&a.id===b.id&&a.count===b.count;
export function transferStack(bag,from,to,count,expected,swap=true){
 if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=bag.length||to>=bag.length||from===to||!bag[from]||!Number.isInteger(count)||count<1||count>bag[from].count)return {ok:false,message:'这个格子无法移动'};
 if(expected&&(!sameStack(bag[from],expected.from)||!sameStack(bag[to],expected.to)))return {ok:false,message:'物品已被同伴移动，请重新拿起'};
 const a=bag[from],b=bag[to];
 if(b&&b.id!==a.id){if(!swap||count!==a.count)return {ok:false,message:'先放下手中物品，再交换整组'};bag[from]=b;bag[to]=a;return {ok:true,moved:count,swapped:true};}
 const moved=Math.min(count,stackLimit(a.id)-(b?.count||0));if(!moved)return {ok:false,message:'这一格已满'};
 bag[to]={id:a.id,count:(b?.count||0)+moved};a.count-=moved;if(!a.count)bag[from]=null;return {ok:true,moved};
}
export function quickTransfer(bag,from,expected){
 if(!Number.isInteger(from)||!bag[from]||expected&&!sameStack(bag[from],expected))return {ok:false,message:'物品已变化，请重试'};
 const a=bag[from],indices=Array.from({length:bag.length},(_,i)=>i).filter(i=>from<HOTBAR_SIZE?i>=HOTBAR_SIZE:i<HOTBAR_SIZE);let moved=0;
 for(const empty of [false,true])for(const to of indices){if(!bag[from])break;const b=bag[to];if(empty?!!b:!b||b.id!==a.id)continue;const r=transferStack(bag,from,to,bag[from].count,null,false);if(r.ok)moved+=r.moved;}
 return {ok:moved>0,moved,message:moved?'':'目标区域没有空位'};
}
export function transaction(bag,cost={},award={},preferred=-1){const out=bag.map(s=>s?{...s}:null),indices=out.map((_,i)=>i);if(Number.isInteger(preferred)&&preferred>=0&&preferred<out.length){indices.splice(preferred,1);indices.unshift(preferred);}for(const [id,n]of Object.entries(cost)){let left=n;for(const i of indices)if(left&&out[i]?.id===id){const take=Math.min(left,out[i].count);out[i].count-=take;left-=take;if(!out[i].count)out[i]=null;}if(left)return null;}
 for(const [id,n]of Object.entries(award)){let left=n;for(const s of out)if(s?.id===id){const add=Math.min(left,stackLimit(id)-s.count);s.count+=add;left-=add;}for(let i=0;i<out.length&&left;i++)if(!out[i]){const count=Math.min(left,stackLimit(id));out[i]={id,count};left-=count;}if(left)return null;}return out;}
export function moveStack(bag,from,to,split=false){if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=bag.length||to>=bag.length||from===to||!bag[from])return false;const a=bag[from],b=bag[to];if(split&&b&&b.id!==a.id)return false;
 const amount=split?Math.ceil(a.count/2):a.count;if(!b){bag[to]={id:a.id,count:amount};a.count-=amount;}else if(b.id===a.id){const n=Math.min(amount,stackLimit(a.id)-b.count);b.count+=n;a.count-=n;if(!n)return false;}else{bag[from]=b;bag[to]=a;return true;}if(!a.count)bag[from]=null;return true;}
