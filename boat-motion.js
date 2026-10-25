import {surfaceHeight} from './water-math.js';
export function advanceBoat(boat,input,delta,sample,time,motion){
  const dt=Math.min(.08,Math.max(0,delta));
  const throttle=Math.max(-1,Math.min(1,input.forward||0));
  motion.speed+=(throttle*6.4-motion.speed)*(1-Math.exp(-dt*(throttle?2.8:1.4)));
  // Positive yaw turns a -Z-facing vessel left; D must turn it right.
  boat.yaw-=(input.side||0)*dt*1.15;
  const dx=-Math.sin(boat.yaw)*motion.speed*dt,dz=-Math.cos(boat.yaw)*motion.speed*dt;
  const nx=boat.x+dx,nz=boat.z+dz;
  if(sample(nx,nz)<-.42&&sample(nx-Math.sin(boat.yaw)*1.5,nz-Math.cos(boat.yaw)*1.5)<-.2){boat.x=nx;boat.z=nz;}
  else motion.speed=0;
  boat.sailing=Math.abs(motion.speed)>.12;boat.y=surfaceHeight(boat.x,boat.z,time,-sample(boat.x,boat.z)*3)-.19;
  return {x:boat.x,z:boat.z,y:boat.y+.24,speed:Math.abs(motion.speed)};
}
export function poseBoat(model,boat,time){
  const wave=(side,forward)=>surfaceHeight(boat.x+Math.cos(boat.yaw)*side-Math.sin(boat.yaw)*forward,boat.z-Math.sin(boat.yaw)*side-Math.cos(boat.yaw)*forward,time,4);
  model.rotation.set(Math.max(-.07,Math.min(.07,(wave(0,1)-wave(0,-1))*.35)),boat.yaw,Math.max(-.06,Math.min(.06,(wave(1,0)-wave(-1,0))*.25)));
  for(const name of ['Oar_L','Oar_R']){const o=model.getObjectByName(name);if(!o)continue;const sign=name==='Oar_L'?1:-1;
    o.rotation.y=boat.sailing?Math.sin(time*3)*sign*.48:0;o.rotation.z=boat.sailing?Math.max(0,Math.cos(time*3))*sign*.12:0;
  }
}
