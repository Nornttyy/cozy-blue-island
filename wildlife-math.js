import {hashSeed,randomAt,CHUNK} from './world-seed.js';
import {ITEMS} from './survival-state.js';
export const SPECIES={
 Crab:{name:'沙蟹',hp:12,loot:{meat:1},scale:1},
 RazorCrab:{name:'礁甲蟹',hp:26,loot:{meat:2},scale:1,aggressive:true,notice:7.2,speed:1.7,attackRange:.92,damage:5,cooldown:1.55},
 Rabbit:{name:'草原兔',hp:18,loot:{meat:2},scale:1},
 Boar:{name:'野猪',hp:54,loot:{meat:3,hide:2},scale:1,retaliates:true,angerSeconds:14,notice:16,speed:3.2,attackRange:1.15,damage:8,cooldown:1.8},
 Viper:{name:'潮汐蛇',hp:32,loot:{meat:1,hide:1},scale:1,aggressive:true,notice:8.6,speed:2.25,attackRange:.78,damage:7,cooldown:1.35},
 Fish:{name:'海鱼',hp:8,loot:{fish:1},scale:1}
};
// Fish meshes extend .35m above their origin and .4m horizontally. Keep their
// complete orbit below the lowest wave trough (-.538m), not just its centre.
const habitats=new WeakMap();
export function fishHabitat(a,math){
 let cache=habitats.get(math);if(!cache){cache=new Map();habitats.set(math,cache);}const key=a.x+','+a.z;if(cache.has(key))return cache.get(key);
 let result=null;
 for(const radius of [2.8,1.8,.9,0]){
  let floor=-Infinity;
  for(let j=0;j<48;j++){const t=j*Math.PI/24,x=a.x+Math.cos(t)*radius,z=a.z+Math.sin(t)*radius;for(const [dx,dz] of [[0,0],[.5,0],[-.5,0],[0,.5],[0,-.5]])floor=Math.max(floor,math.sample(x+dx,z+dz));}
  if(floor< -1.3){result={radius,y:Math.min(-1.06,Math.max(-2.2,floor+.2))};break;}
 }
 if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
}
export function wildlifeIn(math,cx,cz){const list=[],seed=hashSeed(math.seed);for(let i=0;i<4;i++){const x=(cx+randomAt(seed,cx,cz,800+i*2))*CHUNK,z=(cz+randomAt(seed,cx,cz,801+i*2))*CHUNK,y=math.sample(x,z),r=randomAt(seed,cx,cz,850+i);let type=y< -1.3&&y>-8?'Fish':y>.25&&y<1.3?(r<.56?'Crab':'RazorCrab'):y>1.3&&y<18?(r<.54?'Rabbit':r<.82?'Boar':'Viper'):null;if(!type)continue;if(type!=='Fish'&&Math.abs(math.sample(x+2,z)-y)>1.2)continue;const a={id:`a${cx},${cz}:${i}`,type,x,z,y,phase:r*Math.PI*2};if(type==='Fish'&&!fishHabitat(a,math))continue;list.push(a);}return list;}
export function animalPose(a,elapsed,math){
 const t=elapsed*(a.type==='Fish'?.46:a.type==='Viper'?.28:.19)+a.phase;
 if(a.type==='Fish'){const h=fishHabitat(a,math);if(!h)return {x:a.x,z:a.z,y:-2,yaw:-t,hidden:true};return {x:a.x+Math.cos(t)*h.radius,z:a.z+Math.sin(t)*h.radius,y:h.y,yaw:-t};}
 const range=a.type==='Boar'?2.5:a.type==='Viper'?1.85:a.type==='RazorCrab'?1.5:1.2,x=a.x+Math.cos(t)*range,z=a.z+Math.sin(t)*range,land=math.sample(x,z);return {x:land>.2?x:a.x,z:land>.2?z:a.z,y:land>.2?land:a.y,yaw:-t};
}
export function provoke(game,id,type){const species=SPECIES[type];if(!species?.retaliates)return false;game.state.angered??={};game.state.angered[id]=game.state.elapsed+species.angerSeconds;return true;}
export function isHostile(game,a){const species=SPECIES[a.type];return !!species&&(!!species.aggressive||!!species.retaliates&&Number(game.state.angered?.[a.id])>game.state.elapsed);}
// Chasers keep their short-lived local motion in `memory`, while aggression and
// hit points are still saved by the game state. That makes the next encounter
// feel alive without creating teleporting, permanently saved coordinates.
export function hostilePose(a,elapsed,math,game,player,memory,dt){
 const idle=animalPose(a,elapsed,math),species=SPECIES[a.type];if(!isHostile(game,a))return {pose:idle,memory:null,canStrike:false};
 const prior=memory?.pose||idle,dx=player.x-prior.x,dz=player.z-prior.z,distance=Math.hypot(dx,dz),canNotice=distance<=species.notice;
 if(!canNotice&&species.aggressive)return {pose:idle,memory:null,canStrike:false};
 const yaw=Math.atan2(dx,dz),stop=species.attackRange*.72,step=distance>stop?Math.min(distance-stop,species.speed*Math.max(0,dt)):0;
 let x=prior.x+Math.sin(yaw)*step,z=prior.z+Math.cos(yaw)*step,y=math.sample(x,z);
 if(y<=.2){x=prior.x;z=prior.z;y=math.sample(x,z);}
 const pose={x,z,y,yaw};return {pose,memory:{pose},canStrike:distance<=species.attackRange&&Math.abs(player.feet-y)<1.25};
}
export function hunt(game,math,id,tool,p){const item=ITEMS[tool];if(tool==='bow')return {ok:false,message:'弓需要按住蓄力，松手射出箭矢'};if(!item?.weapon||!game.state.inventory[tool])return {ok:false,message:'需要装备猎矛或铁斧'};const match=/^a(-?\d+),(-?\d+):(\d+)$/.exec(id);if(!match)return {ok:false,message:'目标无效'};const a=wildlifeIn(math,+match[1],+match[2]).find(v=>v.id===id);if(!a)return {ok:false,message:'目标不在这里'};const pos=animalPose(a,game.state.elapsed,math),dx=pos.x-p.x,dz=pos.z-p.z;if(Math.hypot(dx,dz)>item.range+1||Math.abs(pos.y-(p.feet||0))>5)return {ok:false,message:'太远了，靠近或换弓'};if(Math.hypot(dx,dz)>.8&&(dx*-Math.sin(p.yaw)+dz*-Math.cos(p.yaw))/Math.hypot(dx,dz)<.65)return {ok:false,message:'请瞄准目标'};
 game.state.wildlife??={};const hp=game.state.wildlife[id]??SPECIES[a.type].hp;if(hp<=0)return {ok:false,message:'已经捕获过了'};
 if(hp<=item.weapon){const loot=game.spawnLoot(SPECIES[a.type].loot,pos);if(!loot.ok)return loot;}
 if(tool==='bow'&&!game.spend({arrow:1}))return {ok:false,message:'箭矢用完了，按 B 制作'};
 game.state.wildlife[id]=Math.max(0,hp-item.weapon);if(hp>item.weapon)provoke(game,id,a.type);else delete game.state.angered?.[id];game.changed();if(hp<=item.weapon)return {ok:true,kill:true,message:'战利品已落地 · 靠近后左键拾取'};return {ok:true,message:SPECIES[a.type].name+(a.type==='Boar'?'被激怒了 · ': ' · ')+'剩余 '+(hp-item.weapon)+' 体力'};
}
