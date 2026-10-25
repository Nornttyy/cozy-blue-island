// Coordinates match the exported Blender mesh (Blender y = -world z).
const TAU = Math.PI * 2;
const BLUFFS = [[-12.1,-4.8,3.4,2.8,2.8],[10.4,-7,3.8,3,3.2],[14.1,.6,3.5,3,3.8],[8.6,8.2,4,3,4.4],[-3,10,4.5,3.1,5],[-12.4,5.7,3.4,3.5,4]];
export const smooth = (a,b,x) => {const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function originalHeight(x,z) {
  const y=-z,a=Math.atan2(y/12,x/15.2);
  const radius=1+.065*Math.sin(3*a+.4)+.065*Math.cos(5*a-.8);
  const q=Math.hypot(x/15.2,y/12)/radius;
  let h=-1.8+2.25*(1-smooth(.89,1.12,q))+.94*(1-smooth(.70,.84,q));
  h+=.065*Math.sin(x*.45)*Math.cos(y*.38)*(1-smooth(.68,.92,q));
  for(const [cx,cy,rx,ry,peak] of BLUFFS){
    const xx=(x-cx)/rx,yy=(y-cy)/ry,t=Math.atan2(yy,xx);
    const d=Math.hypot(xx,yy)/(1+.07*Math.cos(t*5+cx)+.035*Math.sin(t*9+cy));
    let b=-.6+(peak+.6)*(1-smooth(.42,1.06,d));
    b+=(.09*Math.sin(x*2.9+.6)+.07*Math.cos(y*2.7))*smooth(.4,.65,d)*(1-smooth(.9,1.07,d));
    h=Math.max(h,b);
  }
  return h;
}
export const SHORE_SAMPLES=512;
export const shoreRadii=new Float32Array(SHORE_SAMPLES);
for(let i=0;i<SHORE_SAMPLES;i++){
  const a=(i+.5)/SHORE_SAMPLES*TAU-Math.PI,dx=Math.cos(a),dz=Math.sin(a);
  let low=0;
  for(let r=0;r<28;r+=.16)if(originalHeight(r*dx,r*dz)>0)low=r;
  let high=low+.18;
  for(let n=0;n<20;n++){const mid=(low+high)/2;if(originalHeight(mid*dx,mid*dz)>0)low=mid;else high=mid;}
  shoreRadii[i]=(low+high)/2;
}
export function shoreRadius(angle){
  const u=((angle/TAU+.5)%1+1)%1*SHORE_SAMPLES-.5;
  const i=Math.floor(u),t=u-i;
  return shoreRadii[(i+SHORE_SAMPLES)%SHORE_SAMPLES]*(1-t)+shoreRadii[(i+1+SHORE_SAMPLES)%SHORE_SAMPLES]*t;
}
export function shoreDistance(x,z){return Math.hypot(x,z)-shoreRadius(Math.atan2(z,x));}
export function extraDepth(x,z){const d=shoreDistance(x,z);return 5.8*smooth(.45,9,d)+5*smooth(9,35,d);}
// Metric wave amplitudes, spatial frequency vectors, and radians per second.
export const SWELLS=[
  [.19,.17,-.49,2.26,.7],[.10,-.29,-.72,2.76,2.1],
  [.058,.76,-1.02,3.53,4.3],[.032,-1.28,-1.14,4.1,1.4],
  [.021,1.82,-2.05,5.19,5.8],[.012,-2.9,-1.38,5.61,3.2]
];
export function surfaceHeight(x,z,time,coast){
  const d=coast??shoreDistance(x,z),a=Math.atan2(z,x);
  let h=SWELLS.reduce((sum,[amp,kx,kz,speed,phase])=>sum+amp*Math.sin(x*kx+z*kz-time*speed+phase),0)*smooth(-.4,4,d);
  h+=.085*Math.sin(d*2.1+time*1.5+.3*Math.sin(a*5))*Math.exp(-Math.max(d,0)*.25)*smooth(-.35,.6,d);
  return h-.04;
}
export function foamFront(angle,time,phase=0){
  const travel=time*.72+phase+.46*Math.sin(angle*5)+.22*Math.sin(angle*11);
  return 3.8-((travel%4.2)+4.2)%4.2;
}
