import { icon, NAMES, fmt } from './ui.js';
import { key, position } from './engine.js';
import { fitBoard } from './layout.js';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export class Renderer {
  constructor(board,wrap,settings,sound){this.board=board;this.wrap=wrap;this.settings=settings;this.sound=sound;this.elements=new Map();this.state=null;this.cell=48;this.mask=null;this.cancelled=0;new ResizeObserver(()=>this.resize()).observe(wrap);}
  get reduced(){return !this.settings.motion||matchMedia('(prefers-reduced-motion: reduce)').matches;}
  setup(game){
    this.cancelled++;this.board.innerHTML='';this.elements.clear();this.state=null;this.mask=game.config.mask;this.rows=game.rows;this.cols=game.cols;
    for(let r=0;r<game.rows;r++)for(let c=0;c<game.cols;c++)if(this.mask[r][c]){
      const el=document.createElement('div');el.className=`slot ${(r+c)%2?'checker':''}`;el.dataset.p=key(r,c);el.style.setProperty('--r',r);el.style.setProperty('--c',c);this.board.append(el);
    }
    this.resize();this.render(game.snapshot());
  }
  resize(){
    if(!this.mask)return;
    const border=Number.parseFloat(getComputedStyle(this.board).borderLeftWidth)*2;
    const size=fitBoard(Math.min(this.wrap.clientWidth-4,490),this.wrap.clientHeight-12,this.rows,this.cols,border,2,3);
    this.cell=size.cell;this.step=size.cell+size.gap;this.inset=size.padding;
    this.board.style.setProperty('--cell',`${this.cell}px`);this.board.style.setProperty('--step',`${this.step}px`);this.board.style.setProperty('--inset',`${this.inset}px`);
    this.board.style.width=`${size.width}px`;this.board.style.height=`${size.height}px`;
    if(this.state)for(const el of this.elements.values())this.place(el,Number(el.dataset.p));
  }
  place(el,p){const[r,c]=position(p);el.style.transform=`translate(${this.inset+c*this.step}px,${this.inset+r*this.step}px)`;}
  render(state,{fall=false}={}){
    this.state=state;const present=new Set();
    const grass=new Set(state.grass),chains=new Set(state.chains);
    for(const slot of this.board.querySelectorAll('.slot'))slot.classList.toggle('grass',grass.has(Number(slot.dataset.p)));
    for(let r=0;r<this.rows;r++)for(let c=0;c<this.cols;c++){
      const t=state.board[r][c];if(!t)continue;
      const p=key(r,c);present.add(t.id);let el=this.elements.get(t.id);
      const fresh=!el;
      if(fresh){el=document.createElement('button');el.type='button';el.className='piece';el.setAttribute('role','gridcell');el.tabIndex=-1;this.elements.set(t.id,el);this.board.append(el);}
      el.dataset.p=p;el.dataset.id=t.id;
      const name=t.power||t.color||t.kind,sig=`${name}:${t.hp||0}:${chains.has(p)}`;
      el.dataset.art=name;
      if(el.dataset.sig!==sig){el.innerHTML=icon(name)+(t.hp?`<span class="layers">${'<i></i>'.repeat(t.hp)}</span>`:'')+(chains.has(p)?icon('chain','chain-overlay'):'');el.dataset.sig=sig;}
      el.classList.toggle('power',!!t.power);el.classList.toggle('blocker',t.kind!=='gem');el.classList.remove('clearing','hit');
      el.setAttribute('aria-label',`${r+1}, ${c+1}: ${NAMES[name]}${t.hp?`, слоёв: ${t.hp}`:''}${chains.has(p)?', в цепи':''}`);
      this.place(el,p);
      if(fresh&&fall&&!this.reduced){
        // New gems enter from the top of their own refill well. Existing gems
        // animate from their old positions; none travel through a blocker.
        let top=r;while(top>0&&this.mask[top-1][c]&&state.board[top-1][c]?.kind==='gem'&&!chains.has(key(top-1,c)))top--;
        el.style.transition='none';el.style.opacity='0';el.style.transform=`translate(${this.inset+c*this.step}px,${this.inset+(top-.8)*this.step}px)`;
        const token=this.cancelled;
        requestAnimationFrame(()=>{if(token!==this.cancelled||!el.isConnected)return;void el.offsetWidth;el.style.transition='';el.style.opacity='';this.place(el,p);});
      }
    }
    for(const [id,el] of this.elements)if(!present.has(id)){el.remove();this.elements.delete(id);}
    if(!this.board.querySelector('.piece[tabindex="0"]'))this.elements.values().next().value?.setAttribute('tabindex','0');
    document.getElementById('score').textContent=fmt(state.score);
    document.getElementById('moves-count').textContent=state.moves>999?'∞':state.moves;
    document.querySelector('.moves-panel').classList.toggle('low',state.moves<=5);
    document.getElementById('goals').innerHTML=Object.entries(state.goals).map(([k,v])=>`<div class="goal ${v===0?'complete':''}" aria-label="${NAMES[k]}: ${v===0?'выполнено':v}" title="${NAMES[k]}">${icon(k)}<b>${v||'✓'}</b></div>`).join('');
  }
  element(p){return [...this.elements.values()].find(el=>Number(el.dataset.p)===p);}
  clearSelection(){for(const el of this.elements.values())el.classList.remove('selected','hinted');}
  select(p){this.clearSelection();this.element(p)?.classList.add('selected');}
  hint(action){this.clearSelection();for(const p of [action?.a,action?.b])this.element(p)?.classList.add('hinted');}
  transient(el){el.setAttribute('aria-hidden','true');this.board.append(el);setTimeout(()=>el.remove(),650);}
  rocketEffect(p,horizontal){
    const[r,c]=position(p),x=this.inset+c*this.step+this.cell/2,y=this.inset+r*this.step+this.cell/2;
    const beam=document.createElement('div');beam.className=`beam ${horizontal?'horizontal':'vertical'}`;
    Object.assign(beam.style,{left:horizontal?'0px':`${x-this.cell*.14}px`,top:horizontal?`${y-this.cell*.14}px`:'0px',width:horizontal?`${this.step*this.cols}px`:`${this.cell*.28}px`,height:horizontal?`${this.cell*.28}px`:`${this.step*this.rows}px`});this.transient(beam);
    for(const direction of [-1,1]){
      const rocket=document.createElement('div');rocket.className='flying-original-rocket';rocket.innerHTML=icon('rocket-flight');
      rocket.style.left=`${x-this.cell/2}px`;rocket.style.top=`${y-this.cell/2}px`;
      rocket.style.setProperty('--angle',`${horizontal?direction*90:direction===1?180:0}deg`);this.transient(rocket);
      const token=this.cancelled;requestAnimationFrame(()=>{if(token!==this.cancelled||!rocket.isConnected)return;void rocket.offsetWidth;rocket.style.transform=`translate(${horizontal?direction*this.step*this.cols:0}px,${horizontal?0:direction*this.step*this.rows}px)`;});
    }
  }
  effects(effects,destroyed){
    if(this.reduced)return;
    for(const effect of effects.slice(0,18)){
      const[r,c]=position(effect.p),x=this.inset+c*this.step+this.cell/2,y=this.inset+r*this.step+this.cell/2;
      if(effect.power.startsWith('rocket')||['row','column'].includes(effect.power)){
        this.rocketEffect(effect.p,['rocket-h','row'].includes(effect.power));
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
        const hammer=document.createElement('div');hammer.className='hammer-strike';hammer.innerHTML=icon('hammer');hammer.style.cssText=`left:${x}px;top:${y}px;width:${this.cell*1.5}px;height:${this.cell*1.5}px`;this.transient(hammer);
      }else{
        const el=document.createElement('div');el.className='blast';const size=this.cell*(effect.power==='combo'?8:effect.power==='bomb'?5:2);
        Object.assign(el.style,{left:`${x}px`,top:`${y}px`,width:`${size}px`,height:`${size}px`});this.transient(el);
        const ring=document.createElement('div');ring.className='blast-ring';ring.style.cssText=`left:${x}px;top:${y}px;width:${size}px;height:${size}px`;this.transient(ring);
      }
    }
    for(const p of destroyed.slice(0,20)){
      const[r,c]=position(p);
      const ice=this.element(p)?.dataset.art==='ice';
      for(let i=0;i<3;i++){const el=document.createElement('i');el.className=`particle${ice?' ice-shard':''}`;el.style.cssText=`left:${this.inset+c*this.step+this.cell/2}px;top:${this.inset+r*this.step+this.cell/2}px;--particle:${ice?'#b4f7ff':['#fff3a5','#b8f0ed','#ffd6c9'][i]};--dx:${(i-1)*this.cell*.65}px;--dy:${(-.8+i*.3)*this.cell}px`;this.transient(el);}
    }
  }
  async animate(frames){
    const token=this.cancelled;
    if(this.reduced){const final=frames.at(-1);if(final)this.render(final.state);return;}
    let waves=0;
    for(const f of frames){
      if(token!==this.cancelled)return;
      if(f.type==='clear'){
        waves++;
        for(const p of f.destroyed)this.element(p)?.classList.add('clearing');
        for(const p of f.damaged)this.element(p)?.classList.add('hit');
        this.effects(f.effects,f.destroyed);
        const powers=f.effects.map(e=>e.power);
        this.sound.play(powers.some(p=>p==='bomb'||p==='combo')?'bomb':powers.some(p=>p.startsWith('rocket'))?'rocket':f.damaged.length?'stone_break':'match');
        if(f.creations.length)this.sound.play('create_bonus');
        if(waves===3){const label=document.getElementById('combo-label');label.textContent='Чудесно!';label.classList.remove('show');void label.offsetWidth;label.classList.add('show');}
        await wait(f.effects.length?300:180);if(token!==this.cancelled)return;this.render(f.state);
        for(const {p} of f.creations){const el=this.element(p);if(el){el.classList.add('created');setTimeout(()=>el.classList.remove('created'),430);}}
      }else{
        this.render(f.state,{fall:f.type==='fall'});
        if(f.type==='shuffle')this.sound.play('create_bonus');
        if(['swap','invalid'].includes(f.type)){this.sound.play(f.type==='invalid'?'error':'swap');await wait(155);}
        else if(f.type!=='settled')await wait(f.type==='fall'?240:220);
      }
    }
  }
}
