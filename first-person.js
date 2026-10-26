import {buildGroundSampler,PlayerBody} from './player-physics.js';
import {surfaceHeight} from './water-math.js';
import {createPointerLock} from './pointer-lock.js';
import {springDistance,springBedHeight} from './spring-math.js';

export function firstPerson(camera,canvas,terrain,seafloor,spring=null,world=null){
  const terrainSample=buildGroundSampler(terrain.geometry.attributes.position);
  const landSample=(x,z)=>{if(world)return world.sample(x,z);const r=spring?springDistance(x,z):Infinity;return Math.max(terrainSample(x,z),r<1.18?spring.base+springBedHeight(r): -Infinity);};
  const seaSample=buildGroundSampler(seafloor.geometry.attributes.position);
  const body=new PlayerBody((x,z)=>world?landSample(x,z):Math.max(landSample(x,z),seaSample(x,z)),(x,z,time)=>spring&&springDistance(x,z)<.97?spring.waterY:surfaceHeight(x,z,time,world?-world.sample(x,z)*3:undefined));if(world)body.worldLimit=Infinity;
  const keys=new Set(),$=id=>document.getElementById(id);
  let yaw=Math.PI,pitch=-.32,active=false,jump=false,eye=body.feet+body.eyeHeight;
  let locked=false,sensitivity=1,vehicle=null,landingAge=1,landingStrength=0,reducedMotion=false;
  let lastMode='';
  camera.rotation.order='YXZ';
  function hint(){
    const look='鼠标已锁定 · 移动鼠标转头';
    $('control-mode').textContent=body.swimming?'WASD 游动 · C 下潜 · 空格上浮 · E/B 背包 · Esc 暂停':`WASD 移动 · ${look} · 空格跳跃 · E/B 背包 · Esc 暂停`;
  }
  function syncGate(){
    $('reticle').hidden=!active;
    document.body.classList.toggle('walking',active);
    window.dispatchEvent(new CustomEvent('island:activity',{detail:{active}}));
    hint();
  }
  const capture=createPointerLock(canvas,document,status=>{
    active=status.active;locked=status.locked;
    keys.clear();jump=false;if(!active)body.vx=body.vz=0;
    document.documentElement.dataset.pointerLock=JSON.stringify(status);syncGate();
  });
  const pause=()=>capture.pause(),begin=()=>capture.begin();
  function look(dx,dy){yaw-=Math.max(-150,Math.min(150,dx))*.002*sensitivity;pitch=Math.max(-1.35,Math.min(1.25,pitch-dy*.002*sensitivity));}
  document.addEventListener('mousemove',e=>{if(active&&locked)look(e.movementX,e.movementY);});
  canvas.addEventListener('pointerdown',e=>{
    if(!active){if(e.button===0)begin();return;}
    if(e.button===0){e.preventDefault();window.dispatchEvent(new Event('island:primary'));}
    if(e.button===2){e.preventDefault();window.dispatchEvent(new Event('island:cancel-build'));}
  });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('pointerup',e=>{if(e.button===0)window.dispatchEvent(new Event('island:primary-up'));});
  document.addEventListener('pointercancel',()=>window.dispatchEvent(new Event('island:cancel-build')));
  document.addEventListener('keydown',e=>{
    if(e.code==='Escape'&&(active||capture.getState().pending)){pause();return;}
    if(!active)return;
    if(['KeyW','KeyA','KeyS','KeyD','KeyC','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight'].includes(e.code)){
      e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat)jump=true;
    }
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));
  window.addEventListener('blur',pause);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  function reset(shore=false){
    body.reset(shore?2:0,shore?10.4:4);yaw=Math.PI;pitch=shore?-.25:-.32;eye=body.feet+body.eyeHeight;
    keys.clear();jump=false;
    window.dispatchEvent(new Event('island:relocated'));
  }
  return {
    reset,begin,pause,consumeLandings:()=>body.consumeLandings(),setReducedMotion:value=>{reducedMotion=!!value;},
    setVehicle(value){vehicle=value;},
    setCollision(check){body.canMove=check;},
    pushFrom(x,z,strength=.9){if(vehicle||!Number.isFinite(x)||!Number.isFinite(z))return;const dx=body.x-x,dz=body.z-z,length=Math.hypot(dx,dz)||1;body.vx+=dx/length*strength;body.vz+=dz/length*strength;body.vy=Math.max(body.vy,.8);},
    restore(position){body.reset(position.x,position.z);yaw=Number.isFinite(position.yaw)?position.yaw:Math.PI;pitch=-.32;eye=body.feet+body.eyeHeight;keys.clear();jump=false;window.dispatchEvent(new Event('island:relocated'));},
    setSensitivity(value){sensitivity=Math.max(.5,Math.min(2,Number(value)||1));},
    sampleLand:landSample,
    getState(){const lock=capture.getState();return {x:body.x,z:body.z,feet:body.feet,eye:camera.position.y,yaw,pitch,active,locked,lockPending:lock.pending,lockError:lock.error,mode:vehicle?'sailing':body.mode,speed:Math.hypot(body.vx||0,body.vz||0),vehicle:vehicle?.id||null,boatYaw:vehicle?.heading?.()??yaw,grounded:body.grounded,depth:Math.max(0,body.waterLevel-camera.position.y)};},
    update(dt,time=0){
      const input={forward:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),side:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight'),descend:keys.has('KeyC'),ascend:keys.has('Space'),jump};
      if(vehicle){const p=vehicle.update(active?dt:0,input,yaw,time);if(p){body.x=p.x;body.z=p.z;body.feet=p.y;body.vx=p.speed||0;body.vz=0;body.swimming=false;body.waterLevel=0;}jump=false;}
      else if(active){const serial=body.landingSerial;body.update(dt,input,yaw,time);jump=false;if(body.landingSerial!==serial){landingAge=0;landingStrength=Math.min(.045,body.lastLanding.speed*.0035);}}
      landingAge+=dt;const dip=active&&!reducedMotion&&landingAge<.24?Math.sin(landingAge/.24*Math.PI)*landingStrength:0;
      eye+=(body.feet+(vehicle?1.05:body.eyeHeight)-eye)*(1-Math.exp(-(body.swimming?7:20)*dt));
      const minEye=vehicle?body.feet+.6:body.swimming?(body.diveDepth>.02?body.ground(body.x,body.z)+.35:body.waterLevel+.2):body.feet+1.3;
      camera.position.set(body.x,Math.max(minEye,eye-dip),body.z);
      camera.rotation.set(pitch,yaw,0);
      if(lastMode!==body.mode){hint();lastMode=body.mode;}
      document.documentElement.dataset.player=JSON.stringify({x:+body.x.toFixed(3),z:+body.z.toFixed(3),feet:+body.feet.toFixed(3),eye:+camera.position.y.toFixed(3),depth:+Math.max(0,body.waterLevel-camera.position.y).toFixed(2),mode:body.mode,yaw:+yaw.toFixed(3),pitch:+pitch.toFixed(3),active,locked,grounded:body.grounded,blocked:body.blocked});
    }
  };
}
