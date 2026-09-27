import { LEVEL_COUNT, LEVELS_PER_CHAPTER } from './levels.js';

export const SAVE_KEY='wonder_match_v2';
export const TOOLS={hammer:{name:'Молоток',price:120},row:{name:'Стрела',price:180},column:{name:'Пушка',price:180},shuffle:{name:'Перемешивание',price:100},'rocket-h':{name:'Ракета',price:100},bomb:{name:'Бомба',price:140},orb:{name:'Радужный шар',price:200}};
const integer=(v,max=1e9)=>Number.isFinite(Number(v))?Math.max(0,Math.min(max,Math.floor(Number(v)))):0;
export function dayKey(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function previousDay(key) {const date=new Date(key+'T12:00:00');date.setDate(date.getDate()-1);return dayKey(date);}
export function freshProfile() {
  return {version:2,updatedAt:0,unlocked:1,coins:300,levels:{},inventory:{hammer:3,row:1,column:1,shuffle:2,'rocket-h':2,bomb:1,orb:1},
    stats:{games:0,wins:0,score:0,collected:0,powers:0,bestCascade:0,wall:0,endless:0},
    daily:{lastClaim:'',streak:0,challengeDate:'',challengeScore:0},missions:{date:'',wins:0,powers:0,collected:0,claimed:[]},
    claimedChests:0,claimedChapters:[],settings:{sound:true,music:false,motion:true,theme:'auto',hints:true},active:null};
}
export function normalizeProfile(raw) {
  const p=freshProfile();if(!raw||typeof raw!=='object')return p;
  p.unlocked=Math.max(1,integer(raw.unlocked??raw.maxReachedLevel,LEVEL_COUNT));
  p.coins=raw.coins===undefined?300:integer(raw.coins);
  p.updatedAt=integer(raw.updatedAt,9e15);
  for(const [id,v] of Object.entries(raw.levels||{}))if(integer(id,LEVEL_COUNT)===Number(id)&&Number(id)>=1&&v&&typeof v==='object')
    p.levels[id]={stars:integer(v.stars,3),score:integer(v.score),moves:integer(v.moves,100),wins:integer(v.wins),attempts:integer(v.attempts),bestTime:integer(v.bestTime,86400000)};
  for(const k of Object.keys(p.inventory))if(raw.inventory?.[k]!==undefined)p.inventory[k]=integer(raw.inventory[k],999);
  for(const k of Object.keys(p.stats))p.stats[k]=integer(raw.stats?.[k]);
  if(raw.stats?.wall?.hiScore)p.stats.wall=integer(raw.stats.wall.hiScore);
  if(raw.stats?.goals?.hiScore)p.stats.endless=integer(raw.stats.goals.hiScore);
  for(const k of ['sound','music','motion','hints'])if(typeof raw.settings?.[k]==='boolean')p.settings[k]=raw.settings[k];
  if(['auto','garden','coast','sunset','palace'].includes(raw.settings?.theme))p.settings.theme=raw.settings.theme;
  if(raw.isMuted!==undefined)p.settings.sound=!raw.isMuted;
  if(raw.isMusicMuted!==undefined)p.settings.music=!raw.isMusicMuted;
  for(const k of ['lastClaim','challengeDate'])if(/^\d{4}-\d{2}-\d{2}$/.test(raw.daily?.[k]))p.daily[k]=raw.daily[k];
  p.daily.streak=integer(raw.daily?.streak,7);p.daily.challengeScore=integer(raw.daily?.challengeScore);
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw.missions?.date))p.missions.date=raw.missions.date;
  for(const k of ['wins','powers','collected'])p.missions[k]=integer(raw.missions?.[k]);
  p.missions.claimed=(Array.isArray(raw.missions?.claimed)?raw.missions.claimed:[]).filter(k=>['wins','powers','collected'].includes(k));
  p.claimedChests=integer(raw.claimedChests,50);
  p.claimedChapters=[...new Set((Array.isArray(raw.claimedChapters)?raw.claimedChapters:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<25))];
  // Active sessions have their own strict model validation on restore.
  if(raw.active&&typeof raw.active==='object')p.active=raw.active;
  return p;
}
export function loadProfile(storage=globalThis.localStorage) {
  try {
    const current=storage.getItem(SAVE_KEY),old=storage.getItem('tilepop_save');
    return {profile:normalizeProfile(JSON.parse(current||old||'null')),error:null};
  }catch(error){return {profile:freshProfile(),error:'Не удалось прочитать сохранение. Исходные данные оставлены в хранилище.'};}
}
export function saveProfile(profile,storage=globalThis.localStorage) {
  profile.updatedAt=Date.now();
  try{storage.setItem(SAVE_KEY,JSON.stringify(profile));return true;}catch{return false;}
}
export function totalStars(p){return Object.values(p.levels).reduce((n,l)=>n+l.stars,0);}
export function completed(p){return Object.values(p.levels).filter(l=>l.stars>0).length;}
export function ensureMissions(p,today=dayKey()){
  if(p.missions.date!==today)p.missions={date:today,wins:0,powers:0,collected:0,claimed:[]};
}
export function claimDaily(p,today=dayKey()){
  if(p.daily.lastClaim>=today)return null;
  p.daily.streak=p.daily.lastClaim===previousDay(today)?p.daily.streak%7+1:1;
  p.daily.lastClaim=today;
  const coins=60+p.daily.streak*20;p.coins+=coins;
  const tool=p.daily.streak===7?'orb':p.daily.streak%3===0?'bomb':'hammer';p.inventory[tool]++;
  return {coins,tool};
}
export const MISSIONS=[{key:'wins',name:'Три маленькие победы',goal:3,coins:120,tool:'hammer'}, {key:'powers',name:'Мастер комбинаций',goal:12,coins:100,tool:'rocket-h'}, {key:'collected',name:'Собиратель сокровищ',goal:250,coins:100,tool:'shuffle'}];
export function claimMission(p,key,today=dayKey()){
  ensureMissions(p,today);const m=MISSIONS.find(m=>m.key===key);
  if(!m||p.missions[key]<m.goal||p.missions.claimed.includes(key))return false;
  p.missions.claimed.push(key);p.coins+=m.coins;p.inventory[m.tool]++;return true;
}
export function claimChest(p){
  if(totalStars(p)<(p.claimedChests+1)*30)return false;
  p.claimedChests++;p.coins+=250;p.inventory.orb++;p.inventory.hammer++;return true;
}
export function chapterComplete(p,index){
  return Array.from({length:LEVELS_PER_CHAPTER},(_,i)=>index*LEVELS_PER_CHAPTER+i+1).every(id=>p.levels[id]?.stars>0);
}
export function claimChapter(p,index){
  if(!Number.isInteger(index)||index<0||index>=25||p.claimedChapters.includes(index)||!chapterComplete(p,index))return false;
  p.claimedChapters.push(index);p.coins+=400;p.inventory.bomb+=2;p.inventory.orb++;return true;
}
export function buyTool(p,tool){const item=TOOLS[tool];if(!item||p.coins<item.price||p.inventory[tool]>=999)return false;p.coins-=item.price;p.inventory[tool]++;return true;}
export function recordWin(p,game,{mode='campaign',duration=0,today=dayKey()}={}){
  ensureMissions(p,today);p.stats.wins++;p.missions.wins++;
  let coins=0,stars=game.stars(),first=false;
  if(mode==='campaign'){
    const id=game.config.id;
    const old=p.levels[id]||{stars:0,score:0,moves:0,wins:0,attempts:1,bestTime:0};
    first=old.stars===0;
    coins=first?70+stars*20:Math.max(0,stars-old.stars)*20;
    p.levels[id]={...old,stars:Math.max(old.stars,stars),score:Math.max(old.score,game.score),moves:Math.max(old.moves,game.moves),wins:old.wins+1,
      bestTime:old.bestTime?Math.min(old.bestTime,duration):duration};
    p.unlocked=Math.min(LEVEL_COUNT,Math.max(p.unlocked,id+1));
  }else if(mode==='daily'){
    if(p.daily.challengeDate!==today){coins=200;p.inventory.hammer++;p.daily.challengeScore=game.score;}
    else p.daily.challengeScore=Math.max(p.daily.challengeScore,game.score);
    p.daily.challengeDate=today;
  }else coins=20;
  p.coins+=coins;return {coins,stars,first};
}
