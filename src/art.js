import {ART} from './art-manifest.js';
export {ART};
const root=new URL('../assets/runtime/',import.meta.url).href;
export const chapterImage=chapter=>`${root}chapter-${Math.max(1,Math.min(25,chapter+1))}.webp`;
export function art(name,classes=''){
  const a=ART[name];if(!a)return '';
  return `<span class="icon raster-art art-${name} ${classes}" aria-hidden="true"><img src="${root+a.file}" alt="" draggable="false" decoding="async" width="192" height="${Math.round(192/a.aspect)}"></span>`;
}
export function boardArt(name,classes=''){
  const a=ART[name];if(!a?.board)return art(name,classes);
  return `<span class="icon raster-art board-sprite art-${name} ${classes}" aria-hidden="true" style="background-position:${a.col/7*100}% ${a.row*100}%"></span>`;
}
