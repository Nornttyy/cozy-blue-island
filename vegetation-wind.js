import * as THREE from 'three';

// One continuous field for visible meshes, normals, shadows and reflections.
// Palm stem/crown and berry stems/fruit use the same deformation at a joint.
export const WIND_SHADER = `
uniform float islandWindTime;
uniform float islandWindStrength;
uniform float islandWindKind;
vec3 islandWind(vec3 p){
  vec3 origin=modelMatrix[3].xyz;
  float phase=origin.x*.43+origin.z*.31;
  float t=islandWindTime;
  float gust=.65+.35*sin(t*.43-phase*.35);
  float sway=sin(t*.91+phase)+.27*sin(t*1.47+phase*1.7);
  vec3 worldDirection=normalize(vec3(.91,0.,.42));
  vec3 direction=vec3(dot(normalize(modelMatrix[0].xyz),worldDirection),dot(normalize(modelMatrix[1].xyz),worldDirection),dot(normalize(modelMatrix[2].xyz),worldDirection));
  vec3 offset=vec3(0.);
  if(islandWindKind<1.5){
    float stem=pow(smoothstep(.25,3.5,p.y),2.);
    offset=direction*(.085*stem*gust*(.32+sway));
    float radius=length(p.xz-vec2(.24,0.));
    float tip=pow(smoothstep(.28,1.85,radius),2.)*smoothstep(2.5,3.,p.y);
    float frond=atan(p.z,p.x-.24);
    offset.y+=tip*gust*(.085*sin(t*1.36+phase+radius*2.1+sin(frond)*.8)+.009*sin(t*4.3+phase+p.x*14.+p.z*12.));
  }else{
    float top=islandWindKind<3.5?.8:.42;
    float bottom=islandWindKind<3.5?.045:.085;
    float flex=pow(smoothstep(bottom,top,p.y),2.);
    float amplitude=islandWindKind<2.5?.065:islandWindKind<3.5?.032:.026;
    offset=direction*(amplitude*flex*gust*(.35+sway));
    offset.y-=.009*flex*abs(sway)*gust;
    offset.y+=.003*flex*sin(t*3.3+phase+p.x*8.+p.z*11.);
  }
  return p+offset*islandWindStrength;
}
`;

export function patchWindShader(shader, uniforms){
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+WIND_SHADER)
    .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
      #define ISLAND_WIND_POSITION_READY
      vec3 islandWindPosition=islandWind(position);
      #ifdef USE_TANGENT
        vec3 windT=normalize(objectTangent);
      #else
        vec3 windT=normalize(cross(abs(objectNormal.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.),objectNormal));
      #endif
      vec3 windB=normalize(cross(objectNormal,windT));
      vec3 windDt=islandWind(position+windT*.006)-islandWindPosition;
      vec3 windDb=islandWind(position+windB*.006)-islandWindPosition;
      objectNormal=normalize(cross(windDt,windDb));
      #ifdef USE_TANGENT
        objectTangent=normalize(windDt);
      #endif`)
    .replace('#include <begin_vertex>',`#include <begin_vertex>
      #ifdef ISLAND_WIND_POSITION_READY
        transformed=islandWindPosition;
      #else
        transformed=islandWind(position);
      #endif`);
}

export function createVegetationWind(shadowChanged=()=>{}){
  const time={value:0},entries=[];let lastShadow=-Infinity;
  function material(source,uniforms){
    const m=source.clone();
    m.onBeforeCompile=shader=>patchWindShader(shader,uniforms);
    m.customProgramCacheKey=()=> 'island-vegetation-wind-15';
    m.userData.islandWind=true;
    return m;
  }
  return {
    attach(root,kind,weight=()=>1){
      const strength={value:weight()},uniforms={islandWindTime:time,islandWindKind:{value:kind},islandWindStrength:strength};
      const materials=new Map();let count=0;
      root.traverse(o=>{
        if(!o.isMesh||(kind===4&&!o.name.endsWith('leafGreen')))return;
        const wrap=m=>{if(!materials.has(m))materials.set(m,material(m,uniforms));return materials.get(m);};
        o.material=Array.isArray(o.material)?o.material.map(wrap):wrap(o.material);
        o.customDepthMaterial=material(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),uniforms);
        o.customDistanceMaterial=material(new THREE.MeshDistanceMaterial(),uniforms);
        // Cull against the maximum gentle bend, not the undeformed leaf tips.
        o.geometry.computeBoundingSphere();o.geometry.boundingSphere.radius+=.22;
        count++;
      });
      if(count)entries.push({root,strength,weight});
      return count;
    },
    detach(root){for(let i=entries.length-1;i>=0;i--)if(entries[i].root===root)entries.splice(i,1);const disposed=new Set();root.traverse(o=>{if(!o.isMesh)return;for(const m of [o.material,o.customDepthMaterial,o.customDistanceMaterial].flat())if(m?.userData.islandWind&&!disposed.has(m)){m.dispose();disposed.add(m);}});},
    update(seconds){
      if(!Number.isFinite(seconds))return;
      const changed=time.value!==seconds;time.value=Math.max(0,seconds);
      for(const e of entries)e.strength.value=THREE.MathUtils.clamp(e.weight(),0,1);
      // The main renderer caches shadows; refresh at 30 Hz, not once per pass.
      if(changed&&entries.length&&(seconds-lastShadow>=1/30||seconds<lastShadow)){lastShadow=seconds;shadowChanged();}
    },
    get time(){return time.value;},
    get count(){return entries.length;}
  };
}
