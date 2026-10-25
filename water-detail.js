import * as THREE from 'three';
import {noiseGLSL,daylight} from './atmosphere.js';

// Periodic spectral slope texture, mipmapped so distant capillary waves don't sparkle.
export function createRippleTexture(){
  const size=256,data=new Uint8Array(size*size*4),terms=[];
  for(let i=0;i<26;i++){
    const octave=Math.floor(i/6),kx=Math.round(Math.cos(i*2.399)*2**octave*3),kz=Math.round(Math.sin(i*2.399)*2**octave*3);
    terms.push([kx,kz,1/(1+Math.hypot(kx,kz))**1.7,i*1.173]);
  }
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    let dx=0,dz=0,h=0;
    for(const [kx,kz,a,phase] of terms){const p=(kx*x+kz*z)/size*Math.PI*2+phase;dx+=kx*a*Math.cos(p);dz+=kz*a*Math.cos(p);h+=a*Math.sin(p);}
    const i=(z*size+x)*4;
    data[i]=Math.round(THREE.MathUtils.clamp(.5+dx*.18,0,1)*255);
    data[i+1]=Math.round(THREE.MathUtils.clamp(.5+dz*.18,0,1)*255);
    data[i+2]=Math.round(THREE.MathUtils.clamp(.5+h*.75,0,1)*255);data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;
  return t;
}

export const causticGLSL=`
float cells(vec2 p){
  vec2 base=floor(p),f=fract(p);float d1=9.,d2=9.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec2 g=vec2(float(x),float(y)),o=vec2(hash21(base+g),hash21(base+g+17.4));
    vec2 r=g+.5+.44*sin(time*.4+6.283*o)-f;float d=dot(r,r);
    if(d<d1){d2=d1;d1=d;}else d2=min(d2,d);
  }
  return d2-d1;
}
float causticAt(vec2 p){
  p=p*3.2+vec2(time*.05,-time*.08);
  p+=vec2(sin(p.y*1.7+time*.23),sin(p.x*1.4-time*.31))*.42;
  p+=vec2(noise21(p*2.1),noise21(p.yx*2.3+7.))*.65;
  float c=cells(p);
  float brightness=.4+.6*noise21(p*.63+time*.04);
  return pow(1.-smoothstep(.008,.095,c),2.)*brightness;
}
`;

export function dressSeabed(mesh,time){
  const terrain=mesh.name==='Island_Terrain';
  mesh.material.vertexColors=!!mesh.userData?.biomes;
  mesh.material.roughness=.92;
  mesh.material.onBeforeCompile=shader=>{
    shader.uniforms.time=time;shader.uniforms.daylight=daylight;
    shader.uniforms.isLand={value:terrain?1:0};
    shader.uniforms.sandTint={value:new THREE.Color('#efdbb0')};
    shader.uniforms.grassTint={value:new THREE.Color('#83b958')};
    shader.uniforms.rockTint={value:new THREE.Color('#b6b8a7')};
    shader.vertexShader='varying vec3 bedWorld,bedWorldNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbedWorld=(modelMatrix*vec4(position,1.)).xyz;bedWorldNormal=mat3(modelMatrix)*normal;');
    shader.fragmentShader=`uniform float time,isLand,daylight;uniform vec3 sandTint,grassTint,rockTint;varying vec3 bedWorld,bedWorldNormal;\n${noiseGLSL}\n${causticGLSL}\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 groundNormal=normalize(bedWorldNormal);
      float macro=fbm(bedWorld.xz*.3);
      float rockMask=smoothstep(1.65,2.85,bedWorld.y+(macro-.5)*.3) * isLand;
      ${mesh.userData?.procedural?'rockMask*=1.-smoothstep(.65,.88,groundNormal.y);':''}
      float grassMask=smoothstep(.62,1.25,bedWorld.y+(macro-.45)*.9)*(1.-rockMask)*isLand;
      vec3 sand=sandTint*(.95+.08*macro);
      vec3 grass=grassTint*(.92+.16*macro);
      ${mesh.userData?.biomes?'grass=vColor*(.78+.16*macro);':''}
      grass=mix(grass,grass*vec3(1.12,1.06,.92),smoothstep(.5,.72,macro)*.35);
      vec3 rock=rockTint*(.95+.10*macro);
      diffuseColor.rgb=mix(mix(sand,grass,grassMask),rock,rockMask);
      float wet=(1.-smoothstep(-.05,.36,bedWorld.y))*.19;
      diffuseColor.rgb*=1.-wet;
      // Filter sub-pixel grain rather than making distant ground shimmer.
      float footprint=length(fwidth(bedWorld.xz));
      float fineFade=1.-smoothstep(.012,.055,footprint);
      float fineGrain=(noise21(bedWorld.xz*86.)-.5)*fineFade;
      float sandRipple=sin(bedWorld.x*14.+noise21(bedWorld.xz*1.8)*4.)*.5;
      float turf=noise21(bedWorld.xz*24.)-.5;
      float stoneGrain=noise21(bedWorld.xz*17.)-.5;
      diffuseColor.rgb*=1.+mix(mix(fineGrain*.075,turf*.085,grassMask),stoneGrain*.07,rockMask);
      float groundHeight=mix(mix(sandRipple*.003+fineGrain*.0015,turf*.008,grassMask),stoneGrain*.005,rockMask);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=clamp(mix(.94,.45,wet/.19)+fineGrain*.05,.4,1.);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 dpdx=dFdx(-vViewPosition),dpdy=dFdy(-vViewPosition);
      vec3 rx=cross(dpdy,normal),ry=cross(normal,dpdx);
      float det=dot(dpdx,rx);
      if(abs(det)>1e-9)normal=normalize(abs(det)*normal-sign(det)*(dFdx(groundHeight)*rx+dFdy(groundHeight)*ry));
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      if(bedWorld.y<.03){
        float power=exp(-max(0.,-bedWorld.y)*.22)*(1.-smoothstep(-.35,-.04,bedWorld.y));
        outgoingLight+=diffuseColor.rgb*vec3(.7,.85,.72)*causticAt(bedWorld.xz)*power*.35*daylight;
      }
      #include <opaque_fragment>
    `);
  };
  mesh.material.customProgramCacheKey=()=> 'island-cozy-land-material-17'+(mesh.userData?.procedural?'-rolling':'')+(mesh.userData?.biomes?'-biomes':'');
}
