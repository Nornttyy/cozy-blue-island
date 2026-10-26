import * as THREE from 'three';

// One object silhouette, not outlines around each individual triangle/mesh.
// A separate mask keeps original textures, wind, reflections and shadows intact.
export function createSelectionOutline(occlusionDepth){
 const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
 const maskScene=new THREE.Scene(),screen=new THREE.Scene(),screenCamera=new THREE.Camera(),pairs=[];
 const uniforms={mask:{value:target.texture},maskDepth:{value:target.depthTexture},sceneDepth:{value:occlusionDepth},pixel:{value:new THREE.Vector2(1,1)},nearPlane:{value:.07},farPlane:{value:1600}};
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:'varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`varying vec2 uvScreen;uniform sampler2D mask,maskDepth,sceneDepth;uniform vec2 pixel;uniform float nearPlane,farPlane;
   float distanceAt(float d){return nearPlane*farPlane/(farPlane-d*(farPlane-nearPlane));}
   float visibleAt(vec2 p,float here){float a=texture2D(mask,p).a;if(a<.01)return 0.;float z=distanceAt(texture2D(maskDepth,p).r);float scene=distanceAt(texture2D(sceneDepth,p).r);return a*step(z,scene+.04)*step(z,here+.04);}
   void main(){float here=distanceAt(texture2D(sceneDepth,uvScreen).r),edge=0.;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){edge=max(edge,visibleAt(uvScreen+vec2(float(x),float(y))*pixel,here));}
    float inside=texture2D(mask,uvScreen).a;float alpha=edge*(1.-inside)*.96;if(alpha<.01)discard;gl_FragColor=vec4(vec3(1.),alpha);}`});
 const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);quad.frustumCulled=false;screen.add(quad);
 let selected=null;const oldColor=new THREE.Color();
 function setSelection(root){
  if(root===selected)return;selected=root;
  for(const {proxy}of pairs){maskScene.remove(proxy);for(const m of [proxy.material].flat())m.dispose();}pairs.length=0;
  if(!root)return;
  root.traverse(source=>{if(!source.isMesh)return;
   const wrap=original=>{const m=new THREE.MeshBasicMaterial({map:original.map,alphaMap:original.alphaMap,alphaTest:Math.max(original.alphaTest||0,.05),side:original.side,toneMapped:false,fog:false});m.onBeforeCompile=shader=>{if(original.userData.islandWind)original.onBeforeCompile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','gl_FragColor=vec4(1.);');};m.customProgramCacheKey=()=>original.userData.islandWind?'outline-wind-24':'outline-24';return m;};
   const proxy=new THREE.Mesh(source.geometry,Array.isArray(source.material)?source.material.map(wrap):wrap(source.material));proxy.matrixAutoUpdate=false;proxy.frustumCulled=false;maskScene.add(proxy);pairs.push({source,proxy});
  });
 }
 return {
  setSelection,
  resize(w,h,dpr=1){target.setSize(w,h);uniforms.pixel.value.set(1.8*dpr/w,1.8*dpr/h);},
  render(renderer,camera){
   if(!selected||!pairs.length)return;selected.updateWorldMatrix(true,true);
   for(const {source,proxy}of pairs){proxy.matrix.copy(source.matrixWorld);let visible=true;for(let o=source;o;o=o.parent)if(!o.visible)visible=false;proxy.visible=visible;}
   uniforms.nearPlane.value=camera.near;uniforms.farPlane.value=camera.far;
   const previous=renderer.getRenderTarget(),alpha=renderer.getClearAlpha(),auto=renderer.autoClear,tone=renderer.toneMapping,shadow=renderer.shadowMap.enabled;renderer.getClearColor(oldColor);
   try{renderer.toneMapping=THREE.NoToneMapping;renderer.shadowMap.enabled=false;renderer.autoClear=true;renderer.setClearColor(0,0);renderer.setRenderTarget(target);renderer.render(maskScene,camera);renderer.autoClear=false;renderer.setRenderTarget(previous);renderer.render(screen,screenCamera);}
   finally{renderer.setRenderTarget(previous);renderer.setClearColor(oldColor,alpha);renderer.autoClear=auto;renderer.toneMapping=tone;renderer.shadowMap.enabled=shadow;}
  },
  dispose(){setSelection(null);target.dispose();material.dispose();quad.geometry.dispose();}
 };
}
