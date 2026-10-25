import * as THREE from 'three';

// Planar reflected camera with an oblique near plane (Three.js Water/Lengyel method).
// It reflects this scene's real sky and land, not a painted reflection texture.
export function createReflection(height=-.04,maxSize=1200){
  const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
  const camera=new THREE.PerspectiveCamera(),matrix=new THREE.Matrix4();
  const forward=new THREE.Vector3(),look=new THREE.Vector3(),up=new THREE.Vector3();
  const plane=new THREE.Plane(),clip=new THREE.Vector4(),q=new THREE.Vector4();
  const normal=new THREE.Vector3(0,1,0),origin=new THREE.Vector3(0,height,0);
  return {
    target,matrix,
    resize(w,h){const scale=Math.min(1,maxSize/Math.max(w,h));target.setSize(Math.ceil(w*scale),Math.ceil(h*scale));},
    render(renderer,scene,view,ocean){
      view.getWorldDirection(forward);look.copy(view.position).add(forward);look.y=2*height-look.y;
      camera.position.copy(view.position);camera.position.y=2*height-view.position.y;
      up.set(0,1,0).applyQuaternion(view.quaternion);up.y=-up.y;camera.up.copy(up);camera.lookAt(look);
      camera.near=view.near;camera.far=view.far;camera.updateMatrixWorld();camera.projectionMatrix.copy(view.projectionMatrix);
      matrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);
      normal.y=view.position.y<origin.y?-1:1;
      plane.setFromNormalAndCoplanarPoint(normal,origin).applyMatrix4(camera.matrixWorldInverse);
      clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
      const m=camera.projectionMatrix.elements;
      q.set((Math.sign(clip.x)+m[8])/m[0],(Math.sign(clip.y)+m[9])/m[5],-1,(1+m[10])/m[14]);
      clip.multiplyScalar(2/clip.dot(q));m[2]=clip.x;m[6]=clip.y;m[10]=clip.z+1-.001;m[14]=clip.w;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      const old=renderer.getRenderTarget(),visible=ocean.visible;ocean.visible=false;
      renderer.setRenderTarget(target);renderer.render(scene,camera);
      ocean.visible=visible;renderer.setRenderTarget(old);
    }
  };
}
