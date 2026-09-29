import { icon, NAMES, fmt } from './ui.js';
import { key, position } from './engine.js';
import { fitBoard } from './layout.js';
import { boardArt } from './art.js';
import { boardPath } from './board-shape.js';
import {MotionClock,animationFinished,finiteAnimations,afterPaint} from './motion.js';
export class Renderer {
  constructor(board,wrap,settings,sound){this.board=board;this.wrap=wrap;this.settings=settings;this.sound=sound;this.elements=new Map();this.state=null;this.cell=48;this.mask=null;this.cancelled=0;this.clock=new MotionClock();this.animations=new Set();this.pausedAnimations=new Set();this.vkHidden=false;document.addEventListener('visibilitychange',()=>this.syncVisibility());document.addEventListener('vk-app-visibility',e=>{this.vkHidden=!e.detail.visible;this.syncVisibility();});this.syncVisibility();new ResizeObserver(()=>this.resize()).observe(wrap);}
  syncVisibility(){
    const hidden=document.hidden||this.vkHidden;
    this.clock.setPaused(hidden);
    if(hidden){
      for(const animation of new Set([...this.animations,...(this.board.getAnimations?.({subtree:true})||[])])){
        if(animation.playState==='running'||animation.pending){animation.pause();this.pausedAnimations.add(animation);}
      }
    }else{
      for(const animation of this.pausedAnimations)if(animation.playState==='paused')animation.play();
      this.pausedAnimations.clear();
    }
  }
  play(el,keyframes,options){
    const animation=el.animate(keyframes,options);this.animations.add(animation);
    if(this.clock.paused){animation.pause();this.pausedAnimations.add(animation);}
    const done=animationFinished(animation).then(()=>{this.animations.delete(animation);this.pausedAnimations.delete(animation);});
    return {animation,done};
  }
  get reduced(){return this.settings.motion===false;}
  setup(game){
    this.cancelled++;this.clock.clear();for(const animation of this.animations)animation.cancel();this.animations.clear();this.pausedAnimations.clear();this.board.innerHTML='';this.elements.clear();this.state=null;this.mask=game.config.mask;this.rows=game.rows;this.cols=game.cols;
    this.board.innerHTML='<svg class="board-outline" aria-hidden="true"><defs><clipPath id="board-clip"><path clip-rule="evenodd"/></clipPath></defs><path class="frame-shadow" fill-rule="evenodd"/><path class="frame-main" fill-rule="evenodd"/><path class="frame-shine" fill-rule="evenodd"/></svg><div class="board-pieces"></div><div class="board-effects" aria-hidden="true"></div>';
    this.layer=this.board.querySelector('.board-pieces');
    this.effectLayer=this.board.querySelector('.board-effects');
    for(let r=0;r<game.rows;r++)for(let c=0;c<game.cols;c++)if(this.mask[r][c]){
      const el=document.createElement('div');el.className=`slot ${(r+c)%2?'checker':''}`;el.dataset.p=key(r,c);el.style.setProperty('--r',r);el.style.setProperty('--c',c);this.layer.append(el);
    }
    this.resize();this.render(game.snapshot());
  }
  resize(){
    if(!this.mask)return;
    const size=fitBoard(Math.min(this.wrap.clientWidth-4,490),this.wrap.clientHeight-12,this.rows,this.cols,16,2,3);
    this.cell=size.cell;this.step=size.cell+size.gap;this.inset=size.padding+8;
    this.board.style.setProperty('--cell',`${this.cell}px`);this.board.style.setProperty('--step',`${this.step}px`);this.board.style.setProperty('--inset',`${this.inset}px`);
    this.board.style.width=`${size.width}px`;this.board.style.height=`${size.height}px`;
    const outline=this.board.querySelector('svg');outline.setAttribute('viewBox',`0 0 ${size.width} ${size.height}`);
    for(const path of outline.querySelectorAll('path'))path.setAttribute('d',boardPath(this.mask,this.step,this.inset-1,Math.min(7,this.cell*.16)));
    if(this.state)for(const el of this.elements.values())this.place(el,Number(el.dataset.p));
  }
  place(el,p){const[r,c]=position(p);el.style.transform=`translate(${this.inset+c*this.step}px,${this.inset+r*this.step}px)`;}
  render(state,{fall=false,animate=false,duration=240}={}){
    this.state=state;const present=new Set(),animations=[];
    const grass=new Set(state.grass),chains=new Set(state.chains),ice=new Map(state.ice||[]);
    for(const slot of this.board.querySelectorAll('.slot'))slot.classList.toggle('grass',grass.has(Number(slot.dataset.p)));
    for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;c++){
      const t=state.board[r][c];if(!t)continue;
      const p=key(r,c);present.add(t.id);let el=this.elements.get(t.id);
      const fresh=!el;
      if(fresh){el=document.createElement('button');el.type='button';el.className='piece';el.setAttribute('role','gridcell');el.tabIndex=-1;this.elements.set(t.id,el);this.layer.append(el);}
      const oldTransform=el.style.transform;
      el.dataset.p=p;el.dataset.id=t.id;
      const name=t.power||t.color||(t.kind==='stone'&&t.hp===1?'stone-cracked':t.kind==='crate'&&t.hp===1?'crate-cracked':t.kind),sig=`${name}:${t.hp||0}:${chains.has(p)}:${ice.get(p)||0}`;
      el.dataset.art=name;
      if(el.dataset.sig!==sig){el.innerHTML=boardArt(name)+(ice.has(p)?icon(ice.get(p)>1?'ice-shell':'ice-cracked','ice-overlay'):'')+(chains.has(p)?boardArt('chain','chain-overlay'):'');el.dataset.sig=sig;}
      el.classList.toggle('frozen',ice.has(p));
      el.classList.toggle('power',!!t.power);el.classList.toggle('blocker',t.kind!=='gem');el.classList.remove('clearing','hit');
      el.setAttribute('aria-label',`${r+1}, ${c+1}: ${NAMES[t.power||t.color||t.kind]}${t.hp?`, слоёв: ${t.hp}`:''}${ice.has(p)?`, подо льдом: ${ice.get(p)}`:''}${chains.has(p)?', в цепи':''}`);
      this.place(el,p);
      let from=oldTransform;
      if(fresh&&fall&&!this.reduced){
        // New gems enter from the top of their own refill well. Existing gems
        // animate from their old positions; none travel through a blocker.
        let top=r;while(top>0&&this.mask[top-1][c]&&state.board[top-1][c]?.kind==='gem'&&!chains.has(key(top-1,c))&&!ice.has(key(top-1,c)))top--;
        from=`translate(${this.inset+c*this.step}px,${this.inset+(top-1)*this.step}px)`;
      }
      if((animate||fall)&&!this.reduced&&from&&from!==el.style.transform){const a=this.play(el,[{transform:from,opacity:fresh?.25:1},{transform:el.style.transform,opacity:1}],{duration,easing:fall?'cubic-bezier(.25,.65,.3,1)':'cubic-bezier(.2,.7,.3,1)'});animations.push(a.done);}
    }
    for(const [id,el] of this.elements)if(!present.has(id)){el.remove();this.elements.delete(id);}
    if(!this.board.querySelector('.piece[tabindex="0"]'))this.elements.values().next().value?.setAttribute('tabindex','0');
    document.getElementById('score').textContent=fmt(state.score);
    document.getElementById('moves-count').textContent=state.moves>999?'∞':state.moves;
    document.querySelector('.moves-panel').classList.toggle('low',state.moves<=5);
    const goalSignature=JSON.stringify(state.goals);if(this.goalSignature!==goalSignature){document.getElementById('goals').innerHTML=Object.entries(state.goals).map(([k,v])=>`<div class="goal ${v===0?'complete':''}" aria-label="${NAMES[k]}: ${v===0?'выполнено':v}" title="${NAMES[k]}">${icon(k)}<b>${v||'✓'}</b></div>`).join('');this.goalSignature=goalSignature;}
    return Promise.all(animations);
  }
  element(p){return [...this.elements.values()].find(el=>Number(el.dataset.p)===p);}
  clearSelection(){for(const el of this.elements.values())el.classList.remove('selected','hinted');}
  select(p){this.clearSelection();this.element(p)?.classList.add('selected');}
  hint(action){this.clearSelection();for(const p of [action?.a,action?.b])this.element(p)?.classList.add('hinted');}
  async finishVisuals(elements,minimum){
    await afterPaint();
    this.syncVisibility();
    await Promise.all([this.clock.wait(minimum),...elements.flatMap(el=>finiteAnimations(el)).map(animationFinished)]);
  }
  transient(el,ms=750){
    el.setAttribute('aria-hidden','true');this.effectLayer.append(el);
    this.finishVisuals([el],ms).then(()=>el.remove());
  }
  rocketEffect(p,horizontal){
    const[r,c]=position(p),x=this.inset+c*this.step+this.cell/2,y=this.inset+r*this.step+this.cell/2;
    const beam=document.createElement('div');beam.className=`beam ${horizontal?'horizontal':'vertical'}`;
    Object.assign(beam.style,{left:horizontal?'0px':`${x-this.cell*.14}px`,top:horizontal?`${y-this.cell*.14}px`:'0px',width:horizontal?`${this.step*this.cols}px`:`${this.cell*.28}px`,height:horizontal?`${this.cell*.28}px`:`${this.step*this.rows}px`});this.transient(beam);
    for(const direction of [-1,1]){
      const rocket=document.createElement('div');rocket.className='flying-original-rocket';rocket.innerHTML=icon('rocket-flight');
      rocket.style.left=`${x-this.cell/2}px`;rocket.style.top=`${y-this.cell/2}px`;
      rocket.style.setProperty('--angle',`${horizontal?direction*90:direction===1?180:0}deg`);this.transient(rocket);
      this.play(rocket,[{transform:'translate(0,0)'},{transform:`translate(${horizontal?direction*this.step*this.cols:0}px,${horizontal?0:direction*this.step*this.rows}px)`}],{duration:420,fill:'forwards',easing:'cubic-bezier(.3,0,.8,1)'});
    }
  }
  toolEffect(p,column){
    const[r,c]=position(p),x=this.inset+c*this.step+this.cell/2,y=this.inset+r*this.step+this.cell/2;
    if(column){
      const cannon=document.createElement('div');cannon.className='cannon-shot';cannon.innerHTML=icon('cannon-up');cannon.style.cssText=`left:${x}px;top:${this.inset+(this.rows-.6)*this.step}px;width:${this.cell*1.3}px;height:${this.cell*1.5}px`;this.transient(cannon);
      const flash=document.createElement('div');flash.className='muzzle-flash';flash.innerHTML=icon('muzzle-flash');flash.style.cssText=`left:${x}px;top:${this.inset+(this.rows-1.2)*this.step}px;width:${this.cell}px;height:${this.cell}px`;this.transient(flash);
      const ball=document.createElement('div');ball.className='tool-projectile cannon-ball';ball.innerHTML=icon('cannonball');ball.style.cssText=`left:${x-this.cell*.3}px;top:${this.inset+(this.rows-1)*this.step}px;width:${this.cell*.6}px;height:${this.cell*.6}px`;this.transient(ball);this.play(ball,[{transform:'translateY(0)'},{transform:`translateY(${-this.step*(this.rows+1)}px)`}],{duration:520,delay:100,fill:'forwards',easing:'ease-in'});
    }else{
      const arrow=document.createElement('div');arrow.className='tool-projectile arrow-shot';arrow.innerHTML=icon('arrow-flight');arrow.style.cssText=`left:${-this.cell*1.5}px;top:${y-this.cell*.25}px;width:${this.cell*1.6}px;height:${this.cell*.5}px`;this.transient(arrow);this.play(arrow,[{transform:'translateX(0)'},{transform:`translateX(${this.step*(this.cols+3)}px)`}],{duration:530,fill:'forwards',easing:'ease-in'});
    }
  }
  async chargeOrb(effect,token,transformFrame=null){
    const [r,c]=position(effect.p),x=this.inset+c*this.step+this.cell/2,y=this.inset+r*this.step+this.cell/2;
    const glow=document.createElement('div');glow.className='orb-charge';glow.innerHTML=icon('orb');
    glow.style.cssText=`left:${x}px;top:${y}px;width:${this.cell*1.65}px;height:${this.cell*1.65}px`;
    this.transient(glow,4500);
    this.sound.play('create_bonus');
    await this.play(glow,[{scale:.7,opacity:0},{scale:1.08,opacity:1,offset:.8},{scale:1,opacity:1}],{duration:520,easing:'ease-out',fill:'forwards'}).done;
    if(token!==this.cancelled){glow.remove();return;}
    const targets=[...new Set(effect.targets)].filter(p=>p!==effect.p).sort((a,b)=>{
      const [ar,ac]=position(a),[br,bc]=position(b);
      return Math.hypot(ar-r,ac-c)-Math.hypot(br-r,bc-c)||a-b;
    });
    const interval=Math.min(85,1300/Math.max(1,targets.length-1));
    await Promise.all(targets.map(async(p,i)=>{
      const [rr,cc]=position(p),dx=(cc-c)*this.step,dy=(rr-r)*this.step,angle=Math.atan2(dy,dx);
      const ray=document.createElement('div');ray.className='orb-link';
      ray.style.cssText=`left:${x}px;top:${y}px;width:${Math.hypot(dx,dy)}px;--ray-color:${['#ffe87a','#ff96dc','#82eeff','#c4a3ff'][i%4]}`;
      this.transient(ray,3500);
      await this.play(ray,[{transform:`rotate(${angle}rad) scaleX(0)`,opacity:0},{transform:`rotate(${angle}rad) scaleX(1)`,opacity:1,offset:.7},{transform:`rotate(${angle}rad) scaleX(1)`,opacity:.65}],{duration:300,delay:i*interval,fill:'both',easing:'ease-out'}).done;
      if(token!==this.cancelled){ray.remove();return;}
      const el=this.element(p);
      if(el){
        if(transformFrame?.converted.includes(p)){
          const tile=transformFrame.state.board[rr][cc];el.innerHTML=boardArt(tile.power);el.dataset.sig='';el.dataset.art=tile.power;el.classList.add('power');
        }
        el.classList.add('orb-ready');
        this.play(el.firstElementChild,[{scale:.8,filter:'brightness(2)'},{scale:1.16,filter:'brightness(1.5)',offset:.45},{scale:1,filter:'brightness(1)'}],{duration:350,easing:'ease-out'});
      }
      await this.play(ray,[{opacity:.65},{opacity:0}],{duration:350,fill:'forwards'}).done;ray.remove();
    }));
    if(token===this.cancelled)await this.clock.wait(250);
    await this.play(glow,[{scale:1,opacity:1},{scale:1.3,opacity:0}],{duration:200,fill:'forwards'}).done;glow.remove();
  }
  effects(effects,destroyed,thawed=[]){
    if(this.reduced)return;
    for(const effect of effects.slice(0,18)){
      const[r,c]=position(effect.p),x=this.inset+c*this.step+this.cell/2,y=this.inset+r*this.step+this.cell/2;
      if(['row','column'].includes(effect.power)){
        this.toolEffect(effect.p,effect.power==='column');
      }else if(effect.power.startsWith('rocket')){
        this.rocketEffect(effect.p,effect.power==='rocket-h');
      }else if(['cross','triple-cross'].includes(effect.variant)){
        const width=effect.variant==='triple-cross'?1:0;
        for(let offset=-width;offset<=width;offset++){
          if(r+offset>=0&&r+offset<this.rows)this.rocketEffect(key(r+offset,c),true);
          if(c+offset>=0&&c+offset<this.cols)this.rocketEffect(key(r,c+offset),false);
        }
      }else if(effect.power==='orb'||effect.variant==='rainbow'){
        for(const [i,target] of effect.targets.entries()){
          const[rr,cc]=position(target),dx=(cc-c)*this.step,dy=(rr-r)*this.step;if(!dx&&!dy)continue;
          const ray=document.createElement('div');ray.className='orb-ray';
          ray.style.cssText=`left:${x}px;top:${y}px;width:${Math.hypot(dx,dy)}px;--angle:${Math.atan2(dy,dx)}rad;--ray-color:${['#ffe25b','#fc70d5','#55e2ff','#ba91ff'][i%4]}`;this.transient(ray);
        }
        const sparkle=document.createElement('div');sparkle.className='orb-flash';sparkle.innerHTML=icon('orb');sparkle.style.cssText=`left:${x}px;top:${y}px;width:${this.cell*1.5}px;height:${this.cell*1.5}px`;this.transient(sparkle);
      }else if(effect.power==='hammer'){
        // The striking face of the source sprite is at (80%, 60%). Anchor that
        // point to the target; the handle and wind-up move around it.
        const hammer=document.createElement('div');hammer.className='hammer-impact';hammer.innerHTML=icon('hammer');hammer.style.cssText=`left:${x}px;top:${y}px;width:${this.cell*1.7}px;height:${this.cell*1.7}px`;this.transient(hammer,850);
        this.play(hammer,[{transform:'translate(-80%,-60%) translate(22%,-60%) rotate(-35deg)',opacity:0},{transform:'translate(-80%,-60%) translate(22%,-60%) rotate(-35deg)',opacity:1,offset:.25},{transform:'translate(-80%,-60%) rotate(0deg)',opacity:1,offset:.52},{transform:'translate(-80%,-60%) translate(0,-10%) rotate(-8deg)',opacity:1,offset:.66},{transform:'translate(-80%,-60%) translate(0,-25%) rotate(-8deg)',opacity:0}],{duration:650,easing:'ease-in-out',fill:'both'});
        const ring=document.createElement('div');ring.className='hammer-impact-ring';ring.style.cssText=`left:${x}px;top:${y}px;width:${this.cell*.9}px;height:${this.cell*.9}px`;this.transient(ring,850);
      }else{
        const el=document.createElement('div');el.className='blast';const size=this.step*(effect.power==='combo'?5:effect.power==='bomb'?3:1.5);
        Object.assign(el.style,{left:`${x}px`,top:`${y}px`,width:`${size}px`,height:`${size}px`});this.transient(el);
        const ring=document.createElement('div');ring.className='blast-ring';ring.style.cssText=`left:${x}px;top:${y}px;width:${size}px;height:${size}px`;this.transient(ring);
      }
    }
    for(const p of [...thawed,...destroyed].slice(0,20)){
      const[r,c]=position(p);
      const ice=thawed.includes(p);
      for(let i=0;i<3;i++){const el=document.createElement('i');el.className=`particle${ice?' ice-shard':''}`;el.style.cssText=`left:${this.inset+c*this.step+this.cell/2}px;top:${this.inset+r*this.step+this.cell/2}px;--particle:${ice?'#b4f7ff':['#fff3a5','#b8f0ed','#ffd6c9'][i]};--dx:${(i-1)*this.cell*.65}px;--dy:${(-.8+i*.3)*this.cell}px`;this.transient(el);}
    }
  }
  async animate(frames){
    const token=this.cancelled;
    if(this.reduced){const final=frames.at(-1);if(final)this.render(final.state);return;}
    let waves=0,transformed=false;
    for(const f of frames){
      if(token!==this.cancelled)return;
      if(f.type==='transform'){
        await this.chargeOrb({p:f.origin,targets:f.targets},token,f);
        if(token!==this.cancelled)return;
        this.render(f.state);transformed=true;
      }else if(f.type==='clear'){
        waves++;
        const orbs=f.effects.filter(e=>e.power==='orb'||e.variant==='rainbow');
        await Promise.all(orbs.filter(e=>!(transformed&&e.variant==='rainbow')).map(e=>this.chargeOrb(e,token)));
        if(token!==this.cancelled)return;
        transformed=false;
        for(const el of this.elements.values())el.classList.remove('orb-ready');
        const shot=f.effects.find(e=>['row','column','hammer'].includes(e.power));
        for(const p of new Set([...f.destroyed,...f.damaged])){const el=this.element(p);if(!el)continue;const[r,c]=position(p);el.style.setProperty('--impact-delay',`${shot?(shot.power==='hammer'?330:shot.power==='row'?80+c/this.cols*450:100+(this.rows-1-r)/this.rows*430):0}ms`);}
        for(const p of f.destroyed)this.element(p)?.classList.add('clearing');
        for(const p of f.damaged)this.element(p)?.classList.add('hit');
        this.effects(f.effects.filter(e=>e.power!=='orb'&&e.variant!=='rainbow'),f.destroyed,f.thawed);
        const powers=f.effects.map(e=>e.power);
        this.sound.play(powers.some(p=>p==='bomb'||p==='combo')?'bomb':powers.some(p=>p.startsWith('rocket'))?'rocket':f.damaged.length?'stone_break':'match');
        if(f.creations.length)this.sound.play('create_bonus');
        if(waves>=2){const label=document.getElementById('combo-label');label.textContent=['Отлично!','Здорово!','Великолепно!','Потрясающе!','Невероятно!','Вот это каскад!'][Math.min(5,waves-2)];label.classList.remove('show');void label.offsetWidth;label.classList.add('show');}
        // Commit the clear/hit classes before observing their actual completion.
        // A timeout alone can expire while a mobile WebView is still painting.
        const affected=[...new Set([...f.destroyed,...f.damaged])].map(p=>this.element(p)).filter(Boolean);
        await this.finishVisuals(affected,powers.some(p=>['column','row','hammer'].includes(p))?740:f.effects.length?430:240);
        if(token!==this.cancelled)return;this.render(f.state);
        for(const {p} of f.creations){const el=this.element(p);if(el){el.classList.add('created');this.finishVisuals([el],430).then(()=>el.classList.remove('created'));}}
      }else{
        const movement=this.render(f.state,{fall:f.type==='fall',animate:f.type!=='settled',duration:f.type==='fall'?300:230});
        if(f.type==='shuffle')this.sound.play('create_bonus');
        if(['swap','invalid'].includes(f.type))this.sound.play(f.type==='invalid'?'error':'swap');
        await movement;
      }
    }
  }
}
