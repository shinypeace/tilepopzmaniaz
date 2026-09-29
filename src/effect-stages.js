// Presentation phases preserve the model's one-hit-per-resolution-wave rule.
export function effectStages(frame){
  const effects=frame.effects||[],levels=[...new Set([0,...effects.map(e=>e.stage||0)])].sort((a,b)=>a-b);
  const hitAt=new Map(),originAt=new Map();
  for(const e of effects){const stage=e.stage||0;originAt.set(e.p,Math.max(originAt.get(e.p)||0,stage));for(const p of e.targets)hitAt.set(p,Math.min(hitAt.get(p)??Infinity,stage));}
  const when=p=>Math.max(hitAt.get(p)||0,originAt.get(p)||0);
  return levels.map(stage=>({
    effects:effects.filter(e=>(e.stage||0)===stage),
    destroyed:frame.destroyed.filter(p=>when(p)===stage),
    damaged:frame.damaged.filter(p=>when(p)===stage),
    thawed:(frame.thawed||[]).filter(p=>when(p)===stage),
  }));
}
