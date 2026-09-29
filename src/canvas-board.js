import {ART} from './art-manifest.js';
import {artImage} from './asset-loader.js';
import {key} from './engine.js';

export const needsCanvas=(nav=globalThis.navigator)=>/iPad|iPhone|iPod/.test(nav?.userAgent||'')||(/Macintosh/.test(nav?.userAgent||'')&&nav.maxTouchPoints>1);
export const tileArt=t=>t.power||t.color||(t.kind==='stone'&&t.hp===1?'stone-cracked':t.kind==='crate'&&t.hp===1?'crate-cracked':t.kind);
const ease=t=>1-Math.pow(1-t,3);

// One bitmap surface for WebKit. HTML buttons still provide input and labels.
// No per-gem filters, animated CSS backgrounds, or SVG compositing masks.
export class CanvasBoard{
  constructor(canvas,clock,{image=artImage,pixelRatio=()=>Math.min(2,globalThis.devicePixelRatio||1),path=d=>new Path2D(d)}={}){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});this.clock=clock;this.image=image;this.pixelRatio=pixelRatio;this.path=path;this.items=new Map();
    clock.onFrame=()=>this.draw();
  }
  resize({width,height,cell,step,inset,outline}){
    Object.assign(this,{width,height,cell,step,inset});this.ratio=this.pixelRatio();
    this.canvas.width=Math.round(width*this.ratio);this.canvas.height=Math.round(height*this.ratio);
    this.canvas.style.width=`${width}px`;this.canvas.style.height=`${height}px`;this.clip=this.path(outline);
    for(const v of this.items.values()){v.x=inset+v.c*step;v.y=inset+v.r*step;}
    this.draw();
  }
  render(state,{fall=false,animate=false,duration=240,mask}={}){
    const previous=this.items,next=new Map(),ice=new Map(state.ice||[]),chains=new Set(state.chains),moves=[];
    state.board.forEach((row,r)=>row.forEach((t,c)=>{
      if(!t)return;const p=key(r,c),old=previous.get(t.id),x=this.inset+c*this.step,y=this.inset+r*this.step;
      let from=old&&{x:old.x,y:old.y};
      // Keep the visual object while it falls so a creation pulse can finish.
      const v=old||{};Object.assign(v,{id:t.id,p,r,c,x,y,art:tileArt(t),ice:ice.get(p)||0,chain:chains.has(p),scale:old?.scale??1,alpha:1,shake:0});next.set(t.id,v);
      if(!old&&fall){let top=r;while(top>0&&mask[top-1][c]&&state.board[top-1][c]?.kind==='gem'&&!chains.has(key(top-1,c))&&!ice.has(key(top-1,c)))top--;from={x,y:this.inset+(top-1)*this.step};}
      if(from&&(fall||animate)&&(from.x!==x||from.y!==y)){
        v.x=from.x;v.y=from.y;v.alpha=old?1:.25;
        moves.push({v,from:{c:(from.x-this.inset)/this.step,r:(from.y-this.inset)/this.step},r,c,fresh:!old});
      }
    }));
    this.items=next;this.draw();
    if(!moves.length)return Promise.resolve();
    return this.clock.animate(duration,t=>{
      const amount=ease(t);
      for(const {v,from,r,c,fresh} of moves){v.x=this.inset+(from.c+(c-from.c)*amount)*this.step;v.y=this.inset+(from.r+(r-from.r)*amount)*this.step;v.alpha=fresh?.25+.75*amount:1;}
    });
  }
  at(p){return [...this.items.values()].find(v=>v.p===p);}
  convert(p,art){const v=this.at(p);if(v){v.art=art;this.draw();}}
  effect(p,type,delay=0){
    const v=this.at(p);if(!v)return Promise.resolve();
    const duration=type==='pop'?220:type==='hit'?230:420;
    return this.clock.animate(delay+duration,time=>{
      const t=Math.max(0,(time*(delay+duration)-delay)/duration);
      if(type==='pop'){v.scale=t<.35?1+t/.35*.16:1.16*(1-(t-.35)/.65);v.alpha=1-t*t;}
      else if(type==='hit')v.shake=Math.sin(t*Math.PI*4)*this.cell*.07*(1-t);
      else v.scale=1+Math.sin(t*Math.PI)*.18;
    });
  }
  sprite(name,size){
    const a=ART[name],ctx=this.ctx;if(!a)return;
    if(a.board){const image=this.image('board.webp');if(image)ctx.drawImage(image,a.col*128,a.row*128,128,128,-size/2,-size/2,size,size);}
    else {const image=this.image(a.file);if(image){const w=a.aspect>=1?size:size*a.aspect,h=a.aspect>=1?size/a.aspect:size;ctx.drawImage(image,-w/2,-h/2,w,h);}}
  }
  draw(){
    if(!this.ctx||!this.width)return;
    const ctx=this.ctx;ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.clearRect(0,0,this.width,this.height);ctx.save();ctx.clip(this.clip,'evenodd');
    for(const v of this.items.values()){
      if(v.alpha<=0||v.scale<=0)continue;
      ctx.save();ctx.globalAlpha=v.alpha;ctx.translate(v.x+this.cell/2+v.shake,v.y+this.cell/2);ctx.scale(v.scale,v.scale);
      this.sprite(v.art,this.cell*.94);if(v.ice)this.sprite(v.ice>1?'ice-shell':'ice-cracked',this.cell);if(v.chain)this.sprite('chain',this.cell*.94);ctx.restore();
    }
    ctx.restore();
  }
}
