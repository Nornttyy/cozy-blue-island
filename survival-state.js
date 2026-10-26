// Pure survival rules: rendering and input never mutate inventory directly.
import {BAG_SIZE,defaultHotbar,packCounts,totals,validBag,transaction,moveStack} from './inventory.js';
export const SAVE_KEY='cozy-island-survival-v1';
export const ITEMS={
  wood:{name:'木材',icon:'wood',note:'拾取枯枝，或砍倒树后劈开倒木。'},stone:{name:'石块',icon:'stone',note:'海岸上的石堆，采完不再刷新。'},
  fiber:{name:'纤维',icon:'fiber',note:'从草丛和棕榈叶中收集。'},axe:{name:'石斧',icon:'axe',note:'装备后可以砍伐棕榈树。'},
  berry:{name:'浆果',icon:'berry',note:'饱食 +14 · 水分 +4',food:14,water:4},coconut:{name:'椰子',icon:'coconut',note:'饱食 +18 · 水分 +14',food:18,water:14},
  shell:{name:'鲜贝',icon:'shell',note:'靠近篝火，用木材烤熟。'},meal:{name:'烤鲜贝',icon:'meal',note:'饱食 +38 · 健康 +8',food:38,health:8},
  rope:{name:'草绳',icon:'rope',note:'用纤维搓成，制作工具和营地设施。'},plank:{name:'木板',icon:'plank',note:'加工木材，用于工作台。'},
  pickaxe:{name:'石镐',icon:'pickaxe',note:'装备后开采燧石与黏土。'},flint:{name:'燧石',icon:'flint',note:'用石镐采集，可以制作火把。'},clay:{name:'黏土',icon:'clay',note:'用石镐采集，烧成水壶。'},
  herb:{name:'草药',icon:'herb',note:'配合纤维制作绷带。'},bandage:{name:'草药绷带',icon:'bandage',note:'健康 +25',health:25},
  mushroom:{name:'蘑菇',icon:'mushroom',note:'岛上可食用的蘑菇，饱食 +8',food:8},roast:{name:'烤蘑菇',icon:'roast',note:'饱食 +28',food:28},
  flask:{name:'空水壶',icon:'flask',note:'手持水壶，点击淡水泉装水。'},water:{name:'清水壶',icon:'water',note:'水分 +45，喝完保留空壶。',water:45},torch:{name:'火把',icon:'torch',note:'装备时照亮周围，可无限次使用。'}
};
export const RECIPES={
  axe:{name:'石斧',icon:'axe',cost:{wood:3,stone:2,fiber:2},note:'砍树获得更多木材与椰子。'},
  fire:{name:'篝火',icon:'fire',cost:{wood:6,stone:4},build:true,radius:.8,note:'烹饪鲜贝，也给营地一抹暖光。'},
  shelter:{name:'叶棚',icon:'shelter',cost:{wood:8,fiber:6},build:true,radius:1.5,note:'设为营地，休息恢复健康。'},
  meal:{name:'烤鲜贝',icon:'meal',cost:{shell:2,wood:1},station:'fire',note:'需要站在篝火 3.5 米内。'},
  rope:{name:'草绳',icon:'rope',cost:{fiber:3},amount:2,note:'3 纤维 → 2 草绳。'},plank:{name:'木板',icon:'plank',cost:{wood:2},amount:2,note:'2 木材 → 2 木板。'},
  bench:{name:'工作台',icon:'bench',cost:{plank:6,rope:2},build:true,radius:.9,note:'在这里制作石镐。'},
  pickaxe:{name:'石镐',icon:'pickaxe',cost:{wood:3,stone:3,rope:1},station:'bench',note:'需要工作台，用于开采燧石与黏土。'},
  bandage:{name:'草药绷带',icon:'bandage',cost:{herb:2,fiber:2},note:'恢复 25 点健康。'},
  roast:{name:'烤蘑菇',icon:'roast',cost:{mushroom:2,wood:1},station:'fire',note:'需要篝火，饱食 +28。'},
  flask:{name:'陶制水壶',icon:'flask',cost:{clay:3,wood:1},station:'fire',note:'在篝火旁烧制，带到泉边装水。'},
  torch:{name:'火把',icon:'torch',cost:{wood:1,rope:1,flint:1},note:'绑定快捷栏，选中后点亮。'}
};
export const NODE_TYPES={
  wood:{name:'枯枝',duration:.55,yield:{wood:3}},stone:{name:'松散石堆',duration:.8,yield:{stone:3}},fiber:{name:'长叶草',duration:.65,yield:{fiber:3}},
  tree:{name:'棕榈树',duration:2.4,yield:{wood:4,fiber:2,coconut:1},tool:'axe'},berry:{name:'浆果丛',duration:.8,yield:{berry:3},renew:180},
  shell:{name:'浅滩鲜贝',duration:.65,yield:{shell:3}},spring:{name:'淡水泉',duration:.8},
  herb:{name:'野生草药',duration:.65,yield:{herb:2}},mushroom:{name:'可食用蘑菇',duration:.65,yield:{mushroom:2}},
  flint:{name:'燧石矿',duration:.8,yield:{flint:3},tool:'pickaxe'},clay:{name:'黏土矿',duration:.8,yield:{clay:3},tool:'pickaxe'}
};
Object.assign(ITEMS,{
 ironore:{name:'铁矿石',icon:'ironore',note:'山地与赤岩岛的矿脉；用石镐或铁镐开采。'},copperore:{name:'铜矿石',icon:'copperore',note:'丘陵和赤岩岛的矿脉。'},
 iron:{name:'铁锭',icon:'ironore',note:'在篝火旁冶炼铁矿，打造进阶工具。'},copper:{name:'铜锭',icon:'copperore',note:'用于制作航海罗盘。'},salt:{name:'海盐',icon:'salt',note:'赤岩岛盐块，可腌制肉食。'},
 spear:{name:'猎矛',icon:'spear',weapon:18,range:3.3,note:'点击刺击，可捕获鱼类和狩猎。'},bow:{name:'木弓',icon:'bow',weapon:24,range:24,note:'需要箭矢，瞄准生物左键射击。'},arrow:{name:'箭矢',icon:'spear',note:'木弓的弹药。'},
 ironaxe:{name:'铁斧',icon:'ironaxe',tool:'axe',weapon:24,range:2.8,note:'可砍树或防身。'},ironpick:{name:'铁镐',icon:'ironpick',tool:'pickaxe',note:'可开采所有矿石。'},
 hide:{name:'兽皮',icon:'leathervest',note:'狩猎野猪获得，用于制作皮甲。'},leathervest:{name:'皮甲',icon:'leathervest',armor:1,note:'制作后自动穿戴，受到野猪攻击时减伤 35%。'},
 fish:{name:'鲜鱼',icon:'fish',note:'使用猎矛或弓捕获，靠近篝火烤熟。'},meat:{name:'生肉',icon:'meat',note:'狩猎获得，烤熟后食用。'},cookedfish:{name:'烤鱼',icon:'fish',food:42,health:5,note:'饱食 +42 · 健康 +5'},cookedmeat:{name:'烤肉',icon:'meat',food:48,note:'饱食 +48'},saltmeat:{name:'腌肉',icon:'meat',food:65,note:'饱食 +65，适合远航。'},compass:{name:'航海罗盘',icon:'copperore',note:'持有时显示最近岛屿的方向与距离。'}
});
Object.assign(RECIPES,{
 spear:{name:'猎矛',icon:'spear',cost:{wood:4,flint:2,rope:1},note:'近战、捕鱼与狩猎。'},bow:{name:'木弓',icon:'bow',cost:{wood:6,rope:3},station:'bench',note:'射程 24 米，需要箭矢。'},arrow:{name:'箭矢',icon:'spear',cost:{wood:2,flint:1,fiber:1},amount:6,note:'制作六支箭。'},
 iron:{name:'冶炼铁锭',icon:'ironore',cost:{ironore:2,wood:3},station:'fire',note:'篝火冶炼：2 铁矿 + 3 木材。'},copper:{name:'冶炼铜锭',icon:'copperore',cost:{copperore:2,wood:2},station:'fire',note:'制作航海工具的原料。'},
 ironaxe:{name:'铁斧',icon:'ironaxe',cost:{iron:4,wood:3,rope:2},station:'bench',note:'更快挥砍的铁制工具。'},ironpick:{name:'铁镐',icon:'ironpick',cost:{iron:4,wood:3,rope:2},station:'bench',note:'铁制采矿工具。'},leathervest:{name:'皮甲',icon:'leathervest',cost:{hide:4,rope:3},station:'bench',note:'自动穿戴 · 受到攻击时减伤 35%。'},
 cookedfish:{name:'烤鱼',icon:'fish',cost:{fish:1,wood:1},station:'fire',note:'烹饪新鲜海鱼。'},cookedmeat:{name:'烤肉',icon:'meat',cost:{meat:1,wood:1},station:'fire',note:'烹饪狩猎所得。'},saltmeat:{name:'腌肉',icon:'meat',cost:{meat:2,salt:1},note:'航行补给。'},compass:{name:'航海罗盘',icon:'copperore',cost:{copper:3,iron:1},station:'bench',note:'显示离岸岛屿方位。'},
 boat:{name:'双桨木船',icon:'boat',cost:{plank:12,rope:5,wood:6},build:true,radius:1.9,note:'在浅水中放置；靠近点击登船，WASD 划船，空格离船。'}
});
Object.assign(NODE_TYPES,{ironore:{name:'铁矿脉',yield:{ironore:3,stone:1},tool:'pickaxe'},copperore:{name:'铜矿脉',yield:{copperore:3},tool:'pickaxe'},salt:{name:'盐晶',yield:{salt:3}}});
export const matchesTool=(held,required)=>held===required||ITEMS[held]?.tool===required;
// Every inventory entry has its own illustration, including refined/cooked goods.
for(const [id,item] of Object.entries(ITEMS))item.icon=id;
for(const [id,recipe] of Object.entries(RECIPES))recipe.icon=id;
export const dismantleRefund=type=>Object.fromEntries(Object.entries(RECIPES[type]?.cost||{}).map(([id,n])=>[id,Math.floor(n*.75)]).filter(([,n])=>n>0));
export const GOALS=[
  ['gather','收集岸边材料','靠近枯枝、石堆和长叶草，点击左键采集。'],
  ['axe','做一把石斧','按 B 制作石斧，再用绑定的快捷键装备。'],
  ['fire','点亮第一处篝火','收集 6 木材、4 石块，在制作页放置篝火。'],
  ['shelter','搭好自己的叶棚','收集 8 木材、6 纤维，在平坦陆地搭建。'],
  ['meal','吃一顿热乎的饭','在海边捡鲜贝，靠近篝火制作并食用。']
];
const clamp=(n,a,b)=>Number.isFinite(n)?Math.max(a,Math.min(b,n)):a;
export const TREE_HITS=4,LOG_HITS=3,FALL_SECONDS=1.4,TRUNK_LENGTH=3.45;
export function segmentDistance(x,z,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-ax-t*dx,z-az-t*dz);}
export function freshState(){return {version:1,inventory:Object.fromEntries(Object.keys(ITEMS).map(k=>[k,0])),bag:Array(BAG_SIZE).fill(null),hotbar:defaultHotbar(),selected:0,vitals:{health:100,food:78,water:72},elapsed:0,depleted:{},trees:{},wildlife:{},buildings:[],drops:[],nextDrop:0,goals:{},position:null,camp:null,restsAt:-120};}
export function makeLayout(sample){
  const nodes=[];
  const add=(type,x,z)=>{const y=sample(x,z);if(!Number.isFinite(y)||y<.3)return false;if(nodes.some(n=>Math.hypot(n.x-x,n.z-z)<1.2))return false;nodes.push({id:`n${nodes.length}`,type,x,z,y});return true;};
  // The first three pickups are deliberately in the player's initial view.
  add('wood',0,6);add('stone',1.65,6.6);add('fiber',-1.65,6.6);add('berry',3.5,4.5);add('spring',-4.4,3);
  let seed=82193;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const types=['tree','wood','fiber','stone','tree','berry','stone','shell'];
  for(let i=0;i<900&&nodes.length<72;i++){
    const x=(rand()-.5)*36,z=(rand()-.5)*30,y=sample(x,z),type=types[i%types.length];
    if(y<.4||y>3.8||Math.hypot(x,z-4)<3.4)continue;
    if(Math.abs(sample(x+.6,z)-sample(x-.6,z))>.7||Math.abs(sample(x,z+.6)-sample(x,z-.6))>.7)continue;
    if(type==='shell'&&y>1.35)continue;
    add(type,x,z);
  }
  return nodes;
}
export function decodeSave(raw,nodes,sample,expanded=false){
  const data=typeof raw==='string'?JSON.parse(raw):raw;
  if(!data||data.version!==1||!data.inventory||!data.vitals)throw new Error('Unrecognized save');
  const s=freshState();
  for(const k in ITEMS)s.inventory[k]=Math.floor(clamp(data.inventory[k],0,k==='axe'?1:999));
  s.bag=validBag(data.bag,s.inventory,ITEMS)?data.bag.map(v=>v?{...v}:null):packCounts(s.inventory,BAG_SIZE,true);
  s.hotbar=Array.from({length:8},(_,i)=>data.hotbar?.[i]==='hand'||ITEMS[data.hotbar?.[i]]?data.hotbar[i]:defaultHotbar()[i]);s.selected=Math.floor(clamp(data.selected,0,7));
  for(const k in s.vitals)s.vitals[k]=clamp(data.vitals[k],0,100);
  s.elapsed=clamp(data.elapsed,0,1e9);s.restsAt=clamp(data.restsAt??-120,-120,s.elapsed);
  s.wildlife={};for(const [id,hp]of Object.entries(data.wildlife||{}))if(/^a-?\d+,-?\d+:\d+$/.test(id)&&Number.isFinite(hp))s.wildlife[id]=clamp(hp,0,100);
  for(const n of nodes){const v=data.depleted?.[n.id];if(v===true||Number.isFinite(v)&&v>0)s.depleted[n.id]=v===true?true:clamp(v,0,s.elapsed+180);}
  if(expanded)for(const [id,v]of Object.entries(data.depleted||{}))if(/^c-?\d+,-?\d+:\d+$/.test(id)&&(v===true||Number.isFinite(v)&&v>0))s.depleted[id]=v===true?true:clamp(v,0,s.elapsed+180);
  for(const n of nodes.filter(n=>n.type==='tree')){
    const t=data.trees?.[n.id];if(s.depleted[n.id]===true||!t||!['standing','falling','fallen'].includes(t.phase))continue;
    s.trees[n.id]={phase:t.phase,hits:Math.floor(clamp(t.hits,0,t.phase==='standing'?TREE_HITS-1:LOG_HITS-1)),yaw:clamp(t.yaw,-Math.PI*2,Math.PI*2),fallStart:clamp(t.fallStart,0,s.elapsed)};
  }
  if(expanded)for(const [id,t]of Object.entries(data.trees||{}))if(/^c-?\d+,-?\d+:\d+$/.test(id)&&t&&['standing','falling','fallen'].includes(t.phase))s.trees[id]={phase:t.phase,hits:Math.floor(clamp(t.hits,0,t.phase==='standing'?TREE_HITS-1:LOG_HITS-1)),yaw:clamp(t.yaw,-7,7),fallStart:clamp(t.fallStart,0,s.elapsed)};
  for(const b of (Array.isArray(data.buildings)?data.buildings:[]).slice(0,expanded?256:12)){
    if(!RECIPES[b.type]?.build||!Number.isFinite(b.x)||!Number.isFinite(b.z)||Math.hypot(b.x,b.z)>(expanded?1e7:35)||(b.type!=='boat'&&sample(b.x,b.z)<.45))continue;
    const id=/^b\d{1,9}$/.test(b.id)&&!s.buildings.some(v=>v.id===b.id)?b.id:`b${Math.max(-1,...s.buildings.map(v=>Number(v.id.slice(1))))+1}`;
    s.buildings.push({id,type:b.type,x:b.x,z:b.z,y:b.type==='boat'?-.19:sample(b.x,b.z),yaw:clamp(b.yaw,-100,100)});
  }
  for(const [id] of GOALS)s.goals[id]=data.goals?.[id]===true;
  const p=data.position;
  if(p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.hypot(p.x,p.z)<(expanded?1e7:61)&&sample(p.x,p.z)>.1)s.position={x:p.x,z:p.z,yaw:clamp(p.yaw,-100,100)};
  s.drops=(Array.isArray(data.drops)?data.drops:[]).filter(d=>ITEMS[d.item]&&Number.isInteger(d.count)&&d.count>0&&d.count<=50&&Number.isFinite(d.x)&&Number.isFinite(d.z)&&/^drop\d+$/.test(d.id)).slice(0,128).map(d=>({...d,y:sample(d.x,d.z)}));s.nextDrop=Math.max(0,...s.drops.map(d=>Number(d.id.slice(4))+1));
  s.camp=s.buildings.find(b=>b.type==='shelter'&&b.id===data.camp)?.id||null;
  s.nextBuilding=Math.max(Math.floor(clamp(data.nextBuilding,0,1e9)),0,...s.buildings.map(b=>Number(b.id.slice(1))+1));
  return s;
}
export class SurvivalState {
  constructor(nodes,sample,saved){this.nodes=nodes;this.sample=sample;this.state=saved||freshState();this.state.trees??={};this.revision=0;}
  changed(){this.revision++;}
  available(node){const v=this.state.depleted[node.id];return v!==true&&!(Number.isFinite(v)&&v>this.state.elapsed);}
  canAfford(cost){return Object.entries(cost).every(([k,n])=>this.state.inventory[k]>=n);}
  spend(cost){const next=transaction(this.bag(),cost,{});if(!next)return false;this.state.bag=next;for(const [k,n] of Object.entries(cost))this.state.inventory[k]-=n;return true;}
  bag(){const s=this.state;if(!validBag(s.bag,s.inventory,ITEMS))s.bag=packCounts(s.inventory,BAG_SIZE,true);return s.bag;}
  canFit(items,cost={}){return !!transaction(this.bag(),cost,items)&&Object.entries(items).every(([k,n])=>this.state.inventory[k]-(cost[k]||0)+n<=999);}
  add(items){if(!this.canFit(items))return false;const next=transaction(this.bag(),{},items);if(!next)return false;this.state.bag=next;for(const [k,n] of Object.entries(items))this.state.inventory[k]+=n;this.changed();return true;}
  rearrange(from,to,split){const ok=moveStack(this.bag(),from,to,split);if(ok)this.changed();return {ok,message:ok?'背包已整理':'无法移动到这里'};}
  sortBag(){this.state.bag=packCounts(this.state.inventory,this.bag().length);this.changed();return {ok:true,message:'已合并同类物品'};}
  bind(id,index){if(index<0||index>7||!(id==='hand'||ITEMS[id]))return {ok:false,message:'无效快捷栏'};this.state.hotbar[index]=id;this.changed();return {ok:true,message:`已绑定快捷键 ${index+1}`};}
  drop(index,position){const bag=this.bag(),s=bag[index];if(!s)return {ok:false,message:'格子为空'};if(this.state.drops.length>=128)return {ok:false,message:'附近散落物品太多，请先收拾'};const id=s.id;s.count--;if(!s.count)bag[index]=null;this.state.inventory[id]--;this.state.drops.push({id:'drop'+this.state.nextDrop++,type:'drop',item:id,count:1,x:position.x-Math.sin(position.yaw)*1.5,z:position.z-Math.cos(position.yaw)*1.5,y:position.feet});this.changed();return {ok:true,message:`放下了 ${ITEMS[id].name}，可以捡回`};}
  treeStage(node){return this.state.depleted[node.id]===true?{phase:'split',hits:LOG_HITS}:this.state.trees[node.id]||{phase:'standing',hits:0,yaw:0,fallStart:0};}
  logPose(node){
    const t=this.treeStage(node),yaw=t.yaw||0,dx=Math.sin(yaw),dz=Math.cos(yaw),length=TRUNK_LENGTH;
    const endY=this.sample(node.x+dx*length,node.z+dz*length)+.18;
    const angle=Math.acos(clamp((endY-node.y-.28)/length,-.75,.75)),reach=length*Math.sin(angle);
    return {yaw,angle,x:node.x+dx*reach*.48,z:node.z+dz*reach*.48,y:this.sample(node.x+dx*reach*.48,node.z+dz*reach*.48),endX:node.x+dx*reach,endZ:node.z+dz*reach};
  }
  interactionNode(node){const t=this.treeStage(node);return node.type==='tree'&&['falling','fallen'].includes(t.phase)?{...node,...this.logPose(node),source:node}:node;}
  strikeTree(node,tool,player){
    if(!this.nodes.includes(node)||node.type!=='tree'||!this.available(node))return {ok:false,message:'木材已经收好了'};
    if(!matchesTool(tool,'axe')||!this.state.inventory[tool])return {ok:false,message:'需要装备石斧或铁斧 · B 打开背包'};
    const t=this.state.trees[node.id]??={phase:'standing',hits:0,yaw:0,fallStart:0};
    if(t.phase==='falling')return {ok:false,message:'树正在倒下，等落地后再劈'};
    if(t.phase==='fallen'&&t.hits===LOG_HITS-1&&!this.canFit(NODE_TYPES.tree.yield))return {ok:false,message:'背包装不下，先腾出格子再劈木'};
    t.hits++;this.changed();
    if(t.phase==='standing'&&t.hits===TREE_HITS){
      // Prefer away from the player; rotate away from sea, buildings, and other trunks.
      const wanted=player?Math.atan2(node.x-player.x,node.z-player.z):0;
      let best=-Infinity;
      for(let i=0;i<24;i++){
        const yaw=wanted+i*Math.PI/12,dx=Math.sin(yaw),dz=Math.cos(yaw);let score=Math.cos(yaw-wanted)*2;
        for(let j=1;j<=7;j++){const x=node.x+dx*j*.5,z=node.z+dz*j*.5,y=this.sample(x,z);score-=Math.abs(y-node.y)*2;if(y<.55)score-=25;if(this.state.buildings.some(b=>Math.hypot(x-b.x,z-b.z)<RECIPES[b.type].radius+.4))score-=50;if(this.nodes.some(n=>n!==node&&n.type==='tree'&&this.available(n)&&Math.hypot(x-n.x,z-n.z)<.6))score-=30;}
        if(score>best){best=score;t.yaw=Math.atan2(dx,dz);}
      }
      t.phase='falling';t.hits=0;t.fallStart=this.state.elapsed;
      return {ok:true,phase:'falling',message:'树倒下了 · 等它落地，再靠近劈成木材'};
    }
    if(t.phase==='fallen'&&t.hits===LOG_HITS){this.state.depleted[node.id]=true;delete this.state.trees[node.id];this.add(NODE_TYPES.tree.yield);this.state.goals.gather=true;return {ok:true,phase:'split',message:'木材 +4 · 纤维 +2 · 椰子 +1'};}
    return {ok:true,phase:t.phase,message:t.phase==='standing'?`砍伐 ${t.hits}/${TREE_HITS}`:`劈木 ${t.hits}/${LOG_HITS}`};
  }
  harvest(node,tool='hand'){
    if(!this.nodes.includes(node)||!this.available(node))return {ok:false,message:'这里已经采集过了'};
    const rule=NODE_TYPES[node.type];
    if(rule.tool&&(!matchesTool(tool,rule.tool)||!this.state.inventory[tool]))return {ok:false,message:`需要装备${ITEMS[rule.tool].name}`};
    if(node.type==='tree')return {ok:false,message:'先挥斧砍倒树，再劈开地上的倒木'};
    if(node.type==='spring'){if(tool==='flask'&&this.state.inventory.flask){if(!this.canFit({water:1},{flask:1}))return {ok:false,message:'背包已满'};this.spend({flask:1});this.add({water:1});return {ok:true,message:'水壶已装满清水'};}this.state.vitals.water=100;this.changed();return {ok:true,message:'喝了一口清泉 · 水分已补满'};}
    if(!this.canFit(rule.yield))return {ok:false,message:'背包装不下，先腾出格子再采集'};
    this.state.depleted[node.id]=rule.renew?this.state.elapsed+rule.renew:true;
    this.add(rule.yield);this.state.goals.gather=true;
    return {ok:true,message:Object.entries(rule.yield).map(([k,n])=>`${ITEMS[k].name} +${n}`).join(' · ')};
  }
  craft(id,position){
    const r=RECIPES[id];if(!r||r.build)return {ok:false,message:'请在陆地上选择建造位置'};
    if(['axe','pickaxe','torch'].includes(id)&&this.state.inventory[id])return {ok:false,message:'已经有这件工具了'};
    if(this.state.inventory[id]>=999)return {ok:false,message:'背包里已经装满了这种物品'};
    if(r.station&&!this.near(r.station,position,3.5))return {ok:false,message:`需要靠近${RECIPES[r.station].name}`};
    if(!this.canAfford(r.cost))return {ok:false,message:'材料还不够，红色数字是缺少的材料'};
    if(!this.canFit({[id]:r.amount||1},r.cost))return {ok:false,message:'背包空间不足，先腾出格子'};
    this.spend(r.cost);this.add({[id]:r.amount||1});if(id==='axe')this.state.goals.axe=true;
    return {ok:true,message:`做好了：${r.name}`};
  }
  near(type,p,d=3.5){return !!p&&this.state.buildings.some(b=>b.type===type&&Math.hypot(b.x-p.x,b.z-p.z)<=d);}
  placement(type,x,z,p){
    const r=RECIPES[type];if(!r?.build)return '不能建造这个物品';
    if(!Number.isFinite(x)||!Number.isFinite(z)||Math.hypot(x,z)>(this.expanded?1e7:35))return '请选择有效的陆地位置';
    if(this.state.buildings.length>=(this.expanded?256:12))return '当前世界的设施数量已达上限';
    const radius=r.radius,y=this.sample(x,z),heights=[y];
    for(let i=0;i<8;i++)heights.push(this.sample(x+Math.cos(i*Math.PI/4)*radius,z+Math.sin(i*Math.PI/4)*radius));
    if(type==='boat'){if(y>-.5||y< -4||Math.max(...heights)>.05)return '木船需要放在岸边浅水中';}
    else{if(Math.min(...heights)<.55)return '太靠近海水，往岛内走一点';if(Math.max(...heights)-Math.min(...heights)>.55)return '地面太陡，换一块平地';}
    if(p&&Math.hypot(p.x-x,p.z-z)<radius+.7)return '离自己太近了';
    if(this.state.buildings.some(b=>Math.hypot(b.x-x,b.z-z)<radius+RECIPES[b.type].radius+.45))return '与营地设施重叠了';
    if(this.nodes.some(n=>this.available(n)&&['tree','spring'].includes(n.type)&&Math.hypot(n.x-x,n.z-z)<radius+(n.type==='tree'?.55:1.3)))return '这里有树木或淡水泉';
    if(this.nodes.some(n=>n.type==='tree'&&['falling','fallen'].includes(this.treeStage(n).phase)&&segmentDistance(x,z,n.x,n.z,this.logPose(n).endX,this.logPose(n).endZ)<radius+.3))return '先清理地上的倒木';
    if(!this.canAfford(r.cost))return '建造材料不足';
    return '';
  }
  build(type,x,z,yaw,p){
    const reason=this.placement(type,x,z,p);if(reason)return {ok:false,message:reason};
    this.spend(RECIPES[type].cost);
    this.state.nextBuilding=Math.max(this.state.nextBuilding||0,0,...this.state.buildings.map(b=>Number(b.id.slice(1))+1));
    const b={id:`b${this.state.nextBuilding++}`,type,x,z,y:type==='boat'?-.19:this.sample(x,z),yaw:Number.isFinite(yaw)?yaw:0};
    this.state.buildings.push(b);this.state.goals[type]=true;if(type==='shelter')this.state.camp=b.id;this.changed();
    return {ok:true,message:`${RECIPES[type].name}建好了`,building:b};
  }
  dismantle(id,p){
    const s=this.state,b=s.buildings.find(v=>v.id===id);
    if(!b)return {ok:false,message:'这处设施已经不存在了'};
    if(!p||![p.x,p.z,p.feet].every(Number.isFinite)||Math.hypot(p.x-b.x,p.z-b.z)>3||Math.abs(p.feet-b.y)>1.9)return {ok:false,message:'需要靠近要拆除的设施'};
    if(b.owner||p.vehicle===id)return {ok:false,message:'船上有人，先停泊离船再拆除'};
    const refund=dismantleRefund(b.type);
    if(!this.canFit(refund))return {ok:false,message:'背包装不下返还材料，请先腾出空间'};
    if(!this.add(refund))return {ok:false,message:'材料无法放入背包，设施已保留'};
    s.buildings=s.buildings.filter(v=>v.id!==id);if(s.camp===id)s.camp=null;this.changed();
    return {ok:true,message:`已拆除${RECIPES[b.type].name} · `+Object.entries(refund).map(([k,n])=>`${ITEMS[k].name} +${n}`).join(' · '),refund};
  }
  eat(id){
    const item=ITEMS[id],s=this.state;if(!(item?.food||item?.water||item?.health)||s.inventory[id]<1)return {ok:false,message:'没有可使用的消耗品'};
    if((!item.food||s.vitals.food>=100)&&(!item.water||s.vitals.water>=100)&&(!item.health||s.vitals.health>=100))return {ok:false,message:'目前不需要，留着稍后使用吧'};
    if(id==='water'&&!this.canFit({flask:1},{water:1}))return {ok:false,message:'需要留一个空水壶的位置'};
    this.spend({[id]:1});if(id==='water')this.add({flask:1});s.vitals.food=Math.min(100,s.vitals.food+(item.food||0));s.vitals.water=Math.min(100,s.vitals.water+(item.water||0));s.vitals.health=Math.min(100,s.vitals.health+(item.health||0));
    if(id==='meal')s.goals.meal=true;this.changed();return {ok:true,message:`使用了${item.name} · ${item.note}`};
  }
  rest(building){
    const s=this.state;if(!s.buildings.includes(building)||building.type!=='shelter')return {ok:false,message:'需要自己的叶棚'};
    s.camp=building.id;
    if(s.elapsed-s.restsAt<120)return {ok:false,message:`再过 ${Math.ceil(120-(s.elapsed-s.restsAt))} 秒就可以休息了`};
    if(s.vitals.food<15||s.vitals.water<15)return {ok:false,message:'先吃点东西、补充水分再休息'};
    if(s.vitals.health>=100){this.changed();return {ok:true,message:'这里已设为营地 · 现在精神很好'};}
    s.vitals.health=Math.min(100,s.vitals.health+35);s.vitals.food-=10;s.vitals.water-=10;s.restsAt=s.elapsed;this.changed();
    return {ok:true,message:'休息片刻 · 健康 +35，饱食与水分各 −10'};
  }
  tick(dt,active){
    if(!active)return null;dt=clamp(dt,0,.25);const s=this.state;s.elapsed+=dt;
    for(const t of Object.values(s.trees))if(t.phase==='falling'&&s.elapsed-t.fallStart>=FALL_SECONDS){t.phase='fallen';this.changed();}
    s.vitals.food=Math.max(0,s.vitals.food-dt*.035);s.vitals.water=Math.max(0,s.vitals.water-dt*.055);
    if(s.vitals.food===0||s.vitals.water===0)s.vitals.health=Math.max(0,s.vitals.health-dt*.6);
    if(s.vitals.health<=0){
      s.vitals={health:60,food:45,water:55};const b=s.buildings.find(b=>b.id===s.camp);
      let respawn={x:0,z:4};
      if(b)for(let i=0;i<8;i++){const p={x:b.x+Math.cos(i*Math.PI/4)*2.2,z:b.z+Math.sin(i*Math.PI/4)*2.2};if(this.sample(p.x,p.z)>.55&&!this.nodes.some(n=>n.type==='tree'&&this.available(n)&&Math.hypot(n.x-p.x,n.z-p.z)<.7)&&!s.buildings.some(v=>Math.hypot(v.x-p.x,v.z-p.z)<RECIPES[v.type].radius+.35)){respawn=p;break;}}
      this.changed();return {respawn,message:'体力耗尽，已回到营地休息 · 物品保留'};
    }
    return null;
  }
}
