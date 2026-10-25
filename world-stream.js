import * as THREE from 'three';
import {CHUNK,STEP} from './world-seed.js';
import {dressSeabed} from './water-detail.js';

export function createWorldStream(scene,math,waves,legacy=false){
 const chunks=new Map(),material=new THREE.MeshStandardMaterial({color:'#ebdbb2',roughness:.92}),sample=math.vertex;
 const template={name:'Island_Terrain',material,userData:{procedural:true,biomes:!!math.tint}};dressSeabed(template,waves);
 const radius=math.generation>=17?4:3;
 let distant=null;
 function horizon(cx,cz){if(!math.tint)return;if(distant){scene.remove(distant);distant.geometry.dispose();}const p=[],n=[],colors=[],idx=[];
  for(let j=-12;j<=12;j++)for(let i=-12;i<=12;i++){if(Math.abs(i)<=radius&&Math.abs(j)<=radius)continue;const bx=(cx+i)*CHUNK,bz=(cz+j)*CHUNK;
   if(Math.max(sample(bx+16,bz+16),sample(bx,bz),sample(bx+32,bz+32))<-8)continue;const start=p.length/3;
   for(let z=0;z<=8;z++)for(let x=0;x<=8;x++){const wx=bx+x*4,wz=bz+z*4;p.push(wx,sample(wx,wz)-.04,wz);n.push(...new THREE.Vector3(sample(wx-.3,wz)-sample(wx+.3,wz),.6,sample(wx,wz-.3)-sample(wx,wz+.3)).normalize());colors.push(...math.tint(wx,wz));}
   for(let z=0;z<8;z++)for(let x=0;x<8;x++){const a=start+z*9+x;idx.push(a,a+9,a+1,a+1,a+9,a+10);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeBoundingSphere();distant=new THREE.Mesh(g,material);distant.name='Distant_archipelago';scene.add(distant);
 }
 let last='',queue=[];
 const desired=new Set();
 function create(cx,cz){
  const g=new THREE.BufferGeometry(),p=[],n=[],colors=[],idx=[],N=CHUNK/STEP;
  for(let z=0;z<=N;z++)for(let x=0;x<=N;x++){
   const wx=cx*CHUNK+x*STEP,wz=cz*CHUNK+z*STEP,y=sample(wx,wz);p.push(wx,y,wz);
   const normal=new THREE.Vector3(sample(wx-.2,wz)-sample(wx+.2,wz),.4,sample(wx,wz-.2)-sample(wx,wz+.2)).normalize();n.push(...normal);
   if(math.tint)colors.push(...math.tint(wx,wz));
  }
  for(let z=0;z<N;z++)for(let x=0;x<N;x++){const a=z*(N+1)+x;idx.push(a,a+N+1,a+1,a+1,a+N+1,a+N+2);}
  g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setIndex(idx);g.computeBoundingSphere();
  if(math.tint)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  // Legacy island keeps its high-resolution original land; only extend beyond it.
  if(legacy){const kept=[];for(let i=0;i<idx.length;i+=3){const tri=idx.slice(i,i+3);if(tri.some(k=>Math.hypot(p[k*3],p[k*3+2])>42))kept.push(...tri);}g.setIndex(kept);}
  const mesh=new THREE.Mesh(g,material);mesh.name=`Terrain_${cx}_${cz}`;mesh.receiveShadow=true;scene.add(mesh);chunks.set(cx+','+cz,mesh);
 }
 return {update(x,z,immediate=false){const cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK),key=cx+','+cz;
   if(key!==last){last=key;desired.clear();queue=[];horizon(cx,cz);for(let j=-radius;j<=radius;j++)for(let i=-radius;i<=radius;i++){const k=(cx+i)+','+(cz+j);desired.add(k);if(!chunks.has(k))queue.push([cx+i,cz+j,i*i+j*j]);}
    queue.sort((a,b)=>a[2]-b[2]);for(const [k,m]of chunks)if(!desired.has(k)){scene.remove(m);m.geometry.dispose();chunks.delete(k);}
   }
   for(let i=0;i<(immediate?49:2)&&queue.length;i++){const [a,b]=queue.shift();create(a,b);}
  },get count(){return chunks.size;},get pending(){return queue.length;},dispose(){for(const m of chunks.values()){scene.remove(m);m.geometry.dispose();}chunks.clear();material.dispose();}};
}
