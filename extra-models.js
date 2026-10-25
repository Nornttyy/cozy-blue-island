import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const wood=new THREE.MeshStandardMaterial({color:'#ac7845',roughness:.91}),stone=new THREE.MeshStandardMaterial({color:'#80959a',roughness:.82}),leaf=new THREE.MeshStandardMaterial({color:'#7fbc75',roughness:.9}),clay=new THREE.MeshStandardMaterial({color:'#ba8865',roughness:1}),cap=new THREE.MeshStandardMaterial({color:'#cf9b61',roughness:.95}),cream=new THREE.MeshStandardMaterial({color:'#e4d8b6',roughness:.95});
function put(g,geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;}
const models=new Map();
export function installExtraModels(assets){
 for(const type of ['bench','pickaxe','torch','mushroom','herb','flint','clay','drop','flask']){
  const model=assets.getObjectByName('Extra_'+type);if(!model)throw new Error('Missing refined prop '+type);
  const group=new THREE.Group(),batches=new Map();model.updateMatrixWorld(true);
  model.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone().applyMatrix4(o.matrixWorld).toNonIndexed();
   if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
   for(const key of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(key))geo.deleteAttribute(key);
   const key=o.material.uuid,b=batches.get(key)||{material:o.material,geos:[]};b.geos.push(geo);batches.set(key,b);
  });
  for(const b of batches.values()){const geometry=mergeGeometries(b.geos);if(!geometry)throw new Error('Cannot batch refined '+type);for(const g of b.geos)g.dispose();const mesh=new THREE.Mesh(geometry,b.material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
  models.set(type,group);
 }
}
export function extraModel(type){if(models.has(type))return models.get(type).clone(true);const g=new THREE.Group();
 if(type==='bench'){for(const x of [-.6,.6])for(const z of [-.3,.3])put(g,new THREE.CylinderGeometry(.055,.08,.7,10),wood,x,.35,z);for(let i=0;i<5;i++)put(g,new THREE.BoxGeometry(1.5,.1,.15),wood,0,.75,-.32+i*.16);put(g,new THREE.BoxGeometry(1.2,.1,.09),wood,0,.22,0);}
 else if(type==='pickaxe'){put(g,new THREE.CylinderGeometry(.035,.05,.75,12),wood,0,.32,0);const head=put(g,new THREE.CapsuleGeometry(.065,.45,6,12),stone,0,.62,0);head.rotation.z=Math.PI/2;}
 else if(type==='torch'){put(g,new THREE.CylinderGeometry(.035,.055,.6,12),wood,0,.25,0);put(g,new THREE.SphereGeometry(.09,12,10),cap,0,.57,0);const f=put(g,new THREE.SphereGeometry(.075,12,10),new THREE.MeshBasicMaterial({color:'#ffbb54'}),0,.68,0);f.scale.y=1.8;}
 else if(type==='mushroom'){for(let i=0;i<3;i++){const x=(i-1)*.18,z=Math.sin(i*2)*.14;put(g,new THREE.CylinderGeometry(.035,.055,.19,10),cream,x,.095,z);const c=put(g,new THREE.SphereGeometry(.14,16,10,0,Math.PI*2,0,Math.PI/2),cap,x,.19,z);c.scale.y=.7;}}
 else if(type==='herb'){for(let i=0;i<7;i++){const a=i*2.4,m=put(g,new THREE.SphereGeometry(.1,12,8),leaf,Math.sin(a)*.12,.14+Math.sin(i)*.035,Math.cos(a)*.12);m.scale.set(.4,1.7,1);m.rotation.z=Math.sin(a)*.7;}}
 else if(type==='drop'){put(g,new THREE.SphereGeometry(.14,12,8),cream,0,.13,0);put(g,new THREE.TorusGeometry(.07,.018,6,12),wood,0,.23,0).rotation.x=Math.PI/2;}
 else{for(let i=0;i<4;i++){const m=put(g,new THREE.IcosahedronGeometry(.15+i*.025,1),type==='clay'?clay:stone,Math.sin(i*2)*.24,.1,Math.cos(i*2)*.22);m.scale.y=.65;m.rotation.set(i,.5*i,.4*i);}}
 models.set(type,g);return g.clone(true);
}
