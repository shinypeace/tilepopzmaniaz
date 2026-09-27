import { isBlocker, position } from './engine.js';

// A visible-board heuristic shared by the hint system and balance smoke simulations.
// No future refill colours or random seed are examined here.
export function rankActions(game) {
  const actions=game.legalActions();
  const value=p=>{
    const t=game.cell(p);if(!t)return 0;
    let n=game.goals[t.color]>0?3:0.4;
    if(isBlocker(t))n+=game.goals[t.kind]>0?12/t.hp:2;
    if(game.grass.has(p))n+=6;
    if(game.chains.has(p))n+=10;
    for(const q of game.neighbors(p)){const b=game.cell(q);if(isBlocker(b)&&b.kind!=='stone')n+=5/b.hp;}
    return n;
  };
  return actions.map(action=>{
    const {a,b}=action,ta=game.cell(a),tb=b===undefined?null:game.cell(b);let score=0;
    const pa=ta.power,pb=tb?.power;
    const ratePower=(p,power)=>{
      return game.effect(p,power).reduce((n,q)=>n+value(q),0);
    };
    if(pa&&pb)score=ratePower(a,pa)+ratePower(b,pb)+30;
    else if(pa||pb)score=ratePower(pa?a:b,pa||pb)*.85;
    else{
      game.swap(a,b);
      for(const group of game.findMatches()){
        score+=[...group.cells].reduce((n,p)=>n+value(p),0);
        const power=game.powerFor(group);if(power)score+=power==='orb'?28:power==='bomb'?22:14;
      }
      game.swap(a,b);
    }
    score+=position(a)[0]*.08;
    return {action,score};
  }).sort((a,b)=>b.score-a.score);
}
