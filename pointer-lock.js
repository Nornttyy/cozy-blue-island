// Only the browser's confirmed lock activates gameplay. Never substitute edge panning.
// Works with both event-only and Promise-returning Pointer Lock implementations.
export function createPointerLock(canvas,doc,onChange,clock={setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id)}){
  let wanted=false,serial=0,timeout=null,eventFailure=null;
  let state={active:false,locked:false,pending:false,error:''};
  const publish=next=>{state={...state,...next};onChange({...state});};
  const release=()=>{if(doc.pointerLockElement===canvas)doc.exitPointerLock();};
  function clearPending(){clock.clearTimeout(timeout);clock.clearTimeout(eventFailure);timeout=eventFailure=null;}
  function fail(id,error){
    if(id!==serial||!wanted||state.locked)return;
    clearPending();
    wanted=false;publish({active:false,locked:false,pending:false,error:error?.name||'PointerLockError'});
  }
  function changed(){
    if(doc.pointerLockElement===canvas){
      if(!wanted){release();return;}
      clearPending();
      publish({active:true,locked:true,pending:false,error:''});
    }else if(state.locked){
      wanted=false;serial++;publish({active:false,locked:false,pending:false,error:''});
    }
  }
  function begin(){
    if(state.pending||state.locked)return;
    const id=++serial;wanted=true;
    clearPending();
    publish({active:false,locked:false,pending:true,error:''});
    if(typeof canvas.requestPointerLock!=='function'){fail(id,{name:'NotSupportedError'});return;}
    // Some embedded implementations neither resolve nor dispatch an event.
    // Recover the retry control, but never invent a successful lock.
    timeout=clock.setTimeout(()=>fail(id,{name:'TimeoutError'}),10000);
    try{
      // Synchronous call inside the user's click; no await/fullscreen request before it.
      canvas.focus();const request=canvas.requestPointerLock();
      if(request?.then)request.then(()=>{if(id===serial)changed();else if(!wanted)release();},error=>fail(id,error));
    }catch(error){fail(id,error);}
  }
  function pause(){
    clearPending();
    wanted=false;serial++;publish({active:false,locked:false,pending:false,error:''});release();
  }
  doc.addEventListener('pointerlockchange',changed);
  doc.addEventListener('pointerlockerror',()=>{
    if(!state.pending)return;
    const id=serial;
    // Prefer the Promise's specific DOMException over the generic error event.
    eventFailure=clock.setTimeout(()=>fail(id,{name:'PointerLockError'}),0);
  });
  return {begin,pause,getState:()=>({...state})};
}

export function pointerLockMessage(error){
  if(error==='TimeoutError')return '浏览器未回应锁定请求。请先点击游戏窗口，再重试。';
  if(error==='NotSupportedError')return '当前窗口不支持鼠标锁定。请在独立 Chrome 或 Edge 窗口打开。';
  if(error==='NotAllowedError'||error==='SecurityError')return '浏览器阻止了鼠标锁定。请检查此网站的权限后重试。';
  if(error==='WrongDocumentError'||error==='InvalidStateError')return '游戏窗口未激活。请切回游戏窗口后重试。';
  return '当前窗口未能锁定鼠标，游戏保持暂停。可重试，或复制网址到独立浏览器。';
}
