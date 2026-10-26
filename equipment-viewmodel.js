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
      model.rotation.y=Math.PI/2;
      g.userData.strings=[];model.traverse(o=>{if(o.isMesh&&/bowstring/i.test(o.name)){o.geometry=o.geometry.clone();g.userData.strings.push({mesh:o,rest:o.geometry.attributes.position.array.slice()});}});
      g.userData.limbs=[];model.traverse(o=>{if(o.isMesh&&/curved[_ ]bow/i.test(o.name)){o.geometry=o.geometry.clone();g.userData.limbs.push({mesh:o,rest:o.geometry.attributes.position.array.slice()});}});
      const arrow=new THREE.Group(),shaft=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.75,8),new THREE.MeshStandardMaterial({color:'#a9814d',roughness:.78}));shaft.rotation.x=Math.PI/2;arrow.add(shaft);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.019,.075,4),new THREE.MeshStandardMaterial({color:'#828c8a',metalness:.55,roughness:.3}));tip.rotation.x=-Math.PI/2;tip.position.z=-.405;arrow.add(tip);
      const featherGeometry=new THREE.BufferGeometry();featherGeometry.setAttribute('position',new THREE.Float32BufferAttribute([.006,0,.22,.031,0,.29,.025,0,.35,.006,0,.35],3));featherGeometry.setIndex([0,1,2,0,2,3]);featherGeometry.computeVertexNormals();
      const featherMaterial=new THREE.MeshStandardMaterial({color:'#ece0ba',side:THREE.DoubleSide,roughness:1});for(let i=0;i<3;i++){const fin=new THREE.Mesh(featherGeometry,featherMaterial);fin.rotation.z=i*Math.PI*2/3;arrow.add(fin);}
      arrow.name='Nocked_arrow';arrow.position.set(0,0,-.32);g.add(arrow);
    }
  }
  g.name='Equipment_'+id;g.userData.equipment=id;poseEquipment(g,16/9);return g;
}
export function poseDrawnBow(g,aspect,charge=0,releaseAge=10,hasArrow=true,time=0){
 const q=THREE.MathUtils.clamp(charge,0,1),snap=releaseAge<.25?Math.exp(-releaseAge*18)*Math.sin(releaseAge*65):0;
 const right=Math.min(.25,.18*aspect);
 g.position.set(right-q*.10,-.27+q*.10,-.86+q*.04-snap*.025);g.rotation.set(.015,0,-.10+q*.08+snap*.012);
 for(const {mesh,rest}of g.userData.limbs||[]){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const edge=Math.min(1,Math.abs(rest[i*3+1])/.59);p.setX(i,rest[i*3]-q*.11*edge*edge);}p.needsUpdate=true;mesh.geometry.computeVertexNormals();}
 for(const {mesh,rest}of g.userData.strings||[]){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const mid=Math.max(0,1-Math.abs(rest[i*3+1])/.58);p.setX(i,rest[i*3]-q*(.11+.21*mid)+snap*.025*mid);}p.needsUpdate=true;}
 const arrow=g.getObjectByName('Nocked_arrow');arrow.visible=hasArrow&&releaseAge>.25;arrow.position.set(0,0,-.365+q*.32);
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
