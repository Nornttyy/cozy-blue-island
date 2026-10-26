import * as THREE from 'three';
import {expeditionModel,animateExplorer,animateWildlife} from './expedition-models.js';
import {createEquipmentViewmodel,poseEquipment,WEAPON_TIMING} from './equipment-viewmodel.js';
import {advanceBoat} from './boat-motion.js';
import {ITEMS} from './survival-state.js';
import {CHUNK} from './world-seed.js';
import {wildlifeIn,animalPose,SPECIES,hunt} from './wildlife-math.js';
import {createBowController} from './bow-controller.js';
export function createExpedition(scene,camera,player,survival,math,shadowChanged){
 // Only equipment belongs to the local view. Full characters remain visible to peers.
 const game=survival.game,creatures=new Map(),peers=new Map(),first=new THREE.Group();camera.add(first);first.name='First_person_tools';first.visible=false;
 const tools=Object.fromEntries(Object.entries({spear:'Spear',bow:'Bow',ironaxe:'IronAxe',ironpick:'IronPick'}).map(([id,name])=>[id,createEquipmentViewmodel(id,expeditionModel(name))]));for(const m of Object.values(tools))first.add(m);
 const bow=createBowController(scene,camera,player,survival,math,tools.bow);
 let cell='',target=null,attackAge=10,pendingStrike=null,lastAttack=-10,boatId=null,preview=null,remotePeers=[],lastShadow=0;
 const forward=new THREE.Vector3(),temp=new THREE.Vector3();
 const notice=survival.notify;
 function leaveBoat(){const b=game.state.buildings.find(v=>v.id===boatId);if(!b)return;const x=b.x+Math.cos(b.yaw)*1.6,z=b.z-Math.sin(b.yaw)*1.6;
  if(survival.networked)survival.execute('unboard',{id:b.id,x:b.x,z:b.z,yaw:b.yaw},()=>{});b.sailing=false;boatId=null;player.setVehicle(null);player.restore({x,z,yaw:b.yaw});notice('已离船 · 靠近船身点击可重新登船');survival.save();}
 function board(b){boatId=b.id;const motion={speed:0};player.setVehicle({id:b.id,heading:()=>game.state.buildings.find(v=>v.id===boatId)?.yaw||0,update(dt,input,yaw,time){const current=game.state.buildings.find(v=>v.id===boatId);if(!current){boatId=null;player.setVehicle(null);return null;}if(input.jump&&dt){leaveBoat();return null;}return advanceBoat(current,input,dt,math.sample,time,motion);}});notice('已登船 · W/S 划行，A/D 转船，鼠标环顾，空格离船');}
 function action(held,interaction){if(boatId)return true;if(interaction?.building&&interaction.type==='boat'){const b=game.state.buildings.find(v=>v.id===interaction.id);if(survival.networked)survival.execute('board',{id:b.id},()=>{});else board(b);return true;}
  if(held==='bow')return bow.begin();
  if(!ITEMS[held]?.weapon||interaction&&!target)return false;
  if(pendingStrike||game.state.elapsed-lastAttack<WEAPON_TIMING[held].duration)return true;
  lastAttack=game.state.elapsed;attackAge=0;pendingStrike={id:target?.id,tool:held,hit:false};return true;}
 survival.setExtension({action});
 function updatePeers(list){remotePeers=list;const ids=new Set(list.map(p=>p.id));for(const [id,g]of peers)if(!ids.has(id)){scene.remove(g);peers.delete(id);}for(const p of list){if(!peers.has(p.id)){const model=expeditionModel('Explorer');model.name='Coop_'+p.id;model.position.set(p.pose.x,p.pose.feet,p.pose.z);scene.add(model);peers.set(p.id,model);}}}
 const character=document.createElement('dialog');character.id='character-panel';character.className='expedition-panel';character.setAttribute('aria-labelledby','character-title');character.innerHTML='<header class="panel-top"><div><span class="panel-kicker">ISLAND FIELD NOTES</span><h2 id="character-title">海岛探险者</h2></div><button class="character-close icon-button" aria-label="关闭人物面板"><svg><use href="#i-close"/></svg></button></header><div class="expedition-panel-body"><figure class="character-portrait"><div class="character-view"></div><figcaption>远航手记 · 你的岛上身影</figcaption></figure><p>第一人称不显示手和手臂，朋友仍会看到你的完整角色。</p><div class="character-tags"><span>轻便背包</span><span>双桨航行</span><span>徒步与潜水</span></div></div><footer class="panel-footer"><span>轻装出发，慢慢探索。</span><button class="secondary character-return">收起手记</button></footer>';document.body.append(character);
 const btn=document.createElement('button');btn.className='world-button expedition-avatar';btn.innerHTML='<svg aria-hidden="true"><use href="#i-book"/></svg><span>查看探险者</span>';document.querySelector('#title-screen').append(btn);character.querySelector('.character-return').onclick=()=>character.close();
 btn.onclick=()=>{player.pause();character.showModal();if(!preview){const r=new THREE.WebGLRenderer({alpha:true,antialias:true});r.setPixelRatio(Math.min(devicePixelRatio,1.5));r.setSize(330,370);r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.NeutralToneMapping;character.querySelector('.character-view').append(r.domElement);const s=new THREE.Scene(),c=new THREE.PerspectiveCamera(30,330/370,.1,20),m=expeditionModel('Explorer');s.add(m,new THREE.HemisphereLight('#fff4da','#738a84',2.6));const key=new THREE.DirectionalLight('#fff2db',3);key.position.set(2,4,3);s.add(key);c.position.set(0,1.05,4.2);c.lookAt(0,.95,0);preview={r,s,c,m};}preview.r.setAnimationLoop(t=>{if(!character.open){preview.r.setAnimationLoop(null);return;}preview.m.rotation.y=Math.sin(t*.00024)*.55;preview.r.render(preview.s,preview.c);});};character.querySelector('button').onclick=()=>character.close();
 return {board,updatePeers,get boatId(){return boatId;},get selectedModel(){return player.getState().active&&!survival.isPlacing&&survival.interactionTarget?.type!=='drop'&&ITEMS[survival.held()]?.weapon?target?.model:null;},
  update(dt,time){const p=player.getState(),key=Math.floor(p.x/CHUNK)+','+Math.floor(p.z/CHUNK);attackAge+=dt;
   if(!p.active||boatId||pendingStrike&&pendingStrike.tool!==survival.held()){pendingStrike=null;attackAge=10;}
   if(pendingStrike){const timing=WEAPON_TIMING[pendingStrike.tool];
    if(!pendingStrike.hit&&attackAge>=timing.duration*timing.contact){pendingStrike.hit=true;
     if(pendingStrike.id&&target?.id===pendingStrike.id){const strike=pendingStrike,r=survival.execute('hunt',{id:strike.id,tool:strike.tool},()=>hunt(game,math,strike.id,strike.tool,player.getState()));if(!r.pending){notice(r.message);if(r.ok){survival.save();window.dispatchEvent(new Event('island:inventory'));}}}
    }
    if(attackAge>=timing.duration)pendingStrike=null;
   }
   if(key!==cell){cell=key;const wanted=new Map(),cx=Math.floor(p.x/CHUNK),cz=Math.floor(p.z/CHUNK);for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)for(const a of wildlifeIn(math,cx+i,cz+j))wanted.set(a.id,a);for(const [id,a]of creatures)if(!wanted.has(id)){scene.remove(a.model);creatures.delete(id);}for(const a of wanted.values())if(!creatures.has(a.id)){const model=expeditionModel(a.type);scene.add(model);creatures.set(a.id,{...a,model,lastDamage:-10});}shadowChanged();}
   target=null;let best=Infinity;camera.getWorldDirection(forward);for(const a of creatures.values()){const model=a.model,hp=game.state.wildlife?.[a.id]??SPECIES[a.type].hp;model.visible=hp>0;if(!model.visible)continue;const pos=animalPose(a,game.state.elapsed,math);model.position.set(pos.x,pos.y,pos.z);model.rotation.y=pos.yaw;const tail=model.getObjectByName('Tail');if(tail)tail.rotation.y=Math.sin(time*7)*.35;
    animateWildlife(model,a.type,game.state.elapsed+a.phase);
    if(a.previousHp!==undefined&&hp<a.previousHp)a.hitTime=time;a.previousHp=hp;
    if(a.hitTime!==undefined){const age=time-a.hitTime;if(age<.22){const recoil=Math.sin(age/.22*Math.PI)*.07;model.position.x+=Math.sin(p.yaw)*recoil;model.position.z+=Math.cos(p.yaw)*recoil;}}
    temp.set(pos.x,pos.y+(a.type==='Boar'?.4:.18),pos.z).sub(camera.position);const d=temp.length(),along=temp.dot(forward),off=Math.sqrt(Math.max(0,d*d-along*along));if(along>0&&d<(ITEMS[survival.held()]?.range||3)+1&&off<Math.max(.48,d*.025)&&d<best){target=a;best=d;}
    if(p.active&&a.type==='Boar'&&Math.hypot(p.x-pos.x,p.z-pos.z)<1.25&&Math.abs(p.feet-pos.y)<1&&game.state.elapsed-a.lastDamage>2){a.lastDamage=game.state.elapsed;game.state.vitals.health=Math.max(0,game.state.vitals.health-(game.state.inventory.leathervest?5.2:8));notice('野猪撞到了你 · 后退或用武器防身');document.body.classList.add('taking-hit');setTimeout(()=>document.body.classList.remove('taking-hit'),230);}
   }
   const pickingLoot=survival.interactionTarget?.type==='drop';if(target&&!pickingLoot&&!survival.isPlacing){if(p.active&&ITEMS[survival.held()]?.weapon){document.getElementById('interaction').hidden=false;document.getElementById('interaction-label').textContent=SPECIES[target.type].name;document.getElementById('interaction-caption').textContent=`${survival.held()==='bow'?'按住拉弓 · 松手射出':'左键攻击'} · ${game.state.wildlife?.[target.id]??SPECIES[target.type].hp} 体力`;}}
   first.visible=p.active&&!boatId;for(const [id,m]of Object.entries(tools)){m.visible=id===survival.held()&&game.state.inventory[id]>0;const phase=pendingStrike?.tool===id?attackAge/WEAPON_TIMING[id].duration:survival.swing>0?survival.swing:null;poseEquipment(m,camera.aspect,phase,time,p.speed||0);}
   bow.update(dt,time);
   for(const data of remotePeers){const g=peers.get(data.id),s=data.pose;if(!g)continue;g.position.lerp(temp.set(s.x,s.feet,s.z),1-Math.exp(-dt*9));const desired=s.yaw+Math.PI;g.rotation.y+=Math.atan2(Math.sin(desired-g.rotation.y),Math.cos(desired-g.rotation.y))*(1-Math.exp(-dt*10));animateExplorer(g,time,s.speed||0,s.mode==='swim'||s.mode==='dive');}
   if(time-lastShadow>1/20&&(creatures.size||peers.size||boatId)){shadowChanged();lastShadow=time;}
   if(boatId){const b=game.state.buildings.find(v=>v.id===boatId);if(b)document.getElementById('control-mode').textContent='W/S 划行 · A/D 转船 · 鼠标环顾 · 空格离船';}
   const env=document.getElementById('voyage-compass');if(env){env.hidden=!game.state.inventory.compass;if(!env.hidden&&math.nearest){const cx=Math.round(p.x/math.cell),cz=Math.round(p.z/math.cell);let nearest=null;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const a=math.island(cx+i,cz+j),d=Math.hypot(a.x-p.x,a.z-p.z);if(d>65&&(!nearest||d<nearest.d))nearest={...a,d};}if(nearest)env.textContent=`邻岛 ${Math.round(nearest.d)} 米 · 方位 ${Math.round((Math.atan2(nearest.x-p.x,-(nearest.z-p.z))*180/Math.PI+360)%360)}°`;}}
   document.documentElement.dataset.expedition=JSON.stringify({creatures:creatures.size,peers:peers.size,boat:boatId,held:survival.held(),target:target?.type||null});
  }
 };
}
