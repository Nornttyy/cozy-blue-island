import * as THREE from 'three';
import {SAVE_KEY,ITEMS,RECIPES,NODE_TYPES,TREE_HITS,LOG_HITS,SurvivalState,makeLayout,decodeSave,matchesTool} from './survival-state.js';
import {createSurvivalWorld} from './survival-world.js';
import {createAxeViewmodel,poseAxe} from './axe-viewmodel.js';
import {extraModel} from './extra-models.js';
import {CHUNK} from './world-seed.js';
export const QUICK_ITEMS=['hand','axe','berry','coconut','meal','shell'];
export function createSurvival(scene,camera,player,shadowChanged,assets,layoutSample=player.sampleLand,options={}){
  const saveKey=options.saveKey||SAVE_KEY,math=options.world;
  const baseNodes=makeLayout(layoutSample);if(math&&!options.legacy){baseNodes.splice(5);for(const [i,type]of ['tree','tree','stone','herb','flint','clay','mushroom'].entries()){const x=Math.cos(i*.83)*8,z=3+Math.sin(i*.83)*8;baseNodes.push({id:'start'+i,type,x,z,y:player.sampleLand(x,z)});}}
  const nodes=[...baseNodes];let saved=null,saveWarning='',saveBlocked=false;
  try{const raw=localStorage.getItem(saveKey);if(raw){try{saved=decodeSave(raw,nodes,player.sampleLand,!!math);}catch{localStorage.setItem(saveKey+'-recovery',raw);saveWarning='旧存档无法读取，已保留备份并开始新营地';}}}catch{saveWarning='浏览器不能保存，本次进度请勿刷新';saveBlocked=true;}
  const game=new SurvivalState(nodes,player.sampleLand,saved),world=createSurvivalWorld(scene,game,shadowChanged,assets);
  player.setCollision(world.canMove);if(saved?.position)player.restore(saved.position);
  game.expanded=!!math;let nodeCell='',dropRevision=-1,cellNodes=[];
  function streamNodes(s){if(!math)return;game.view=s;const cx=Math.floor(s.x/CHUNK),cz=Math.floor(s.z/CHUNK),key=cx+','+cz;
    if(key!==nodeCell){nodeCell=key;cellNodes=[];for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++)cellNodes.push(...math.nodes(cx+i,cz+j));dropRevision=-1;}
    if(dropRevision!==game.revision){dropRevision=game.revision;nodes.splice(0,nodes.length,...baseNodes.filter(n=>n.type==='spring'||Math.hypot(n.x-s.x,n.z-s.z)<100),...cellNodes,...game.state.drops.filter(d=>Math.hypot(d.x-s.x,d.z-s.z)<90));world.sync();}
  }
  let selected=game.state.selected||0,attack=null,target=null,building=null,placement=null,lastSave=0,saveState=saved?'已读取本机存档':'本机自动存档',noticeOnce=false,extension=null,remoteAction=null;
  const held=()=>game.state.hotbar[selected]||'hand';
  const prompt=document.getElementById('interaction'),label=document.getElementById('interaction-label'),caption=document.getElementById('interaction-caption'),bar=document.getElementById('interaction-progress');
  const notify=message=>window.dispatchEvent(new CustomEvent('island:notice',{detail:message}));
  function save(){
    if(remoteAction)return;
    if(saveBlocked)return;
    const s=player.getState();if(player.sampleLand(s.x,s.z)>.1)game.state.position={x:s.x,z:s.z,yaw:s.yaw};
    game.bag();try{localStorage.setItem(saveKey,JSON.stringify(game.state));saveState='进度已存到本机';}catch{saveState='保存失败 · 请勿刷新';if(!noticeOnce){notify('浏览器存储不可用，进度暂时只能保留在本次');noticeOnce=true;}}
  }
  function result(r){if(r.pending)return r;if(r.ok){save();window.dispatchEvent(new Event('island:inventory'));}if(r.message)notify(r.message);return r;}
  function execute(kind,args,local){if(remoteAction){remoteAction(kind,args).then(result).catch(e=>notify(e.message));return {ok:false,pending:true,message:'同步中'};}return local();}
  const useItem=id=>result(execute('eat',{id},()=>game.eat(id)));
  const putDown=index=>result(execute('drop',{index},()=>game.drop(index,player.getState())));
  function select(i){selected=Math.max(0,Math.min(7,i));game.state.selected=selected;attack=null;}
  function cancelBuild(){building=null;placement=null;attack=null;world.preview(null);}
  function startBuild(type){building=type;attack=null;notify('绿色可以放置 · 左键确认，右键取消 · 材料在确认后扣除');}
  function action(){
    if(!player.getState().active||attack)return;
    if(building&&placement){const r=execute('build',{type:building,...placement},()=>game.build(building,placement.x,placement.z,placement.yaw,player.getState()));if(r.ok||r.pending){cancelBuild();world.sync();}if(!r.pending)result(r);return;}
    if(extension?.action(held(),target))return;
    if(ITEMS[held()]?.food||ITEMS[held()]?.water||ITEMS[held()]?.health){useItem(held());return;}
    if(target?.building){if(target.type==='shelter')result(game.rest(game.state.buildings.find(b=>b.id===target.id)));else window.dispatchEvent(new Event('island:craft-open'));return;}
    if(!target)return;
    if(target.type==='drop'){if(remoteAction){execute('pickup',{id:target.id},()=>{});return;}if(!game.canFit({[target.item]:target.count})){notify('背包已满，先腾出格子');return;}game.add({[target.item]:target.count});game.state.drops=game.state.drops.filter(d=>d.id!==target.id);result({ok:true,message:'捡回了 '+ITEMS[target.item].name});return;}
    const node=target.source||target,rule=NODE_TYPES[node.type];
    if(rule.tool&&(!matchesTool(held(),rule.tool)||!game.state.inventory[held()])){notify('需要装备'+ITEMS[rule.tool].name+' · B 背包绑定快捷键');return;}
    if(node.type==='tree'&&game.treeStage(node).phase==='falling')return;
    attack={node,age:0,hit:false,duration:held()==='ironaxe'?.36:node.type==='tree'?.58:.4,tool:held()};
  }
  window.addEventListener('island:primary',action);
  const cancel=()=>{if(building){cancelBuild();notify('已取消建造，材料没有消耗');}};
  window.addEventListener('island:cancel-build',cancel);
  document.addEventListener('keydown',e=>{
    if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||!player.getState().active)return;
    if(e.code==='KeyF'){e.preventDefault();useItem(held());}
    if(e.code==='KeyQ'){e.preventDefault();putDown(game.bag().findIndex(s=>s?.id===held()));}
    if(e.code==='KeyR'){e.preventDefault();cancel();}
  });
  window.addEventListener('island:activity',()=>{if(!player.getState().active){attack=null;save();}});
  window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.hidden)save();});
  const forward=new THREE.Vector3(),to=new THREE.Vector3();
  function findTarget(s){
    forward.set(-Math.sin(s.yaw),0,-Math.cos(s.yaw));let best=null,score=-Infinity;
    const objects=[...nodes.filter(n=>game.available(n)).map(n=>game.interactionNode(n)),...game.state.buildings.map(b=>({...b,building:true}))];
    for(const n of objects){
      const d=Math.hypot(n.x-s.x,n.z-s.z),dy=Math.abs(n.y-s.feet);if(d>3||dy>1.9)continue;
      to.set(n.x-s.x,0,n.z-s.z).normalize();const facing=to.dot(forward);if(d>.65&&facing<.15)continue;
      const locked=n.type==='tree'&&(!matchesTool(held(),'axe')||!game.state.inventory[held()]);
      const rank=facing*1.2-d*.35-(locked?1:0);if(rank>score){score=rank;best=n;}
    }return best;
  }
  const tool=createAxeViewmodel(world.tool);camera.add(tool);scene.add(camera);
  const pick=extraModel('pickaxe'),torch=extraModel('torch');camera.add(pick,torch);pick.position.set(.35,-.48,-.75);pick.rotation.z=-.45;torch.position.set(.35,-.48,-.75);const lamp=new THREE.PointLight('#ffc573',2.5,9,2);torch.add(lamp);lamp.position.y=.75;
  world.sync();
  return {
    game,select,startBuild,save,held,notify,execute,hasSave:!!saved,springModel:world.spring,world:options.descriptor,
    setExtension(value){extension=value;},setRemote(value){remoteAction=value;},get networked(){return !!remoteAction;},
    applyShared(state){for(const key of ['inventory','bag','depleted','trees','buildings','drops','nextDrop','goals','wildlife'])if(state[key]!==undefined)game.state[key]=structuredClone(state[key]);game.state.elapsed=state.elapsed;game.changed();world.sync();window.dispatchEvent(new Event('island:inventory'));},
    get swing(){return attack?attack.age/attack.duration:0;},
    bind:(id,i)=>result(game.bind(id,i)),move:(from,to,split)=>result(execute('move',{from,to,split},()=>game.rearrange(from,to,split))),sort:()=>result(execute('sort',{},()=>game.sortBag())),drop:putDown,
    updateWind:time=>world.updateWind(time),
    get selected(){return selected;},get saveState(){return remoteAction?'合作房间保存 · 与本机存档分开':saveBlocked?'仅本次游玩 · 未存档':saveState;},
    eat:useItem,craft:id=>{const r=execute('craft',{id},()=>game.craft(id,player.getState()));return r.pending?r:result(r);},
    update(dt,time){
      const s=player.getState(),active=s.active;
      streamNodes(s);
      const outcome=game.tick(dt,active);if(outcome){player.restore(outcome.respawn);result({ok:true,message:outcome.message});player.pause();return;}
      if(active&&saveWarning){notify(saveWarning);saveWarning='';}
      if(active){lastSave+=dt;if(lastSave>10){save();lastSave=0;}}
      tool.visible=active&&held()==='axe'&&game.state.inventory.axe>0;pick.visible=active&&held()==='pickaxe'&&game.state.inventory.pickaxe>0;torch.visible=active&&held()==='torch'&&game.state.inventory.torch>0;
      const phase=attack?Math.min(1,(attack.age+dt)/attack.duration):0;
      // One click is one wrist-driven swing; model mounting stays blade-forward.
      poseAxe(tool,camera.aspect,attack?.node.type==='tree'?phase:null);
      pick.rotation.x=attack?-.7*Math.sin(phase*Math.PI):0;
      if(!active){prompt.hidden=true;world.highlight(null);world.preview(null);return;}
      target=findTarget(s);
      if(attack){
        attack.age+=dt;
        if(!attack.hit&&attack.age>=attack.duration*.45){
          attack.hit=true;const n=attack.node,p=game.interactionNode(n);
          if(target?.id===n.id&&Math.hypot(p.x-s.x,p.z-s.z)<=3){
            const r=execute(n.type==='tree'?'tree':'harvest',{id:n.id,tool:attack.tool},()=>n.type==='tree'?game.strikeTree(n,attack.tool,s):game.harvest(n,attack.tool));
            if((r.ok||r.pending)&&n.type==='tree')world.impact(n);if(!r.pending)result(r);world.sync();
          }
        }
        if(attack.age>=attack.duration)attack=null;
      }
      let progress=0;
      if(building){
        const x=s.x-Math.sin(s.yaw)*3.3,z=s.z-Math.cos(s.yaw)*3.3;
        placement={x,z,y:player.sampleLand(x,z),yaw:s.yaw};const reason=game.placement(building,x,z,s);
        world.preview(building,placement,!reason);world.highlight(null);prompt.hidden=false;prompt.classList.toggle('invalid',!!reason);
        label.textContent=reason||'可以建造在这里';caption.textContent='左键确认放置 · 右键取消';
      }else{
        prompt.hidden=!target;prompt.classList.remove('invalid');
        if(target){
          if(target.building){label.textContent=RECIPES[target.type].name;caption.textContent=target.type==='boat'?'左键 · 登船；空格离船':target.type==='shelter'?'左键 · 休息 / 设为营地':'左键 · 打开制作';}
          else if(target.type==='drop'){label.textContent=ITEMS[target.item].name+' ×'+target.count;caption.textContent='左键 · 捡回物品';}
          else{
            const rule=NODE_TYPES[target.type],locked=rule.tool&&(!matchesTool(held(),rule.tool)||!game.state.inventory[held()]);
            label.textContent=rule.name;caption.textContent=target.type==='spring'?'左键 · 喝淡水':'左键 · 拾取';
            if(target.type==='spring'&&held()==='flask')caption.textContent='左键 · 水壶装水';else if(locked)caption.textContent='需要装备'+ITEMS[rule.tool].name;
            if(target.type==='tree'){
              const t=game.treeStage(target),fallen=t.phase==='fallen';progress=t.hits/(fallen?LOG_HITS:TREE_HITS);
              label.textContent=fallen?'倒下的树干':t.phase==='falling'?'树正在倒下':[2,5].includes(target.biome)?'松树':[1,4].includes(target.biome)?'阔叶树':'棕榈树';
              caption.textContent=locked?'需要石斧 · B 制作并绑定快捷栏':t.phase==='falling'?'等落地后，再劈成木材':fallen?'左键劈木 · '+t.hits+'/'+LOG_HITS:'左键挥斧 · '+t.hits+'/'+TREE_HITS;
            }else progress=attack?.node.id===target.id?Math.min(1,phase/.45):0;
          }
        }
        world.highlight(target,progress);
      }
      bar.style.width=Math.min(100,progress*100)+'%';
      world.update(time,attack?.node,phase,dt);
      document.documentElement.dataset.survival=JSON.stringify({inventory:game.state.inventory,vitals:game.state.vitals,goals:game.state.goals,buildings:game.state.buildings.length,trees:game.state.trees,target:target?{id:target.id,type:target.type,x:target.x,z:target.z}:null,building,save:saveState});
    }
  };
}
