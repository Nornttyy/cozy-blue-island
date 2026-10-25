import {hashSeed,randomAt,smooth,CHUNK} from './world-seed.js';
import {SPRING,springDistance,springBedHeight} from './spring-math.js';
export const BIOMES=[
 {name:'椰风海岸',tint:[.23,.48,.10]}, {name:'花甸丘陵',tint:[.19,.42,.07]},
 {name:'松林高地',tint:[.07,.24,.12]}, {name:'赤岩荒岛',tint:[.56,.26,.11]},
 {name:'雾湾湿地',tint:[.10,.32,.19]}, {name:'霜顶山岛',tint:[.68,.79,.75]}
];
export function createVoyageMath(text){
 const seed=hashSeed(text),cell=210,cache=new Map();
 function island(cx,cz){const key=cx+','+cz;if(cache.has(key))return cache.get(key);const r=s=>randomAt(seed,cx,cz,s),home=!cx&&!cz;
  const biome=home?0:Math.floor(r(7)*6),a={x:home?0:cx*cell+(r(1)-.5)*32,z:home?0:cz*cell+(r(2)-.5)*32,rx:home?47:34+r(3)*18,rz:home?42:32+r(4)*18,phase:r(5)*6.28,height:home?10:biome===5?28:biome===2?22:biome===4?8:13+r(6)*9,biome,cx,cz};
  if(cache.size>196)cache.delete(cache.keys().next().value);cache.set(key,a);return a;
 }
 function nearest(x,z){return island(Math.round(x/cell),Math.round(z/cell));}
 function raw(x,z){const a=nearest(x,z),dx=x-a.x,dz=z-a.z,angle=Math.atan2(dz,dx),shape=1+.08*Math.sin(angle*3+a.phase)+.035*Math.sin(angle*7-a.phase),r=Math.hypot(dx/a.rx,dz/a.rz)/shape,shore=(1-r)*Math.min(a.rx,a.rz);
  const hill=!a.cx&&!a.cz?a.height*smooth(5,18,shore)*(1-smooth(0,26,Math.hypot(dx-18,dz+14))):a.height*smooth(7,35,shore)*(.72+.28*Math.sin(dx*.095+a.phase)*Math.sin(dz*.085));
  let h=shore<0?-Math.min(21,Math.pow(-shore,.91)*.48):Math.min(1.6,shore*.27)+hill;
  // A winding gentler ridge provides a traversable ascent; surrounding slopes are steeper.
  if(shore>8){const path=Math.abs(dx-Math.sin(dz*.065+a.phase)*8);h-=a.height*.16*(1-smooth(2,7,path))*smooth(8,26,shore);}
  const d=Math.hypot(x,z-3),t=smooth(11,20,d);h=h*t+1.45*(1-t);return h;
 }
 const base=raw(SPRING.x,SPRING.z),vertex=(x,z)=>{const r=springDistance(x,z),h=raw(x,z);return r<1.5?Math.min(h,base-.62+.58*smooth(.55,1.08,r)):h;};
 function sample(x,z){const ix=Math.floor(x),iz=Math.floor(z),u=x-ix,v=z-iz,a=vertex(ix,iz),b=vertex(ix+1,iz),c=vertex(ix,iz+1),d=vertex(ix+1,iz+1);let h=u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);const r=springDistance(x,z);if(r<1.18)h=Math.max(h,base+springBedHeight(r));return h;}
 function nodes(cx,cz){const list=[];for(let i=0;i<32;i++){const x=(cx+randomAt(seed,cx,cz,100+i*3))*CHUNK,z=(cz+randomAt(seed,cx,cz,101+i*3))*CHUNK,y=sample(x,z),a=nearest(x,z);if(Math.hypot(x,z)<11||y<.25||Math.max(Math.abs(sample(x+.5,z)-sample(x-.5,z)),Math.abs(sample(x,z+.5)-sample(x,z-.5)))>.8)continue;
   const choices=a.biome===3?['stone','copperore','ironore','flint','salt','wood','fiber']:a.biome===5?['stone','ironore','flint','tree','herb']:a.biome===4?['tree','fiber','clay','herb','mushroom','wood']:['tree','tree','wood','fiber','stone','berry','herb','flint','mushroom','copperore'];
   let type=y<.7?'shell':choices[Math.floor(randomAt(seed,cx,cz,102+i*3)*choices.length)];if(y>9&&i%3===0)type='ironore';if(list.some(n=>Math.hypot(x-n.x,z-n.z)<2.2))continue;list.push({id:`c${cx},${cz}:${i}`,type,x,z,y,biome:a.biome});
  }return list;}
 return {seed:text,generation:17,cell,raw,vertex,sample,nodes,island,nearest,biome:(x,z)=>BIOMES[nearest(x,z).biome].name,tint:(x,z)=>BIOMES[nearest(x,z).biome].tint,anchor:{...SPRING,base,waterY:base+.025,layoutSample:raw,changed:0}};
}
