import * as THREE from 'three';

// The same live island, rendered through an independent presentation pose.
// PlayerBody is never teleported by opening or leaving the title screen.
export function createTitleCamera(camera){
  const pose=new THREE.PerspectiveCamera(),target=new THREE.Vector3(),offset=new THREE.Vector3();
  let blend=1,lastTitle=true,transition=1;
  return {
    scale:1,
    update(dt,time,title,reduced,anchor={x:0,z:0}){
      if(title!==lastTitle){transition=0;lastTitle=title;}
      transition=Math.min(1,transition+dt/1.05);
      const eased=transition*transition*(3-2*transition);
      blend=reduced?(title?1:0):(title?eased:1-eased);
      if(blend<.0001){if(camera.fov!==68){camera.fov=68;camera.updateProjectionMatrix();}return;}
      const narrow=camera.aspect<1.15;
      // Keep the island clear of the left-hand title and menu in widescreen.
      target.set(narrow?0:-12,narrow?2:0,narrow?0:7);
      target.x+=anchor.x;target.z+=anchor.z;
      const turn=reduced?0:Math.sin(time*.035)*.035;
      offset.set(29*Math.cos(turn)+42*Math.sin(turn),33,42*Math.cos(turn)-29*Math.sin(turn));
      offset.multiplyScalar(this.scale);
      if(narrow)offset.multiplyScalar(1.21);
      if(camera.aspect<.65)offset.multiplyScalar(.8/Math.max(.4,camera.aspect));
      pose.position.copy(target).add(offset);pose.lookAt(target);
      camera.position.lerp(pose.position,blend);camera.quaternion.slerp(pose.quaternion,blend);
      const fov=68+(45-68)*blend;if(Math.abs(camera.fov-fov)>.001){camera.fov=fov;camera.updateProjectionMatrix();}
    }
  };
}
