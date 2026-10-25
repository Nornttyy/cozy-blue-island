import * as THREE from 'three';

// The exported axe has its handle on +Y and its cutting edge on +X.
// Camera-forward is -Z. Keep this fixed mounting correction separate from
// the wrist swing so the blade, not the broad cheek, leads the strike.
export const AXE_GRIP_Y=-.20;
export const AXE_MOUNT_YAW=2.20;
export function createAxeViewmodel(model){
  const wrist=new THREE.Group(),mount=new THREE.Group();
  wrist.name='Axe_Wrist';mount.name='Axe_Forward_Mount';
  model.position.set(0,-AXE_GRIP_Y,0);mount.rotation.y=AXE_MOUNT_YAW;
  mount.add(model);wrist.add(mount);wrist.scale.setScalar(.7);
  poseAxe(wrist,16/9);return wrist;
}
export function poseAxe(wrist,aspect,phase=null){
  const p=phase===null?0:Math.max(0,Math.min(1,phase));
  const swing=p<.3?-Math.sin(p/.3*Math.PI/2)*.55:p<.45?-.55+(p-.3)/.15*1.35:.8*(1-(p-.45)/.55)**2;
  wrist.position.set(Math.min(.36,.26*aspect)-Math.max(0,swing)*.30,-.44+Math.min(0,swing)*.08+Math.max(0,swing)*.14,-.72-Math.max(0,swing)*.22);
  wrist.rotation.set(-swing,0,-.28-swing*.20,'XYZ');
}
