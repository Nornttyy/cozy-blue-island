import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createWater, deepenSeabed } from './water-system.js';
import { firstPerson } from './first-person.js';
import {createSky,SUN_DIRECTION} from './atmosphere.js';
import {dressSeabed} from './water-detail.js';
import {refineLand} from './terrain-math.js';
import {createUnderwater} from './underwater.js';
import {createHUD} from './hud.js';
import {createTitleCamera} from './title-camera.js';
import {createSurvival} from './survival.js';
import {prepareSpringTerrain,createSpringWater} from './spring-water.js';
import {finishMaterials} from './material-finish.js';
import {createWorldMath,currentWorld,makeWorld} from './world-seed.js';
import {createWorldStream} from './world-stream.js';
import {buildGroundSampler} from './player-physics.js';
import {springDistance,springBedHeight} from './spring-math.js';
import {installExtraModels} from './extra-models.js';
import {installExpeditionModels,mergeRefinements} from './expedition-models.js';
import {createExpedition} from './expedition.js';
import {createClimate} from './climate.js';
import {createCooperative,roomSession} from './cooperative.js';
import {createSelectionOutline} from './selection-outline.js';

const $ = id => document.getElementById(id);
let renderer, player, camera, scene, ocean, bedTarget,underwater,sky,hud,titleCamera,survival,spring,outline;
let clockTime = 0, previousTime = 0, ready = false, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let windTime = 0;
let worldMath,worldStream,sun,worldDescriptor,expedition,climate,cooperative;
let progress = 0;
const waves = { value: 0 };
const frameSize = new THREE.Vector2();
let measuredTime=0,measuredFrames=0;
let shadowX=Infinity,shadowZ=Infinity;

function setProgress(value, label) {
  progress = Math.min(100, Math.max(progress, Number.isFinite(value) ? value : progress));
  $('progress').style.width = `${progress}%`;
  $('percentage').textContent = `${Math.round(progress)}%`;
  if (label) $('load-detail').textContent = label;
}
function fail(error) {
  console.error(error);
  $('loading').classList.remove('ready');
  $('load-title').textContent = '小岛还没加载好';
  $('load-detail').textContent = '请检查网络，并使用支持 WebGL 2 的浏览器重试。';
  $('percentage').hidden = true;
  $('retry').hidden = false;
}
$('retry').addEventListener('click', () => location.reload());

function styleModel(model) {
  const report = deepenSeabed(model);
  const landReport=refineLand(model.getObjectByName('Island_Terrain'));
  document.documentElement.dataset.terrain=JSON.stringify(landReport);
  document.documentElement.dataset.seabed = JSON.stringify(report);
  const originalWater = model.getObjectByName('Clear_Ocean');
  if (originalWater) originalWater.visible = false;
  model.traverse(o => {
    if (!o.isMesh || o === originalWater) return;
    o.castShadow = o.name.startsWith('Island_Terrain');
    o.receiveShadow = true;
    if (o.name.startsWith('White_Broken_Surf')) {
      // Replace static ribbons with travelling, breaking fronts on the water.
      o.visible = false;
    } else if (o.name.startsWith('Submerged_Seagrass')) {
      o.material = o.material.clone();
      o.material.side = THREE.DoubleSide;
      o.material.roughness = .9;
    } else {
      o.material = o.material.clone();
      o.material.roughness = .95;
      o.material.metalness = 0;
      if(['Island_Terrain','Sand_Seafloor'].includes(o.name))dressSeabed(o,waves);
    }
  });
  scene.add(model);
}

function resize() {
  if (!renderer) return;
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  renderer.getDrawingBufferSize(frameSize);
  bedTarget.setSize(frameSize.x,frameSize.y);
  outline?.resize(frameSize.x,frameSize.y,renderer.getPixelRatio());
  underwater?.resize(frameSize.x,frameSize.y);
  ocean?.userData.reflection.resize(frameSize.x,frameSize.y);
  spring?.resize(frameSize.x,frameSize.y);
}
function tick(now) {
  if (!ready) return;
  const delta = Math.min(.15,Math.max(0,(now-previousTime)/1000));
  previousTime = now;
  if (document.hidden) return;
  if (!paused) clockTime += delta;
  waves.value = clockTime;
  document.documentElement.dataset.waveTime = clockTime.toFixed(2);
  player.update(delta,clockTime);
  const pos=player.getState();worldStream.update(pos.x,pos.z);ocean.userData.follow(pos.x,pos.z,worldMath.sample);sky.position.set(pos.x,0,pos.z);
  climate?.update(delta,clockTime,pos);
  sun.position.set(pos.x+SUN_DIRECTION.x*38,SUN_DIRECTION.y*38,pos.z+SUN_DIRECTION.z*38);sun.target.position.set(pos.x,0,pos.z);sun.target.updateMatrixWorld();
  if(Math.hypot(pos.x-shadowX,pos.z-shadowZ)>.5){renderer.shadowMap.needsUpdate=true;shadowX=pos.x;shadowZ=pos.z;}
  document.documentElement.dataset.world=JSON.stringify({seed:worldDescriptor.seed,chunks:worldStream.count,pending:worldStream.pending,x:pos.x,z:pos.z});
  survival?.update(delta,clockTime);
  if((player.getState().active||hud?.isTitleScreen())&&hud?.windEnabled()&&!hud.reduceMotion())windTime+=delta;
  survival?.updateWind(windTime);
  hud?.update(now);
  expedition?.update(delta,clockTime);cooperative?.update(delta);
  titleCamera.update(delta,clockTime,hud?.isTitleScreen()??true,hud?.reduceMotion()??false,pos);
  camera.updateMatrixWorld();
  const submerged=underwater.update(clockTime,-worldMath.sample(camera.position.x,camera.position.z)*3);
  renderer.toneMapping = THREE.NoToneMapping;
  spring.surface.visible=false;
  ocean.userData.reflection.render(renderer,scene,camera,ocean);
  ocean.visible = false;
  const springDistance=camera.position.distanceTo(spring.surface.position);
  if(springDistance<32)spring.reflection.render(renderer,scene,camera,spring.surface);
  renderer.setRenderTarget(bedTarget);
  renderer.render(scene,camera);
  ocean.visible = true;
  spring.surface.visible=true;
  if(submerged>0){
    renderer.setRenderTarget(underwater.target);renderer.render(scene,camera);
    renderer.toneMapping=THREE.NeutralToneMapping;underwater.render(renderer);
  }else{
    renderer.toneMapping=THREE.NeutralToneMapping;renderer.setRenderTarget(null);renderer.render(scene,camera);
  }
  outline.setSelection(player.getState().active?(expedition?.selectedModel||survival?.selectedModel):null);outline.render(renderer,camera);
  measuredTime+=delta;measuredFrames++;
  if(measuredTime>=1){document.documentElement.dataset.renderStats=JSON.stringify({fps:Math.round(measuredFrames/measuredTime),water:'gerstner-refraction-planar-reflection',reflectionSize:ocean.userData.reflection.target.width});measuredTime=0;measuredFrames=0;}
}

async function init() {
  renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label','第一人称小岛：WASD 移动，鼠标转头，C 下潜，空格跳跃或上浮，Esc 暂停');
  renderer.domElement.tabIndex = 0;
  renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;fail(new Error('WebGL context lost'));});
  $('viewport').appendChild(renderer.domElement);
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#c6eeff');
  camera = new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.07,1600);
  titleCamera=createTitleCamera(camera);
  sky=createSky(renderer);scene.add(sky);
  scene.environment=sky.userData.environment;
  scene.environmentIntensity=.28;
  underwater=createUnderwater(camera);
  bedTarget = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
  bedTarget.depthTexture = new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  outline=createSelectionOutline(bedTarget.depthTexture);
  const hemisphere=new THREE.HemisphereLight('#d9efff','#d6bd91',1.3);scene.add(hemisphere);
  sun = new THREE.DirectionalLight('#fff4dc',2.8);
  sun.position.copy(SUN_DIRECTION).multiplyScalar(38);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-27,right:27,top:27,bottom:-27,near:1,far:85});
  sun.shadow.normalBias = .06; sun.shadow.bias = -.0003;
  scene.add(sun,sun.target);scene.fog=new THREE.Fog('#b8dfe2',85,120);
  const fill=new THREE.DirectionalLight('#c9efff',.6);fill.position.set(12,15,-20);scene.add(fill);
  resize();
  setProgress(3,'载入真实 3D 地形');
  const gltf = await new GLTFLoader().loadAsync('./assets/island.glb',e=>{if(e.total>0)setProgress(3+e.loaded/e.total*80);});
  try{worldDescriptor=currentWorld(localStorage);if(worldDescriptor.legacy&&!localStorage.getItem('cozy-island-survival-v1'))worldDescriptor=makeWorld(localStorage,'');}catch{worldDescriptor={id:'session',seed:'海风-'+Date.now(),legacy:false};}
  const room=roomSession();if(room)worldDescriptor={id:'room-'+room.code,seed:room.seed,generation:17};
  titleCamera.scale=worldDescriptor.generation>=17?1.65:1;
  styleModel(gltf.scene);
  let springAnchor=prepareSpringTerrain(gltf.scene.getObjectByName('Island_Terrain'));
  const terrainSample=buildGroundSampler(gltf.scene.getObjectByName('Island_Terrain').geometry.attributes.position),seaSample=buildGroundSampler(gltf.scene.getObjectByName('Sand_Seafloor').geometry.attributes.position);
  worldMath=createWorldMath(worldDescriptor.seed,worldDescriptor.legacy?(x,z)=>Math.max(springAnchor.layoutSample(x,z),seaSample(x,z)):null,worldDescriptor);
  if(worldDescriptor.legacy){const generated=worldMath.sample;worldMath.sample=(x,z)=>Math.hypot(x,z)<42?Math.max(terrainSample(x,z),seaSample(x,z),springDistance(x,z)<1.18?springAnchor.base+springBedHeight(springDistance(x,z)):-Infinity):generated(x,z);}
  else{scene.remove(gltf.scene);springAnchor=worldMath.anchor;}
  worldStream=createWorldStream(scene,worldMath,waves,!!worldDescriptor.legacy);worldStream.update(0,4,true);
  document.documentElement.dataset.spring=JSON.stringify({x:springAnchor.x,z:springAnchor.z,waterY:springAnchor.waterY,base:springAnchor.base,carvedVertices:springAnchor.changed,optics:'depth-refraction-planar-reflection',revision:12});
  player=firstPerson(camera,renderer.domElement,gltf.scene.getObjectByName('Island_Terrain'),gltf.scene.getObjectByName('Sand_Seafloor'),springAnchor,worldMath);
  setProgress(85,'载入树木、工具和营地模型');
  const props=await new GLTFLoader().loadAsync('./assets/survival-props-14.glb',e=>{if(e.total>0)setProgress(85+e.loaded/e.total*6,'载入物件纹理与材质');});
  finishMaterials(props.scene,renderer);
  const extra=await new GLTFLoader().loadAsync('./assets/survival-extra-16.glb');
  finishMaterials(extra.scene,renderer);installExtraModels(extra.scene);
  setProgress(91,'整理探险者的行囊、船与野生动物');
  const models=await new GLTFLoader().loadAsync('./assets/expedition-20.glb');
  const refined=await new GLTFLoader().loadAsync('./assets/refinements-21.glb');mergeRefinements(models.scene,refined.scene);
  finishMaterials(models.scene,renderer);installExpeditionModels(models.scene);
  survival=createSurvival(scene,camera,player,()=>{renderer.shadowMap.needsUpdate=true;},props.scene,springAnchor.layoutSample,{world:worldMath,legacy:!!worldDescriptor.legacy,descriptor:worldDescriptor,saveKey:worldDescriptor.legacy?'cozy-island-survival-v1':'cozy-island-save-'+worldDescriptor.id});
  player.world=worldMath;
  hud=createHUD(player,{setWaves:enabled=>{paused=!enabled;},survival});
  expedition=createExpedition(scene,camera,player,survival,worldMath,()=>{renderer.shadowMap.needsUpdate=true;});
  cooperative=createCooperative(player,survival,expedition);climate=createClimate(scene,sun,fill,hemisphere,worldMath,survival);
  player.update(1);
  ocean=createWater(scene,camera,bedTarget,frameSize,waves,sky.userData.environment);
  spring=createSpringWater(scene,camera,bedTarget,frameSize,waves,sky.userData.environment,springAnchor,survival.springModel);
  spring.resize(frameSize.x,frameSize.y);
  ocean.userData.reflection.resize(frameSize.x,frameSize.y);
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  setProgress(92,'准备海面反射、清澈浅滩与岸边碎浪');
  await renderer.compileAsync(scene,camera);
  ready=true;
  previousTime=performance.now();
  tick(previousTime);
  setProgress(100,'小岛已准备好');
  $('loading').classList.add('ready');
  hud.ready();
  renderer.setAnimationLoop(tick);
  window.addEventListener('resize',resize);
}
init().catch(fail);
