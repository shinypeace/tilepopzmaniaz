export class Sound {
  constructor(settings){this.settings=settings;this.effects=new Map();this.music=null;this.track='menu';}
  play(name){
    if(!this.settings.sound||document.hidden)return;
    let pool=this.effects.get(name);
    if(!pool){pool=Array.from({length:3},()=>new Audio(`./assets/audio/${name}.mp3`));this.effects.set(name,pool);}
    const sound=pool.find(a=>a.paused)||pool[0];sound.volume=.35;sound.currentTime=0;sound.play().catch(()=>{});
  }
  setTrack(track){
    if(this.track!==track||!this.music){this.music?.pause();this.track=track;this.music=new Audio(`./assets/audio/${track}_music.mp3`);this.music.loop=true;this.music.volume=.18;}
    this.sync();
  }
  sync(){if(this.settings.music&&!document.hidden)this.music?.play().catch(()=>{});else this.music?.pause();}
}
