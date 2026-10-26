import {TASKS,headingFromYaw,bearingOffset,cleanPreferences,ExplorationJournal} from './hud-state.js';
import {pointerLockMessage} from './pointer-lock.js';
import {ITEMS,GOALS} from './survival-state.js';
import {readWorlds,makeWorld,selectWorld} from './world-seed.js';
import {inventoryHTML,craftHTML,journalHTML} from './survival-panels.js';
import {HOTBAR_SIZE} from './inventory.js';
import {createInventoryUI} from './inventory-ui.js';
const $=id=>document.getElementById(id);
import {itemIcon as icon} from './item-icons.js';
const PREFS_KEY='cozy-island-interface-v1';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function createHUD(player,{setWaves,survival}){
  let prefs;
  try{prefs=cleanPreferences(JSON.parse(localStorage.getItem(PREFS_KEY)||'{}'));}catch{prefs=cleanPreferences();}
  const journal=new ExplorationJournal(),panel=$('field-panel');
  document.querySelector('.equipped-label small').textContent='1–9 / 滚轮 · E 背包';
  let panelPage=null,returnToPlay=false,started=survival.hasSave,titleScreen=true,enabled=false,lastTick=0,toastTimer,selected=survival.selected,bagSelected=0;
  const inventoryUI=createInventoryUI({panel,survival,active:()=>panel.open&&panelPage==='inventory',refresh:()=>renderPanel(),choose:i=>{bagSelected=i;}});
  const bearings=Array.from({length:24},(_,i)=>{const el=document.createElement('span');el.className='bearing'+(i%3===0?' major':'');el.textContent=i%3===0?['北','东北','东','东南','南','西南','西','西北'][i/3]:'·';$('compass-ticks').append(el);return el;});
  const slots=Array.from({length:HOTBAR_SIZE},(_,i)=>{
    const button=document.createElement('button');button.type='button';button.className='quick-slot';
    button.innerHTML=`<kbd>${i+1}</kbd>${i===0?icon('hand'):'<span class="empty-slot">·</span>'}`;
    button.setAttribute('aria-label',`快捷栏 ${i+1}：${i===0?'空手':'空格位'}`);
    button.addEventListener('click',()=>select(i,true));$('hotbar').append(button);return button;
  });
  function select(index){selected=index;survival.select(index);updateSlots();}
  function updateSlots(){const bag=survival.game.bag();slots.forEach((el,i)=>{const stack=bag[i],item=ITEMS[stack?.id];el.classList.toggle('selected',i===selected);el.classList.remove('unavailable');el.setAttribute('aria-pressed',String(i===selected));el.setAttribute('aria-label',`快捷栏 ${i+1}：${item?.name||'空手'}${item?'，'+stack.count:''}`);el.innerHTML=`<kbd>${i+1}</kbd>${item?icon(stack.id):''}${stack?.count>1?'<small class="slot-count">'+stack.count+'</small>':''}`;});const item=ITEMS[bag[selected]?.id];$('equipped-name').textContent=item?item.name+(item.placeable?' · 左键放置':item.food||item.water||item.health?' · 左键使用':bag[selected].id==='bow'?' · 按住拉弓，松手射出':''):'空手 · 左键拾取';}
  function toast(text){clearTimeout(toastTimer);$('hud-toast').textContent=text;$('hud-toast').classList.add('show');if(panel.open)$('panel-footer-note').textContent=text;toastTimer=setTimeout(()=>$('hud-toast').classList.remove('show'),3200);}
  function applyPreferences(save=false){
    document.body.classList.toggle('hidden-guidance',!prefs.guidance);document.body.classList.toggle('reduced-motion',prefs.reducedMotion);
    player.setSensitivity(prefs.sensitivity);player.setReducedMotion?.(prefs.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches);setWaves(prefs.waves);
    if(save){try{localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));}catch{$('panel-footer-note').textContent='浏览器禁止存储，设置仅在本次生效';}}
  }
  function sync(){
    if(!enabled)return;
    const {active,locked,lockPending,lockError}=player.getState();
    $('enter-island').disabled=lockPending;
    $('enter-label').textContent=lockPending?'正在锁定鼠标…':lockError?'重试锁定鼠标':'锁定鼠标，继续探索';
    $('pause-title').textContent=lockPending?'准备进入小岛':lockError?'鼠标尚未锁定':'歇一会儿';
    $('pause-description').textContent=lockPending?'请确认浏览器的鼠标锁定提示。':lockError?pointerLockMessage(lockError):'点击下方按钮锁定鼠标；Esc 释放并暂停。';
    $('pointer-lock-help').hidden=!lockError;
    $('pointer-lock-error').textContent=lockError?'浏览器返回：'+lockError:'';
    document.body.classList.toggle('pointer-locked',locked);
    $('walk-gate').hidden=active||panel.open||titleScreen;
    $('walk-gate').inert=active||panel.open||titleScreen;
    $('title-screen').hidden=!titleScreen||panel.open;
    $('title-screen').inert=!titleScreen||panel.open;
    document.body.classList.toggle('title-mode',titleScreen);
    document.body.classList.toggle('menu-open',!active);
    document.body.classList.toggle('panel-open',panel.open);
    $('title-start-label').textContent=started?'继续我的营地':'开始岛上生活';
  }
  function begin(){started=true;titleScreen=false;player.begin();}
  function open(page){
    if(!enabled)return;
    inventoryUI.cancel();
    if(!panel.open){returnToPlay=player.getState().active;panel.showModal();}
    player.pause();panelPage=page;renderPanel();$('panel-content').scrollTop=0;sync();
  }
  function close(resume=returnToPlay){panel.close();panelPage=null;inventoryUI.cancel();if(resume)begin();else{sync();$(titleScreen?'title-start':'enter-island').focus();}}
  function renderPanel(){
    const titles={inventory:'随身行囊',craft:'营地制作',map:'海域地图',worlds:'我的世界',journal:'海岛手账',settings:'游戏设置',guide:'操作指南'};
    panel.classList.toggle('inventory-panel',panelPage==='inventory');
    panel.classList.toggle('title-settings-panel',titleScreen&&['settings','guide','worlds'].includes(panelPage));
    $('panel-resume').innerHTML=(titleScreen?'返回主菜单':'返回小岛')+'<svg aria-hidden="true"><use href="#i-arrow"/></svg>';
    $('panel-title').textContent=titles[panelPage];document.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-current',String(el.dataset.tab===panelPage)));
    $('panel-footer-note').textContent=survival.saveState;
    if(panelPage==='worlds'){
      let worlds=[];try{worlds=readWorlds(localStorage);}catch{}
      $('panel-content').innerHTML=`<p class="world-note">当前种子：<b>${escape(survival.world?.seed||'旧营地')}</b><br>新建世界不会删除旧营地。同一种子产生相同地形与资源位置。</p><label class="seed-label">世界种子（可不填）<input id="world-seed" maxlength="40" placeholder="例如：海风和椰子" /></label><button class="primary" data-new-world="1">创建随机世界</button><div class="world-list"><button data-load-world="legacy">原来的小岛存档 <span>保留</span></button>${worlds.map(w=>`<button data-load-world="${w.id}">${escape(w.seed)}<span>${w.id===survival.world?.id?'当前世界':'进入'}</span></button>`).join('')}</div><p class="bag-tip">按需生成周围地块，走远后卸载，返回时重建；采集、倒木与建筑状态会保留。存档只在当前浏览器内。</p>`;
      $('panel-content').querySelector('[data-new-world]').textContent='创建远航世界 · 六种群系';
      $('panel-content').querySelector('.world-note').append(document.createTextNode(' 旧世界保留原地形；新世界使用更远的群岛与更明显的山丘。'));
    }else if(panelPage==='inventory'){
      $('panel-content').innerHTML=inventoryHTML(survival,player,bagSelected,inventoryUI.cursor.carry,inventoryUI.cursor.pending);inventoryUI.paint();
    }else if(panelPage==='craft'){
      $('panel-content').innerHTML=craftHTML(survival,player);
    }else if(panelPage==='map'){
      $('panel-content').innerHTML=`<div class="map-layout"><div class="map-paper"><span class="map-north">N ↑</span><canvas id="island-map" width="520" height="520" aria-label="根据实际地形绘制的地图，橙色箭头标记玩家位置"></canvas></div><aside class="map-info"><h3>晴蓝小岛</h3><p>从海岸线，<br>找到自己的方向。</p><dl><dt>所在位置</dt><dd id="map-region"></dd><dt>本地坐标</dt><dd id="map-coordinates"></dd><dt>面向</dt><dd id="map-heading"></dd></dl><span class="map-legend"><i></i> 你在这里</span></aside></div>`;
      drawMap($('island-map'));updateMapText(player.getState());
    }else if(panelPage==='journal'){
      $('panel-content').innerHTML=journalHTML(survival);
    }else if(panelPage==='guide'){
      $('panel-content').innerHTML=`<div class="guide-grid"><div class="guide-row"><span>移动 / 加速</span><span><kbd>WASD</kbd> / <kbd>Shift</kbd></span></div><div class="guide-row"><span>观察四周</span><span>移动鼠标，无需按住</span></div><div class="guide-row"><span>采集 / 喝水 / 砍树</span><span>靠近并点击 <kbd>左键</kbd></span></div><div class="guide-row"><span>背包与制作 / 地图 / 手账</span><span><kbd>E / B</kbd> / <kbd>M</kbd> / <kbd>J</kbd></span></div><div class="guide-row"><span>切换物品 / 选择空格</span><span><kbd>1–9</kbd> 或滚轮 / <kbd>0</kbd></span></div><div class="guide-row"><span>使用消耗品 / 放下一个</span><span><kbd>左键</kbd> 或 <kbd>F</kbd> / <kbd>Q</kbd></span></div><div class="guide-row"><span>放置建筑 / 取消建造</span><span><kbd>左键</kbd> / <kbd>右键</kbd></span></div><div class="guide-row"><span>跳跃、上浮 / 下潜</span><span><kbd>Space</kbd> / <kbd>C</kbd></span></div><div class="guide-row"><span>暂停</span><kbd>Esc</kbd></div></div><p class="guide-note">先捡枯枝、石块和长叶草，做一把石斧。挥斧砍倒树，等树落地后再劈成木材。背包支持拖动、右键拆半、Shift 点击快速转移和九格快捷栏。制作工作台后可以做石镐，开采燧石和黏土。暂停不会消耗状态；在陆地自动存档，潜水退出后会从最近的陆地位置继续。当前采用电脑键鼠操作。</p>`;
      $('panel-content').insertAdjacentHTML('beforeend','<p class="guide-note">远航：在浅海放置双桨木船，靠近左键登船。W/S 前后划行，A/D 转船，鼠标环顾，空格离船。工作台可制作弓、铁制工具与皮甲；猎矛可捕鱼、狩猎，弓需要箭矢；按住左键蓄力、松手射出，右键取消。箭会下坠，远处目标要稍抬高准星。皮甲在背包中自动生效。罗盘会标出邻岛方向。合作房间共享物资、营地和昼夜天气，保留 24 小时，个人暂停不暂停其他人的世界。</p>');
    }else{
      $('panel-content').innerHTML=`<label class="setting-row"><span>探索提示<small>显示手账目标与底部操作说明</small></span><input id="setting-guidance" type="checkbox" ${prefs.guidance?'checked':''}></label><label class="setting-row"><span>减少界面动效<small>保留清晰反馈，关闭面板过渡动画</small></span><input id="setting-reduced" type="checkbox" ${prefs.reducedMotion?'checked':''}></label><label class="setting-row"><span>海浪流动<small>控制海面、泡沫与水下光斑的动态</small></span><input id="setting-waves" type="checkbox" ${prefs.waves?'checked':''}></label><label class="setting-row"><span>转头灵敏度<small>鼠标自由转头</small></span><span class="setting-value"><output id="sensitivity-value">${prefs.sensitivity.toFixed(1)}×</output><br><input id="setting-sensitivity" aria-label="转头灵敏度" type="range" min="0.5" max="2" step="0.1" value="${prefs.sensitivity}"></span></label><div class="safety-actions"><button id="home" class="secondary">回到草地起点</button><button id="shore" class="secondary">前往海边体验</button></div><p class="settings-note">若卡在地形中，可返回起点。进度自动保存在本机；暂停不会消耗状态，返回起点不会清空物资。</p>`;
      $('panel-content').querySelector('.settings-note').textContent='进度自动保存在当前浏览器。清除网站数据会丢失存档；回到起点不会清除物品与已建营地。';
      $('setting-waves').closest('label').insertAdjacentHTML('afterend',`<label class="setting-row"><span>植被随风<small>树冠、草叶和灌木轻摆，暂停时停止</small></span><input id="setting-wind" type="checkbox" ${prefs.wind?'checked':''}></label>`);
      $('setting-reduced').closest('label').querySelector('span').innerHTML='减少动态效果<small>关闭界面过渡、植被风动与菜单运镜</small>';
      for(const [id,key] of [['guidance','guidance'],['reduced','reducedMotion'],['waves','waves'],['wind','wind']])$('setting-'+id).addEventListener('change',e=>{prefs[key]=e.target.checked;applyPreferences(true);});
      $('setting-sensitivity').addEventListener('input',e=>{prefs.sensitivity=Number(e.target.value);$('sensitivity-value').textContent=prefs.sensitivity.toFixed(1)+'×';applyPreferences(true);});
      if(survival.networked)$('panel-content').querySelector('.settings-note').textContent='联机物资与营地由房间保存，保留 24 小时。回到起点不会清空物资；请先离船再重新定位。';
      $('home').addEventListener('click',()=>{if(player.getState().vehicle){toast('请先空格离船，再回到起点');return;}player.reset();close(true);toast('已回到草地起点');});
      $('shore').addEventListener('click',()=>{if(player.getState().vehicle){toast('请先空格离船，再重新定位');return;}player.reset(true);close(true);toast('已来到海边');});
    }
  }
  function region(s){return s.mode==='dive'?'浅海水下':s.mode==='swim'?'近岸海域':s.mode==='wade'?'潮间浅滩':'岛上陆地';}
  function updateMapText(s){$('map-region').textContent=region(s);$('map-coordinates').textContent=`X ${s.x.toFixed(1)} · Z ${s.z.toFixed(1)}`;$('map-heading').textContent=`${headingFromYaw(s.yaw).label} · ${Math.round(headingFromYaw(s.yaw).degrees)%360}°`;}
  // Sample the rendered island, not a decorative or invented map.
  const mapBase=document.createElement('canvas');mapBase.width=mapBase.height=384;
  mapBase.width=mapBase.height=160;const mapContext=mapBase.getContext('2d'),pixels=mapContext.createImageData(160,160);let mapX=Infinity,mapZ=Infinity;
  const mapExtent=survival.world?.generation>=17?256:96;
  function refreshMap(s){const cx=Math.floor(s.x/32)*32,cz=Math.floor(s.z/32)*32;if(cx===mapX&&cz===mapZ)return;mapX=cx;mapZ=cz;
  for(let y=0;y<160;y++)for(let x=0;x<160;x++){
    const h=player.sampleLand(mapX+(x/159-.5)*mapExtent*2,mapZ+(y/159-.5)*mapExtent*2);
    const color=h>1.25?[145,169,115]:h>.65?[171,188,133]:h>-.04?[235,222,171]:h>-.7?[166,206,192]:[181,216,203];
    const p=(y*160+x)*4;pixels.data.set([...color,255],p);
  }
  mapContext.putImageData(pixels,0,0);}
  function drawMap(canvas){
    if(!canvas)return;
    const c=canvas.getContext('2d'),s=player.getState(),w=canvas.width,h=canvas.height;
    refreshMap(s);const extent=mapExtent,size=Math.min(w,h)*.91;
    c.clearRect(0,0,w,h);c.save();c.translate((w-size)/2,(h-size)/2);
    c.globalAlpha=.85;c.drawImage(mapBase,0,0,size,size);c.globalAlpha=1;
    c.strokeStyle='#668e6c22';c.lineWidth=.7;
    for(let i=0;i<=8;i++){c.beginPath();c.moveTo(i*size/8,0);c.lineTo(i*size/8,size);c.moveTo(0,i*size/8);c.lineTo(size,i*size/8);c.stroke();}
    const markers=[...survival.game.nodes.filter(n=>n.type==='spring'),...survival.game.state.buildings];
    for(const m of markers){const x=((m.x-mapX)/(extent*2)+.5)*size,z=((m.z-mapZ)/(extent*2)+.5)*size;if(x<0||z<0||x>size||z>size)continue;c.fillStyle=m.type==='spring'?'#349da8':'#8c6746';c.beginPath();c.arc(x,z,7,0,Math.PI*2);c.fill();c.fillStyle='#fffef1';c.font='bold 9px system-ui';c.textAlign='center';c.fillText(m.type==='spring'?'泉':m.type==='shelter'?'家':m.type==='bench'?'台':'火',x,z+3);}c.textAlign='left';
    const px=((s.x-mapX)/(extent*2)+.5)*size,pz=((s.z-mapZ)/(extent*2)+.5)*size;
    c.save();c.translate(px,pz);c.rotate(-s.yaw);c.fillStyle='#df9065';c.strokeStyle='#fffdf0';c.lineWidth=2;c.shadowColor='#335c4466';c.shadowBlur=5;c.beginPath();c.moveTo(0,-10);c.lineTo(7,8);c.lineTo(0,5);c.lineTo(-7,8);c.closePath();c.fill();c.stroke();c.restore();
    const meters=extent>96?50:10,bar=meters/(extent*2)*size;c.strokeStyle='#658771';c.lineWidth=2;c.beginPath();c.moveTo(10,size-15);c.lineTo(10+bar,size-15);c.stroke();c.fillStyle='#668670';c.font='10px system-ui';c.fillText(meters+' m',10,size-22);c.restore();
  }
  function updateJournal(s){
    const goals=survival.game.state.goals,count=GOALS.filter(([id])=>goals[id]).length;
    $('goal-count').textContent=count+'/'+GOALS.length;$('goal-progress').style.width=count/GOALS.length*100+'%';
    $('next-goal').textContent=GOALS.find(([id])=>!goals[id])?.[1]||'营地建成了，继续享受岛上生活';
  }
  document.querySelectorAll('[data-open]').forEach(el=>el.addEventListener('click',()=>open(el.dataset.open)));
  document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>{inventoryUI.cancel();panelPage=el.dataset.tab;renderPanel();$('panel-content').scrollTop=0;}));
  $('settings-open').addEventListener('click',()=>open('settings'));
  $('title-start').addEventListener('click',begin);
  $('title-settings').addEventListener('click',()=>open('settings'));
  $('title-guide').addEventListener('click',()=>open('guide'));
  $('title-worlds').addEventListener('click',()=>open('worlds'));
  $('return-title').addEventListener('click',()=>{titleScreen=true;player.pause();sync();$('title-start').focus();});
  $('enter-island').addEventListener('click',begin);$('pause-walk').addEventListener('click',()=>player.pause());
  $('copy-game-link').addEventListener('click',async()=>{
    const link=new URL(location.href);link.search='';link.hash='';
    try{await navigator.clipboard.writeText(link.href);$('copy-game-link').textContent='已复制 · 粘贴到 Chrome 地址栏';}
    catch{$('game-link-manual').hidden=false;$('game-link-manual').value=link.href;$('game-link-manual').focus();$('game-link-manual').select();}
  });
  $('panel-close').addEventListener('click',()=>close());$('panel-resume').addEventListener('click',()=>close(!titleScreen));
  panel.addEventListener('cancel',e=>{e.preventDefault();close();});
  $('goal-toggle').addEventListener('click',()=>{const collapsed=$('goal-toggle').getAttribute('aria-expanded')==='true';$('goal-toggle').setAttribute('aria-expanded',String(!collapsed));$('goal-detail').hidden=collapsed;});
  window.addEventListener('island:activity',sync);window.addEventListener('island:relocated',()=>journal.relocate());
  window.addEventListener('island:notice',e=>toast(e.detail));
  window.addEventListener('island:inventory',()=>{updateSlots();inventoryUI.cursor.validate();if(panel.open&&['inventory','craft'].includes(panelPage))renderPanel();});
  window.addEventListener('island:craft-open',()=>open('craft'));
  $('panel-content').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.dataset.sort&&!inventoryUI.cursor.pending&&!inventoryUI.cursor.carry)survival.sort();
    if(b.dataset.slot!==undefined)return;
    if(inventoryUI.cursor.pending||inventoryUI.cursor.carry){toast('先把手中的物品放回格子');return;}
    if(b.dataset.eat)survival.eat(b.dataset.eat,Number(b.dataset.index));if(b.dataset.craft)survival.craft(b.dataset.craft);if(b.dataset.build){survival.startBuild(b.dataset.build);close(true);}
    if(b.dataset.newWorld||b.dataset.loadWorld){try{survival.save();if(b.dataset.newWorld)makeWorld(localStorage,$('world-seed').value);else selectWorld(localStorage,b.dataset.loadWorld);location.reload();}catch(error){toast(error.message);}}
  });
  let lastWheel=-Infinity;
  document.addEventListener('wheel',e=>{if(player.getState().active&&!panel.open&&e.deltaY){e.preventDefault();const now=performance.now();if(now-lastWheel<70)return;lastWheel=now;select((selected+(e.deltaY>0?1:HOTBAR_SIZE-1))%HOTBAR_SIZE);}}, {passive:false});
  document.addEventListener('keydown',e=>{
    if(!enabled||e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
    if(inventoryUI.keydown(e))return;
    if(titleScreen&&!panel.open)return;
    const page={KeyE:'inventory',KeyB:'inventory',KeyI:'inventory',KeyM:'map',KeyJ:'journal'}[e.code];
    if(page){e.preventDefault();if(panel.open&&panelPage===page)close();else open(page);}
    if(!panel.open&&player.getState().active&&/^Digit[1-9]$/.test(e.code)){e.preventDefault();select(Number(e.code.slice(-1))-1);}
    if(!panel.open&&player.getState().active&&e.code==='Digit0'){e.preventDefault();const empty=survival.game.bag().slice(0,HOTBAR_SIZE).findIndex(s=>!s);if(empty>=0)select(empty);else toast('快捷栏已满，把一格移回背包就能空手');}
  });
  select(selected);applyPreferences();
  return {
    isTitleScreen(){return titleScreen;},
    windEnabled(){return prefs.wind;},
    reduceMotion(){return prefs.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;},
    ready(){enabled=true;document.body.classList.remove('booting');$('game-hud').hidden=false;sync();},
    update(now){
      if(!enabled||now-lastTick<90)return;lastTick=now;
      const s=player.getState(),heading=headingFromYaw(s.yaw);
      $('heading-name').textContent=heading.label;$('heading-degrees').textContent=(Math.round(heading.degrees)%360)+'°';
      bearings.forEach((el,i)=>{const offset=bearingOffset(i*15,heading.degrees);el.style.left=`calc(50% + ${offset*2}px)`;el.hidden=Math.abs(offset)>75;});
      $('region-label').textContent=player.world?.biome?.(s.x,s.z)||region(s);
      const swimming=s.mode==='swim'||s.mode==='dive';
      $('mode-icon').setAttribute('href',swimming?'#i-wave':'#i-foot');
      $('mode-label').textContent={walk:'自由探索',wade:'浅滩涉水',swim:'水面游泳',dive:'水下探索',sailing:'乘船远航'}[s.mode]||'自由探索';
      $('mode-caption').textContent=s.mode==='sailing'?'WASD 划船 · 空格离船':s.mode==='dive'?'空格上浮 · C 下潜':swimming?'C 下潜 · 游回浅滩上岸':'脚下是陆地';
      $('depth-readout').hidden=s.mode!=='dive';
      $('depth-readout').innerHTML=s.depth.toFixed(1)+'<small>米深</small>';
      updateJournal(s);
      for(const key of ['health','food','water']){const value=survival.game.state.vitals[key],el=$('vital-'+key);el.textContent=Math.ceil(value);el.closest('.vital').classList.toggle('low',value<25);$('meter-'+key).style.width=value+'%';}
      const oxygen=survival.game.state.vitals.oxygen??100,oxygenUI=$('oxygen-status');oxygenUI.hidden=!(player.getState().depth>.12||oxygen<99.99);oxygenUI.classList.toggle('low',oxygen<=25);$('vital-oxygen').textContent=Math.ceil(oxygen);$('meter-oxygen').style.width=oxygen+'%';$('oxygen-caption').textContent=player.getState().depth>.12?'空格 · 上浮':'呼吸恢复中';
      $('save-status').textContent=survival.saveState;
      if(panel.open&&panelPage==='map'){drawMap($('island-map'));updateMapText(s);}
    }
  };
}
