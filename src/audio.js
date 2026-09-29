export const EFFECTS=['bomb','create_bonus','error','lose','match','rocket','stone_break','swap','tap','win'];
const root=new URL('../assets/audio/',import.meta.url);
export class Sound {
  constructor(settings,{contextFactory=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)({latencyHint:'interactive'}),fetcher=(...args)=>fetch(...args),hidden=()=>document.hidden}={}){
    this.settings=settings;this.contextFactory=contextFactory;this.fetcher=fetcher;this.hidden=hidden;
    this.buffers=new Map();this.music=null;this.track='menu';this.active=new Set();this.mutedByHost=false;
  }
  async prepare(){
    if(this.preparing)return this.preparing;
    this.preparing=(async()=>{
      try{this.context=this.contextFactory();this.gain=this.context.createGain();this.gain.gain.value=.35;this.gain.connect(this.context.destination);}catch{return;}
      // Decode once, before gameplay. No media seeking or network on a match.
      await Promise.all(EFFECTS.map(async name=>{
        try{
          const response=await this.fetcher(new URL(`${name}.mp3`,root),{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`Sound ${name}: ${response.status}`);
          const buffer=await this.context.decodeAudioData(await response.arrayBuffer());this.buffers.set(name,buffer);
        }catch(error){console.warn('Sound preload failed',name,error);}
      }));
    })();return this.preparing;
  }
  unlock(){
    // Called synchronously inside a trusted input event, including on iOS.
    this.sync();
  }
  play(name){
    const buffer=this.buffers.get(name);
    // Never replay stale sounds after a download, tab restore or unlock.
    if(!this.settings.sound||this.hidden()||this.mutedByHost||!buffer||this.context?.state!=='running')return false;
    const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.gain);
    this.active.add(source);source.onended=()=>{source.disconnect();this.active.delete(source);};source.start();return true;
  }
  setTrack(track){
    if(this.track!==track||!this.music){this.music?.pause();this.track=track;this.music=new Audio(new URL(`${track}_music.mp3`,root));this.music.preload='auto';this.music.loop=true;this.music.volume=.18;}
    this.sync();
  }
  sync(){
    const hidden=this.hidden()||this.mutedByHost;
    if(hidden||!this.settings.sound)for(const source of this.active){try{source.stop();}catch{}}
    if(hidden)this.context?.suspend().catch(()=>{});
    else if(['suspended','interrupted'].includes(this.context?.state))this.context.resume().catch(()=>{});
    if(this.settings.music&&!hidden){if(this.music?.paused)this.music.play().catch(()=>{});}else this.music?.pause();
  }
}
