import * as THREE from 'three';
import {surfaceHeight,smooth} from './water-math.js';

export function createUnderwater(camera){
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true,samples:2});
  target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  const uniforms={sceneColor:{value:target.texture},sceneDepth:{value:target.depthTexture},inverseProjection:{value:camera.projectionMatrixInverse},amount:{value:0},depth:{value:0}};
  const material=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,uniforms,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`
      uniform sampler2D sceneColor,sceneDepth;uniform mat4 inverseProjection;uniform float amount,depth;
      varying vec2 vUv;
      void main(){
        float z=texture2D(sceneDepth,vUv).r;
        vec4 p=inverseProjection*vec4(vUv*2.-1.,z*2.-1.,1.);
        float path=z>.99999?400.:min(160.,length(p.xyz/p.w));
        vec3 original=texture2D(sceneColor,vUv).rgb;
        vec3 transmission=exp(-vec3(.115,.037,.022)*path);
        vec3 tint=vec3(.014,.32,.43)*exp(-depth*.023);
        vec3 wet=original*transmission+tint*(1.-transmission);
        // A gentle distance-dependent veil, not an opaque blue fullscreen overlay.
        gl_FragColor=vec4(mix(original,wet,amount),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const screen=new THREE.Scene();screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
  const ortho=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  return {
    target,
    resize(w,h){target.setSize(w,h);},
    update(time,coast){
      const depth=surfaceHeight(camera.position.x,camera.position.z,time,coast)-camera.position.y;
      uniforms.depth.value=Math.max(0,depth);uniforms.amount.value=smooth(-.04,.16,depth);
      document.documentElement.dataset.underwater=JSON.stringify({depth:+Math.max(0,depth).toFixed(2),amount:+uniforms.amount.value.toFixed(3)});
      return uniforms.amount.value;
    },
    render(renderer){renderer.setRenderTarget(null);renderer.render(screen,ortho);}
  };
}
