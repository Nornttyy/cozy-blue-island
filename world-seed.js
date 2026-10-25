// Deterministic world math. Rendering and collision sample the same triangle grid.
import {SPRING,springDistance,springBedHeight} from './spring-math.js';
import {createVoyageMath} from './world-v17.js';
export const CHUNK=32,STEP=1,ISLAND_CELL=90;
export const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function hashSeed(text){let h=2166136261;for(const c of String(text)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
export function randomAt(seed,x,z,salt=0){let h=seed^Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(salt,1597334677);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
function noise(seed,x,z){const ix=Math.floor(x),iz=Math.floor(z),u=smooth(0,1,x-ix),v=smooth(0,1,z-iz),r=(a,b)=>randomAt(seed,a,b);return (r(ix,iz)*(1-u)+r(ix+1,iz)*u)*(1-v)+(r(ix,iz+1)*(1-u)+r(ix+1,iz+1)*u)*v;}
export function createWorldMath(seedText,legacySample=null,options={}){
 if(options.generation>=17&&!legacySample)return createVoyageMath(seedText);
 const seed=hashSeed(seedText),cache=new Map();
 function island(cx,cz){const key=cx+','+cz;if(cache.has(key))return cache.get(key);const r=s=>randomAt(seed,cx,cz,s),home=cx===0&&cz===0;
   const i={x:home?0:cx*ISLAND_CELL+(r(1)-.5)*22,z:home?0:cz*ISLAND_CELL+(r(2)-.5)*22,rx:home?27+r(3)*8:19+r(3)*17,rz:home?23+r(4)*8:18+r(4)*15,phase:r(5)*6.28,height:1.3+r(6)*2.2,biome:Math.floor(r(7)*3)};
   if(cache.size>160)cache.delete(cache.keys().next().value);cache.set(key,i);return i;
 }
 function raw(x,z){
   let h=-9-noise(seed+4,x*.022,z*.022)*3;const cx=Math.round(x/ISLAND_CELL),cz=Math.round(z/ISLAND_CELL);
   for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
     const a=island(cx+i,cz+j),dx=x-a.x,dz=z-a.z,angle=Math.atan2(dz,dx),shape=1+.10*Math.sin(angle*3+a.phase)+.055*Math.sin(angle*5-a.phase);
     const radius=Math.sqrt((dx/a.rx)**2+(dz/a.rz)**2)/shape,shore=(radius-1)*Math.min(a.rx,a.rz);
     const land=shore>0?-Math.min(11,shore*.55):Math.min(1.4,-shore*.26)+a.height*smooth(4,18,-shore)*(.35+.65*noise(seed, x*.075,z*.075));h=Math.max(h,land);
   }
   // Safe, softly blended landing clearing; island shape is still seed-dependent.
   const d=Math.hypot(x,z-3);h=h*(smooth(7,13,d))+1.45*(1-smooth(7,13,d));
   if(legacySample){const t=smooth(42,64,Math.hypot(x,z));h=legacySample(x,z)*(1-t)+h*t;}
   return h;
 }
 const base=raw(SPRING.x,SPRING.z);
 const vertex=(x,z)=>{const r=springDistance(x,z),h=raw(x,z);return r<1.5?Math.min(h,base-.62+.58*smooth(.55,1.08,r)):h;};
 function sample(x,z){const ix=Math.floor(x/STEP)*STEP,iz=Math.floor(z/STEP)*STEP,u=(x-ix)/STEP,v=(z-iz)/STEP,a=vertex(ix,iz),b=vertex(ix+STEP,iz),c=vertex(ix,iz+STEP),d=vertex(ix+STEP,iz+STEP);let h=u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);const r=springDistance(x,z);if(r<1.18)h=Math.max(h,base+springBedHeight(r));return h;}
 function nodes(cx,cz){const list=[];for(let i=0;i<18;i++){
   const x=(cx+randomAt(seed,cx,cz,100+i*3))*CHUNK,z=(cz+randomAt(seed,cx,cz,101+i*3))*CHUNK,y=raw(x,z);
   if(Math.hypot(x,z)<(legacySample?37:10)||y<.3||y>3.6)continue;
   if(Math.abs(sample(x+.5,z)-sample(x-.5,z))>.45||Math.abs(sample(x,z+.5)-sample(x,z-.5))>.45)continue;
   const types=['tree','tree','wood','fiber','stone','berry','herb','flint','clay','mushroom'];let type=types[Math.floor(randomAt(seed,cx,cz,102+i*3)*types.length)];if(y<.65)type='shell';
   if(list.some(n=>Math.hypot(n.x-x,n.z-z)<1.8))continue;
   list.push({id:`c${cx},${cz}:${i}`,type,x,z,y:sample(x,z)});
 }return list;}
 return {seed:seedText,raw,vertex,sample,nodes,island,biome(x,z){return ['椰林海岸','碧绿草洲','岩石浅滩'][island(Math.round(x/ISLAND_CELL),Math.round(z/ISLAND_CELL)).biome];},anchor:{...SPRING,base,waterY:base+.025,layoutSample:raw,changed:0}};
}

const REGISTRY='cozy-island-worlds-v2',ACTIVE='cozy-island-active-world-v2';
export function readWorlds(storage){try{const a=JSON.parse(storage.getItem(REGISTRY)||'[]');return Array.isArray(a)?a.filter(w=>/^w[0-9a-z-]+$/.test(w.id)&&typeof w.seed==='string').slice(0,20):[];}catch{return [];}}
export function currentWorld(storage){const worlds=readWorlds(storage),active=storage.getItem(ACTIVE);return worlds.find(w=>w.id===active)||{id:'legacy',seed:'晴蓝旧营地',legacy:true};}
export function makeWorld(storage,text){const worlds=readWorlds(storage);if(worlds.length>=20)throw new Error('已保留 20 个世界，请继续已有营地');const bytes=new Uint32Array(2);crypto.getRandomValues(bytes);const seed=String(text||'海风-'+bytes[0].toString(36)).trim().slice(0,40),world={id:'w'+Date.now().toString(36)+'-'+bytes[1].toString(36),seed,generation:17};storage.setItem(REGISTRY,JSON.stringify([...worlds,world]));storage.setItem(ACTIVE,world.id);return world;}
export function selectWorld(storage,id){if(id!=='legacy'&&!readWorlds(storage).some(w=>w.id===id))throw new Error('世界不存在');storage.setItem(ACTIVE,id);}
