import { Random } from './random.js';
import { LAYOUTS, FAMILY_LAYOUTS, OPENING } from './level-layouts.js';
export const COLORS=['blue','green','orange','red','yellow','purple'];
const chapterNames = ['Королевский сад','Хрустальный берег','Солнечная оранжерея','Звёздный дворец','Лавандовая долина','Затерянный фонтан','Медовые холмы','Лунная гавань','Парк воздушных шаров','Зеркальный лабиринт','Вишнёвый остров','Библиотека чудес','Бирюзовый водопад','Янтарная мастерская','Облачный замок','Сад орхидей','Алмазная пещера','Золотая обсерватория','Жемчужная лагуна','Праздничная площадь','Долина драконов','Зимняя резиденция','Радужный мост','Тайная сокровищница','Дворец пятисот звёзд'];
export const CHAPTERS=chapterNames.map((name,i)=>({name,theme:['garden','coast','sunset','palace'][i%4]}));
export const LEVEL_COUNT=500;
export const LEVELS_PER_CHAPTER=20;
export const GENERATOR_VERSION=5;
// Four arcs per chapter: a gentler reset, a spatial problem, a bonus puzzle,
// then a harder finale. Palette and budgets never change during an attempt.
const ARC=[['garden',4],['crate',4],['ice',4],['powers',3],['mixed',4],
 ['collect',3],['ice',4],['crate',4],['garden',5],['chains',4],
 ['garden',4],['powers',4],['ice',3],['crate',4],['mixed',4],
 ['collect',4],['chains',4],['powers',3],['ice',4],['mixed',4]];
const TITLES={collect:'Цветная мозаика',crate:'Садовые кладовые',ice:'Ледяное сердце',garden:'Цветущая тропа',powers:'Каменная мастерская',mixed:'Сокровища за стеной',chains:'Запертые ворота'};
export function getLevel(id){
 id=Math.max(1,Math.min(LEVEL_COUNT,Math.floor(id)||1));
 const chapter=Math.floor((id-1)/20),step=(id-1)%20,rng=new Random(73129+id*9973);
 let layout,paletteSize;
 if(id<=40)[layout,paletteSize]=OPENING[id-1];
 else{
   const [family,palette]=ARC[step],pool=FAMILY_LAYOUTS[family];paletteSize=palette;
   layout=pool[(chapter+Math.floor(step/5)*2+step)%pool.length];
 }
 const design=LAYOUTS[layout],family=design.family,hard=id%5===0,superHard=id%20===0;
 let pattern=design.rows.map(row=>[...row]);
 // A whole composition is reflected or rotated; its lanes and chambers survive.
 if(id>40){
   if(chapter%2)pattern=pattern.map(row=>[...row].reverse());
   const rotations=(Math.floor(chapter/2)+Math.floor(step/5))%4;
   for(let i=0;i<rotations;i++)pattern=pattern[0].map((_,c)=>pattern.map(row=>row[c]).reverse());
 }
 const mask=pattern.map(row=>row.map(char=>char!=='#')),blockers=[],grass=[],chains=[];
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
   const char=pattern[r][c],kind=({c:'crate',C:'crate',i:'ice',I:'ice',s:'stone'})[char];
   if(kind){
     // Two-layer cores are surrounded by lighter edges, so opening the board
     // gives visible progress. Stone layers remain readable from the artwork.
     const core=r>=2&&r<=5&&c>=2&&c<=5;
     const hp=kind==='stone'?(id===21||!hard&&id<41?1:layout==='stoneCross'?(r+c)%2===0?2:1:2):
       id<7||id===11||id===12?1:(core&&(hard||(r+c+chapter)%3===0)?2:1);
     blockers.push({r,c,kind,hp});
   }
   if('gCI'.includes(char))grass.push([r,c]);
   if(char==='x')chains.push([r,c]);
 }
 const colors=rng.shuffle(COLORS).slice(0,paletteSize),goals={};
 for(const b of blockers)goals[b.kind]=(goals[b.kind]||0)+1;
 if(grass.length)goals.grass=grass.length;
 if(chains.length)goals.chain=chains.length;
 if(family==='collect'){
   goals[colors[0]]=id===1?16:id===2?24:id<=40?70:paletteSize===3?145:70;
   if(id>2)goals[colors[1]]=id<=40?50:paletteSize===3?105:60;
 }else if(id<7||layout==='firstIce')goals[colors[0]]=18;
 const layers=blockers.reduce((n,b)=>n+b.hp,0),stones=blockers.filter(b=>b.kind==='stone').length;
 let moves=Math.round(16+layers*.30+grass.length*.18+chains.length*.7+stones*.65);
 if(family==='collect')moves=paletteSize===3?22:26;
 if(paletteSize===3)moves-=2;
 if(paletteSize===5)moves+=3;
 if(hard)moves-=1;
 if(family==='crate'&&id>5)moves-=4;
 if(family==='garden'&&!['winterGarden'].includes(layout)&&id>14)moves-=3;
 if(layout==='glacier'&&paletteSize===4)moves+=3;
 if(layout==='frozenLocks')moves+=5;
 if(layout==='courtyardHole')moves+=3;
 if(id<=5)moves=[20,21,23,23,26][id-1];
 moves=Math.max(id<21?20:18,Math.min(42,moves));
 const startingPowers=[];
 if(stones){
   // Authored tools on the board are free and don't consume player inventory.
   const open=[];
   for(let r=1;r<7;r++)for(let c=1;c<7;c++)if(pattern[r][c]==='.')open.push([r,c]);
   const order=open.sort((a,b)=>Math.abs(a[0]-3.5)+Math.abs(a[1]-3.5)-Math.abs(b[0]-3.5)-Math.abs(b[1]-3.5));
   const first=order[0],second=order.find(([r,c])=>Math.abs(r-first[0])+Math.abs(c-first[1])>=5);
   for(const [i,spot] of [first,...(stones>=8?[second]:[])].entries())if(spot)startingPowers.push({r:spot[0],c:spot[1],power:i?'bomb':'rocket-v'});
 }
 return {id,name:id===1?'Добро пожаловать':TITLES[family],rows:8,cols:8,mask,blockers,grass,chains,goals,moves,colors,
   seed:73129+id*9973,chapter,archetype:family,layout,paletteSize,startingPowers,
   difficulty:superHard?'Суперсложный':hard?'Сложный':'Обычный',
   tip:'Освобождайте проходы и объединяйте бонусы у целей.'};
}
export function getDaily(dateKey){
 const seed=[...dateKey].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),17)>>>0,level=getLevel(41+seed%460);
 return {...level,id:0,name:'Испытание дня',mode:'daily',seed,moves:level.moves+3,difficulty:'Ежедневный'};
}
export function getChallenge(mode,stage=1){
 const level=getLevel(6);
 return {...level,id:0,name:mode==='wall'?'Стена':'Бесконечность',mode,seed:Date.now()>>>0,moves:mode==='wall'?9999:24,
   mask:Array.from({length:8},()=>Array(8).fill(true)),
   blockers:mode==='wall'?Array.from({length:8},(_,c)=>({r:7,c,kind:'crate',hp:1})):[],
   startingPowers:[],grass:[],chains:[],goals:mode==='wall'?{}:{blue:20+stage*3,green:20+stage*3},colors:COLORS.slice(0,5)};
}
