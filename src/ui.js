import { CHAPTERS, getLevel } from './levels.js';
import { totalStars, completed, dayKey, previousDay, MISSIONS, TOOLS, chapterComplete } from './progress.js';
import { art, chapterImage } from './art.js';
import { OBSTACLES } from './obstacles.js';
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt=n=>Number(n||0).toLocaleString('ru-RU');
export const icon=art;
export const stars=(n,cls='stars-inline')=>`<span class="${cls}" aria-label="${n} из 3 звёзд">${[1,2,3].map(i=>icon('star',i>n?'empty':'')).join('')}</span>`;
export const NAMES={blue:'Синий щит',green:'Зелёный лист',red:'Красная книга',orange:'Оранжевая плитка',yellow:'Золотая корона',purple:'Фиолетовый кристалл',ice:'Лёд',crate:'Ящик',stone:'Камень',grass:'Трава',chain:'Цепь','rocket-h':'Ракета по горизонтали','rocket-v':'Ракета по вертикали',orb:'Радужный шар',bomb:'Бомба'};
export const TOOL_INFO={hammer:'Убирает фишку или один слой препятствия.',row:'Выстрел стрелой очищает выбранную строку.',column:'Пушка очищает выбранный столбец.',shuffle:'Перемешивает свободные фишки, сохраняя бонусы.','rocket-h':'Ракета на старте уровня.',bomb:'Бомба на старте уровня.',orb:'Радужный шар на старте уровня.'};
export const NAV=[['map','map','Карта'],['rewards','chest','Награды'],['home','home','Главная'],['shop','hammer','Бустеры'],['records','trophy','Рекорды']];
export function navigation(active,p){return NAV.map(([page,name,label])=>`<button data-action="nav" data-page="${page}" class="${active===page?'active':''} ${page==='home'?'nav-home':''}" ${active===page?'aria-current="page"':''}>${icon(name)}<span>${label}</span>${page==='rewards'&&p.daily.lastClaim!==dayKey()?'<i class="nav-dot"></i>':''}</button>`).join('');}
export const heading=(_eyebrow,title,back=false)=>`<header class="page-heading ${back?'with-back':''}">${back?`<button class="art-button page-back" data-action="nav" data-page="home" aria-label="Вернуться на главную">${icon('back')}</button>`:''}<h1><span class="ribbon-copy">${title}</span></h1></header>`;
const tabs=(items,active,action)=>`<div class="tab-strip">${items.map(([id,label])=>`<button class="${active===id?'active':''}" data-action="${action}" data-tab="${id}" aria-pressed="${active===id}">${label}</button>`).join('')}</div>`;
const progress=(n,max)=>`<div class="progress-track"><i style="width:${Math.min(100,n/max*100)}%"></i><b>${Math.min(n,max)} / ${max}</b></div>`;
export function homePage(p){return `<div class="home-menu">${icon('logo','home-logo')}<div class="home-actions">${p.active?'<button class="primary" data-action="resume-saved">Продолжить</button>':''}<button class="primary ${p.active?'blue-button':''}" data-action="level" data-id="${p.unlocked}">Уровень ${p.unlocked}</button></div><div class="home-shortcuts"><button class="home-gift" data-action="nav" data-page="rewards">${icon('chest')}<span class="shortcut-label">${p.daily.lastClaim===dayKey()?'Награды':'Подарок дня'}</span></button><button class="home-gift" data-action="nav" data-page="arcades">${icon('arcade')}<span class="shortcut-label">Аркады</span></button></div><button class="home-help art-button" data-action="rules" aria-label="Как играть">${icon('rules')}</button></div>`;}
export const goalList=goals=>Object.entries(goals).map(([k,v])=>`<div title="${NAMES[k]}" aria-label="${NAMES[k]}: ${v}">${icon(k)}<b>${v}</b></div>`).join('');
export function chapterPicker(chosen=0,action='choose-chapter'){return `<h2 id="modal-title">Все главы</h2><div class="chapter-picker">${CHAPTERS.map((ch,i)=>`<button class="chapter-thumb ${i===chosen?'selected':''}" data-action="${action}" data-id="${i}"><img src="${chapterImage(i)}" alt="" loading="lazy" draggable="false"><span>${i+1}. ${ch.name}</span></button>`).join('')}</div>`;}
export function mapPage(p,chapter){
 const start=chapter*20+1;
 const nodes=Array.from({length:20},(_,i)=>{const id=start+i,rec=p.levels[id],locked=id>p.unlocked,current=id===p.unlocked,x=[50,73,50,27][i%4],y=94-i*4.55;
 const skin=locked?'locked':rec?.stars?'green':getLevel(id).difficulty!=='Обычный'?'purple':'blue';
 return `<button class="level-node ${locked?'locked':''} ${current?'current':''}" style="left:${x}%;top:${y}%" data-action="level" data-id="${id}" aria-label="Уровень ${id}${locked?', закрыт':rec?.stars?`, ${rec.stars} звезды`:''}" ${locked?'aria-disabled="true"':''}>${icon('node-'+skin)}<b>${id}</b>${rec?.stars?stars(rec.stars,'node-stars'):''}${current?'<span class="node-label">Играть</span>':''}</button>`;
 }).join('');
 return `<div class="map-page"><div class="chapter-header"><button class="art-button" data-action="chapter" data-delta="-1" aria-label="Предыдущая глава" ${chapter===0?'disabled':''}>${icon('back')}</button><button class="chapter-title" data-action="chapter-picker"><span class="ribbon-copy"><small>Глава ${chapter+1}</small><strong>${CHAPTERS[chapter].name}</strong></span></button><button class="art-button next-arrow" data-action="chapter" data-delta="1" aria-label="Следующая глава" ${chapter===24?'disabled':''}>${icon('back')}</button></div><div class="map-scroll" id="map-scroll"><div class="map-landscape" style="background-image:url('./assets/runtime/map-${chapter+1}.webp')"><button class="map-finish" data-action="nav" data-page="rewards" aria-label="Награда за главу">${icon('chest')}</button>${nodes}</div></div><div class="map-play"><button class="primary" data-action="level" data-id="${p.unlocked}">Уровень ${p.unlocked}</button></div></div>`;
}
export function recordsPage(p,tab='campaign',chapter=0){
 let content='';
 if(tab==='campaign'){
 const rows=Array.from({length:20},(_,i)=>chapter*20+i+1).filter(id=>p.levels[id]?.stars).map(id=>`<button class="record-row" data-action="level" data-id="${id}" aria-label="Переиграть уровень ${id}"><span class="record-badge">${icon('node-blue')}<b>${id}</b></span><span>${stars(p.levels[id].stars)}<strong>${fmt(p.levels[id].score)} <small>очков</small></strong></span>${icon('back','replay-arrow')}</button>`).join('');
 content=`<div class="chapter-switch"><button data-action="record-chapter" data-delta="-1" aria-label="Предыдущая глава" ${chapter===0?'disabled':''}>${icon('back')}</button><b>Глава ${chapter+1}</b><button class="next-arrow" data-action="record-chapter" data-delta="1" aria-label="Следующая глава" ${chapter===24?'disabled':''}>${icon('back')}</button></div>${rows||`<div class="game-panel empty-state">${icon('trophy')}<h3>Первый рекорд впереди</h3><p>Пройдите уровень этой главы.</p><button class="primary" data-action="nav" data-page="map">На карту</button></div>`}`;
 }
 else content=`<div class="game-panel">${[['Игр',p.stats.games],['Побед',p.stats.wins],['Собрано фишек',p.stats.collected],['Создано бонусов',p.stats.powers],['Лучший каскад',p.stats.bestCascade]].map(([label,n])=>`<div class="stat-line"><span>${label}</span><strong>${fmt(n)}</strong></div>`).join('')}</div>`;
 return heading('','Рекорды')+`<div class="content-pad"><div class="record-hero">${icon('trophy')}<span><strong>${completed(p)}</strong> уровней</span><span>${icon('star')}<strong>${totalStars(p)}</strong></span></div>${tabs([['campaign','Уровни'],['stats','Итоги']],tab,'records-tab')}${content}</div>`;
}
export function arcadesPage(p){return heading('','Аркады',true)+`<div class="content-pad">${[['wall','crate','Стена','Стена поднимается каждые 5 ходов. Не дайте ей дойти до верха.'],['endless','orb','Бесконечность','Выполняйте цели и переходите к следующей волне.']].map(([mode,i,n,d])=>`<article class="game-panel arcade-card">${icon(i)}<h3>${n}</h3><p>${d}</p><strong class="arcade-score">${fmt(p.stats[mode])}</strong><button class="primary" data-action="arcade" data-mode="${mode}">Играть</button></article>`).join('')}</div>`;}
export function shopPage(p,tab='tools'){
 const keys=tab==='tools'?['hammer','row','column','shuffle']:['rocket-h','bomb','orb'];
 return heading('','Бустеры')+`<div class="content-pad">${tabs([['tools','В игре'],['start','На старте']],tab,'shop-tab')}<p class="page-note">${tab==='tools'?'Помогают, не расходуя ход':'Выберите перед началом уровня'}</p><div class="shop-grid">${keys.map(k=>`<article class="game-panel shop-item"><button class="tool-info" data-action="tool-info" data-tool="${k}" aria-label="Как работает ${TOOLS[k].name}">${icon(k)}<span class="stock-count">${p.inventory[k]}</span></button><h3>${TOOLS[k].name}</h3><button class="primary price-button" data-action="buy" data-tool="${k}" ${p.coins<TOOLS[k].price||p.inventory[k]>=999?'disabled':''} aria-label="Купить ${TOOLS[k].name} за ${TOOLS[k].price} монет">${icon('coin')}${TOOLS[k].price}</button></article>`).join('')}</div><p class="notice">Монеты зарабатываются в игре</p></div>`;
}
export function rewardsPage(p,tab='gifts'){
 const today=dayKey(),claimed=p.daily.lastClaim===today,streak=p.daily.streak||0,day=claimed?streak:p.daily.lastClaim===previousDay(today)?streak%7+1:1;
 let content='';
 if(tab==='gifts'){
 const collected=Math.min(30,Math.max(0,totalStars(p)-p.claimedChests*30));
 content=`<div class="game-panel gift-panel"><h3>Семь дней подарков</h3><div class="daily-days">${Array.from({length:7},(_,i)=>`<div class="day ${i+1===day?'current':''} ${claimed&&i<day?'claimed':''}"><span>День ${i+1}</span>${icon(i===6?'orb':(i+1)%3===0?'bomb':'hammer')}<b>${80+i*20} ${icon('coin')}</b></div>`).join('')}</div><button class="primary" data-action="daily-gift" ${claimed?'disabled':''}>${claimed?'До завтра!':'Забрать подарок'}</button></div><div class="game-panel treasure-panel">${icon('chest','treasure-art')}<h3>Звёздный сундук</h3>${progress(collected,30)}<div class="prize-icons">${icon('coin')}<b>250</b>${icon('orb')}${icon('hammer')}</div><button class="primary" data-action="chest" ${collected<30?'disabled':''}>Открыть</button></div><div class="game-panel treasure-panel">${icon('daily-challenge','treasure-art')}<h3>Испытание дня</h3><div class="prize-icons">${icon('coin')}<b>200</b>${icon('hammer')}</div><button class="primary blue-button" data-action="daily-level">${p.daily.challengeDate===today?'Улучшить рекорд':'Играть'}</button></div>`;
 }else if(tab==='missions')content=`<p class="page-note">Новые задания каждый день</p>${MISSIONS.map(m=>{const done=p.missions.claimed.includes(m.key),n=p.missions[m.key];return `<article class="game-panel mission-card">${icon(m.tool)}<h3>${m.name}</h3>${progress(n,m.goal)}<div class="prize-icons">${icon('coin')}<b>${m.coins}</b>${icon(m.tool)}</div><button class="primary" data-action="mission" data-key="${m.key}" ${done||n<m.goal?'disabled':''}>${done?'Получено':'Забрать'}</button></article>`;}).join('')}`;
 else content=`<div class="chapter-rewards">${CHAPTERS.map((c,i)=>{const done=p.claimedChapters.includes(i),count=Array.from({length:20},(_,j)=>i*20+j+1).filter(id=>p.levels[id]?.stars).length;return `<article class="game-panel chapter-reward"><img src="${chapterImage(i)}" loading="lazy" alt="" draggable="false"><h3>${c.name}</h3>${progress(count,20)}<div class="prize-icons">${icon('coin')}<b>400</b>${icon('bomb')}<b>×2</b>${icon('orb')}</div><button class="primary" data-action="chapter-reward" data-id="${i}" ${done||!chapterComplete(p,i)?'disabled':''}>${done?'Получено':'Забрать'}</button></article>`;}).join('')}</div>`;
 return heading('','Награды')+`<div class="content-pad">${tabs([['gifts','Подарки'],['missions','Задания'],['chapters','Главы']],tab,'rewards-tab')}${content}</div>`;
}
export const RULE_TABS=[['basics','Основы'],['powers','Бонусы'],['obstacles','Преграды'],['combos','Комбо']];
const rules={
 basics:[['blue','Соберите три','Меняйте соседние фишки. Три одинаковые в ряд исчезают.','match'],['map','Выполните цели','Уберите все цели до окончания ходов. Неверный обмен не тратит ход.'],['star','Сохраните ходы','Останется 28% ходов — получите 3 звезды, 12% — 2 звезды. Победа всегда даёт звезду.'],['hammer','Помощь без расхода хода','Выберите инструмент, затем клетку. Нет доступных ходов — бесплатное перемешивание.']],
 powers:[['rocket-h','Четыре в ряд','Ракета очищает одну линию. Направление зависит от комбинации.'],['bomb','Т или Г из пяти','Бомба взрывает квадрат 3 × 3.','blast'],['orb','Пять в ряд','Обменяйте шар с фишкой — исчезнет весь её цвет.'],['rocket-v','Одно касание','Нажмите на бонус для активации. Задетые бонусы продолжают цепную реакцию.']],
 combos:[['rocket-h','Ракета + ракета','Одна строка и один столбец.','rocket-v'],['bomb','Бомба + ракета','Три строки и три столбца.','rocket-h'],['bomb','Бомба + бомба','Взрыв 5 × 5.','bomb'],['orb','Шар + бонус','Фишки самого частого цвета без льда и цепей превращаются в бонусы, а затем срабатывают.','rocket-h'],['orb','Шар + шар','Всё поле. Один слой с каждой преграды.','orb']],
};
export function rulesContent(tab='basics',seen=[]) {
 const entries=tab==='obstacles'?Object.entries(OBSTACLES).filter(([k])=>seen.includes(k)).map(([,o])=>[o.art,o.name,o.body,o.diagram]):(rules[tab]||rules.basics);
 if(!entries.length)return '<div class="rules-empty">Новые преграды откроются здесь, когда вы встретите их в игре.</div>';
 return `<div class="rules-grid">${entries.map(([i,title,body,diagram])=>{
 let picture=icon(i);
 if(diagram==='match')picture=`<div class="rule-picture">${icon('blue')}${icon('blue')}${icon('blue')}</div>`;
 else if(diagram==='blast')picture=`<div class="blast-diagram">${Array.from({length:9},(_,n)=>`<span>${n===4?icon('bomb'):icon('blue')}</span>`).join('')}</div>`;
 else if(diagram==='ice')picture=`<div class="frozen-demo">${icon('red')}${icon('ice-shell','ice-overlay')}</div>`;
 else if(diagram==='grass')picture=icon('grass-demo');
 else if(diagram==='crate')picture=`<div class="rule-picture">${icon('crate')}<b>→</b>${icon('crate-cracked')}</div>`;
 else if(diagram==='chain')picture=`<div class="frozen-demo">${icon('blue')}${icon('chain','ice-overlay')}</div>`;
 else if(diagram==='stone')picture=`<div class="rule-picture">${icon('stone')}<b>→</b>${icon('stone-cracked')}</div>`;
 else if(diagram)picture=`<div class="rule-picture">${icon(i)}<b>+</b>${icon(diagram)}</div>`;
 return `<article class="rule-card">${picture}<h3>${title}</h3><p>${body}</p></article>`;
 }).join('')}</div>`;}
export function rulesPage(tab,seen=[]){return heading('','Как играть')+`<div class="content-pad">${tabs(RULE_TABS,tab,'rules-tab')}${rulesContent(tab,seen)}</div>`;}

