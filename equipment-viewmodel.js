import * as THREE from 'three';
import {createAxeViewmodel,poseAxe} from './axe-viewmodel.js';

export const WEAPON_TIMING={spear:{duration:.62,contact:.36},bow:{duration:.8,contact:.62},ironaxe:{duration:.62,contact:.45},ironpick:{duration:.64,contact:.45}};
const smooth=t=>{t=THREE.MathUtils.clamp(t,0,1);return t*t*(3-2*t);};
export function createEquipmentViewmodel(id,model){
  let g;
  if(id==='ironaxe'||id==='ironpick'){
    g=createAxeViewmodel(model);model.position.y=0;g.scale.setScalar(.78);
  }else{
    g=new THREE.Group();g.add(model);
    if(id==='spear')model.rotation.x=-1.38;
    else{
      // Bow limbs remain upright; curvature faces away from the player.
      model.rotation.y=1.12;
      g.userData.strings=[];model.traverse(o=>{if(o.isMesh&&/bowstring/i.test(o.name)){o.geometry=o.geometry.clone();g.userData.strings.push({mesh:o,rest:o.geometry.attributes.position.array.slice()});}});
      const arrow=new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.75,8),new THREE.MeshStandardMaterial({color:'#a9814d',roughness:.78}));
      arrow.name='Nocked_arrow';arrow.rotation.x=Math.PI/2;arrow.position.set(-.02,0,-.32);g.add(arrow);
    }
  }
  g.name='Equipment_'+id;g.userData.equipment=id;poseEquipment(g,16/9);return g;
}
export function poseEquipment(g,aspect,phase=null,time=0,speed=0){
  const id=g.userData.equipment,p=phase===null?0:THREE.MathUtils.clamp(phase,0,1),right=Math.min(.34,.24*aspect);
  if(id==='ironaxe'||id==='ironpick'){poseAxe(g,aspect,phase);}
  else if(id==='spear'){
    const thrust=p<.2?-.12*smooth(p/.2):p<.36?-.12+.68*smooth((p-.2)/.16):.56*(1-smooth((p-.36)/.64));
    g.position.set(right-thrust*.16,-.43,-1.00-thrust);g.rotation.set(0,0,-.09);
  }else{
    const draw=p<.62?smooth(p/.62):1-smooth((p-.62)/.38);
    g.position.set(right-.06,-.34,-.78+draw*.08);g.rotation.set(.03,0,-.10+draw*.045);
    const arrow=g.getObjectByName('Nocked_arrow');arrow.visible=phase===null||p<.62;arrow.position.z=-.32+draw*.13;
    for(const {mesh,rest}of g.userData.strings){const positions=mesh.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){const weight=Math.max(0,1-Math.abs(rest[i*3+1])/.61);positions.setX(i,rest[i*3]-draw*.14*weight);}positions.needsUpdate=true;
    }
  }
  // Tiny equipment-only weight shift. No head shake, camera lag, or visible hands.
  if(phase===null){const weight=Math.min(1,speed/3);g.position.x+=Math.sin(time*7)*.004*weight;g.position.y+=Math.cos(time*14)*.004*weight;}
}
