import * as THREE from 'three';
import {SPRING,springRadius} from './spring-math.js';
export {prepareSpringTerrain} from './spring-math.js';
import {createReflection} from './water-reflection.js';
import {SUN_DIRECTION,daylight,cloudCover} from './atmosphere.js';

export function springGeometry(){
  const p=[0,0,0],uv=[0,0],indices=[],N=80,R=10;
  for(let i=1;i<=R;i++)for(let j=0;j<N;j++){
    const a=j*Math.PI*2/N,r=i/R*.965*springRadius(a),x=Math.cos(a)*SPRING.rx*r,z=Math.sin(a)*SPRING.rz*r;
    p.push(x,0,z);uv.push(x,z);
  }
  for(let j=0;j<N;j++)indices.push(0,1+(j+1)%N,1+j);
  for(let i=0;i<R-1;i++)for(let j=0;j<N;j++){
    const a=1+i*N+j,b=1+i*N+(j+1)%N;indices.push(a,b,b+N,a,b+N,a+N);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
const ripple=`
  uniform float time;
  float heightAt(vec2 p){
    float d=length(p-vec2(.22,-.58));
    return .004*sin(dot(p,vec2(8.1,4.3))-time*1.4)+.0027*sin(dot(p,vec2(-5.7,11.8))+time*1.9)
      +.0022*sin(d*32.-time*4.6)*exp(-d*2.2);
  }
`;
export function createSpringWater(scene,camera,bedTarget,resolution,time,environment,anchor,model){
  const reflection=createReflection(anchor.waterY,720),material=new THREE.ShaderMaterial({
    name:'Clear_Freshwater_Refraction',side:THREE.DoubleSide,
    uniforms:{time,daylight,cloudCover,bedColor:{value:bedTarget.texture},bedDepth:{value:bedTarget.depthTexture},mirrorColor:{value:reflection.target.texture},mirrorMatrix:{value:reflection.matrix},resolution:{value:resolution},inverseProjection:{value:camera.projectionMatrixInverse},cameraWorld:{value:camera.matrixWorld},skyEnvironment:{value:environment},sunDirection:{value:SUN_DIRECTION}},
    vertexShader:`${ripple} varying vec3 waterWorld;varying vec2 localXZ;
      void main(){localXZ=position.xz;vec3 p=position;p.y+=heightAt(localXZ);vec4 w=modelMatrix*vec4(p,1.);waterWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`${ripple}
      uniform sampler2D bedColor,bedDepth,mirrorColor;uniform samplerCube skyEnvironment;uniform float daylight,cloudCover;
      uniform vec2 resolution;uniform mat4 inverseProjection,cameraWorld,mirrorMatrix;uniform vec3 sunDirection;
      varying vec3 waterWorld;varying vec2 localXZ;
      vec3 worldAt(vec2 uv){vec4 v=inverseProjection*vec4(uv*2.-1.,texture2D(bedDepth,uv).r*2.-1.,1.);return (cameraWorld*vec4(v.xyz/v.w,1.)).xyz;}
      void main(){
        vec2 uv=gl_FragCoord.xy/resolution;float h=heightAt(localXZ);
        vec3 n=normalize(vec3((h-heightAt(localXZ+vec2(.012,0.)))/.012,1.,(h-heightAt(localXZ+vec2(0.,.012)))/.012));
        vec3 eye=normalize(cameraPosition-waterWorld);float ndv=max(dot(n,eye),.001);
        float distanceToEye=distance(cameraPosition,waterWorld),depth=max(0.,waterWorld.y-worldAt(uv).y);
        vec2 shifted=clamp(uv+n.xz*.024*smoothstep(0.,.4,depth)/max(1.,distanceToEye*.5),vec2(.001),vec2(.999));
        if(worldAt(shifted).y>waterWorld.y-.012)shifted=uv;
        float path=min(2.,max(0.,distance(waterWorld,worldAt(shifted))));
        vec3 attenuation=exp(-vec3(.80,.18,.09)*path);
        vec3 bottom=texture2D(bedColor,shifted).rgb*attenuation+vec3(.06,.43,.50)*(1.-attenuation)*.55*mix(.09,1.,daylight);
        vec4 m=mirrorMatrix*vec4(waterWorld,1.);vec2 mirrorUV=m.xy/m.w+n.xz*.018;
        float edge=smoothstep(0.,.06,min(min(mirrorUV.x,mirrorUV.y),min(1.-mirrorUV.x,1.-mirrorUV.y)));
        vec3 reflected=mix(vec3(.025,.045,.08),textureCube(skyEnvironment,reflect(-eye,n)).rgb,daylight);
        if(m.w>0.)reflected=mix(reflected,texture2D(mirrorColor,clamp(mirrorUV,vec2(.002),vec2(.998))).rgb,edge);
        float fresnel=.02037+.97963*pow(1.-ndv,5.);
        float sun=pow(max(dot(reflect(-sunDirection,n),eye),0.),420.);
        gl_FragColor=vec4(mix(bottom,reflected,fresnel)+vec3(1.,.92,.72)*sun*.48*daylight*(1.-cloudCover),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const surface=new THREE.Mesh(springGeometry(),material);surface.name='Freshwater_Surface';surface.position.set(anchor.x,anchor.waterY,anchor.z);surface.frustumCulled=false;scene.add(surface);
  // Restrained moving light on actual submerged geometry; not a painted water disc.
  model.getObjectByName('Spring_Bed')?.traverse(o=>{
    if(!o.isMesh)return;o.material=o.material.clone();
    o.material.onBeforeCompile=shader=>{
      shader.uniforms.springTime=time;
      shader.vertexShader='varying vec3 springLocal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nspringLocal=position;');
      shader.fragmentShader='uniform float springTime;varying vec3 springLocal;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`
        float lines=sin(springLocal.x*17.+sin(springLocal.z*12.+springTime*.7))*sin(springLocal.z*19.-springTime*.5);
        outgoingLight*=1.+.13*pow(abs(lines),9.)*(1.-smoothstep(-.06,.04,springLocal.y));
        #include <opaque_fragment>`);
    };o.material.customProgramCacheKey=()=> 'spring-caustics-12';
  });
  return {surface,reflection,anchor,resize:(w,h)=>reflection.resize(w,h)};
}
