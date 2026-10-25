import * as THREE from 'three';
import {RECIPES,FALL_SECONDS,segmentDistance} from './survival-state.js';
import {createVegetationWind} from './vegetation-wind.js';
import {extraModel} from './extra-models.js';
import {hashSeed} from './world-seed.js';
import {expeditionModel} from './expedition-models.js';
import {poseBoat} from './boat-motion.js';
const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.88});
const palette={cut:mat('#dcc28c')};
function mesh(g,geometry,material,x,y,z,sx=1,sy=sx,sz=sx){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function flameLobe(g,color,x,y,z,width,height){
  const geo=new THREE.SphereGeometry(1,16,18),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const t=(p.getY(i)+1)/2,s=(1-t*.75);p.setXYZ(i,p.getX(i)*s*width,p.getY(i)*height*.5,p.getZ(i)*s*width*.75);}geo.computeVertexNormals();
  const m=mesh(g,geo,new THREE.MeshBasicMaterial({color}),x,y,z);return m;
}
export function buildingModel(type,assets){
  if(type==='boat'){const g=new THREE.Group(),hull=expeditionModel('Rowboat');g.name='Boat_heading';hull.rotation.y=Math.PI;g.add(hull);return g;}
  if(type==='bench')return extraModel(type);
  const g=assets.getObjectByName(type==='fire'?'Fire':'Shelter').clone(true);
  if(type==='fire'){
    const flame=new THREE.Group();flame.name='flame';g.add(flame);
    flameLobe(flame,'#fda347',0,.51,0,.26,.66);
    flameLobe(flame,'#ffe4a3',.01,.40,.03,.14,.36);
    flameLobe(flame,'#ffbd65',-.13,.47,-.02,.12,.43);
    const light=new THREE.PointLight('#ffbd74',3.5,5,2);light.position.set(0,.9,0);g.add(light);
  }
  return g;
}
function nodeModel(n,assets){
  const g=new THREE.Group();
  const index=/^n\d+$/.test(n.id)?Number(n.id.slice(1)):hashSeed(n.id)%10000,name={wood:'Wood',stone:'Stone'+index%3,fiber:'Fiber',berry:'Berry',shell:'Shell',spring:'Spring'}[n.type];
  if(name){const model=assets.getObjectByName(name).clone(true);g.add(model);if(n.type!=='spring')g.rotation.y=index*2.39996;}
  if(['herb','mushroom','flint','clay','drop'].includes(n.type))g.add(extraModel(n.type));
  if(['ironore','copperore','salt'].includes(n.type))g.add(expeditionModel({ironore:'IronOre',copperore:'CopperOre',salt:'Salt'}[n.type]));
  if(n.type==='tree'){
    const stump=assets.getObjectByName('Stump').clone(true),pivot=new THREE.Group(),body=[2,5].includes(n.biome)?expeditionModel('Pine'):[1,4].includes(n.biome)?expeditionModel('Broadleaf'):assets.getObjectByName('Palm').clone(true);
    pivot.position.y=.28;pivot.add(body);g.add(stump,pivot);g.userData={pivot,body};
  }
  g.position.set(n.x,n.y,n.z);return g;
}
export function createSurvivalWorld(scene,game,shadowChanged,assets){
  for(const name of ['Palm','Stump','Axe','Shelter','Fire','Wood','Stone0','Stone1','Stone2','Fiber','Berry','Shell','Spring'])if(!assets?.getObjectByName(name))throw new Error('Missing survival model: '+name);
  assets.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  const group=new THREE.Group();group.name='Survival_World';scene.add(group);
  const nodeMeshes=new Map(),buildMeshes=new Map();let ghost=null,ghostType=null,seen=-1;
  const wind=createVegetationWind(shadowChanged);
  function addNode(n){const g=nodeModel(n,assets);group.add(g);nodeMeshes.set(n.id,g);
    if(n.type==='tree')wind.attach(g.userData.body,1,()=>{const t=game.treeStage(n);return t.phase==='standing'?1:t.phase==='falling'?Math.max(0,1-(game.state.elapsed-t.fallStart)/.4):0;});
    else if(n.type==='fiber'||n.type==='herb')wind.attach(g,2);
    else if(n.type==='berry')wind.attach(g,3);
    else if(n.type==='spring')wind.attach(g,4);
  }
  for(const n of game.nodes)addNode(n);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.42,.47,36),new THREE.MeshBasicMaterial({color:'#fff5b1',side:THREE.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.visible=false;group.add(ring);
  function sync(){
    let dirty=seen!==game.revision;seen=game.revision;
    const present=new Set(game.nodes.map(n=>n.id));for(const [id,g]of nodeMeshes)if(!present.has(id)){wind.detach(g.userData.body||g);group.remove(g);nodeMeshes.delete(id);dirty=true;}
    for(const n of game.nodes)if(!nodeMeshes.has(n.id)){addNode(n);dirty=true;}
    for(const n of game.nodes){const g=nodeMeshes.get(n.id),available=game.available(n);if(n.type==='tree'){
      const t=game.treeStage(n),pose=game.logPose(n),pivot=g.userData.pivot;
      g.userData.body.visible=t.phase!=='split';pivot.rotation.y=pose.yaw;
      const elapsed=(game.state.elapsed-t.fallStart)/FALL_SECONDS,fall=t.phase==='falling'?Math.min(1,elapsed*elapsed):t.phase==='fallen'?1:0;
      g.userData.body.rotation.x=pose.angle*fall;
      if(t.phase==='falling')dirty=true;
    }else if(n.type==='berry'){const fruit=g.getObjectByName('fruit');if(fruit.visible!==available){fruit.visible=available;dirty=true;}}else if(g.visible!==available){g.visible=available;dirty=true;}}
    for(const [id,g]of buildMeshes){const b=game.state.buildings.find(b=>b.id===id);if(!b||game.view&&Math.hypot(b.x-game.view.x,b.z-game.view.z)>100){group.remove(g);buildMeshes.delete(id);dirty=true;}}
    for(const b of game.state.buildings)if(!buildMeshes.has(b.id)&&(!game.view||Math.hypot(b.x-game.view.x,b.z-game.view.z)<100)){const g=buildingModel(b.type,assets);g.position.set(b.x,b.y,b.z);g.rotation.y=b.yaw;group.add(g);buildMeshes.set(b.id,g);dirty=true;}
    for(const b of game.state.buildings)if(b.type==='boat'){const g=buildMeshes.get(b.id);if(g){g.position.set(b.x,b.y,b.z);poseBoat(g,b,game.state.elapsed);}}
    if(dirty)shadowChanged();
  }
  function clearGhost(){if(ghost){group.remove(ghost);ghost.traverse(o=>{if(o.isMesh)o.material.dispose();});ghost=null;}ghostType=null;}
  const chips=[],chipGeo=new THREE.BoxGeometry(.025,.055,.015);
  return {
    sync,
    updateWind:time=>wind.update(time),
    spring:nodeMeshes.get(game.nodes.find(n=>n.type==='spring')?.id),
    tool:assets.getObjectByName('Axe').clone(true),
    impact(n){const p=game.interactionNode(n);for(let i=0;i<5;i++){const m=mesh(group,chipGeo,palette.cut,p.x,p.y+(game.treeStage(n).phase==='standing'?.85:.3),p.z);chips.push({m,age:0,vx:Math.sin(i*2.4)*.9,vz:Math.cos(i*2.4)*.9,vy:1.1+i*.13});}},
    highlight(n,progress=0){ring.visible=!!n;if(!n)return;ring.position.set(n.x,n.y+.045,n.z);const r=n.type==='tree'?.85:n.type==='spring'?2:1.25;ring.scale.setScalar(r+progress*.12);ring.material.opacity=.6+progress*.35;},
    preview(type,position,valid){
      if(!type){clearGhost();return;}
      if(type!==ghostType){clearGhost();ghost=buildingModel(type,assets);ghostType=type;ghost.traverse(o=>{if(o.isLight)o.intensity=0;if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.4;o.material.depthWrite=false;o.castShadow=false;}});group.add(ghost);}
      ghost.position.set(position.x,type==='boat'?-.19:position.y,position.z);ghost.rotation.y=position.yaw;ghost.traverse(o=>{if(o.isMesh)o.material.color.set(valid?'#9bdc9e':'#ed9274');});
    },
    canMove(x,z,radius,feet){
      for(const n of game.nodes)if(n.type==='tree'){
        const t=game.treeStage(n);
        if(t.phase==='standing'&&Math.hypot(n.x-x,n.z-z)<radius+.2&&feet<n.y+3.5)return false;
        if(t.phase==='fallen'){const p=game.logPose(n);if(segmentDistance(x,z,n.x,n.z,p.endX,p.endZ)<radius+.17&&feet<game.sample(x,z)+.39)return false;}
      }
      for(const b of game.state.buildings)if(b.type==='fire'&&Math.hypot(b.x-x,b.z-z)<radius+.45&&feet<b.y+.5)return false;
      return true;
    },
    update(time,working,progress,dt){sync();for(const n of game.nodes){const g=nodeMeshes.get(n.id);if(n.type==='tree'&&game.treeStage(n).phase==='standing'){
      g.userData.body.rotation.z=working?.id===n.id?Math.sin(progress*Math.PI*4)*.012:0;
    }}
      for(let i=chips.length-1;i>=0;i--){const c=chips[i];c.age+=dt;c.vy-=dt*4;c.m.position.addScaledVector(new THREE.Vector3(c.vx,c.vy,c.vz),dt);c.m.rotation.x+=dt*6;c.m.rotation.z+=dt*3;if(c.age>.55){group.remove(c.m);chips.splice(i,1);}}
      for(const g of buildMeshes.values()){const f=g.getObjectByName('flame');if(f){f.scale.set(1+Math.sin(time*7)*.05,1+Math.sin(time*9)*.12,1);f.rotation.y=time*.5;}}
    }
  };
}
