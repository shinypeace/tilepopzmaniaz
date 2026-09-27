// Coordinates are taken from the original artwork. SVG is only a clipped image
// viewport here: no game piece is redrawn or replaced with vector shapes.
const original='./assets/source/atlas.png';
const tools='./assets/generated/tools-v1.png';
const hud='./assets/generated/hud-v1.png';
const crop=(image,w,h,x,y,cw,ch)=>({image:new URL(image,new URL('../',import.meta.url)).href,w,h,x,y,cw,ch});
export const ART={
  logo:crop(original,1536,1024,35,18,688,365),
  blue:crop(original,1536,1024,39,407,106,116),
  green:crop(original,1536,1024,155,407,105,115),
  orange:crop(original,1536,1024,274,408,106,111),
  red:crop(original,1536,1024,399,406,112,122),
  yellow:crop(original,1536,1024,525,409,119,111),
  purple:crop(original,1536,1024,654,406,113,115),
  bomb:crop(original,1536,1024,292,542,143,176),
  stone:crop(original,1536,1024,473,558,150,155),
  'rocket-v':crop('./assets/source/tile-rocket-bi.png',809,809,150,8,510,791),
  'rocket-flight':crop('./assets/source/tile-rocket-bi.png',809,809,150,8,510,402),
  orb:crop('./assets/source/tile-color-bomb.png',886,886,10,12,866,862),
  ice:crop('./assets/source/tile-ice.png',843,843,12,12,819,819),
  settings:crop(original,1536,1024,1299,51,160,163),
  rules:crop(original,1536,1024,1299,207,157,150),
  trophy:crop(original,1536,1024,1299,352,157,154),
  pause:crop(original,1536,1024,1299,498,157,149),
  'button-green':crop(original,1536,1024,772,61,460,120),
  'button-blue':crop(original,1536,1024,771,190,461,119),
  'button-orange':crop(original,1536,1024,772,315,460,121),
  'button-purple':crop(original,1536,1024,772,444,460,121),
  'button-small':crop(original,1536,1024,38,878,295,109),
  crate:crop(tools,1254,1254,418,0,418,418),
  hammer:crop(tools,1254,1254,836,0,418,418),
  row:crop(tools,1254,1254,0,418,418,418),
  column:crop(tools,1254,1254,418,418,418,418),
  shuffle:crop(tools,1254,1254,836,418,418,418),
  star:crop(tools,1254,1254,0,836,418,418),
  coin:crop(tools,1254,1254,418,836,418,418),
  chest:crop(tools,1254,1254,836,836,418,418),
  'hud-wide':crop(hud,1536,1024,39,99,798,322),
  'tool-base':crop(hud,1536,1024,943,18,466,444),
  chain:crop(hud,1536,1024,119,479,630,521),
  back:crop(hud,1536,1024,910,485,498,491),
};
ART['rocket-h']={...ART['rocket-v'],rotate:90};
for(const [alias,name] of Object.entries({leaf:'green',grass:'green',crown:'yellow',flower:'yellow',map:'logo',heart:'red',lock:'chain'}))ART[alias]=ART[name];
export function art(name,classes=''){
  const a=ART[name];if(!a)return '';
  const graphic=`<svg viewBox="${a.x} ${a.y} ${a.cw} ${a.ch}" preserveAspectRatio="xMidYMid meet" class="art-crop" aria-hidden="true"><image href="${a.image}" width="${a.w}" height="${a.h}"/></svg>`;
  return `<span class="icon raster-art art-${name} ${classes}" aria-hidden="true">${a.rotate?`<span class="art-rotate">${graphic}</span>`:graphic}</span>`;
}
