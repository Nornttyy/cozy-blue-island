import {createAxeViewmodel,poseAxe} from './axe-viewmodel.js';
// The old stone pick was exported with its butt at Y=0, head at Y=.75.
// Rotate about a grip on the shaft, not around the model's distant bottom.
export function createStonePickViewmodel(model){
  const wrist=createAxeViewmodel(model);wrist.name='StonePick_Wrist';
  model.position.set(0,-.22,0);wrist.scale.setScalar(.78);
  poseStonePick(wrist,16/9);return wrist;
}
export function poseStonePick(wrist,aspect,phase=null){poseAxe(wrist,aspect,phase);wrist.position.x-=Math.max(0,1.2-aspect)*.16;wrist.position.z-=.12;}
