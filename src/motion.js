// All durations are milliseconds. A 60 Hz screen draws fewer intermediate
// frames than a 144 Hz screen, but neither advances a turn any faster.
export const afterPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

export function animationFinished(animation){
  if(animation.finished?.then)return animation.finished.catch(()=>{});
  // Older mobile WebViews implement animate() without Animation.finished.
  return new Promise(resolve=>{
    if(['finished','idle'].includes(animation.playState)){resolve();return;}
    const done=()=>{animation.removeEventListener('finish',done);animation.removeEventListener('cancel',done);resolve();};
    animation.addEventListener('finish',done,{once:true});
    animation.addEventListener('cancel',done,{once:true});
  });
}

export function finiteAnimations(root){
  return (root.getAnimations?.({subtree:true})||[]).filter(a=>{
    const timing=a.effect?.getComputedTiming();
    return timing&&Number.isFinite(timing.endTime)&&!['finished','idle'].includes(a.playState);
  });
}

export class MotionClock{
  constructor({now=()=>performance.now(),requestFrame=cb=>requestAnimationFrame(cb),cancelFrame=id=>cancelAnimationFrame(id)}={}){
    this.now=now;this.requestFrame=requestFrame;this.cancelFrame=cancelFrame;
    this.jobs=new Set();this.paused=false;this.frame=null;
  }
  wait(duration){
    return new Promise(resolve=>{this.jobs.add({deadline:this.now()+duration,remaining:duration,resolve});this.schedule();});
  }
  schedule(){
    if(this.paused||this.frame!==null||!this.jobs.size)return;
    this.frame=this.requestFrame(timestamp=>{
      this.frame=null;
      for(const job of this.jobs)if(timestamp>=job.deadline){this.jobs.delete(job);job.resolve();}
      this.schedule();
    });
  }
  setPaused(paused){
    if(this.paused===paused)return;
    this.paused=paused;
    if(paused&&this.frame!==null){this.cancelFrame(this.frame);this.frame=null;}
    // Time spent behind another VK screen must not consume an animation.
    const now=this.now();
    for(const job of this.jobs){if(paused)job.remaining=Math.max(0,job.deadline-now);else job.deadline=now+job.remaining;}
    if(!paused)this.schedule();
  }
  clear(){
    if(this.frame!==null)this.cancelFrame(this.frame);
    this.frame=null;
    for(const job of this.jobs)job.resolve();
    this.jobs.clear();
  }
}
