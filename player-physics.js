// Ground sampling comes from the real, deepened terrain, not an invisible flat plane.
export function buildGroundSampler(position){
  const snap=v=>Math.round(v*10000)/10000;
  const xs=[...new Set(Array.from({length:position.count},(_,i)=>snap(position.getX(i))))].sort((a,b)=>a-b);
  const zs=[...new Set(Array.from({length:position.count},(_,i)=>snap(position.getZ(i))))].sort((a,b)=>a-b);
  const nx=xs.length,nz=zs.length;
  if(nx>500||nz>500||nx<3||nz<3)throw new Error('Unsupported terrain grid');
  const values=new Float32Array(nx*nz).fill(-Infinity);
  const xIndex=new Map(xs.map((x,i)=>[x,i])),zIndex=new Map(zs.map((z,i)=>[z,i]));
  for(let i=0;i<position.count;i++){
    const ix=xIndex.get(snap(position.getX(i))),iz=zIndex.get(snap(position.getZ(i))),j=iz*nx+ix;
    values[j]=Math.max(values[j],position.getY(i));
  }
  const dx=(xs.at(-1)-xs[0])/(nx-1),dz=(zs.at(-1)-zs[0])/(nz-1);
  if(!values.every(Number.isFinite))throw new Error('Incomplete terrain collision grid');
  return (x,z)=>{
    const fx=(x-xs[0])/dx,fz=(z-zs[0])/dz;
    if(fx<0||fz<0||fx>=nx-1||fz>=nz-1)return -100;
    const ix=Math.floor(fx),iz=Math.floor(fz),tx=fx-ix,tz=fz-iz;
    const a=values[iz*nx+ix],b=values[iz*nx+ix+1],c=values[(iz+1)*nx+ix],d=values[(iz+1)*nx+ix+1];
    // Matches the exported terrain's triangle diagonal, including steep bluffs.
    return tx+tz<=1 ? a+(b-a)*tx+(c-a)*tz : d+(c-d)*(1-tx)+(b-d)*(1-tz);
  };
}

export class PlayerBody {
  constructor(sample,water=()=>-.04){this.sample=sample;this.water=water;this.radius=.27;this.eyeHeight=1.62;this.reset();}
  ground(x,z){
    let h=this.sample(x,z);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;h=Math.max(h,this.sample(x+Math.cos(a)*this.radius,z+Math.sin(a)*this.radius));}
    return h;
  }
  reset(x=0,z=4){this.x=x;this.z=z;this.feet=this.ground(x,z);this.vy=0;this.vx=0;this.vz=0;this.grounded=true;this.blocked=false;this.swimming=false;this.diveDepth=0;this.mode='walk';this.waterLevel=-.04;this.coyote=.09;this.jumpBuffer=0;}
  tryMove(x,z){
    if(this.canMove&&!this.canMove(x,z,this.radius,this.feet))return false;
    const h=this.ground(x,z),center=this.sample(x,z);
    if((this.worldLimit!==Infinity&&Math.hypot(x,z)>(this.worldLimit??62))||h>this.feet+(this.swimming?.35:.22))return false;
    const gx=(this.sample(x+.18,z)-this.sample(x-.18,z))/.36;
    const gz=(this.sample(x,z+.18)-this.sample(x,z-.18))/.36;
    // Descending a beach is allowed; the old symmetric slope test blocked water entry.
    if(Math.hypot(gx,gz)>1.35&&h>this.ground(this.x,this.z)+.002&&center>.45)return false;
    this.x=x;this.z=z;return true;
  }
  update(delta,input,yaw,time=0){
    const count=Math.max(1,Math.ceil(Math.min(delta,.15)*90)),dt=Math.min(delta,.15)/count;
    if(input.jump)this.jumpBuffer=.12;
    this.blocked=false;
    for(let i=0;i<count;i++){
      this.coyote=this.grounded?.09:Math.max(0,this.coyote-dt);this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
      if(this.jumpBuffer>0&&this.coyote>0&&!this.swimming){this.vy=4.4;this.grounded=false;this.coyote=0;this.jumpBuffer=0;}
      this.waterLevel=this.water(this.x,this.z,time);
      const floor=this.ground(this.x,this.z),depth=this.waterLevel-floor;
      if(this.swimming){if(depth<.88){this.swimming=false;this.diveDepth=0;}}
      else if(depth>1.08&&this.feet<this.waterLevel-.68){this.swimming=true;this.diveDepth=0;}
      let forward=input.forward||0,side=input.side||0;
      const length=Math.hypot(forward,side);if(length>1){forward/=length;side/=length;}
      const speed=this.swimming?(input.sprint?2.75:1.8):(input.sprint?4.5:2.9);
      const tx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed;
      const tz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed;
      const easing=1-Math.exp(-(this.swimming?4.5:this.grounded?(length?18:30):8)*dt);
      this.vx+=(tx-this.vx)*easing;this.vz+=(tz-this.vz)*easing;
      const mx=this.vx*dt,mz=this.vz*dt;
      if(!this.tryMove(this.x+mx,this.z+mz)){
        const ax=this.tryMove(this.x+mx,this.z),az=this.tryMove(this.x,this.z+mz);
        if(!ax)this.vx=0;if(!az)this.vz=0;
        this.blocked=!(ax&&az);
      }
      if(this.swimming){
        // Neutral buoyancy at the chosen depth, positive buoyancy at the surface.
        const vertical=(input.descend?1:0)-(input.ascend?1:0);
        this.diveDepth=Math.max(0,Math.min(14,depth-1.22,this.diveDepth+vertical*(input.sprint?2.8:1.8)*dt));
        const floatingFeet=this.waterLevel-1.12-this.diveDepth;
        this.vy+=((floatingFeet-this.feet)*20-this.vy*8.5)*dt;
      }else this.vy-=12*dt;
      this.feet+=this.vy*dt;
      const ground=this.ground(this.x,this.z);
      if(this.feet<=ground){this.feet=ground;this.vy=0;this.grounded=true;}
      else this.grounded=false;
      this.mode=this.swimming?(this.feet+this.eyeHeight<this.waterLevel-.12?'dive':'swim'):(this.waterLevel-this.feet>.12?'wade':'walk');
    }
    if(!Number.isFinite(this.feet)||this.feet< -35)this.reset();
  }
}
