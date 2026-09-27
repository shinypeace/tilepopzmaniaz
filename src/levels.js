import { Random } from './random.js';
export const COLORS = ['blue', 'green', 'orange', 'red', 'yellow', 'purple'];
export const CHAPTERS = [
  { name: 'Королевский сад', subtitle: 'Первые шаги к большой истории', theme: 'garden', icon: 'leaf' },
  { name: 'Хрустальный берег', subtitle: 'Растопите лёд. Найдите свой путь.', theme: 'coast', icon: 'ice' },
  { name: 'Солнечная оранжерея', subtitle: 'Больше комбинаций, больше открытий', theme: 'sunset', icon: 'flower' },
  { name: 'Звёздный дворец', subtitle: 'Испытание для мастера комбинаций', theme: 'palace', icon: 'crown' },
];
// Hand-authored spatial motifs. A dot is a playable square; # is a cut-out.
const SHAPES = {
  full: ['........','........','........','........','........','........','........','........'],
  round: ['#......#','........','........','........','........','........','........','#......#'],
  hourglass: ['........','........','#......#','##....##','##....##','#......#','........','........'],
  steps: ['##....##','#......#','........','........','........','........','#......#','##....##'],
};
const MOTIFS = {
  corners: [[1,1],[1,6],[6,1],[6,6]],
  garden: [[3,2],[3,5],[4,2],[4,5]],
  gates: [[2,1],[2,2],[2,5],[2,6],[5,1],[5,2],[5,5],[5,6]],
  diamond: [[2,3],[2,4],[3,2],[3,5],[4,2],[4,5],[5,3],[5,4]],
  stairs: [[2,1],[3,2],[4,3],[4,4],[3,5],[2,6]],
  islands: [[2,2],[2,5],[5,2],[5,5],[3,3],[4,4]],
};
// [name, shape, motif, obstacle, layers, moves, color goal, goal amount]
const BLUEPRINTS = [
  ['Добро пожаловать','full',null,null,0,20,'blue',16],
  ['Сочная комбинация','round',null,null,0,21,'green',24],
  ['Садовые ящики','full','garden','crate',1,22,'red',18],
  ['Четыре уголка','round','corners','crate',1,22,'yellow',22],
  ['За воротами','full','gates','crate',1,22,'orange',24],
  ['Полетели!','steps',null,null,0,23,'purple',28],
  ['Цветочная аллея','full','stairs','crate',2,25,'green',24],
  ['Золотой час','hourglass','garden','crate',1,23,'yellow',24],
  ['Тайный сад','round','diamond','crate',2,25,'red',24],
  ['Ключ от сада','full','gates','crate',2,24,'blue',30],
  ['Первый лёд','full','garden','ice',1,23,'blue',22],
  ['Хрустальные ступени','steps','stairs','ice',1,24,'orange',25],
  ['Морозное утро','round','corners','ice',2,25,'purple',26],
  ['Зелёный ковёр','full',null,null,0,25,'green',22],
  ['Ледяные ворота','full','gates','ice',2,25,'yellow',28],
  ['Лёгкий бриз','round','garden','ice',1,26,'red',24],
  ['На двух берегах','hourglass','corners','ice',2,27,'blue',28],
  ['Под снегом','steps','diamond','ice',2,27,'green',26],
  ['Тихая бухта','full','islands','crate',2,25,'orange',30],
  ['Сердце кристалла','round','diamond','ice',2,25,'purple',32],
  ['Каменная тропа','full','garden','stone',2,27,'red',24],
  ['Солнечные острова','round','islands','crate',2,26,'yellow',32],
  ['Камень и лёд','full','corners','stone',2,27,'blue',28],
  ['Рассвет','steps','stairs','ice',2,27,'orange',30],
  ['Лабиринт цветов','hourglass','garden','stone',2,26,'green',32],
  ['Большой урожай','full','gates','crate',2,27,'red',30],
  ['Роса на листьях','round','diamond','ice',2,28,'purple',30],
  ['Зелёные террасы','steps','garden','stone',2,28,'yellow',32],
  ['Цветочный фонтан','full','islands','crate',2,26,'blue',34],
  ['Солнечная корона','round','gates','ice',2,26,'orange',36],
  ['Дворцовые ступени','steps','stairs','stone',2,28,'purple',30],
  ['Лунный сад','full','diamond','ice',2,27,'blue',34],
  ['Сокровищница','round','islands','stone',2,28,'yellow',34],
  ['Двойная радуга','hourglass','corners','crate',2,28,'green',36],
  ['Королевский приём','full','gates','stone',2,28,'red',32],
  ['Звёздный вальс','round','stairs','ice',2,28,'orange',34],
  ['Тайна дворца','steps','diamond','crate',2,27,'purple',36],
  ['Северное сияние','full','islands','stone',2,28,'blue',36],
  ['Последний ключ','round','gates','ice',2,27,'green',38],
  ['Ваша светлость','full','diamond','stone',2,28,'yellow',38],
];
const chapterNames = ['Королевский сад','Хрустальный берег','Солнечная оранжерея','Звёздный дворец','Лавандовая долина','Затерянный фонтан','Медовые холмы','Лунная гавань','Парк воздушных шаров','Зеркальный лабиринт','Вишнёвый остров','Библиотека чудес','Бирюзовый водопад','Янтарная мастерская','Облачный замок','Сад орхидей','Алмазная пещера','Золотая обсерватория','Жемчужная лагуна','Праздничная площадь','Долина драконов','Зимняя резиденция','Радужный мост','Тайная сокровищница','Дворец пятисот звёзд'];
CHAPTERS.splice(0,CHAPTERS.length,...chapterNames.map((name,i)=>({name,subtitle:['Каждый ход — маленькое открытие','Новые пути. Красивые комбинации.','Ваше следующее приключение'][i%3],theme:['garden','coast','sunset','palace'][i%4],icon:['leaf','ice','flower','crown'][i%4]})));
export const LEVEL_COUNT = 500;
export const LEVELS_PER_CHAPTER = 20;
export const GENERATOR_VERSION = 3;
export function getLevel(id) {
  id = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(id) || 1));
  if(id>BLUEPRINTS.length)return composeLevel(id);
  const [name, shape, motif, kind, hp, moves, color, amount] = BLUEPRINTS[id - 1];
  const rows=id<=6?10:8,cols=id<=6?7:8;
  const mask = Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>SHAPES[shape][rows===10?Math.max(0,Math.min(7,r-1)):r][cols===7&&c>3?c+1:c]!=='#'));
  const blockers = (MOTIFS[motif] || []).map(([r,c]) => ({r:rows===10?r+1:r,c,kind,hp})).filter(b => mask[b.r]?.[b.c]);
  const grass = id >= 14 && id % 3 !== 0
    ? [[6,2],[6,3],[6,4],[6,5],[5,2],[5,3],[5,4],[5,5]].filter(([r,c]) => mask[r][c] && !blockers.some(b => b.r === r && b.c === c))
    : [];
  const colors = [...COLORS];
  // Keep the target in the palette; introduce the fifth colour after onboarding.
  colors.splice(colors.indexOf(color), 1); colors.unshift(color);
  const goals = { [color]: amount };
  if (blockers.length) goals[kind] = blockers.length;
  if (grass.length) goals.grass = grass.length;
  return { id, name, rows, cols, mask, blockers, grass, goals, moves,
    colors: colors.slice(0, id < 7 ? 4 : 5), seed: 73129 + id * 9973,
    difficulty: id % 10 === 0 ? 'Суперсложный' : id % 5 === 0 ? 'Сложный' : 'Обычный',
    chapter: Math.floor((id-1)/LEVELS_PER_CHAPTER),
    tip: id < 3 ? 'Соберите 3 одинаковые фишки. Четыре в ряд создадут ракету.' : id < 6 ? 'Собирайте комбинации рядом с ящиками.' : id < 11 ? 'Соберите Т или Г из пяти фишек, чтобы создать бомбу.' : id < 14 ? 'Лёд стоит на месте. Комбинация рядом снимает один слой.' : id < 21 ? 'Собирайте фишки на траве, чтобы очистить её.' : 'Камни разрушаются только взрывами и инструментами.',
  };
}
const ADVANCED_SHAPES = [
  ...Object.values(SHAPES),
  ['#......#','#......#','........','........','........','........','#......#','#......#'],
  ['........','........','........','#......#','#......#','........','........','........'],
  ['##....##','##....##','........','........','........','........','........','........'],
  ['........','........','........','...##...','...##...','........','........','........'],
];
function composeLevel(id) {
  const rng=new Random(id*9973+73129),chapter=Math.floor((id-1)/20),step=(id-1)%20;
  const hard=(step+1)%5===0,superHard=step===19,breather=step%5===0;
  const mask=rng.pick(ADVANCED_SHAPES).map(row=>[...row].map(c=>c!== '#'));
  if(rng.next()>.5)mask.reverse();
  const names=['Аллея','Фонтан','Терраса','Мост','Секрет','Созвездие','Ключ','Мозаика','Сокровище','Открытие'];
  const archetypes=['collect','clear','garden','mixed','powers'];
  const archetype=archetypes[(step+chapter)%archetypes.length];
  const available=[];
  for(let r=2;r<7;r++)for(let c=0;c<8;c++)if(mask[r][c])available.push([r,c]);
  // Prefer readable motifs, then extend with seeded candidates. Top two rows stay open.
  const motif=rng.pick(Object.values(MOTIFS));
  const ordered=[...motif,...rng.shuffle(available)];
  const seen=new Set(),spots=ordered.filter(([r,c])=>{
    const k=r*100+c;if(!mask[r]?.[c]||r<2||seen.has(k))return false;seen.add(k);return true;
  });
  const count=archetype==='collect'?4:Math.min(12,6+Math.floor(chapter/6)+(hard?3:0));
  const kinds=archetype==='powers'?['stone']:archetype==='garden'?['crate']:['ice','crate'];
  if(id>=81&&archetype==='mixed')kinds.push('stone');
  const blockers=spots.slice(0,count).map(([r,c],i)=>({r,c,kind:kinds[(i+chapter)%kinds.length],hp:breather?1:2}));
  const open=rng.shuffle(available.filter(([r,c])=>!blockers.some(b=>b.r===r&&b.c===c)));
  const chains=id>=61&&['powers','mixed'].includes(archetype)?open.splice(0,hard?4:2):[];
  const grass=['garden','mixed'].includes(archetype)?open.slice(0,Math.min(16,8+Math.floor(chapter/4)+(hard?2:0))):[];
  const colors=rng.shuffle(COLORS).slice(0,breather?4:5);
  const goals={};
  for(const b of blockers)goals[b.kind]=(goals[b.kind]||0)+1;
  if(grass.length)goals.grass=grass.length;
  if(chains.length)goals.chain=chains.length;
  if(archetype==='collect'){
    goals[colors[0]]=30+Math.min(14,chapter)+(hard?8:0);
    goals[colors[1]]=24+Math.min(10,chapter);
  }else if(Object.keys(goals).length<3)goals[colors[0]]=22+Math.min(14,chapter)+(hard?6:0);
  const workload=blockers.reduce((n,b)=>n+b.hp*(b.kind==='stone'?1.3:.75),0)+grass.length*.35+chains.length*1.3;
  const moves=Math.max(24,Math.min(36,Math.round(18+workload*.48+(archetype==='collect'?8:0)-(superHard?2:hard?1:0))));
  return {id,name:`${names[step%10]} · ${CHAPTERS[chapter].name}`,rows:8,cols:8,mask,blockers,chains,grass,goals,moves,colors,
    seed:73129+id*9973,chapter,archetype,difficulty:superHard?'Суперсложный':hard?'Сложный':'Обычный',
    tip:chains.length?'Цепи удерживают фишку. Взрыв снимает цепь и оставляет фишку на поле.':kinds.includes('stone')?'Камни требуют попаданий бонусами. Соединяйте ракеты и бомбы.':'Сначала откройте пространство, затем объединяйте бонусы у целей.',
  };
}
export function getDaily(dateKey) {
  const seed=[...dateKey].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0),17)>>>0;
  const level=getLevel(41+(seed%460));
  return {...level,id:0,name:'Испытание дня',mode:'daily',seed,moves:level.moves+3,difficulty:'Ежедневный'};
}
export function getChallenge(mode, stage = 1) {
  const level = getLevel(Math.min(40, 6 + stage));
  return { ...level, id:0, name: mode === 'wall' ? 'Стена' : 'Бесконечность', mode,
    seed: Date.now() >>> 0, moves:mode === 'wall' ? 9999 : 24,
    mask:SHAPES.full.map(row => [...row].map(() => true)),
    blockers:mode === 'wall' ? Array.from({length:8}, (_,c) => ({r:7,c,kind:'crate',hp:1})) : [],
    grass:[], goals:mode === 'wall' ? {} : {blue:20 + stage * 3, green:20 + stage * 3}, colors:COLORS.slice(0,5),
  };
}
