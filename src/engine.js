import { Random } from './random.js';

const copy = value => JSON.parse(JSON.stringify(value));
export const POWERS = ['rocket-h', 'rocket-v', 'bomb', 'orb'];
export const isTile = cell => cell?.kind === 'gem';
export const isBlocker = cell => cell && cell.kind !== 'gem';
export const key = (r,c) => r * 100 + c;
export const position = key => [Math.floor(key / 100), key % 100];

/** Pure deterministic model. The renderer consumes immutable animation frames. */
export class Game {
  constructor(config, { seed = config.seed, record = false } = {}) {
    this.config = copy(config); this.rows = config.rows; this.cols = config.cols;
    this.rng = new Random(seed); this.record = record; this.serial = 0;
    this.board = Array.from({length:this.rows}, () => Array(this.cols).fill(null));
    this.grass = new Set((config.grass || []).map(([r,c]) => key(r,c)));
    this.chains = new Set((config.chains || []).map(([r,c]) => key(r,c)));
    this.ice = new Map((config.blockers || []).filter(b=>b.kind==='ice').map(b=>[key(b.r,b.c),b.hp]));
    this.goals = {...config.goals}; this.moves = config.moves; this.score = 0;
    this.turns = 0; this.status = 'playing'; this.frames = []; this.collected = 0;
    this.powersCreated = 0; this.powersUsed = 0; this.maxCascade = 0; this.shuffles = 0;
    for (const b of config.blockers || []) if(b.kind!=='ice')this.board[b.r][b.c] = {...b, id:++this.serial};
    this.fillInitial();
    for(const {r,c,power} of config.startingPowers||[]){
      const p=key(r,c);if(POWERS.includes(power)&&this.movable(p))this.put(p,this.tile(null,power));
    }
  }
  inside(r,c) { return r >= 0 && c >= 0 && r < this.rows && c < this.cols && this.config.mask[r][c]; }
  get(r,c) { return this.inside(r,c) ? this.board[r][c] : null; }
  tile(color = this.rng.pick(this.config.colors), power = null) { return {id:++this.serial,kind:'gem',color:power ? null : color,power}; }
  positions() {
    const out = [];
    for (let r=0;r<this.rows;r++) for (let c=0;c<this.cols;c++) if (this.inside(r,c)) out.push(key(r,c));
    return out;
  }
  neighbors(p) { const [r,c] = position(p); return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([r,c])=>this.inside(r,c)).map(([r,c])=>key(r,c)); }
  cell(p) { const [r,c] = position(p); return this.get(r,c); }
  colorAt(r,c) { return this.chains.has(key(r,c)) ? null : this.get(r,c)?.color; }
  put(p,value) { const [r,c] = position(p); this.board[r][c] = value; }
  snapshot() { return { board:copy(this.board), grass:[...this.grass], chains:[...this.chains], ice:[...this.ice], goals:{...this.goals}, moves:this.moves, score:this.score, status:this.status }; }
  frame(type, details = {}) { if (this.record) this.frames.push({type,...details,state:this.snapshot()}); }
  fillInitial() {
    for (let attempt=0;attempt<200;attempt++) {
      for (let r=0;r<this.rows;r++) for (let c=0;c<this.cols;c++) {
        if (!this.inside(r,c) || isBlocker(this.board[r][c])) continue;
        const available = this.config.colors.filter(color =>
          !(this.get(r,c-1)?.color === color && this.get(r,c-2)?.color === color) &&
          !(this.get(r-1,c)?.color === color && this.get(r-2,c)?.color === color));
        this.board[r][c] = this.tile(this.rng.pick(available.length ? available : this.config.colors));
      }
      if (!this.findMatches().length && this.legalActions().length >= 3) return;
    }
    throw new Error(`Level ${this.config.id}: cannot generate a playable starting board`);
  }
  findMatches() {
    const parts = [];
    for (let r=0;r<this.rows;r++) for (let c=0;c<this.cols;c++) {
      const color = this.colorAt(r,c);
      if (!color) continue;
      for (const [dr,dc,kind] of [[0,1,'h'],[1,0,'v']]) {
        if (this.colorAt(r-dr,c-dc) === color) continue;
        const cells=[]; let rr=r,cc=c;
        while (this.colorAt(rr,cc) === color) { cells.push(key(rr,cc));rr+=dr;cc+=dc; }
        if(cells.length>=3) parts.push({cells,kind});
      }
    }
    const groups=[];
    for (const part of parts) {
      const linked = groups.filter(g=>part.cells.some(p=>g.cells.has(p)));
      const group={cells:new Set(part.cells),parts:[part]};
      for(const g of linked) { g.cells.forEach(p=>group.cells.add(p));group.parts.push(...g.parts);groups.splice(groups.indexOf(g),1); }
      groups.push(group);
    }
    return groups;
  }
  powerFor(group) {
    if (group.parts.some(p=>p.cells.length >= 5)) return 'orb';
    if (group.parts.some(p=>p.kind==='h') && group.parts.some(p=>p.kind==='v')) return 'bomb';
    const line = group.parts.find(p=>p.cells.length===4);
    if(line) return line.kind==='h'?'rocket-h':'rocket-v';
    return null;
  }
  movable(p) { return isTile(this.cell(p)) && !this.chains.has(p) && !this.ice.has(p); }
  swap(a,b) { const t=this.cell(a);this.put(a,this.cell(b));this.put(b,t); }
  legalActions() {
    const actions=[];
    for (const a of this.positions()) {
      if (!this.movable(a)) continue;
      if(this.cell(a).power) actions.push({type:'tap',a});
      const [r,c]=position(a);
      for(const [rr,cc] of [[r+1,c],[r,c+1]]) {
        const b=key(rr,cc);
        if(!this.inside(rr,cc)||!this.movable(b))continue;
        if(this.cell(a).power || this.cell(b).power) {actions.push({type:'swap',a,b});continue;}
        if(this.cell(a).color===this.cell(b).color) continue;
        this.swap(a,b);
        const matched=this.findMatches().some(g=>g.cells.has(a)||g.cells.has(b));
        this.swap(a,b);
        if(matched)actions.push({type:'swap',a,b});
      }
    }
    return actions;
  }
  collect(kind, amount=1) {
    if(this.goals[kind]>0)this.goals[kind]=Math.max(0,this.goals[kind]-amount);
  }
  mostColor() {
    const count={};for(const p of this.positions()){const c=this.cell(p)?.color;if(c)count[c]=(count[c]||0)+1;}
    return Object.entries(count).sort((a,b)=>b[1]-a[1])[0]?.[0] || this.config.colors[0];
  }
  area(p,radius) { const [r,c]=position(p);return this.positions().filter(q=>{const [rr,cc]=position(q);return Math.abs(rr-r)<=radius&&Math.abs(cc-c)<=radius;}); }
  line(p,axis,width=0) {const [r,c]=position(p);return this.positions().filter(q=>{const [rr,cc]=position(q);return axis==='h'?Math.abs(rr-r)<=width:Math.abs(cc-c)<=width;});}
  effect(p,power,targetColor=null) {
    if(power==='rocket-h') return this.line(p,'h');
    if(power==='rocket-v') return this.line(p,'v');
    if(power==='bomb') return this.area(p,1);
    if(power==='orb') {const color=targetColor||this.mostColor();return this.positions().filter(q=>this.cell(q)?.color===color).concat(p);}
    return [p];
  }
  /** One resolution wave removes at most one layer per cell, even if blasts overlap. */
  damage(initial, {power=false, creations=[], effects=[]}={}) {
    const hit=new Set(initial), matched=new Set(power?[]:initial), powered=new Set(power?initial:[]), processed=new Set();
    const queue=[...hit].filter(p=>this.cell(p)?.power&&!this.chains.has(p)&&!this.ice.has(p)).map(p=>({p,stage:effects.length?1:0}));
    while(queue.length) {
      const {p,stage}=queue.shift();if(processed.has(p))continue;
      processed.add(p);const t=this.cell(p);this.powersUsed++;
      const impacted=this.effect(p,t.power,t.targetColor);
      effects.push({p,power:t.power,targets:impacted,stage});
      for(const q of impacted){hit.add(q);powered.add(q);if(this.cell(q)?.power&&!this.chains.has(q)&&!this.ice.has(q)&&!processed.has(q))queue.push({p:q,stage:stage+1});}
    }
    // Adjacency belongs to an actual colour match, never to a blast or tool.
    // Frozen gems participate in colour matches; neighbouring matches do not break ice.
    const adjacent=new Set();
    for(const p of matched)if(isTile(this.cell(p))&&!this.chains.has(p))for(const q of this.neighbors(p))if(this.cell(q)?.kind==='crate')adjacent.add(q);
    const all=new Set([...hit,...adjacent]); const destroyed=[],damaged=[],thawed=[];
    const preserved=new Map(creations.map(v=>[v.p,v.power]));
    for(const p of all){
      const t=this.cell(p);if(!t)continue;
      if(this.chains.has(p)){
        if(powered.has(p)){this.chains.delete(p);this.collect('chain');this.score+=40;damaged.push(p);}
        continue;
      }
      if(this.ice.has(p)){
        if(!hit.has(p))continue;
        const layers=this.ice.get(p)-1;
        if(layers){this.ice.set(p,layers);}else{this.ice.delete(p);this.collect('ice');thawed.push(p);}
        this.score+=30;damaged.push(p);continue;
      }
      if(isBlocker(t)){
        if(t.kind==='stone'&&!powered.has(p))continue;
        t.hp--;this.score+=30;damaged.push(p);
        if(t.hp<=0){this.collect(t.kind);this.put(p,null);destroyed.push(p);}
        continue;
      }
      if(!hit.has(p))continue;
      if(this.grass.delete(p)){this.collect('grass');this.score+=20;}
      if(t.color){this.collect(t.color);this.collected++;}
      this.score+=50;
      if(preserved.has(p)){this.put(p,this.tile(null,preserved.get(p)));this.powersCreated++;}
      else {this.put(p,null);destroyed.push(p);}
    }
    this.frame('clear',{destroyed,damaged,thawed,effects,creations});
  }
  gravity() {
    // Blockers, holes and chained gems partition a column into independent refill wells.
    // No existing tile can fall through an obstacle.
    for(let c=0;c<this.cols;c++){
      let segment=[];
      const settle=()=>{
        if(!segment.length)return;
        const tiles=segment.map(r=>this.board[r][c]).filter(Boolean);
        const missing=segment.length-tiles.length;
        for(let i=0;i<segment.length;i++)this.board[segment[i]][c]=i<missing?this.tile():tiles[i-missing];
        segment=[];
      };
      for(let r=0;r<this.rows;r++){
        if(!this.inside(r,c)||isBlocker(this.get(r,c))||this.chains.has(key(r,c))||this.ice.has(key(r,c)))settle();
        else segment.push(r);
      }
      settle();
    }
    this.frame('fall');
  }
  resolve(preferred=[]) {
    let depth=0;
    while(depth<100){
      const groups=this.findMatches();if(!groups.length)break;
      const hit=new Set(),creations=[];
      for(const g of groups){
        g.cells.forEach(p=>hit.add(p));
        const power=this.powerFor(g);
        const candidates=[...preferred,...g.cells].filter(p=>g.cells.has(p)&&this.movable(p));
        if(power&&candidates.length)creations.push({p:candidates[0],power});
      }
      // Chained gems retain their colour, but a match wholly locked in chains must not loop.
      const actionable=[...hit].some(p=>!this.chains.has(p));
      if(!actionable)break;
      this.damage(hit,{creations});this.gravity();depth++;preferred=[];
    }
    this.maxCascade=Math.max(this.maxCascade,depth);
    if(depth>=100)this.shuffle();
  }
  combo(a,b) {
    const pa=this.cell(a).power,pb=this.cell(b).power;
    const isRocket=p=>p.startsWith('rocket');
    const hit=new Set([a,b]); const add=list=>list.forEach(p=>hit.add(p));
    const effects=[{p:pa==='orb'?a:b,power:'combo',variant:pa==='orb'||pb==='orb'?'rainbow':pa==='bomb'&&pb==='bomb'?'blast':isRocket(pa)&&isRocket(pb)?'cross':'triple-cross',targets:[]}];
    this.powersUsed+=2;
    // Consume the pair before chain resolution, so each power runs exactly once.
    this.cell(a).power=null;this.cell(b).power=null;
    if(pa==='orb'&&pb==='orb')add(this.positions());
    else if(pa==='orb'||pb==='orb'){
      const other=pa==='orb'?pb:pa,color=this.mostColor(),targets=[],converted=[];
      for(const p of this.positions())if(this.cell(p)?.color===color&&!this.chains.has(p)){
        if(!this.ice.has(p)){this.cell(p).color=null;this.cell(p).power=isRocket(other)?this.rng.pick(['rocket-h','rocket-v']):other;converted.push(p);}hit.add(p);targets.push(p);
      }
      this.frame('transform',{origin:pa==='orb'?a:b,targets,converted,power:other});
    }else if(pa==='bomb'&&pb==='bomb')add(this.area(b,2));
    else if(isRocket(pa)&&isRocket(pb)){add(this.line(b,'h'));add(this.line(b,'v'));}
    else{add(this.line(b,'h',1));add(this.line(b,'v',1));}
    effects[0].targets=[...hit];this.damage(hit,{power:true,effects});
  }
  shuffle() {
    const ps=this.positions().filter(p=>this.movable(p)), original=ps.map(p=>this.cell(p));
    for(let attempt=0;attempt<160;attempt++){
      const shuffled=this.rng.shuffle(original);ps.forEach((p,i)=>this.put(p,shuffled[i]));
      if(!this.findMatches().length&&this.legalActions().length){this.shuffles++;this.frame('shuffle');return true;}
    }
    // Rare degenerate colour distribution: recolour only ordinary unlocked gems.
    // Powers and objectives stay on the board, and this never consumes a move.
    for(let attempt=0;attempt<300;attempt++){
      for(const p of ps){const t=this.cell(p);if(!t.power)t.color=this.rng.pick(this.config.colors);}
      if(!this.findMatches().length&&this.legalActions().length){this.shuffles++;this.frame('shuffle');return true;}
    }
    // A guaranteed escape power also handles boards whose locked cells form an unavoidable match.
    const p=ps.find(p=>!this.cell(p).power);
    if(p!==undefined){this.put(p,this.tile(null,'orb'));this.shuffles++;this.frame('shuffle');return true;}
    return false;
  }
  shiftWall() {
    if(this.board[0].some(isBlocker)){this.status='lost';this.frame('wall');return;}
    this.board.shift();this.board.push(Array.from({length:this.cols},()=>({id:++this.serial,kind:'crate',hp:1})));
    this.frame('wall');this.resolve();
  }
  perform(action) {
    this.frames=[];
    if(this.status!=='playing')return {valid:false,frames:[]};
    const {type,a,b,tool}=action;
    if(type==='swap'){
      if(!this.movable(a)||!this.movable(b)||!this.neighbors(a).includes(b))return {valid:false,frames:[]};
      const hasPower=this.cell(a).power||this.cell(b).power;
      this.swap(a,b);this.frame('swap');
      const matches=this.findMatches().some(g=>g.cells.has(a)||g.cells.has(b));
      if(!hasPower&&!matches){this.swap(a,b);this.frame('invalid');return {valid:false,frames:this.frames};}
      this.moves--;this.turns++;
      if(this.cell(a).power&&this.cell(b).power)this.combo(a,b);
      else if(hasPower){
        const p=this.cell(a).power?a:b,other=p===a?b:a;
        if(this.cell(p).power==='orb')this.cell(p).targetColor=this.cell(other).color;
        this.damage([p],{power:true});
      }else this.resolve([b,a]);
      if(hasPower){this.gravity();this.resolve();}
    }else if(type==='tap'){
      if(!this.movable(a)||!this.cell(a).power)return {valid:false,frames:[]};
      this.moves--;this.turns++;this.damage([a],{power:true});this.gravity();this.resolve();
    }else if(type==='tool'){
      if(!['hammer','row','column','shuffle'].includes(tool))return {valid:false,frames:[]};
      if(tool==='shuffle')this.shuffle();
      else{
        if(!this.cell(a))return {valid:false,frames:[]};
        const targets=tool==='hammer'?[a]:this.line(a,tool==='row'?'h':'v');
        this.damage(targets,{power:true,effects:[{p:a,power:tool,targets}]});this.gravity();this.resolve();
      }
    }else return {valid:false,frames:[]};
    if(this.config.mode==='wall'&&type!=='tool'&&this.turns%5===0)this.shiftWall();
    if(this.config.mode!=='wall'&&Object.values(this.goals).every(n=>n===0))this.status='won';
    else if(this.moves<=0)this.status='lost';
    else if(this.status==='playing'&&!this.legalActions().length)this.shuffle();
    this.frame('settled');return {valid:true,frames:this.frames};
  }
  addStartingPower(power) {
    if(!POWERS.includes(power))return false;
    const choices=this.positions().filter(p=>this.movable(p)&&!this.cell(p).power);
    if(!choices.length)return false;
    this.put(this.rng.pick(choices),this.tile(null,power));return true;
  }
  stars() {
    if(this.status!=='won')return 0;
    const ratio=this.moves / this.config.moves;
    return ratio>=0.28?3:ratio>=0.12?2:1;
  }
  clone() {
    const g=Object.create(Game.prototype);
    Object.assign(g,this);g.board=copy(this.board);g.goals={...this.goals};g.grass=new Set(this.grass);g.chains=new Set(this.chains);g.ice=new Map(this.ice);
    g.rng=new Random(this.rng.seed);g.frames=[];g.record=false;return g;
  }
  serialize() {
    const {frames,record,rng,grass,chains,ice,...data}=this;
    return {...copy(data),schema:3,rngSeed:rng.seed,grass:[...grass],chains:[...chains],ice:[...ice]};
  }
  static restore(data) {
    if(!data||![8,10].includes(data.rows)||![7,8].includes(data.cols)||data.status!=='playing'||!Array.isArray(data.board)||data.board.length!==data.rows||!data.board.every(r=>Array.isArray(r)&&r.length===data.cols))throw new Error('Invalid board');
    if(!data.config?.mask?.every(r=>Array.isArray(r)&&r.length===data.cols)||data.config.mask.length!==data.rows||data.config.rows!==data.rows||data.config.cols!==data.cols)throw new Error('Invalid mask');
    // Preserve an unfinished game from the withdrawn prototype without keeping its extra power.
    data=copy(data);
    for(const row of data.board)for(const t of row)if(t?.kind==='gem'&&t.power==='propeller'){t.power='bomb';t.color=null;}
    const known=['blue','green','orange','red','yellow','purple'],powers=POWERS;
    if(!Array.isArray(data.config.colors)||data.config.colors.length<3||data.config.colors.some(c=>!known.includes(c)))throw new Error('Invalid palette');
    const ids=new Set();
    for(const row of data.board)for(const t of row)if(t){
      if(!Number.isInteger(t.id)||ids.has(t.id)||t.id<1)throw new Error('Invalid tile id');ids.add(t.id);
      if(t.kind==='gem'){if(t.power==null?!known.includes(t.color):!powers.includes(t.power)||t.color!==null)throw new Error('Invalid gem');}
      else if(!['ice','stone','crate'].includes(t.kind)||!Number.isInteger(t.hp)||t.hp<1||t.hp>3)throw new Error('Invalid blocker');
    }
    for(let r=0;r<data.rows;r++)for(let c=0;c<data.cols;c++)if(!data.config.mask[r][c]&&data.board[r][c])throw new Error('Tile outside mask');
    for(const n of ['moves','score','serial','turns','collected','powersCreated','powersUsed','maxCascade','shuffles','rngSeed'])if(!Number.isSafeInteger(data[n])||data[n]<0)throw new Error('Invalid counter');
    if(data.moves>10000||data.serial<Math.max(...ids)||!data.goals||Object.entries(data.goals).some(([k,v])=>!([...known,'ice','stone','crate','chain','grass'].includes(k))||!Number.isInteger(v)||v<0||v>1000))throw new Error('Invalid goals');
    const game=Object.create(Game.prototype);Object.assign(game,copy(data));
    game.rng=new Random(data.rngSeed);game.grass=new Set(data.grass);game.chains=new Set(data.chains);game.ice=new Map(data.ice||[]);game.frames=[];game.record=true;
    // Legacy ice occupied a whole cell. Restore its layers over a deterministic
    // colour without consuming the refill RNG or altering the rest of the save.
    for(const p of game.positions())if(game.cell(p)?.kind==='ice'){
      const old=game.cell(p),[r,c]=position(p);
      game.ice.set(p,old.hp);
      const colors=game.config.colors.filter(color=>
        !((game.colorAt(r,c-1)===color&&game.colorAt(r,c+1)===color)||(game.colorAt(r-1,c)===color&&game.colorAt(r+1,c)===color)||
        (game.colorAt(r,c-1)===color&&game.colorAt(r,c-2)===color)||(game.colorAt(r-1,c)===color&&game.colorAt(r-2,c)===color)||
        (game.colorAt(r,c+1)===color&&game.colorAt(r,c+2)===color)||(game.colorAt(r+1,c)===color&&game.colorAt(r+2,c)===color)));
      game.put(p,{id:old.id,kind:'gem',color:(colors.length?colors:game.config.colors)[0],power:null});
    }
    for(const p of [...game.grass,...game.chains])if(!game.positions().includes(p))throw new Error('Invalid overlay');
    for(const p of game.chains)if(!isTile(game.cell(p)))throw new Error('Invalid chain');
    for(const [p,hp] of game.ice)if(!game.positions().includes(p)||!isTile(game.cell(p))||game.cell(p).power||game.chains.has(p)||!Number.isInteger(hp)||hp<1||hp>3)throw new Error('Invalid ice');
    for(const p of game.positions())if(!game.cell(p))throw new Error('Unsettled board');
    return game;
  }
}
