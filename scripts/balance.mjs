import {Game,POWERS} from '../src/engine.js';
import {getLevel,LEVEL_COUNT,GENERATOR_VERSION} from '../src/levels.js';
import {rankActions} from '../src/strategy.js';
import {Random} from '../src/random.js';
import {writeFile} from 'node:fs/promises';
const trials=Number(process.argv[2]||3),end=Number(process.argv[3]||LEVEL_COUNT),start=Number(process.argv[4]||1);
const results=[],started=Date.now();
for(let id=start;id<=end;id++){
  const config=getLevel(id);let wins=0,totalMoves=0,remaining=0,shuffles=0;
  for(let trial=0;trial<trials;trial++){
    const g=new Game(config,{seed:config.seed+trial*7919}),rng=new Random(trial+id*77);
    while(g.status==='playing'&&g.turns<120){
      const ranked=rankActions(g);if(!ranked.length)throw new Error(`No moves in level ${id}`);
      // A little variety between attempts; strategy does not inspect the upcoming refill.
      const top=ranked.filter(a=>a.score>=ranked[0].score*.88).slice(0,3);
      const {action}=rng.pick(top);const result=g.perform(action);
      if(!result.valid)throw new Error(`Invalid suggested move at ${id}`);
    }
    if(g.status==='won')wins++;
    totalMoves+=g.turns;remaining+=Object.values(g.goals).reduce((a,b)=>a+b,0);shuffles+=g.shuffles;
  }
  results.push({id,difficulty:config.difficulty,archetype:config.archetype||'authored',wins,trials,rate:wins/trials,moves:config.moves,averageUsed:Math.round(totalMoves/trials*10)/10,averageRemaining:Math.round(remaining/trials*10)/10,shuffles});
  if(id%20===0)console.log(`Levels ${id-19}-${id}: ${results.slice(-20).reduce((n,r)=>n+r.wins,0)}/${20*trials} wins; ${Math.round((Date.now()-started)/1000)}s`);
}
await writeFile('docs/balance-report.json',JSON.stringify({date:new Date().toISOString(),generatorVersion:GENERATOR_VERSION,powers:POWERS,method:'Visible-board greedy heuristic, no boosters, seeded independent attempts. Not a human win-rate estimate or certification of level balance.',trials,results},null,2));
console.log(JSON.stringify({levels:results.length,trials,wins:results.reduce((n,r)=>n+r.wins,0),zeroWinLevels:results.filter(r=>!r.wins).map(r=>r.id),seconds:Math.round((Date.now()-started)/1000)}));
