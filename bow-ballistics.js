import {wildlifeIn,animalPose,SPECIES,provoke} from './wildlife-math.js';
import {CHUNK} from './world-seed.js';
export const DRAW_SECONDS=1.2,ARROW_GRAVITY=14,MAX_FLIGHT=4;
export const bowPower=seconds=>{const charge=Math.max(0,Math.min(1,(Number(seconds)||0)/DRAW_SECONDS));return {charge,speed:7+27*charge,damage:Math.round(5+27*charge*charge)};};
export function arrowPoint(shot,t){return {x:shot.origin.x+shot.velocity.x*t,y:shot.origin.y+shot.velocity.y*t-.5*ARROW_GRAVITY*t*t,z:shot.origin.z+shot.velocity.z*t};}
export function arrowVelocity(shot,t){return {x:shot.velocity.x,y:shot.velocity.y-ARROW_GRAVITY*t,z:shot.velocity.z};}
const distanceToSegment=(p,a,b)=>{const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},l=d.x*d.x+d.y*d.y+d.z*d.z,t=Math.max(0,Math.min(1,((p.x-a.x)*d.x+(p.y-a.y)*d.y+(p.z-a.z)*d.z)/(l||1)));return Math.hypot(p.x-a.x-d.x*t,p.y-a.y-d.y*t,p.z-a.z-d.z*t);};
export function makeShot(p,seconds,start=0){const power=bowPower(seconds),pitch=Math.max(-1.35,Math.min(1.25,p.pitch||0)),cos=Math.cos(pitch),direction={x:-Math.sin(p.yaw)*cos,y:Math.sin(pitch),z:-Math.cos(p.yaw)*cos};return {...power,start,origin:{x:p.x+direction.x*.25,y:(Number.isFinite(p.eye)?p.eye:p.feet+1.62)-.10+direction.y*.25,z:p.z+direction.z*.25},velocity:{x:direction.x*power.speed,y:direction.y*power.speed,z:direction.z*power.speed}};}
// Swept collision at 120 Hz: no crosshair auto-hit and no tunnelling through small animals.
export function traceArrow(shot,math,dead={},obstacles=[]){
 const cached=new Map(),radius={Crab:.24,RazorCrab:.34,Rabbit:.30,Boar:.56,Viper:.34,Fish:.26},height={Crab:.18,RazorCrab:.24,Rabbit:.26,Boar:.45,Viper:.24,Fish:.16};let previous=shot.origin;
 for(let n=1;n<=MAX_FLIGHT*120;n++){const t=n/120,point=arrowPoint(shot,t),cx=Math.floor(point.x/CHUNK),cz=Math.floor(point.z/CHUNK);
  if(point.y<=math.sample(point.x,point.z)+.035)return {time:t,point,kind:'ground'};
  for(const b of obstacles){const r=b.type==='shelter'?1.1:b.type==='boat'?1.5:.65,h=b.type==='shelter'?2:b.type==='boat'?.6:1;if(point.y>b.y&&point.y<b.y+h&&Math.hypot(point.x-b.x,point.z-b.z)<r)return {time:t,point,kind:'wood'};}
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const key=(cx+i)+','+(cz+j);if(!cached.has(key))cached.set(key,wildlifeIn(math,cx+i,cz+j));for(const a of cached.get(key)){if(dead[a.id]===0)continue;const pos=animalPose(a,shot.start+t,math);if(distanceToSegment({x:pos.x,y:pos.y+height[a.type],z:pos.z},previous,point)<radius[a.type])return {time:t,point,kind:'animal',target:a.id,type:a.type};}}
  previous=point;
 }
 return {time:MAX_FLIGHT,point:previous,kind:'miss'};
}
export function releaseArrow(game,math,p,seconds){
 if(!game.state.inventory.bow)return {ok:false,message:'先把弓放进快捷栏'};
 if(!game.state.inventory.arrow)return {ok:false,message:'箭矢用完了，打开制作页补充'};
 if(!Number.isFinite(seconds)||seconds<.06)return {ok:false,message:''};
 const shot=makeShot(p,seconds,game.state.elapsed);shot.id='arrow'+(game.state.nextArrow||0);shot.impact=traceArrow(shot,math,game.state.wildlife,game.state.buildings);
 if(!game.spend({arrow:1}))return {ok:false,message:'箭矢用完了'};
 game.state.nextArrow=(game.state.nextArrow||0)+1;game.state.arrows??=[];game.state.arrows.push(shot);game.changed();return {ok:true,shot};
}
export function resolveArrows(game){
 const s=game.state,messages=[];let changed=false;
 for(const shot of s.arrows||[]){if(shot.resolved||s.elapsed<shot.start+shot.impact.time)continue;shot.resolved=true;changed=true;
  if(shot.impact.kind!=='animal')continue;
  const {target,type,point}=shot.impact,hp=s.wildlife[target]??SPECIES[type].hp;if(hp<=0)continue;
  if(hp<=shot.damage){const loot=game.spawnLoot(SPECIES[type].loot,point);if(!loot.ok){messages.push(loot.message);continue;}}
  s.wildlife[target]=Math.max(0,hp-shot.damage);if(s.wildlife[target]>0)provoke(game,target,type);else delete s.angered?.[target];
  if(s.wildlife[target]===0)messages.push('命中 · 战利品已落地，靠近后左键拾取');
  else messages.push('命中 '+shot.damage+' · '+SPECIES[type].name+'剩余 '+s.wildlife[target]+' 体力');
 }
 const kept=(s.arrows||[]).filter(a=>s.elapsed<a.start+a.impact.time+2);if(kept.length!==(s.arrows||[]).length){s.arrows=kept;changed=true;}
 if(changed)game.changed();return {changed,messages};
}
