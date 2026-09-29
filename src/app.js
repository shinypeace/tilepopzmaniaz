import { unseenObstacles, OBSTACLES } from './obstacles.js';
import {Game,key,position} from './engine.js';
import {getLevel,getChallenge,getDaily,CHAPTERS,LEVEL_COUNT} from './levels.js';
import {loadProfile,saveProfile,dayKey,totalStars,completed,ensureMissions,claimDaily,claimMission,claimChest,claimChapter,buyTool,recordWin,TOOLS} from './progress.js';
import {icon,esc,fmt,stars,NAMES,TOOL_INFO,navigation,homePage,arcadesPage,mapPage,recordsPage,shopPage,rewardsPage,rulesPage,rulesContent,RULE_TABS,goalList,chapterPicker} from './ui.js';
import {Renderer} from './renderer.js';
import {prepareArt} from './asset-loader.js';
import {Sound} from './audio.js';
import {rankActions} from './strategy.js';
import {connectPlatform,syncCloud,showBanner,flushCloud} from './platform.js';

const $=id=>document.getElementById(id);
const loaded=loadProfile();
let p=loaded.profile,page='home',chapter=Math.floor((p.unlocked-1)/20),recordsTab='campaign',recordsChapter=chapter,rulesTab='basics',rewardsTab='gifts',shopTab='tools';
let game=null,mode='campaign',stage=1,runScore=0,runDate=dayKey(),elapsed=0,startedAt=0;
let busy=false,selected=null,activeTool=null,drag=null,hintTimer=null,toastTimer=null,modalKind='',pending=null,preboost=new Set(),finished=false,extraUsed=false;
let persistenceWarned=false,cloud=false,pauseRequested=false;
const sound=new Sound(p.settings),renderer=new Renderer($('board'),$('board-wrap'),p.settings,sound);
const themes={garden:'critters',coast:'gems',sunset:'nature',palace:'sweets'};

function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function persist(){
  if(!saveProfile(p)&&!persistenceWarned){persistenceWarned=true;toast('Хранилище недоступно. Прогресс сохранится только до закрытия страницы.');}
  syncCloud(p,()=>{cloud=false;});
}
function applySettings(){document.body.classList.toggle('reduce-motion',!p.settings.motion);setTheme();sound.settings=p.settings;renderer.settings=p.settings;sound.sync();}
function setTheme(){const theme='garden';document.documentElement.style.setProperty('--scene',`url("${new URL(`../assets/bg-${themes[theme]}.webp`,import.meta.url).href}")`);}
function decorate(){
  for(const el of document.querySelectorAll('.primary:not([data-skin]),.secondary:not([data-skin])')){
    const color=el.classList.contains('gold-button')||el.classList.contains('orange-button')?'orange':el.classList.contains('purple-button')?'purple':el.classList.contains('blue-button')||el.classList.contains('secondary')?'blue':'green';
    el.insertAdjacentHTML('afterbegin',icon(`button-${color}`,'button-skin'));el.dataset.skin=color;
  }
  $('app').classList.toggle('at-home',page==='home');
}
function chrome(){
  $('star-wallet').innerHTML=icon('star')+fmt(totalStars(p));$('coin-wallet').innerHTML=icon('coin')+fmt(p.coins);
  $('star-wallet').setAttribute('aria-label',`Звёзды: ${totalStars(p)}`);$('coin-wallet').setAttribute('aria-label',`Монеты: ${p.coins}. Открыть бустеры`);
  $('mobile-nav').innerHTML=navigation(page==='arcades'?'home':page,p);
  document.querySelector('.wallet .round-button').innerHTML=icon('settings');
}
function renderPage(scroll=true){
  ensureMissions(p);chrome();setTheme();
  const content=page==='home'?homePage(p):page==='arcades'?arcadesPage(p):page==='map'?mapPage(p,chapter):page==='records'?recordsPage({...p,cloud},recordsTab,recordsChapter):page==='shop'?shopPage(p,shopTab):page==='rewards'?rewardsPage(p,rewardsTab):rulesPage(rulesTab,p.seenObstacles);
  const oldScroll=$('page-content').scrollTop;$('page-content').innerHTML=content;
  $('page-content').scrollTop=scroll?0:oldScroll;
  $('breadcrumb').textContent=({home:'',map:'Карта',rewards:'Награды',records:'Рекорды',shop:'Бустеры',rules:'Правила'})[page];decorate();
  if(page==='map')requestAnimationFrame(()=>{
    const target=$('map-scroll'),node=target?.querySelector('.current')||target?.querySelector('.level-node');
    if(target&&node)target.scrollTop=node.offsetTop-target.clientHeight*.6;
  });
}
function stopClock(){if(startedAt){elapsed+=Date.now()-startedAt;startedAt=0;}}
function startClock(){if(!startedAt&&game?.status==='playing')startedAt=Date.now();}
function saveSession(){
  if(game&&game.status==='playing'&&!finished)p.active={game:game.serialize(),mode,stage,runScore,runDate,elapsed:elapsed+(startedAt?Date.now()-startedAt:0),extraUsed};
  else if(game)p.active=null;
  persist();
}
function navigate(next){
  if(busy){toast('Дождитесь завершения комбинации');return;}
  if(game&&!$('game-screen').hidden){stopClock();saveSession();}
  clearTimeout(hintTimer);closeModal(false);page=next;$('app').classList.remove('playing');$('game-screen').hidden=true;
  sound.setTrack('menu');renderPage();
}
function showModal(kind,html,{close=true}={}){
  clearTimeout(hintTimer);stopClock();modalKind=kind;$('modal').dataset.kind=kind;$('modal-body').innerHTML=html;
  const cross=$('modal').querySelector('.modal-close');cross.innerHTML=icon('close');cross.hidden=!close;
  $('modal-body').scrollTop=0;decorate();
  if(!$('modal').open)$('modal').showModal();
}
function closeModal(resume=true){
  $('modal').close();modalKind='';
  if(resume&&game&&!$('game-screen').hidden&&game.status==='playing'){startClock();scheduleHint();}
}
function showPrelevel(config,selectedMode='campaign'){
  if(busy)return;
  if(selectedMode==='campaign'&&config.id>p.unlocked){toast(`Сначала пройдите уровень ${p.unlocked}`);return;}
  pending={config,mode:selectedMode};preboost=new Set();drawPrelevel();
}
function drawPrelevel(){
  const {config,mode:chosen}=pending;
  showModal('prelevel',`<h2 id="modal-title">${chosen==='campaign'?`Уровень ${config.id}`:esc(config.name)}</h2><div class="modal-goals">${goalList(config.goals)}</div><h3 class="section-label">Выберите бустеры</h3><div class="booster-select">${['rocket-h','bomb','orb'].map(k=>`<button data-action="preboost" data-tool="${k}" class="${preboost.has(k)?'selected':''}" aria-pressed="${preboost.has(k)}" aria-label="${TOOLS[k].name}, в запасе ${p.inventory[k]}" ${!p.inventory[k]?'disabled':''}>${icon(k)}<span class="booster-count">${p.inventory[k]}</span></button>`).join('')}</div><button class="primary" data-action="start">Играть</button>`);
}
function enterGame(){
  closeModal(false);$('app').classList.add('playing');$('game-screen').hidden=false;
  activeTool=null;selected=null;busy=false;finished=false;pauseRequested=false;drag=null;
  $('game-title').textContent=mode==='campaign'?`Уровень ${game.config.id}`:mode==='endless'?`Бесконечность · волна ${stage}`:game.config.name;
  $('game-difficulty').textContent=mode==='wall'?'Стена':game.config.difficulty==='Обычный'?'':game.config.difficulty;
  $('moves-label').textContent='ХОДЫ';
  $('game-pause').innerHTML=icon('pause');$('game-help').innerHTML=icon('rules');
  for(const el of document.querySelectorAll('.meter-star'))el.innerHTML=icon('star');
  $('game-message').textContent=mode==='wall'?'Остановите стену':game.turns===0&&game.config.id===1?'Соберите 3 одинаковые фишки':'';
  $('board').classList.remove('busy','targeting');renderer.setup(game);renderTools();updateMeter();sound.setTrack('game');startClock();
  requestAnimationFrame(()=>{renderer.resize();scheduleHint();});
  obstacleIntro();
}
function obstacleIntro(){
  const next=unseenObstacles(game.config,p.seenObstacles)[0];
  if(!next)return;
  const obstacle=OBSTACLES[next];
  showModal('obstacle-intro',`<h2 id="modal-title">${obstacle.name}</h2>${rulesContent('obstacles',[next])}<button class="primary" data-action="obstacle-next" data-obstacle="${next}">Понятно!</button>`,{close:false});
}
function acknowledgeObstacle(){
  const next=unseenObstacles(game.config,p.seenObstacles)[0];
  if(next)p.seenObstacles.push(next);
  persist();closeModal();obstacleIntro();
}
function begin(config,chosen,{carry=false}={}){
  if(chosen==='campaign'&&config.id>p.unlocked)return;
  const attempts=p.levels[config.id]?.attempts||0;
  const newGame=new Game(config,{seed:config.seed+(chosen==='campaign'?attempts*7919:0),record:true});
  stopClock();if(!carry){stage=1;runScore=0;elapsed=0;extraUsed=false;runDate=dayKey();}
  game=newGame;mode=chosen;
  for(const booster of preboost)if(p.inventory[booster]>0&&game.addStartingPower(booster))p.inventory[booster]--;
  preboost.clear();
  if(chosen==='campaign'){
    const old=p.levels[config.id]||{stars:0,score:0,moves:0,wins:0,attempts:0,bestTime:0};
    old.attempts++;p.levels[config.id]=old;chapter=config.chapter;
  }
  if(!carry)p.stats.games++;
  enterGame();saveSession();
}
function resumeSaved(){
  try{
    const s=p.active;if(!s)return;
    if(!['campaign','daily','wall','endless'].includes(s.mode))throw new Error('Unknown mode');
    game=Game.restore(s.game);mode=s.mode;stage=Math.max(1,Number(s.stage)||1);runScore=Math.max(0,Number(s.runScore)||0);runDate=s.runDate||dayKey();elapsed=Math.max(0,Number(s.elapsed)||0);extraUsed=!!s.extraUsed;startedAt=0;enterGame();
  }catch{p.active=null;game=null;persist();renderPage();toast('Этот заход не удалось восстановить. Уровни и награды сохранены.');}
}
function renderTools(){
  $('tools').innerHTML=['hammer','row','column','shuffle'].map(k=>`<button class="tool ${activeTool===k?'active':''} ${p.inventory[k]?'':'empty'}" data-action="tool" data-tool="${k}" aria-pressed="${activeTool===k}" aria-label="${TOOLS[k].name}: ${p.inventory[k]}" title="${TOOLS[k].name}: ${TOOL_INFO[k]}">${icon('tool-base','tool-skin')}${icon(k,'tool-art')}<span class="tool-count">${p.inventory[k]||'+'}</span></button>`).join('');
  $('cancel-tool').hidden=!activeTool;$('board').classList.toggle('targeting',!!activeTool);
}
function updateMeter(){
  if(!game)return;
  const potential=game.moves>=Math.ceil(game.config.moves*.28)?3:game.moves>=Math.ceil(game.config.moves*.12)?2:1;
  $('star-fill').style.width=`${Math.min(100,15+game.moves/game.config.moves*85)}%`;
  document.querySelectorAll('.meter-star').forEach((el,i)=>{el.classList.toggle('unearned',i>=potential);el.classList.remove('pulse');if(i<potential&&p.settings.motion){requestAnimationFrame(()=>el.classList.add('pulse'));}});
  const threshold3=Math.ceil(game.config.moves*.28),threshold2=Math.ceil(game.config.moves*.12);
  document.querySelector('.star-meter').setAttribute('title',`3 звезды: закончите с ${threshold3}+ ходами. 2 звезды: с ${threshold2}+.`);
}
function scheduleHint(){
  clearTimeout(hintTimer);
  if(!p.settings.hints||busy||$('modal').open||!game||game.status!=='playing'||$('game-screen').hidden)return;
  hintTimer=setTimeout(()=>{if(!busy&&!$('modal').open&&!activeTool){const hint=rankActions(game)[0]?.action;if(hint)renderer.hint(hint);}},7000);
}
function resultMarkup(result){
  if(game.status==='won')return `<div class="modal-eyebrow">${mode==='campaign'?`УРОВЕНЬ ${game.config.id} ПРОЙДЕН`:'ПРЕКРАСНАЯ ИГРА'}</div><h2 id="modal-title">${result.stars===3?'Блестящая победа!':'У вас получилось!'}</h2>${stars(result.stars,'result-stars')}<div class="result-values"><div>${fmt(game.score+runScore)}<small>Очки</small></div><div>${icon('coin')} +${result.coins}<small>Награда</small></div></div><p class="modal-subtitle">${mode==='campaign'?(game.config.id===500?'Все 500 уровней пройдены! Возвращайтесь за испытанием дня и недостающими звёздами.':result.first?'Новый путь открыт. Следующее чудо уже ждёт.':'Лучшие звёзды и очки сохранены.') : mode==='daily'?'Сегодняшняя головоломка решена. Завтра будет новая.':'Готовы к следующей волне?'}</p><button class="primary" data-action="${mode==='campaign'&&game.config.id<500?'next':mode==='endless'?'next-wave':'result-map'}">${mode==='campaign'&&game.config.id<500?'Следующий уровень':mode==='endless'?'Следующая волна':'На карту'}</button><button class="secondary" data-action="result-map">${mode==='campaign'?'Вернуться на карту':'Закрыть'}</button>`;
  return `${icon(mode==='wall'?'crate':'heart','hero-icon')}<div class="modal-eyebrow">ЕЩЁ ОДНА ПОПЫТКА — НОВЫЙ ШАНС</div><h2 id="modal-title">${mode==='wall'?'Стена добралась до верха':'Ходы закончились'}</h2><p class="modal-subtitle">${mode==='wall'?`Ваш результат: ${fmt(game.score)} очков`:'Вы уже близко. Попробуйте объединять бонусы и освобождать пространство.'}</p><div class="modal-goals">${goalList(Object.fromEntries(Object.entries(game.goals).filter(([,n])=>n>0)))}</div>${mode!=='wall'&&!extraUsed?`<button class="primary gold-button" data-action="extra" ${p.coins<150?'disabled':''}>Ещё 5 ходов · ${icon('coin')} 150</button>`:''}<button class="primary" data-action="retry">Попробовать ещё раз</button><button class="secondary" data-action="result-map">На карту</button><p class="notice">Попытки бесплатны. Запас жизней не ограничен.</p>`;
}
function registerOutcome(){
  if(game.status==='playing'||finished)return null;
  finished=true;stopClock();p.active=null;
  let result={stars:0,coins:0,first:false};
  if(game.status==='won'){
    if(mode!=='daily'||runDate===dayKey())result=recordWin(p,game,{mode,duration:elapsed,today:dayKey()});
    else{result.stars=game.stars();toast('Испытание прошлого дня завершено. Сегодня уже доступно новое.');}
    sound.play('win');
  }else sound.play('lose');
  if(mode==='wall')p.stats.wall=Math.max(p.stats.wall,game.score);
  if(mode==='endless')p.stats.endless=Math.max(p.stats.endless,runScore+game.score);
  persist();chrome();return result;
}
async function act(action){
  if(busy||$('modal').open||!game||game.status!=='playing'||$('game-screen').hidden)return;
  if(action.type==='tool'&&!p.inventory[action.tool])return;
  busy=true;$('board').classList.add('busy');clearTimeout(hintTimer);renderer.clearSelection();selected=null;
  const before={collected:game.collected,powers:game.powersCreated};let outcome=null;
  try{
    const result=game.perform(action);
    if(result.valid){
      if(action.type==='tool')p.inventory[action.tool]--;
      activeTool=null;ensureMissions(p);
      p.stats.collected+=game.collected-before.collected;p.stats.powers+=game.powersCreated-before.powers;
      p.missions.collected+=game.collected-before.collected;p.missions.powers+=game.powersCreated-before.powers;
      p.stats.bestCascade=Math.max(p.stats.bestCascade,game.maxCascade);p.stats.score=Math.max(p.stats.score,game.score);
      if(mode==='wall')p.stats.wall=Math.max(p.stats.wall,game.score);
      if(mode==='endless')p.stats.endless=Math.max(p.stats.endless,runScore+game.score);
      outcome=registerOutcome();saveSession();
    }
    await renderer.animate(result.frames);renderer.render(game.snapshot());updateMeter();renderTools();
    if(result.frames.some(f=>f.type==='shuffle'))toast('Новых ходов не было — фишки перемешаны бесплатно');
    if(!result.valid&&action.type==='swap')$('game-message').textContent='Нет комбинации — ход сохранён';
    else if(mode==='wall')$('game-message').textContent=`Новая стена через ${5-game.turns%5} ходов`;
    else $('game-message').textContent='';
    if(outcome)showModal('result',resultMarkup(outcome),{close:false});
  }catch(error){console.error(error);renderer.render(game.snapshot());toast('Не удалось завершить действие. Сохранение доступно на карте.');}
  finally{busy=false;$('board').classList.remove('busy');if(pauseRequested&&!outcome){pauseRequested=false;pause();}else scheduleHint();}
}
function onCell(picked){
  if(busy||$('modal').open||!game||game.status!=='playing')return;
  clearTimeout(hintTimer);renderer.clearSelection();
  if(activeTool){act({type:'tool',tool:activeTool,a:picked});return;}
  if(selected!==null&&selected!==picked&&game.neighbors(selected).includes(picked)){const old=selected;selected=null;act({type:'swap',a:old,b:picked});return;}
  if(game.cell(picked)?.power&&game.movable(picked)){selected=null;act({type:'tap',a:picked});return;}
  if(!game.movable(picked)){selected=null;toast(game.chains.has(picked)?'Цепь снимается взрывом или инструментом':game.ice.has(picked)?'Соберите ряд с цветом фишки подо льдом':game.cell(picked)?.kind==='stone'?'Камень повреждается только прямым попаданием':'Соберите комбинацию рядом с ящиком');return;}
  selected=selected===picked?null:picked;if(selected!==null)renderer.select(selected);scheduleHint();
}
function pause(){
  if(busy){pauseRequested=true;return;}
  if(!game||game.status!=='playing')return;
  saveSession();showModal('pause',`${icon('leaf','hero-icon')}<div class="modal-eyebrow">МОЖНО НЕ СПЕШИТЬ</div><h2 id="modal-title">Пауза</h2><button class="primary" data-action="close">Продолжить</button><button class="secondary" data-action="settings">Настройки</button><button class="secondary" data-action="nav" data-page="home">В меню</button>`);
}
function settings(){showModal('settings',`<div class="modal-eyebrow">ИГРА ПО ВАШИМ ПРАВИЛАМ</div><h2 id="modal-title">Настройки</h2>${[['sound','Звуки','Комбинации и маленькие победы'],['music','Музыка','Сказочное настроение'],['motion','Анимации','Выключите для спокойной игры'],['hints','Подсказки','Подсветить ход после паузы']].map(([k,n,d])=>`<label class="setting-row"><span><strong>${n}</strong><small>${d}</small></span><input type="checkbox" data-setting="${k}" ${p.settings[k]?'checked':''}></label>`).join('')}<button class="primary" data-action="close">Готово</button>`);}
function gameRules(tab='basics'){
  showModal('rules',`<h2 id="modal-title">Как играть</h2><div class="tab-strip">${RULE_TABS.map(([k,n])=>`<button data-action="modal-rules" data-tab="${k}" class="${tab===k?'active':''}">${n}</button>`).join('')}</div><div class="rules-in-modal">${rulesContent(tab,p.seenObstacles)}</div><button class="primary" data-action="close">Всё понятно</button>`);
}
function reward(title,message,rewardIcon='chest'){persist();chrome();renderPage(false);showModal('reward',`${icon(rewardIcon,'hero-icon')}<div class="modal-eyebrow">МАЛЕНЬКОЕ СОКРОВИЩЕ</div><h2 id="modal-title">${title}</h2><p class="modal-subtitle">${message}</p><button class="primary" data-action="close">Отлично!</button>`);sound.play('win');}
function toolSelection(tool){
  if(busy||!game||game.status!=='playing')return;
  if(!p.inventory[tool]){showModal('buy-tool',`${icon(tool,'hero-icon')}<h2 id="modal-title">${TOOLS[tool].name}</h2><p class="modal-subtitle">${TOOL_INFO[tool]}<br>Не расходует ход.</p><button class="primary gold-button" data-action="buy-in-game" data-tool="${tool}" ${p.coins<TOOLS[tool].price?'disabled':''}>Купить · ${TOOLS[tool].price} монет</button><button class="secondary" data-action="close">Вернуться в игру</button>`);return;}
  if(tool==='shuffle'){act({type:'tool',tool});return;}
  activeTool=activeTool===tool?null:tool;selected=null;renderer.clearSelection();renderTools();$('game-message').textContent=activeTool?'Выберите клетку':'';
}

document.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]');if(!button||button.disabled)return;
  sound.play('tap');const {action,id,tool,tab}=button.dataset;
  if(busy&&!['pause'].includes(action)){toast('Комбинация ещё завершается');return;}
  switch(action){
    case 'nav':navigate(button.dataset.page);break;
    case 'chapter':chapter=Math.max(0,Math.min(24,chapter+Number(button.dataset.delta)));renderPage();break;
    case 'level':showPrelevel(getLevel(Number(id)));break;
    case 'preboost':preboost.has(tool)?preboost.delete(tool):preboost.add(tool);drawPrelevel();break;
    case 'start':if(pending){const start=pending;pending=null;begin(start.config,start.mode);}break;
    case 'resume-saved':resumeSaved();break;
    case 'close':closeModal();break;
    case 'obstacle-next':acknowledgeObstacle();break;
    case 'settings':settings();break;
    case 'rules':gameRules();break;
    case 'modal-rules':gameRules(tab);break;
    case 'rules-tab':rulesTab=tab;renderPage(false);break;
    case 'records-tab':recordsTab=tab;renderPage(false);break;
    case 'record-chapter':recordsChapter=Math.max(0,Math.min(24,recordsChapter+Number(button.dataset.delta)));renderPage(false);break;
    case 'shop-tab':shopTab=tab;renderPage();break;
    case 'rewards-tab':rewardsTab=tab;renderPage();break;
    case 'chapter-picker':showModal('chapters',chapterPicker(chapter));break;
    case 'choose-chapter':chapter=Number(id);closeModal();renderPage();break;
    case 'tool-info':showModal('tool-info',`${icon(tool,'hero-icon')}<h2 id="modal-title">${TOOLS[tool].name}</h2><p class="modal-subtitle">${TOOL_INFO[tool]}</p><button class="primary" data-action="close">Понятно</button>`);break;
    case 'daily-level':showPrelevel(getDaily(dayKey()),'daily');break;
    case 'arcade':preboost.clear();begin(getChallenge(button.dataset.mode==='wall'?'wall':'goals'),button.dataset.mode);break;
    case 'daily-gift':{const gift=claimDaily(p);if(gift)reward('Ваш подарок!',`${gift.coins} монет и ${TOOLS[gift.tool].name.toLowerCase()} добавлены в запас.`,gift.tool);break;}
    case 'mission':if(claimMission(p,button.dataset.key))reward('Задание выполнено','Монеты и бустер уже в вашем запасе.');break;
    case 'chest':if(claimChest(p))reward('Сундук открыт!','250 монет, радужный шар и молоток — всё ваше.');break;
    case 'chapter-reward':if(claimChapter(p,Number(id)))reward('Новая глава истории','400 монет, две бомбы и радужный шар добавлены в запас.');break;
    case 'buy':if(buyTool(p,tool)){persist();renderPage(false);toast(`${TOOLS[tool].name} +1`);}break;
    case 'buy-in-game':if(buyTool(p,tool)){persist();closeModal();renderTools();toolSelection(tool);}break;
    case 'tool':toolSelection(tool);break;
    case 'cancel-tool':activeTool=null;renderTools();$('game-message').textContent='';break;
    case 'pause':pause();break;
    case 'retry':{
      const config=mode==='campaign'?getLevel(game.config.id):mode==='daily'?getDaily(dayKey()):getChallenge(mode==='wall'?'wall':'goals');
      preboost.clear();begin(config,mode);break;
    }
    case 'extra':if(game.status==='lost'&&!extraUsed&&p.coins>=150&&mode!=='wall'){
      p.coins-=150;extraUsed=true;finished=false;game.moves+=5;game.status='playing';closeModal();renderer.render(game.snapshot());updateMeter();saveSession();startClock();scheduleHint();
    }break;
    case 'next':showPrelevel(getLevel(Math.min(500,game.config.id+1)));break;
    case 'next-wave':runScore+=game.score;stage++;preboost.clear();begin(getChallenge('goals',stage),'endless',{carry:true});break;
    case 'result-map':game=null;p.active=null;persist();navigate('map');break;
  }
});
document.addEventListener('change',e=>{
  if(e.target.dataset.setting){const k=e.target.dataset.setting;p.settings[k]=k==='theme'?e.target.value:e.target.checked;applySettings();persist();}
  if(e.target.id==='records-chapter'){recordsChapter=Number(e.target.value);renderPage(false);}
});
$('modal').addEventListener('cancel',e=>{e.preventDefault();if(modalKind==='obstacle-intro')return;if(modalKind==='result'){game=null;p.active=null;persist();navigate('map');}else closeModal();});
$('board').addEventListener('pointerdown',e=>{
  if(busy||$('modal').open||!game||game.status!=='playing'||(e.pointerType==='mouse'&&e.button!==0))return;
  const el=e.target.closest('.piece');if(!el)return;
  drag={p:Number(el.dataset.p),x:e.clientX,y:e.clientY,id:e.pointerId};$('board').setPointerCapture(e.pointerId);e.preventDefault();
});
$('board').addEventListener('pointerup',e=>{
  if(!drag||drag.id!==e.pointerId)return;const start=drag;drag=null;
  const dx=e.clientX-start.x,dy=e.clientY-start.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))>Math.max(12,renderer.cell*.25)&&!activeTool){
    const[r,c]=position(start.p),horizontal=Math.abs(dx)>Math.abs(dy),rr=r+(horizontal?0:dy>0?1:-1),cc=c+(horizontal?dx>0?1:-1:0);
    if(game.inside(rr,cc))act({type:'swap',a:start.p,b:key(rr,cc)});
  }else onCell(start.p);
});
$('board').addEventListener('pointercancel',()=>{drag=null;});
$('board').addEventListener('lostpointercapture',()=>{drag=null;});
$('board').addEventListener('keydown',e=>{
  if(busy||!game||$('modal').open)return;
  const el=e.target.closest('.piece');if(!el)return;const p=Number(el.dataset.p);
  if(e.key==='Enter'||e.key===' '){e.preventDefault();onCell(p);return;}
  const delta={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[e.key];if(!delta)return;e.preventDefault();
  const[r,c]=position(p);let rr=r+delta[0],cc=c+delta[1];
  while(rr>=0&&rr<game.rows&&cc>=0&&cc<game.cols){const target=renderer.element(key(rr,cc));if(target){el.tabIndex=-1;target.tabIndex=0;target.focus();break;}rr+=delta[0];cc+=delta[1];}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('modal').open&&!$('game-screen').hidden){if(activeTool){activeTool=null;renderTools();}else pause();}});
document.addEventListener('visibilitychange',()=>{sound.sync();if(document.hidden){stopClock();if(game&&!$('game-screen').hidden){saveSession();if(!$('modal').open)pause();}}});
document.addEventListener('vk-app-visibility',e=>{if(!e.detail.visible){sound.music?.pause();stopClock();if(game&&!$('game-screen').hidden){saveSession();if(!$('modal').open)pause();}flushCloud();}else sound.sync();});
for(const event of ['selectstart','dragstart','contextmenu'])document.addEventListener(event,e=>e.preventDefault());
document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
document.addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault();},{passive:false});
window.addEventListener('pagehide',()=>{stopClock();saveSession();flushCloud();});
window.addEventListener('hashchange',()=>{if(location.hash==='#map')navigate('map');});

try{
  const [platform]=await Promise.all([connectPlatform(p),prepareArt()]);p=platform.profile;cloud=platform.cloud;chapter=Math.floor((p.unlocked-1)/20);recordsChapter=chapter;
  applySettings();ensureMissions(p);$('app').hidden=false;$('boot').hidden=true;renderPage();sound.setTrack('menu');
  showBanner();
  if(loaded.error)toast(loaded.error);
}catch(error){console.error(error);$('boot').innerHTML='<strong>Не удалось загрузить игру</strong><span>Проверьте соединение и повторите загрузку.</span><button id="retry-load">Повторить</button>';$('retry-load').addEventListener('click',()=>location.reload());}
