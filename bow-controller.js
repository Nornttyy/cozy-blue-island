import * as THREE from 'three';
import {DRAW_SECONDS,bowPower,releaseArrow,resolveArrows,arrowPoint,arrowVelocity} from './bow-ballistics.js';
import {poseDrawnBow} from './equipment-viewmodel.js';
import {unlockBowAudio,bowSound} from './bow-audio.js';
export function createBowController(scene,camera,player,survival,math,view){
 let drawing=false,age=0,released=10,busy=false,generation=0,drawReady=Promise.resolve({ok:true});const flights=new Map();
 const meter=document.createElement('div');meter.className='bow-meter';meter.hidden=true;meter.innerHTML='<div><i></i></div><small>按住左键拉弓</small>';document.getElementById('game-hud')?.append(meter);
 const unit=new THREE.Vector3(0,1,0),direction=new THREE.Vector3(),shaft=new THREE.CylinderGeometry(.007,.007,.75,6),tip=new THREE.ConeGeometry(.022,.08,4),wood=new THREE.MeshStandardMaterial({color:'#9c7346',roughness:.7}),steel=new THREE.MeshStandardMaterial({color:'#737d7c',metalness:.55,roughness:.3}),feather=new THREE.MeshStandardMaterial({color:'#ebe1bf',side:THREE.DoubleSide,roughness:1});
 function model(){const g=new THREE.Group(),stick=new THREE.Mesh(shaft,wood),head=new THREE.Mesh(tip,steel);head.position.y=.40;g.add(stick,head);for(let i=0;i<3;i++){const fin=new THREE.Mesh(new THREE.PlaneGeometry(.07,.13),feather);fin.position.y=-.28;fin.rotation.y=i*Math.PI/3;g.add(fin);}scene.add(g);return g;}
 function cancel(){generation++;if(!drawing)return;drawing=false;age=0;meter.hidden=true;if(survival.networked)survival.requestAction('bowCancel',{},()=>({ok:true}));}
 function begin(){if(busy||drawing)return true;if(!survival.game.state.inventory.bow||!survival.game.state.inventory.arrow){survival.notify('需要弓和箭矢 · E 打开背包与制作');return true;}unlockBowAudio();drawing=true;age=0;released=10;generation++;const current=generation;drawReady=survival.networked?survival.requestAction('bowDraw',{},()=>({ok:true})):Promise.resolve({ok:true});drawReady.then(r=>{if(!r.ok&&generation===current){drawing=false;meter.hidden=true;}});return true;}
 async function release(){if(!drawing)return;const seconds=age;drawing=false;age=0;meter.hidden=true;if(!player.getState().active||survival.held()!=='bow'||seconds<.06){if(survival.networked)survival.requestAction('bowCancel',{},()=>({ok:true}));return;}
  busy=true;released=0;bowSound('release',bowPower(seconds).charge);
  const p={...player.getState(),eye:camera.position.y},ticket=generation;try{const ready=await drawReady;if(!ready.ok||ticket!==generation||!player.getState().active||survival.held()!=='bow'){released=10;return;}const r=await survival.requestAction('bowShoot',{seconds},()=>releaseArrow(survival.game,math,p,seconds),p);if(!r.ok)released=10;}finally{busy=false;}
 }
 window.addEventListener('island:primary-up',release);window.addEventListener('island:tool-change',cancel);window.addEventListener('island:cancel-build',cancel);window.addEventListener('island:activity',()=>{if(!player.getState().active)cancel();});window.addEventListener('blur',cancel);
 return {begin,cancel,get drawing(){return drawing;},get charge(){return bowPower(age).charge;},update(dt,time){
  const active=player.getState().active,held=survival.held()==='bow';if(!active||!held)cancel();if(drawing)age=Math.min(DRAW_SECONDS,age+dt);released+=dt;
  const q=bowPower(age).charge;meter.hidden=!active||!held;meter.classList.toggle('ready',q>=.99);meter.querySelector('i').style.width=q*100+'%';meter.querySelector('small').textContent=busy?'正在搭箭':drawing?q>=.99?'满弓 · 松手射出':'松手射出 · 右键取消':'按住左键蓄力';
  if(held)poseDrawnBow(view,camera.aspect,q,released,survival.game.state.inventory.arrow>0,time);
  if(!survival.networked&&active){const r=resolveArrows(survival.game);if(r.changed){survival.save();window.dispatchEvent(new Event('island:inventory'));for(const m of r.messages)survival.notify(m);}}
  const elapsed=survival.game.state.elapsed;
  for(const shot of survival.game.state.arrows||[]){if(!flights.has(shot.id)&&elapsed<shot.start+shot.impact.time+1.5)flights.set(shot.id,{shot,g:model(),hit:false});}
  for(const [id,f]of flights){const t=Math.max(0,elapsed-f.shot.start),impact=f.shot.impact,at=Math.min(t,impact.time),pos=arrowPoint(f.shot,at),v=arrowVelocity(f.shot,at);f.g.position.set(pos.x,pos.y,pos.z);f.g.quaternion.setFromUnitVectors(unit,direction.set(v.x,v.y,v.z).normalize());
   if(t>=impact.time&&!f.hit){f.hit=true;if(active){bowSound('impact');if(impact.kind==='animal')document.getElementById('reticle')?.animate?.([{transform:'scale(2)',background:'#fff3b0'},{transform:'scale(1)',background:'#fff7'}],{duration:180});}}
   f.g.visible=impact.kind!=='animal'||t<impact.time+.1;
   if(t>impact.time+1.4){f.g.removeFromParent();flights.delete(id);}
  }
  document.documentElement.dataset.bow=JSON.stringify({drawing,charge:q,arrows:survival.game.state.inventory.arrow,flights:flights.size});
 }};
}
