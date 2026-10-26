let context;
export function contactSound(kind){
 if(!context||context.state!=='running')return;
 const t=context.currentTime,duration=kind==='pickup'?.075:.12,gain=context.createGain(),osc=context.createOscillator();
 gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(kind==='pickup'?.018:.035,t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);gain.connect(context.destination);
 osc.type=kind==='stone'?'triangle':'sine';osc.frequency.setValueAtTime(kind==='pickup'?640:kind==='stone'?370:115,t);osc.frequency.exponentialRampToValueAtTime(kind==='pickup'?880:kind==='stone'?110:46,t+duration);osc.connect(gain);osc.start(t);osc.stop(t+duration);osc.onended=()=>{osc.disconnect();gain.disconnect();};
}
export function unlockBowAudio(){try{context??=new (window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')context.resume().catch(()=>{});}catch{}}
export function bowSound(kind,power=1){if(!context||context.state!=='running')return;const t=context.currentTime,pluck=kind==='release',duration=pluck?.18:.09;
 const gain=context.createGain(),filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=pluck?1800:1000;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime((pluck?.045:.055)*(.6+.4*power),t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);filter.connect(gain).connect(context.destination);
 const osc=context.createOscillator();osc.type=pluck?'triangle':'sine';osc.frequency.setValueAtTime(pluck?230+power*110:135,t);osc.frequency.exponentialRampToValueAtTime(pluck?65:48,t+duration);osc.connect(filter);osc.start(t);osc.stop(t+duration);
 osc.onended=()=>{osc.disconnect();filter.disconnect();gain.disconnect();};
}
