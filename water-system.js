import * as THREE from 'three';
import {shoreRadii,SHORE_SAMPLES,SWELLS,extraDepth} from './water-math.js';
import {SUN_DIRECTION,skyGLSL,daylight,cloudCover} from './atmosphere.js';
import {createReflection} from './water-reflection.js';
import {createRippleTexture} from './water-detail.js';

export function deepenSeabed(model){
  const report=[];
  model.traverse(o=>{
    if(!o.isMesh||!['Island_Terrain','Sand_Seafloor','Submerged_Seagrass'].includes(o.name))return;
    o.geometry=o.geometry.clone();const p=o.geometry.attributes.position;
    let changed=0,maximumDrop=0;
    for(let i=0;i<p.count;i++){
      if(p.getY(i)>=0)continue;
      const drop=extraDepth(p.getX(i),p.getZ(i));p.setY(i,p.getY(i)-drop);
      if(drop>1e-6)changed++;maximumDrop=Math.max(maximumDrop,drop);
    }
    p.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
    report.push({mesh:o.name,changed,maximumDrop});
  });return report;
}

const coastGLSL=`
uniform float time;uniform sampler2D shoreProfile;
uniform float infiniteWorld;uniform sampler2D worldCoast;uniform vec2 coastOrigin,waterOrigin;
const float TAU=6.28318530718;
float coastDistance(vec2 p){if(infiniteWorld>.5){vec2 uv=(p-coastOrigin)/256.+.5;if(min(uv.x,uv.y)<0.||max(uv.x,uv.y)>1.)return 32.;return texture2D(worldCoast,uv).r;}return length(p)-texture2D(shoreProfile,vec2(atan(p.y,p.x)/TAU+.5,.5)).r;}
`;
const waveGLSL=`
${coastGLSL}
void swell(vec2 uv,float amplitude,vec2 k,float speed,float phase,float fade,inout vec3 p,inout vec3 tx,inout vec3 tz){
  float f=dot(k,uv)-time*speed+phase,a=amplitude*fade,s=sin(f),c=cos(f);
  vec2 d=normalize(k);float q=.65;
  p+=vec3(q*a*d.x*c,a*s,q*a*d.y*c);
  tx+=vec3(-q*a*d.x*k.x*s,a*k.x*c,-q*a*d.y*k.x*s);
  tz+=vec3(-q*a*d.x*k.y*s,a*k.y*c,-q*a*d.y*k.y*s);
}
void waveSurface(vec2 uv,out vec3 p,out vec3 n){
  // Sparse horizon rings cannot resolve short waves. Flatten only the distant
  // geometry; the full world-space wave phase remains stable near the player.
  float lodFade=1.-smoothstep(65.,170.,length(uv-waterOrigin));
  float coast=coastDistance(uv),fade=smoothstep(-.4,4.,coast)*lodFade;
  p=vec3(uv.x,-.04,uv.y);vec3 tx=vec3(1,0,0),tz=vec3(0,0,1);
  ${SWELLS.map(([a,x,z,s,phase])=>`swell(uv,${a.toFixed(4)},vec2(${x.toFixed(4)},${z.toFixed(4)}),${s.toFixed(4)},${phase.toFixed(4)},fade,p,tx,tz);`).join('\n')}
  float angle=atan(uv.y,uv.x),f=coast*2.1+time*1.5+.3*sin(angle*5.);
  float a=.085*exp(-max(coast,0.)*.25)*smoothstep(-.35,.6,coast)*lodFade;
  p.y+=a*sin(f);vec2 dir=normalize(uv+vec2(.001));
  tx.y+=a*2.1*cos(f)*dir.x;tz.y+=a*2.1*cos(f)*dir.y;
  n=normalize(cross(tz,tx));
}
`;

export function createWater(scene,camera,target,resolution,waves,skyEnvironment){
  const profile=new THREE.DataTexture(shoreRadii,SHORE_SAMPLES,1,THREE.RedFormat,THREE.FloatType);
  profile.minFilter=profile.magFilter=THREE.LinearFilter;profile.wrapS=THREE.RepeatWrapping;profile.needsUpdate=true;
  const reflection=createReflection();
  const material=new THREE.ShaderMaterial({
    name:'Tropical_Optical_Water',
    side:THREE.DoubleSide,
    uniforms:{time:waves,skyEnvironment:{value:skyEnvironment},shoreProfile:{value:profile},ripples:{value:createRippleTexture()},bedColor:{value:target.texture},bedDepth:{value:target.depthTexture},mirrorColor:{value:reflection.target.texture},mirrorMatrix:{value:reflection.matrix},resolution:{value:resolution},inverseProjection:{value:camera.projectionMatrixInverse},cameraWorld:{value:camera.matrixWorld},sunDirection:{value:SUN_DIRECTION}},
    vertexShader:`${waveGLSL}
      varying vec3 worldPosition,geometricNormal;varying vec2 surfaceUV;
      void main(){vec3 p,n;waveSurface(position.xz+waterOrigin,p,n);surfaceUV=position.xz+waterOrigin;worldPosition=p;geometricNormal=n;gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);}`,
    fragmentShader:`
      ${coastGLSL}
      ${skyGLSL}
      uniform sampler2D ripples,bedColor,bedDepth,mirrorColor;
      uniform vec2 resolution;uniform mat4 inverseProjection,cameraWorld,mirrorMatrix;
      varying vec3 worldPosition,geometricNormal;varying vec2 surfaceUV;
      vec3 worldAt(vec2 uv){vec4 v=inverseProjection*vec4(uv*2.-1.,texture2D(bedDepth,uv).r*2.-1.,1.);return (cameraWorld*vec4(v.xyz/v.w,1.)).xyz;}
      float foamCells(vec2 p){
        vec2 base=floor(p),f=fract(p);float d1=9.,d2=9.;
        for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
          vec2 g=vec2(float(i),float(j));vec2 o=vec2(hash21(base+g),hash21(base+g+7.1));
          vec2 r=g+.05+.9*o-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else d2=min(d2,d);
        }return 1.-smoothstep(.018,.14,d2-d1);
      }
      float foamAt(vec2 p,float coast){
        if(coast<-.6||coast>4.5)return 0.;
        float angle=atan(p.y,p.x),warp=(noise21(p*1.8)-.5)*.21;
        vec2 frothUV=p*28.+vec2(time*.16,-time*.21);
        frothUV+=vec2(noise21(p*11.+time*.2),noise21(p.yx*12.-time*.15))*1.7;
        float lace=foamCells(frothUV);
        float small=texture2D(ripples,p*.71+vec2(time*.012,-time*.018)).b;
        float foam=0.;
        for(int i=0;i<2;i++){
          float travel=time*.72+float(i)*2.1+.46*sin(angle*5.)+.22*sin(angle*11.);
          float front=3.8-mod(travel,4.2);
          float life=smoothstep(-.4,.1,front)*(1.-smoothstep(2.6,3.8,front));
          float edge=coast-front+warp;
          float spread=mix(.75,.22,smoothstep(0.,3.,front));
          float band=exp(-pow(edge/spread,2.));
          float breaking=smoothstep(.23,.52,noise21(vec2(angle*19.+float(i)*7.,floor(travel/4.2)*.63)));
          float tip=exp(-pow((edge+.035)/.065,2.))*(.20+.5*small);
          foam=max(foam,(band*(.09+.55*lace+.17*small)+tip)*life*breaking);
        }
        return foam*smoothstep(-.4,.15,coast);
      }
      void main(){
        vec2 p=surfaceUV,uv=gl_FragCoord.xy/resolution;
        float distanceToEye=distance(cameraPosition,worldPosition),coast=coastDistance(p);
        vec2 flow=vec2(time*.015,-time*.022);
        vec2 detail=(texture2D(ripples,p*.13+flow).rg-.5)*.26;
        detail+=(texture2D(ripples,p*.31-flow*.73).rg-.5)*.15;
        detail+=(texture2D(ripples,p*.83+flow*.4).rg-.5)*.075*(1.-smoothstep(10.,55.,distanceToEye));
        float normalLOD=1.-smoothstep(30.,220.,distanceToEye)*.88;
        vec3 n=normalize(mix(vec3(0,1,0),geometricNormal+vec3(detail.x,0,detail.y),normalLOD));
        vec3 eye=normalize(cameraPosition-worldPosition);
        if(!gl_FrontFacing){
          n=-n;
          float cosine=max(dot(n,eye),0.);
          vec3 airRay=refract(-eye,n,1.333);
          float totalReflection=1.-step(.001,dot(airRay,airRay));
          float sinTransmitted2=1.333*1.333*(1.-cosine*cosine);
          float transmittedCosine=sqrt(max(0.,1.-sinTransmitted2));
          float rs=(1.333*cosine-transmittedCosine)/max(.0001,1.333*cosine+transmittedCosine);
          float rp=(cosine-1.333*transmittedCosine)/max(.0001,cosine+1.333*transmittedCosine);
          float f=mix(.5*(rs*rs+rp*rp),1.,smoothstep(.98,1.,sinTransmitted2));
          vec3 sky=skyRadiance(airRay+vec3(0.,.00001,0.));
          vec4 belowMirror=mirrorMatrix*vec4(worldPosition,1.);
          vec2 belowUV=belowMirror.xy/belowMirror.w+n.xz*.023;
          vec3 reflectedBed=texture2D(mirrorColor,clamp(belowUV,vec2(.002),vec2(.998))).rgb;
          reflectedBed=reflectedBed*vec3(.48,.80,.85)+vec3(.006,.07,.09);
          vec3 reflection=reflectedBed;
          vec3 below=mix(sky,reflection,max(f,totalReflection));
          below=mix(below,vec3(.7,.88,.87),foamAt(p,coast)*.32);
          gl_FragColor=vec4(below,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          return;
        }
        float ndv=max(dot(n,eye),.001);
        bool noBed=texture2D(bedDepth,uv).r>.99999;
        vec3 floorPosition=worldAt(uv);
        float depth=noBed?25.:max(0.,worldPosition.y-floorPosition.y);
        float path=noBed?60.:min(60.,distance(worldPosition,floorPosition));
        // Refraction follows the surface normal; never borrow a foreground land pixel.
        vec2 offset=n.xz*.018*smoothstep(0.,2.5,depth)/max(1.,distanceToEye*.075);
        vec2 refracted=clamp(uv+offset,vec2(.002),vec2(.998));
        if(worldAt(refracted).y>worldPosition.y-.03)refracted=uv;
        vec3 bed=texture2D(bedColor,refracted).rgb;
        if(noBed)bed=vec3(.015,.22,.32);
        vec3 transmittance=exp(-vec3(.17,.046,.024)*path);
        vec3 scattering=vec3(.008,.34,.50)*mix(.09,1.,daylight)*(1.-cloudCover*.24);
        vec3 underwater=bed*transmittance+scattering*(1.-transmittance);
        // Fade optical sampling before the streamed sea floor ends. Missing depth
        // pixels otherwise produce hard polygons and oversized far reflections.
        float distantWater=infiniteWorld*smoothstep(60.,90.,length(p-waterOrigin));
        underwater=mix(underwater,scattering,distantWater);
        // True IOR-based Fresnel: see sand looking down, see sky looking across.
        float fresnel=.02037+.97963*pow(1.-ndv,5.);
        vec3 reflectedRay=reflect(-eye,n);
        vec4 mirror=mirrorMatrix*vec4(worldPosition,1.);
        vec2 mirrorUV=mirror.xy/mirror.w+n.xz*.023;
        float edgeFade=smoothstep(0.,.08,min(min(mirrorUV.x,mirrorUV.y),min(1.-mirrorUV.x,1.-mirrorUV.y)));
        vec3 reflected=texture2D(mirrorColor,clamp(mirrorUV,vec2(.002),vec2(.998))).rgb;
        if(mirror.w<=0.)reflected=skyRadiance(reflectedRay);
        else if(edgeFade<.99)reflected=mix(skyRadiance(reflectedRay),reflected,edgeFade);
        reflected=mix(reflected,skyRadiance(reflectedRay),distantWater);
        vec3 color=mix(underwater,reflected,fresnel);
        vec3 halfVector=normalize(sunDirection+eye);
        float nh=max(dot(n,halfVector),0.);float gloss=pow(nh,520.);
        color+=vec3(1.8,1.65,1.35)*gloss*daylight*(1.-cloudCover*.8);
        float crest=smoothstep(.1,.32,worldPosition.y);
        color+=vec3(.008,.055,.05)*crest*(1.-fresnel);
        float foam=foamAt(p,coast);
        color=mix(color,vec3(.94,1.01,1.0)*mix(.12,1.,daylight),clamp(foam,0.,.91));
        if(distanceToEye>170.)color=mix(color,skyRadiance(normalize(vec3(eye.x,0.,eye.z))),smoothstep(170.,680.,distanceToEye)*.72);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const coastData=new Float32Array(128*128),coastTexture=new THREE.DataTexture(coastData,128,128,THREE.RedFormat,THREE.FloatType);coastTexture.minFilter=coastTexture.magFilter=THREE.LinearFilter;coastTexture.needsUpdate=true;
  Object.assign(material.uniforms,{daylight,cloudCover,infiniteWorld:{value:0},worldCoast:{value:coastTexture},coastOrigin:{value:new THREE.Vector2()},waterOrigin:{value:new THREE.Vector2()}});
  const ocean=new THREE.Group();ocean.name='Refractive_Reflective_Gerstner_Sea';
  const geometry=new THREE.PlaneGeometry(150,150,420,420);geometry.rotateX(-Math.PI/2);
  const near=new THREE.Mesh(geometry,material);near.frustumCulled=false;ocean.add(near);
  const radii=[75,95,130,180,260,420,720],side=420,ring=side*4,positions=[],indices=[];
  for(const r of radii)for(let s=0;s<4;s++)for(let i=0;i<side;i++){
    const v=-r+2*r*i/side,p=s===0?[v,-r]:s===1?[r,v]:s===2?[-v,r]:[-r,-v];positions.push(p[0],0,p[1]);
  }
  for(let r=0;r<radii.length-1;r++)for(let i=0;i<ring;i++){const a=r*ring+i,b=r*ring+(i+1)%ring,c=a+ring,d=b+ring;indices.push(a,b,c,c,b,d);}
  const horizon=new THREE.BufferGeometry();horizon.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));horizon.setIndex(indices);
  const far=new THREE.Mesh(horizon,material);far.frustumCulled=false;ocean.add(far);
  let coastCell='';ocean.userData.follow=(x,z,sample)=>{material.uniforms.infiniteWorld.value=1;material.uniforms.waterOrigin.value.set(x,z);const cx=Math.floor(x/32)*32,cz=Math.floor(z/32)*32,key=cx+','+cz;if(key===coastCell)return;coastCell=key;material.uniforms.coastOrigin.value.set(cx,cz);for(let j=0;j<128;j++)for(let i=0;i<128;i++)coastData[j*128+i]=-sample(cx+((i+.5)/128-.5)*256,cz+((j+.5)/128-.5)*256)*3;coastTexture.needsUpdate=true;};
  ocean.userData.reflection=reflection;scene.add(ocean);return ocean;
}
