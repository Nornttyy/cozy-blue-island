export const TASKS=[
  {title:'沿海岸走一走',description:'步行探索 15 米，认识小岛的轮廓。'},
  {title:'潜入浅蓝海水',description:'走进海里，按住 C，下潜到水面以下 1 米。'},
  {title:'平安回到岸上',description:'按空格上浮，再游回沙滩，重新站到陆地。'}
];
export function headingFromYaw(yaw){
  const degrees=(((-yaw*180/Math.PI)%360)+360)%360;
  return {degrees,label:['北','东北','东','东南','南','西南','西','西北'][Math.round(degrees/45)%8]};
}
export function bearingOffset(bearing,heading){return ((bearing-heading+540)%360)-180;}
export function cleanPreferences(value={}){
  if(!value||typeof value!=='object')value={};
  return {guidance:value.guidance!==false,reducedMotion:value.reducedMotion===true,waves:value.waves!==false,wind:value.wind!==false,sensitivity:Number.isFinite(value.sensitivity)?Math.max(.5,Math.min(2,value.sensitivity)):1};
}
export class ExplorationJournal{
  constructor(){this.distance=0;this.done=[false,false,false];this.previous=null;}
  relocate(){this.previous=null;}
  update(state){
    const before=this.done.filter(Boolean).length;
    if(state.active&&this.previous&&state.mode==='walk'&&this.previous.mode==='walk'){
      const step=Math.hypot(state.x-this.previous.x,state.z-this.previous.z);
      if(step<2)this.distance+=step;
    }
    if(this.distance>=15)this.done[0]=true;
    if(state.active&&state.mode==='dive'&&state.depth>=1)this.done[1]=true;
    if(state.active&&this.done[1]&&state.mode==='walk'&&state.grounded&&this.previous&&this.previous.mode!=='walk')this.done[2]=true;
    this.previous=state.active?{...state}:null;
    return this.done.filter(Boolean).length>before;
  }
}
