import * as THREE from 'three';
let library;
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
export function expeditionModel(name){const source=library?.getObjectByName(name);if(!source)throw new Error('Missing expedition asset: '+name);const g=source.clone(true);g.position.set(0,0,0);g.rotation.set(0,0,0);return g;}
export function animateExplorer(g,time,speed=0,swim=false){const swing=Math.sin(time*(swim?3:8))*Math.min(.65,speed*.17);for(const [name,angle]of [['Thigh_L',swing],['Thigh_R',-swing],['UpperArm_L',-swing],['UpperArm_R',swing],['Shin_L',Math.max(0,-swing)*.8],['Shin_R',Math.max(0,swing)*.8]]){const p=g.getObjectByName(name);if(p)p.rotation.x=angle;}}
export function animateWildlife(g,type,time){
 const set=(name,x,z=0)=>{const p=g.getObjectByName(name);if(p){p.rotation.x=x;p.rotation.z=z;}};
 if(type==='Boar'){const step=Math.sin(time*3.2)*.3;for(const [name,sign]of [['Leg_Front_L',1],['Leg_Back_R',1],['Leg_Front_R',-1],['Leg_Back_L',-1]])set(name,step*sign);}
 else if(type==='Rabbit'){const cycle=(time%1.4)/1.4,hop=cycle>.25&&cycle<.85?Math.sin((cycle-.25)/.6*Math.PI):0;g.position.y+=hop*.075;for(const side of ['L','R']){set('HindLeg_'+side,-hop*.48);set('ForeLeg_'+side,hop*.28);}}
 else if(type==='Crab'){for(let i=1;i<=4;i++)for(const side of ['L','R'])set('Leg_'+side+i,0,Math.sin(time*4+i*Math.PI+(side==='L'?0:Math.PI))*.13);}
}
