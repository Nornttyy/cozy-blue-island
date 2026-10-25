import {smooth,shoreDistance,extraDepth} from './water-math.js';

// Keep the exact coastline and regular collision grid while relieving the flat plateau.
export function landHeight(x,y,z){
  const d=shoreDistance(x,z);
  if(y<=0){
    // Ease the submerged beach slope, not the bottom cap of the island mesh.
    if(d>=0&&d<1.8&&y> -2.6-extraDepth(x,z)){
      const blend=smooth(.35,1.8,d);return -d*.65*(1-blend)+y*blend;
    }
    return y;
  }
  const beach=Math.min(y,Math.max(0,-d)*.62);
  y=beach+(y-beach)*smooth(1.6,2.4,y);
  const inland=smooth(.08,1.1,y);
  const hill=.21*Math.sin(x*.37+.6)*Math.cos(z*.31)+.12*Math.sin(z*.52+x*.18);
  const rock=smooth(1.8,3.2,y)*.07*Math.sin(x*2.1+z*.9)*Math.cos(z*1.6);
  return y+inland*(hill+rock);
}

export function refineLand(mesh){
  const p=mesh.geometry.attributes.position;let changed=0,maxChange=0;
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),next=landHeight(p.getX(i),y,p.getZ(i));
    if(next!==y){p.setY(i,next);changed++;maxChange=Math.max(maxChange,Math.abs(next-y));}
  }
  p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
  return {changed,maxChange};
}
