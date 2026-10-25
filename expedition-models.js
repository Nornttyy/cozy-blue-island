import * as THREE from 'three';
let library;
export function installExpeditionModels(root){library=root;root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});}
export function expeditionModel(name){const source=library?.getObjectByName(name);if(!source)throw new Error('Missing expedition asset: '+name);const g=source.clone(true);g.position.set(0,0,0);g.rotation.set(0,0,0);return g;}
export function animateExplorer(g,time,speed=0,swim=false){const swing=Math.sin(time*(swim?3:8))*Math.min(.65,speed*.17);for(const [name,angle]of [['Thigh_L',swing],['Thigh_R',-swing],['UpperArm_L',-swing],['UpperArm_R',swing],['Shin_L',Math.max(0,-swing)*.8],['Shin_R',Math.max(0,swing)*.8]]){const p=g.getObjectByName(name);if(p)p.rotation.x=angle;}}
