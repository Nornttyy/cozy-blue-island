import * as THREE from 'three';
let library;
const tintMaterial=(material,color)=>{
 const tint=new THREE.Color(color),copy=material.clone();
 if(copy.color)copy.color.lerp(tint,.42);
 if(copy.emissive)copy.emissive.copy(tint).multiplyScalar(.035);
 copy.roughness=Math.min(.9,(copy.roughness??.7)+.1);return copy;
};
function razorCrab(source){
 const g=source.clone(true);g.name='RazorCrab';g.traverse(o=>{if(!o.isMesh)return;o.material=Array.isArray(o.material)?o.material.map(v=>tintMaterial(v,'#9c4e3f')):tintMaterial(o.material,'#9c4e3f');});return g;
}
function viper(){
 const g=new THREE.Group();g.name='Viper';const body=new THREE.Group();body.name='ViperSegments';g.add(body);
 const skin=new THREE.MeshStandardMaterial({color:'#315e4b',roughness:.56,metalness:.04}),belly=new THREE.MeshStandardMaterial({color:'#d6c786',roughness:.7}),eye=new THREE.MeshStandardMaterial({color:'#ffe66d',emissive:'#ffbd3d',emissiveIntensity:.6,roughness:.32});
 for(let i=0;i<7;i++){const r=.22-i*.019,part=new THREE.Mesh(new THREE.SphereGeometry(r,12,9),skin);part.name='Viper_Segment_'+i;part.scale.set(1,.76,1.32);part.position.set(0,.17,.48-i*.16);body.add(part);}
 const head=new THREE.Mesh(new THREE.ConeGeometry(.29,.58,5),skin);head.name='Viper_Head';head.rotation.x=Math.PI/2;head.position.set(0,.18,-.56);g.add(head);
 for(const side of [-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),eye);e.position.set(side*.16,.29,-.67);g.add(e);}
 const underside=new THREE.Mesh(new THREE.SphereGeometry(.15,10,8),belly);underside.scale.set(1,.38,1.6);underside.position.set(0,.06,-.34);g.add(underside);
 return g;
}
export function mergeRefinements(base,refined){for(const child of [...refined.children]){const previous=base.getObjectByName(child.name);previous?.removeFromParent();base.add(child);}}
export function installExpeditionModels(root){
 library=root;
 // Wind uses asset-space height. Imported batches must not each bend around
 // a separate mesh origin, which used to pull twigs away from their leaves.
 for(const name of ['Pine','Broadleaf']){const tree=root.getObjectByName(name);if(!tree||tree.userData.windNormalized)continue;
  tree.updateWorldMatrix(true,true);const inverse=tree.matrixWorld.clone().invert(),meshes=[];tree.traverse(o=>{if(o.isMesh)meshes.push(o);});
  for(const m of meshes){m.geometry=m.geometry.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld));tree.add(m);m.position.set(0,0,0);m.rotation.set(0,0,0);m.scale.setScalar(1);}
  tree.userData.windNormalized=true;
 }
 root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});
}
export function expeditionModel(name){
 if(name==='Viper')return viper();
 const source=library?.getObjectByName(name==='RazorCrab'?'Crab':name);if(!source)throw new Error('Missing expedition asset: '+name);
 const g=name==='RazorCrab'?razorCrab(source):source.clone(true);g.position.set(0,0,0);g.rotation.set(0,0,0);return g;
}
export function animateExplorer(g,time,speed=0,swim=false){const swing=Math.sin(time*(swim?3:8))*Math.min(.65,speed*.17);for(const [name,angle]of [['Thigh_L',swing],['Thigh_R',-swing],['UpperArm_L',-swing],['UpperArm_R',swing],['Shin_L',Math.max(0,-swing)*.8],['Shin_R',Math.max(0,swing)*.8]]){const p=g.getObjectByName(name);if(p)p.rotation.x=angle;}}
export function animateWildlife(g,type,time){
 const set=(name,x,z=0)=>{const p=g.getObjectByName(name);if(p){p.rotation.x=x;p.rotation.z=z;}};
 if(type==='Boar'){const step=Math.sin(time*3.2)*.3;for(const [name,sign]of [['Leg_Front_L',1],['Leg_Back_R',1],['Leg_Front_R',-1],['Leg_Back_L',-1]])set(name,step*sign);}
 else if(type==='Rabbit'){const cycle=(time%1.4)/1.4,hop=cycle>.25&&cycle<.85?Math.sin((cycle-.25)/.6*Math.PI):0;g.position.y+=hop*.075;for(const side of ['L','R']){set('HindLeg_'+side,-hop*.48);set('ForeLeg_'+side,hop*.28);}}
 else if(type==='Crab'||type==='RazorCrab'){for(let i=1;i<=4;i++)for(const side of ['L','R'])set('Leg_'+side+i,0,Math.sin(time*(type==='RazorCrab'?5.4:4)+i*Math.PI+(side==='L'?0:Math.PI))*.13);}
 else if(type==='Viper'){const segments=g.getObjectByName('ViperSegments');if(segments)for(let i=0;i<7;i++){const part=segments.getObjectByName('Viper_Segment_'+i);if(part){part.position.x=Math.sin(time*7-i*.74)*.065*(1-i*.075);part.rotation.y=Math.cos(time*7-i*.74)*.18;}}const head=g.getObjectByName('Viper_Head');if(head)head.rotation.z=Math.sin(time*7)*.09;}
}
