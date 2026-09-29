import {ART} from './art-manifest.js';

const root=new URL('../assets/runtime/',import.meta.url);
const images=new Map();
const files=[...new Set(['board.webp',...Object.values(ART).map(a=>a.file)])];

function loadImage(url){
  if(images.has(url))return images.get(url).ready;
  const image=new Image();
  const ready=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>fail(),20000);
    const fail=()=>{clearTimeout(timer);image.onload=image.onerror=null;images.delete(url);reject(new Error(`Image unavailable: ${url}`));};
    image.onerror=fail;
    image.onload=async()=>{
      clearTimeout(timer);
      // Decode before the first frame of a short-lived rocket or tool effect.
      // Some older WebViews have no decode(); load is the fallback there.
      try{await image.decode?.();}catch{/* onload already confirmed a valid image. */}
      image.onload=image.onerror=null;resolve();
    };
    image.src=url;
  });
  images.set(url,{image,ready});return ready;
}

export async function prepareArt(){
  const pending=files.map(file=>new URL(file,root).href);
  pending.push(new URL('../assets/bg-critters.webp',import.meta.url).href);
  // Keep the loading screen until the common UI and every gameplay effect
  // can be drawn. Chapter/map backgrounds continue to load on demand.
  const errors=[];
  await Promise.all(Array.from({length:6},async()=>{
    while(pending.length){const url=pending.shift();try{await loadImage(url);}catch(error){errors.push(error);}}
  }));
  if(errors.length)throw new AggregateError(errors,'Game artwork is missing');
}
