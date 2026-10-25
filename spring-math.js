import {buildGroundSampler} from './player-physics.js';
export const SPRING={x:-4.4,z:3,rx:1.12,rz:.86};
export const springRadius=a=>1+.055*Math.sin(3*a+.3)+.025*Math.cos(5*a-.7);
export function springDistance(x,z){const u=(x-SPRING.x)/SPRING.rx,v=(z-SPRING.z)/SPRING.rz;return Math.hypot(u,v)/springRadius(Math.atan2(v,u));}
export function springBedHeight(r){
  const profile=[[0,-.5],[.2,-.49],[.45,-.46],[.68,-.37],[.84,-.21],[1,.06],[1.18,.09],[1.42,-.18]];
  for(let i=1;i<profile.length;i++)if(r<=profile[i][0]){const [a,y]=profile[i-1],[b,z]=profile[i];return y+(z-y)*(r-a)/(b-a);}
  return -.18;
}
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function prepareSpringTerrain(terrain){
  // Preserve the pre-carve layout sampler so old resource IDs/saves stay valid.
  const p=terrain.geometry.attributes.position,layoutSample=buildGroundSampler(p),base=layoutSample(SPRING.x,SPRING.z);
  let changed=0;
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),r=springDistance(p.getX(i),p.getZ(i));
    if(r>=1.55||y<base-1)continue;
    const bowl=base-.62+.58*smooth(.55,1.08,r),blend=smooth(1.08,1.55,r);
    p.setY(i,bowl*(1-blend)+y*blend);changed++;
  }
  p.needsUpdate=true;terrain.geometry.computeVertexNormals();terrain.geometry.computeBoundingBox();terrain.geometry.computeBoundingSphere();
  return {...SPRING,base,waterY:base+.025,layoutSample,changed};
}
