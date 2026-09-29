// One source for the first-encounter tutorial and the unlocked rule book.
export const OBSTACLES = {
  crate: {art:'crate',name:'Ящик',body:'Соберите комбинацию рядом или попадите бонусом. Каждый удар снимает один слой.',diagram:'crate'},
  ice: {art:'ice-shell',name:'Лёд',body:'Фишка подо льдом не двигается. Соберите ряд с её цветом или попадите бонусом, чтобы снять слой льда.',diagram:'ice'},
  grass: {art:'grass',name:'Трава',body:'Соберите или взорвите фишку на траве, чтобы очистить эту клетку.',diagram:'grass'},
  stone: {art:'stone',name:'Камень',body:'Разбивается только прямым попаданием бонуса или инструмента. Целый камень выдерживает два удара, треснувший — один.',diagram:'stone'},
  chain: {art:'chain',name:'Цепь',body:'Не даёт фишке двигаться и участвовать в комбинациях. Попадите бонусом: цепь исчезнет, а фишка останется.',diagram:'chain'},
};
export function obstacleKinds(config) {
  const present=new Set((config.blockers||[]).map(b=>b.kind));
  if(config.grass?.length)present.add('grass');
  if(config.chains?.length)present.add('chain');
  return Object.keys(OBSTACLES).filter(k=>present.has(k));
}
export function unseenObstacles(config,seen=[]) { return obstacleKinds(config).filter(k=>!seen.includes(k)); }
