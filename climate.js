import * as THREE from 'three';
import {daylight,cloudCover,SUN_DIRECTION} from './atmosphere.js';
import {hashSeed,randomAt,smooth} from './world-seed.js';
export function climateAt(seed,seconds){const day=seconds/900+8/24,hour=(day%1)*24,elevation=Math.sin((hour-6)/24*Math.PI*2),slot=Math.floor(seconds/170),roll=randomAt(hashSeed(seed),slot,41),kind=slot===0?'晴天':roll<.42?'晴天':roll<.68?'多云':roll<.9?'阵雨':'风雨';return {hour,day:Math.floor(day)+1,elevation,light:.025+.975*smooth(-.15,.25,elevation),cloud:{晴天:0,多云:.48,阵雨:.72,风雨:.9}[kind],rain:{晴天:0,多云:0,阵雨:.55,风雨:1}[kind],kind};}
export function createClimate(scene,sun,fill,hemisphere,math,survival){
 const count=220,positions=new Float32Array(count*6),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const material=new THREE.LineBasicMaterial({color:'#d4e7f4',transparent:true,opacity:0,depthWrite:false}),rain=new THREE.LineSegments(geometry,material);rain.frustumCulled=false;scene.add(rain);let wet=0,lastLabel='';
 return {update(dt,time,p){const c=climateAt(math.seed,survival.game.state.elapsed),ease=1-Math.exp(-dt*.18);daylight.value+=(c.light-daylight.value)*ease;cloudCover.value+=(c.cloud-cloudCover.value)*ease;wet+=(c.rain-wet)*ease;
   const angle=(c.hour-6)/24*Math.PI*2;SUN_DIRECTION.set(Math.cos(angle)*.65,Math.sin(angle),.4).normalize();
   sun.intensity=(.12+2.68*daylight.value)*(1-cloudCover.value*.65);sun.color.set(daylight.value<.55?'#ffd2a1':'#fff4dc');hemisphere.intensity=.18+1.12*daylight.value;fill.intensity=.1+.5*daylight.value;scene.environmentIntensity=.045+.235*daylight.value;
   if(scene.fog){scene.fog.color.setRGB(.045+daylight.value*.56,.075+daylight.value*.72,.13+daylight.value*.75);scene.fog.near=math.generation>=17?110-wet*55:85;scene.fog.far=math.generation>=17?370-wet*210:120;}
   rain.visible=wet>.02&&p.mode!=='dive';material.opacity=wet*.48;
   if(rain.visible){for(let i=0;i<count;i++){const a=i*6,x=p.x+Math.sin(i*31.7)*14,z=p.z+Math.cos(i*19.3)*14,y=p.feet+((i*.711-time*13)%18+18)%18;positions.set([x,y,z,x+.12+wet*.15,y-.65,z+.08],a);}geometry.attributes.position.needsUpdate=true;}
   const label=`第 ${c.day} 天 · ${String(Math.floor(c.hour)).padStart(2,'0')}:${String(Math.floor(c.hour%1*60)).padStart(2,'0')} · ${c.kind}`;
   if(label!==lastLabel){lastLabel=label;const el=document.querySelector('.environment > span');if(el)el.textContent=label;}
   document.documentElement.dataset.climate=JSON.stringify({hour:+c.hour.toFixed(2),weather:c.kind,light:+daylight.value.toFixed(2)});
   return wet;
 }};
}
