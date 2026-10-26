let context;
export function unlockBowAudio(){try{context??=new (window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')context.resume().catch(()=>{});}catch{}}
export function bowSound(kind,power=1){if(!context||context.state!=='running')return;const t=context.currentTime,pluck=kind==='release',duration=pluck?.18:.09;
 const gain=context.createGain(),filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=pluck?1800:1000;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime((pluck?.045:.055)*(.6+.4*power),t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);filter.connect(gain).connect(context.destination);
 const osc=context.createOscillator();osc.type=pluck?'triangle':'sine';osc.frequency.setValueAtTime(pluck?230+power*110:135,t);osc.frequency.exponentialRampToValueAtTime(pluck?65:48,t+duration);osc.connect(filter);osc.start(t);osc.stop(t+duration);
 osc.onended=()=>{osc.disconnect();filter.disconnect();gain.disconnect();};
}
