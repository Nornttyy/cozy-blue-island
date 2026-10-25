import * as THREE from 'three';

export const SUN_DIRECTION=new THREE.Vector3(-.42,.69,.59).normalize();
export const daylight={value:1},cloudCover={value:0};
export const noiseGLSL=`
float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.),f.x),f.y);}
float fbm(vec2 p){float n=.5*noise21(p);p=mat2(.8,.6,-.6,.8)*p*2.03;n+=.25*noise21(p);p=p*2.01+3.7;n+=.125*noise21(p);return n+.0625*noise21(p*2.02);}
`;
// The dome and water share a cubemap, baked once from volumetric cloud density.
export const skyGLSL=`${noiseGLSL}
uniform vec3 sunDirection;uniform samplerCube skyEnvironment;uniform float daylight,cloudCover;
vec3 skyRadiance(vec3 ray){ray=normalize(ray);vec3 day=textureCube(skyEnvironment,ray).rgb;day=mix(day,vec3(.32,.43,.52),cloudCover*.68);
 vec3 night=mix(vec3(.014,.025,.060),vec3(.035,.065,.11),1.-max(0.,ray.y));
 vec2 p=vec2(atan(ray.z,ray.x),asin(ray.y))*180.;float star=step(.996,hash21(floor(p)))*(1.-smoothstep(.02,.14,length(fract(p)-.5)))*smoothstep(.05,.4,ray.y);
 night+=vec3(.8,.88,1.)*star*(1.-cloudCover);
 vec3 color=mix(night,day,daylight);float sun=smoothstep(.99955,.99985,dot(ray,sunDirection));float moon=smoothstep(.99965,.9999,dot(ray,-sunDirection));
 return color+vec3(4.,3.5,2.7)*sun*daylight*(1.-cloudCover)+vec3(.55,.66,.9)*moon*(1.-daylight)*(1.-cloudCover);
}
`;

const cloudGLSL=`${noiseGLSL}
uniform vec3 sunDirection;
float hash31(vec3 p){return hash21(p.xy+p.z*vec2(31.7,17.3));}
float noise3(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  float a=mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y);
  float b=mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y);
  return mix(a,b,f.z);
}
float cloudDensity(vec3 p){
  if(p.y<60.||p.y>145.)return 0.;
  vec2 tile=floor(p.xz/115.);float density=0.;
  for(int z=-1;z<=1;z++)for(int x=-1;x<=1;x++){
    vec2 id=tile+vec2(float(x),float(z));float seed=hash21(id+9.3);
    if(seed<.61)continue;
    vec2 center=(id+.25+vec2(hash21(id+3.1),hash21(id+8.8))*.5)*115.;
    float radius=22.+hash21(id+2.7)*28.,height=15.+hash21(id+4.5)*10.;
    vec3 q=vec3(p.x-center.x,p.y-87.-seed*12.,p.z-center.y);
    if(length(q.xz)>radius*1.9)continue;
    float a=length(q/vec3(radius,height*.6,radius*.77))-1.;
    float b=length((q-vec3(-radius*.40,height*.53,radius*.12))/vec3(radius*.65,height*.85,radius*.58))-1.;
    float c=length((q-vec3(radius*.51,height*.3,-radius*.12))/vec3(radius*.60,height*.7,radius*.61))-1.;
    float d=min(a,min(b,c));
    d+=(noise3(p*.21)-.5)*.08;
    density=max(density,(1.-smoothstep(-.22,.06,d))*.82);
  }
  return density;
}
vec3 atmosphere(vec3 ray){
  vec3 sky=mix(vec3(.59,.85,1.12),vec3(.16,.53,1.03),pow(max(ray.y,0.),.48));
  float sunCos=max(dot(ray,sunDirection),0.);
  sky+=vec3(1.,.86,.64)*pow(sunCos,18.)*.16;
  if(ray.y<.065)return sky;
  float start=60./ray.y,finish=min(145./ray.y,1600.);
  if(finish<=start)return sky;
  float stepSize=(finish-start)/48.;
  float transmittance=1.;vec3 light=vec3(0.);
  for(int i=0;i<48;i++){
    vec3 p=ray*(start+(float(i)+.5)*stepSize);
    float density=cloudDensity(p);
    if(density>.002){
      float sunShadow=cloudDensity(p+sunDirection*7.)*.95+cloudDensity(p+sunDirection*18.)*.75;
      float direct=exp(-sunShadow*1.7);
      vec3 shade=mix(vec3(.64,.78,.89),vec3(1.7,1.67,1.51),direct);
      float alpha=1.-exp(-density*stepSize*.24);
      light+=transmittance*shade*alpha;transmittance*=1.-alpha;
    }
    if(transmittance<.015)break;
  }
  return mix(sky,light+sky*transmittance,smoothstep(.065,.18,ray.y));
}
`;

export function createSky(renderer){
  const geometry=new THREE.SphereGeometry(900,32,20);
  const vertexShader='varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
  const bakeScene=new THREE.Scene();
  const bakeMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{sunDirection:{value:SUN_DIRECTION}},vertexShader,
    fragmentShader:`${cloudGLSL}\nvarying vec3 direction;void main(){gl_FragColor=vec4(atmosphere(normalize(direction)),1.);}`});
  bakeScene.add(new THREE.Mesh(geometry,bakeMaterial));
  const target=new THREE.WebGLCubeRenderTarget(512,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter,depthBuffer:false});
  const capture=new THREE.CubeCamera(.1,1000,target),tone=renderer.toneMapping;
  renderer.toneMapping=THREE.NoToneMapping;capture.update(renderer,bakeScene);renderer.toneMapping=tone;
  bakeMaterial.dispose();
  const sky=new THREE.Mesh(geometry,new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{sunDirection:{value:SUN_DIRECTION},skyEnvironment:{value:target.texture},daylight,cloudCover},vertexShader,
    fragmentShader:`${skyGLSL}\nvarying vec3 direction;void main(){gl_FragColor=vec4(skyRadiance(direction),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`}));
  sky.name='Soft_Volumetric_Cumulus_Sky';sky.userData.environment=target.texture;sky.userData.target=target;
  return sky;
}
