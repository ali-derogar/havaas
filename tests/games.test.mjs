import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTORIES } from '../src/games/index.js';
import { COLORS, GAMES, HUNT_SETTINGS, LEVELS, THEMES } from '../src/config.js';
import { ReactionSession } from '../src/core/reaction.js';
import { ActiveClock } from '../src/core/session.js';
import { seededRandom } from '../src/core/random.js';
import { generateNBack } from '../src/games/nback.js';
import { generateStroop, isStroopTarget } from '../src/games/stroop.js';
import { generateSearch } from '../src/games/search.js';
import { readProgress, writeProgress, saveResult, resultKey } from '../src/core/storage.js';
import { symbol } from '../src/visuals.js';

function clock() { let value=0; return { now:()=>value, advance:ms=>{value+=ms;} }; }
function create(id, level='easy', practice=false, seed=42) { const timer=clock(); return { timer, session: FACTORIES[id]({level,practice,now:timer.now,random:seededRandom(seed)}) }; }

for (const game of GAMES) for (const level of Object.keys(LEVELS)) for (const practice of [false,true]) {
  test(`${game.id}/${level}/${practice?'practice':'main'} completes correctly`,()=>{
    const {session:s,timer:t}=create(game.id,level,practice);
    if(game.kind==='reaction') {
      let guard=0;
      while(!s.done&&guard++<200) {
        if(s.gate) { const before=s.clock.elapsed;t.advance(7000);assert.equal(s.clock.elapsed,before);s.acknowledge(); }
        t.advance(240);
        if(s.current.target&&s.current.scored!==false) assert.equal(s.respond(),true);
        t.advance(760);s.tick();
      }
      assert.ok(s.done);assert.equal(s.metrics.hits,practice?2:30);assert.equal(s.metrics.misses,0);assert.equal(s.metrics.falseAlarms,0);
      assert.equal(s.position,practice?5:150);assert.equal(s.result.meanReactionMs,240);
    } else if(game.kind==='search') {
      while(!s.done) {t.advance(2100);assert.equal(s.choose(s.current.choices.findIndex(c=>c.target)),true);}
      assert.equal(s.metrics.hits,practice?5:10);assert.equal(s.result.meanReactionMs,100);
    } else if(practice) {
      let guard=0;
      while(!s.done&&guard++<10) { const item=s.currentItem;t.advance(200);if(item.blocked) s.choose(item.id);if(item.required)s.choose(item.id);else s.reject(); }
      assert.ok(s.done,'practice must finish in five decisions');
      assert.equal(s.judged,5);assert.equal(s.result.correctResponses,5);assert.equal(s.metrics.hits,3);
    } else {
      for(const item of s.items.filter(i=>i.required)) {t.advance(100);if(item.blocked) assert.equal(s.choose(item.id),'cleared');assert.equal(s.choose(item.id),true);}
      assert.ok(s.ready);assert.ok(s.depart());assert.equal(s.metrics.hits,LEVELS[level].required);
    }
    assert.ok(s.completed);assert.equal(s.score,s.maxScore);assert.ok(s.result.durationMs>0);assert.equal(s.result.version,1);
    const duration=s.result.durationMs;t.advance(30000);s.tick();assert.equal(s.result.durationMs,duration);
  });
}

test('all hunt themes have exactly thirty real targets',()=>{
  for(const theme of Object.keys(THEMES)) for(let seed=0;seed<35;seed++) {
    const s=FACTORIES.hunt({level:'hard',theme,random:seededRandom(seed)});
    assert.equal(s.trials.length,150);assert.equal(s.trials.filter(t=>t.target).length,30);
    for(const trial of s.trials) assert.equal(JSON.stringify(trial.stimulus)===JSON.stringify(s.target),trial.target);
  }
});
test('n-back target flags match actual sequence, without accidental matches',()=>{
  for(let n=1;n<=3;n++) for(let seed=0;seed<100;seed++) {
    const trials=generateNBack(n,150,30,seededRandom(seed));assert.equal(trials.length,150+n);
    assert.equal(trials.filter(t=>t.scored===false).length,n);
    assert.equal(trials.filter(t=>t.target).length,30);
    for(let i=n;i<trials.length;i++) assert.equal(trials[i].target,trials[i].stimulus.shape===trials[i-n].stimulus.shape);
  }
});
test('Stroop rules, block lengths and twenty percent targets hold across seeds',()=>{
  for(let seed=0;seed<100;seed++) {
    const trials=generateStroop(false,seededRandom(seed));assert.equal(trials.length,150);
    for(const [phase,count] of [40,40,40,30].entries()) {
      const block=trials.filter(t=>t.phase===phase);assert.equal(block.length,count);assert.equal(block.filter(t=>t.target).length,count/5);
      for(const t of block) assert.equal(t.target,isStroopTarget(phase,t.stimulus));
    }
  }
});
test('Stroop color, word and conjunction are distinct rules',()=>{
  const a={word:'yellow',color:'red'},b={word:'red',color:'yellow'};
  assert.equal(isStroopTarget(1,a),false);assert.equal(isStroopTarget(1,b),true);
  assert.equal(isStroopTarget(2,a),true);assert.equal(isStroopTarget(2,b),false);
  assert.equal(isStroopTarget(3,a),false);assert.equal(isStroopTarget(3,b),false);assert.equal(isStroopTarget(3,{word:'yellow',color:'yellow'}),true);
});
test('reaction scoring distinguishes hits, false alarms, omissions and correct rejection',()=>{
  const t=clock(),s=new ReactionSession({gameId:'traffic',now:t.now},[true,false,true,false].map(target=>({target,phase:0})));
  t.advance(400);assert.equal(s.respond(),true);assert.equal(s.respond(),null);t.advance(600);s.tick();
  t.advance(200);assert.equal(s.respond(),false);assert.equal(s.respond(),null);t.advance(800);s.tick();
  t.advance(1000);s.tick();t.advance(1000);s.tick();
  assert.deepEqual([s.metrics.hits,s.metrics.falseAlarms,s.metrics.misses,s.metrics.correctRejects],[1,1,1,1]);
  assert.equal(s.score,0);assert.equal(s.result.meanReactionMs,400);assert.equal(s.result.longestStreak,1);
});
test('reaction exposure changes by level but the response window remains one second',()=>{
  for(const level of Object.keys(LEVELS)) {
    const t=clock(),s=new ReactionSession({gameId:'hunt',level,now:t.now},[{target:true,phase:0}]);
    t.advance(LEVELS[level].visibleMs-1);assert.ok(s.visible);t.advance(1);assert.equal(s.visible,false);
    t.advance(999-LEVELS[level].visibleMs);assert.equal(s.respond(),true);t.advance(1);s.tick();assert.ok(s.done);assert.equal(s.result.meanReactionMs,999);
  }
});
test('pause excludes inactive time, replays unresponded trial and never scores a response twice',()=>{
  const {timer:t,session:s}=create('traffic');
  t.advance(180);s.pause();const elapsed=s.clock.elapsed;t.advance(25000);assert.equal(s.clock.elapsed,elapsed);assert.equal(s.respond(),null);
  s.resume();assert.ok(s.visible);assert.equal(s.index,0);t.advance(120);s.respond();s.pause();t.advance(12000);s.resume();
  assert.equal(s.respond(),null);t.advance(880);s.tick();
  assert.equal(s.index,1);assert.equal(s.metrics.hits+s.metrics.falseAlarms,1);assert.equal(s.clock.elapsed,1180);
});
test('active clock supports pause at zero and repeated pause/resume',()=>{
  const t=clock(),c=new ActiveClock(t.now);c.pause();t.advance(100);c.pause();assert.equal(c.elapsed,0);c.resume();c.resume();t.advance(30);assert.equal(c.elapsed,30);
});
test('n-back warm-up cannot be answered or scored',()=>{
  const {timer:t,session:s}=create('nback','hard');
  for(let i=0;i<3;i++){assert.equal(s.respond(),null);t.advance(1000);s.tick();}
  assert.equal(s.position,0);assert.equal(s.index,3);assert.equal(s.result.correctResponses,0);assert.equal(s.metrics.misses,0);
});
test('search has one exact target and meaningful difficulty',()=>{
  for(const level of Object.keys(LEVELS)) for(let seed=0;seed<100;seed++) {
    const {target,choices}=generateSearch(level,seededRandom(seed));assert.equal(choices.length,LEVELS[level].items);
    assert.equal(choices.filter(c=>c.shape===target.shape&&c.color===target.color&&c.detail===target.detail).length,1);
    if(level==='hard') assert.ok(choices.every(c=>c.shape===target.shape&&c.color===target.color));
  }
});
test('search preview, wrong selections, duplicate inputs and deadline are enforced',()=>{
  const {timer:t,session:s}=create('search');
  assert.equal(s.choose(0),null);t.advance(2000);const wrong=s.current.choices.findIndex(c=>!c.target);
  assert.equal(s.choose(wrong),false);assert.equal(s.choose(wrong),null);assert.equal(s.metrics.falseAlarms,1);
  const oldTarget=s.current.choices.findIndex(c=>c.target);t.advance(30000);assert.equal(s.choose(oldTarget),null);
  assert.equal(s.index,1);assert.equal(s.metrics.misses,1);assert.ok(s.preview);
  s.pause();const remaining=s.remainingMs;t.advance(100000);s.tick();assert.equal(s.remainingMs,remaining);assert.equal(s.index,1);
});
test('all search rounds can time out without getting stuck',()=>{
  const {timer:t,session:s}=create('search','hard');
  for(let i=0;i<10;i++){t.advance(17000);s.tick();}
  assert.ok(s.done);assert.equal(s.metrics.misses,10);assert.equal(s.result.meanReactionMs,null);
});
test('adventure has exact object counts, required items and obstacles',()=>{
  for(const id of ['ark','space']) for(const level of Object.keys(LEVELS)) {
    const {session:s}=create(id,level);assert.equal(s.items.length,LEVELS[level].items);assert.equal(s.items.filter(i=>i.required).length,LEVELS[level].required);
    assert.equal(s.items.filter(i=>i.blocked).length,id==='space'?LEVELS[level].obstacles:0);assert.equal(new Set(s.items.map(i=>i.icon)).size,s.items.length);
  }
});
test('adventure penalties happen once, obstacles must be cleared and departure requires equipment',()=>{
  const {timer:t,session:s}=create('space');assert.equal(s.depart(),false);
  const blocked=s.items.find(i=>i.blocked);assert.equal(s.choose(blocked.id),'cleared');assert.equal(blocked.collected,false);assert.equal(s.metrics.hits,0);
  const wrong=s.items.find(i=>!i.required&&!i.blocked);assert.equal(s.choose(wrong.id),false);assert.equal(s.remainingMs,58000);assert.equal(s.choose(wrong.id),null);assert.equal(s.remainingMs,58000);
  s.pause();t.advance(90000);assert.equal(s.remainingMs,58000);s.resume();t.advance(58000);s.tick();assert.ok(s.done);assert.equal(s.completed,false);assert.equal(s.result.omissions,4);assert.equal(s.result.falseSelections,1);
});
test('departure at or after deadline fails even with a complete pack',()=>{
  const {timer:t,session:s}=create('ark','hard');for(const item of s.items.filter(i=>i.required)) s.choose(item.id);
  assert.ok(s.ready);t.advance(30000);assert.equal(s.depart(),false);assert.equal(s.completed,false);assert.equal(s.result.omissions,0);
});
test('adventure practice supports five decisions including rejection feedback',()=>{
  const {session:s}=create('space','easy',true);let decisions=0;
  while(!s.done) {const item=s.currentItem;if(item.blocked)s.choose(item.id);if(item.required)s.reject();else s.choose(item.id);decisions++;}
  assert.equal(decisions,5);assert.equal(s.metrics.hits,0);assert.equal(s.metrics.misses,3);assert.equal(s.metrics.falseAlarms,2);assert.equal(s.result.meanReactionMs,null);
});
test('a hidden practice item must be revealed before being rejected',()=>{
  const {session:s}=create('space','easy',true);assert.ok(s.currentItem.blocked);assert.equal(s.reject(),null);assert.equal(s.judged,0);
  assert.equal(s.choose(s.currentItem.id),'cleared');assert.notEqual(s.reject(),null);assert.equal(s.judged,1);
});
test('storage failures, malformed JSON, and unavailable APIs do not stop play',()=>{
  const denied={getItem(){throw new Error('Denied');},setItem(){throw new Error('Denied');}};
  assert.deepEqual(readProgress(denied),{version:1,games:{},sound:false});assert.equal(writeProgress({},denied),false);
  for(const value of ['broken','null','[]','{"version":1,"games":null}','{"version":42,"sound":true}']) assert.ok(readProgress({getItem:()=>value}).games);
  assert.equal(writeProgress({},null),false);
});
test('last result updates while best is retained separately per game and level',()=>{
  const p={version:1,games:{},sound:false};
  saveResult(p,{gameId:'hunt',level:'easy',score:25,completed:true});saveResult(p,{gameId:'hunt',level:'easy',score:10,completed:true});saveResult(p,{gameId:'hunt',level:'hard',score:8,completed:true});
  assert.equal(p.games['hunt:easy'].best.score,25);assert.equal(p.games['hunt:easy'].last.score,10);assert.equal(p.games['hunt:hard'].best.score,8);
});
test('a corrupted best score is replaced by a valid session result',()=>{
  const p={version:1,games:{'ark:easy':{best:{score:'broken'}}}};
  saveResult(p,{gameId:'ark',level:'easy',score:4,maxScore:4,completed:true});assert.equal(p.games['ark:easy'].best.score,4);
});

test('a late reaction cannot be assigned to the next, unseen stimulus',()=>{
  const t=clock(),s=new ReactionSession({gameId:'hunt',now:t.now},[{target:true,phase:0},{target:true,phase:0}]);
  t.advance(1001);assert.equal(s.respond(),null);assert.equal(s.index,1);assert.equal(s.response,null);assert.equal(s.metrics.misses,1);assert.equal(s.metrics.hits,0);
  t.advance(200);assert.equal(s.respond(),true);t.advance(800);s.tick();assert.equal(s.result.hits,1);assert.equal(s.result.omissions,1);assert.equal(s.result.meanReactionMs,200);
});
test('direct stimulus input validates visibility, trial identity and one response per trial',()=>{
  const t=clock(),s=new ReactionSession({gameId:'hunt',level:'hard',now:t.now},[{target:true,phase:0},{target:false,phase:0}]);
  t.advance(50);assert.equal(s.respondToStimulus(1),null);assert.equal(s.respondToStimulus(0),true);assert.equal(s.respond(),null);
  t.advance(950);s.tick();assert.equal(s.respondToStimulus(0),null);t.advance(101);assert.equal(s.respondToStimulus(1),null);assert.equal(s.respond(),false);
  t.advance(899);s.tick();assert.equal(s.metrics.hits,1);assert.equal(s.metrics.falseAlarms,1);assert.equal(s.metrics.misses,0);
});
test('two-target hunt preserves 150 stimuli and exactly 15 appearances of each target',()=>{
  for(const theme of Object.keys(THEMES))for(const level of Object.keys(LEVELS))for(let seed=0;seed<25;seed++) {
    const s=FACTORIES.hunt({level,theme,targetCount:2,random:seededRandom(seed)});assert.equal(s.trials.length,150);assert.equal(s.targets.length,2);assert.equal(s.variant,'divided');
    for(const target of s.targets)assert.equal(s.trials.filter(t=>JSON.stringify(t.stimulus)===JSON.stringify(target)).length,15);
    for(const trial of s.trials)assert.equal(trial.target,s.targets.some(target=>JSON.stringify(trial.stimulus)===JSON.stringify(target)));
  }
});
test('hunt difficulty increases visual similarity and varies position, size and background',()=>{
  const expected=[0,60,108];let previousSize=Infinity;
  for(const [index,level] of Object.keys(LEVELS).entries()) {
    const {session:s}=create('hunt',level);const setting=HUNT_SETTINGS[level];
    assert.equal(s.trials.filter(t=>!t.target&&t.stimulus.color==='blue').length,expected[index]);assert.ok(setting.size<previousSize);previousSize=setting.size;
    assert.ok(new Set(s.trials.map(t=>`${t.position.x}:${t.position.y}`)).size>1);
    assert.ok(s.trials.every(t=>setting.positions.some(p=>p.x===t.position.x&&p.y===t.position.y)&&t.size===setting.size));
    assert.equal(s.background,level==='hard'?'abstract':'garden');
  }
});
test('traffic uses single, co-located circles differing only in color',()=>{
  for(const level of Object.keys(LEVELS)) {
    const {session:s}=create('traffic',level);assert.equal(s.trials.filter(t=>t.stimulus.color==='green').length,30);
    assert.ok(s.trials.every(t=>t.stimulus.shape==='circle'&&t.target===(t.stimulus.color==='green')));
  }
  assert.equal(symbol({shape:'circle',color:'green'}).replace(COLORS.green,'COLOR'),symbol({shape:'circle',color:'red'}).replace(COLORS.red,'COLOR'));
});
test('scattered search has one exact target and bounded, non-overlapping selectable positions',()=>{
  for(const level of Object.keys(LEVELS))for(let seed=0;seed<60;seed++) {
    const board=generateSearch(level,seededRandom(seed),'scattered'),width=304,height=board.rows*78;
    assert.equal(board.choices.filter(c=>c.target).length,1);
    const boxes=board.choices.map(c=>{
      const a=Math.abs(c.angle)*Math.PI/180,w=Math.min(66,width/board.columns-12);
      const box={x:width*c.position.x/100,y:height*c.position.y/100,w:w*Math.cos(a)+48*Math.sin(a),h:48*Math.cos(a)+w*Math.sin(a)};
      assert.ok(box.x-box.w/2>=0&&box.x+box.w/2<=width);assert.ok(box.y-box.h/2>=0&&box.y+box.h/2<=height);return box;
    });
    for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++)assert.ok(Math.abs(boxes[a].x-boxes[b].x)>=(boxes[a].w+boxes[b].w)/2||Math.abs(boxes[a].y-boxes[b].y)>=(boxes[a].h+boxes[b].h)/2);
  }
});
test('scattered search finishes all ten rounds with the same scoring and timing',()=>{
  for(const level of Object.keys(LEVELS)) {
    const t=clock(),s=FACTORIES.search({level,layout:'scattered',now:t.now,random:seededRandom(1)});
    for(let round=0;round<10;round++){t.advance(2250);assert.equal(s.choose(s.current.choices.findIndex(c=>c.target)),true);}
    assert.ok(s.done);assert.equal(s.result.score,10);assert.equal(s.result.meanReactionMs,250);assert.equal(s.result.variant,'scattered');
  }
});
test('adventure choice intervals exclude pauses and start again after each decision',()=>{
  const {timer:t,session:s}=create('ark');const required=s.items.filter(i=>i.required);
  t.advance(400);s.choose(required[0].id);s.pause();t.advance(10000);s.resume();t.advance(200);s.choose(required[1].id);
  assert.deepEqual(s.metrics.reactionTimes,[400,200]);assert.equal(s.result.meanReactionMs,300);assert.equal(s.result.reactionMeasure,'decision-interval');
});
test('revealing an obstacle starts a fresh choice interval',()=>{
  const {timer:t,session:s}=create('space');const item=s.items.find(i=>i.required);item.blocked=true;
  t.advance(500);s.choose(item.id);t.advance(100);s.choose(item.id);assert.deepEqual(s.metrics.reactionTimes,[100]);
});
test('variant records remain separate and legacy standard records keep their keys',()=>{
  const p={version:1,games:{}};const normal={gameId:'hunt',level:'easy',score:10,maxScore:30,completed:true};
  saveResult(p,normal);saveResult(p,{...normal,variant:'divided',score:30});
  assert.equal(p.games['hunt:easy'].best.score,10);assert.equal(p.games['hunt:easy:divided'].best.score,30);assert.equal(resultKey({...normal,variant:'standard'}),'hunt:easy');
});

test('traffic signs obey the go/no-go rule with exactly thirty targets',()=>{
  for(const level of Object.keys(LEVELS)) {
    const s=FACTORIES.traffic({level,trafficMode:'signs',random:seededRandom(7)});
    assert.equal(s.variant,'signs');assert.equal(s.trials.filter(t=>t.target).length,30);
    for(const t of s.trials){assert.equal(t.target,t.stimulus.shape==='oneway');assert.ok(['noentry','oneway'].includes(t.stimulus.shape));assert.ok(symbol(t.stimulus).includes('<svg'));}
  }
});
test('number and toy n-back never introduce accidental matches',()=>{
  for(const material of ['numbers','toys'])for(const level of Object.keys(LEVELS))for(let seed=0;seed<20;seed++) {
    const s=FACTORIES.nback({level,material,random:seededRandom(seed)});
    assert.equal(s.variant,material);assert.equal(s.trials.filter(t=>t.target).length,30);
    for(let i=s.n;i<s.trials.length;i++)assert.equal(s.trials[i].target,s.trials[i].stimulus.shape===s.trials[i-s.n].stimulus.shape);
    assert.ok(symbol(s.current.stimulus).includes('symbol'));
  }
});
test('letter search has exactly one matching letter and mark in both layouts',()=>{
  for(const level of Object.keys(LEVELS))for(const layout of ['grid','scattered'])for(let seed=0;seed<30;seed++) {
    const s=FACTORIES.search({level,material:'letters',layout,random:seededRandom(seed)}),{target,choices}=s.current;
    assert.equal(s.variant,layout==='grid'?'letters':'letters-scattered');assert.ok(target.shape.startsWith('letter-'));
    assert.equal(choices.filter(c=>c.shape===target.shape&&c.color===target.color&&c.detail===target.detail).length,1);
    assert.ok(symbol(target).includes('stroke-linecap="round"'));assert.ok(!symbol(target).includes('<text'));assert.equal(symbol(target).includes('letter-mark'),target.detail>0);
  }
});
test('five Stroop tutorial trials teach all four rules',()=>{
  const trials=generateStroop(true,seededRandom(8));assert.equal(trials.length,5);assert.equal(trials.filter(t=>t.target).length,2);assert.deepEqual([...new Set(trials.map(t=>t.phase))],[0,1,2,3]);
  for(const t of trials)assert.equal(t.target,isStroopTarget(t.phase,t.stimulus));
});
test('outcome history distinguishes omissions, errors, correct rejection and response time',()=>{
  const t=clock(),s=new ReactionSession({gameId:'traffic',now:t.now},[true,false,true,false].map(target=>({target,phase:0,stimulus:{shape:'circle',color:target?'green':'red'}})));
  t.advance(100);s.respond();t.advance(900);s.tick();t.advance(200);s.respond();t.advance(800);s.tick();t.advance(1000);s.tick();t.advance(1000);s.tick();
  assert.equal(s.result.outcomes.length,4);assert.deepEqual(s.result.outcomes.map(o=>[o.target,o.response,o.correct]),[[true,true,true],[false,true,false],[true,false,false],[false,false,true]]);
  assert.equal(s.result.outcomes[0].reactionMs,100);assert.equal(s.result.outcomes[1].reactionMs,200);assert.equal(s.result.outcomes[2].reactionMs,null);
  assert.equal(s.result.outcomes.filter(o=>o.correct).length,s.result.correctResponses);
  const finished=s.result.finishedAt;t.advance(10000);assert.equal(s.result.finishedAt,finished);
});

test('hunt displays multiple simultaneous distractors with exactly one target in target scenes',()=>{
  for(const level of Object.keys(LEVELS))for(const targetCount of [1,2])for(let seed=0;seed<20;seed++) {
    const s=FACTORIES.hunt({level,targetCount,random:seededRandom(seed)});
    assert.equal(s.result.protocolVersion,3);assert.equal(s.trials.length,150);assert.equal(s.trials.filter(t=>t.target).length,30);
    for(const trial of s.trials){
      assert.equal(trial.choices.length,HUNT_SETTINGS[level].sceneItems);
      assert.equal(trial.choices.filter(c=>c.target).length,Number(trial.target));
      assert.equal(new Set(trial.choices.map(c=>`${c.position.x}:${c.position.y}`)).size,trial.choices.length);
      for(const c of trial.choices)assert.equal(c.target,s.targets.some(target=>JSON.stringify(target)===JSON.stringify(c.stimulus)));
      const size=Math.min(trial.size,360*.18),width=300,height=220;
      for(let i=0;i<trial.choices.length;i++)for(let j=i+1;j<trial.choices.length;j++) {
        const a=trial.choices[i].position,b=trial.choices[j].position;
        assert.ok(Math.abs(a.x-b.x)*width/100>=size || Math.abs(a.y-b.y)*height/100>=size,'touch targets overlap');
      }
    }
  }
});
test('clicking a hunt distractor during a target scene is one wrong selection, never a hit',()=>{
  const {session:s,timer:t}=create('hunt');
  while(!s.current.target){t.advance(1000);s.tick();if(s.gate)s.acknowledge();}
  const wrong=s.current.choices.findIndex(c=>!c.target),target=s.current.choices.findIndex(c=>c.target),prior=s.metrics.correctRejects;
  t.advance(50);assert.equal(s.respondToStimulus(s.index,wrong),false);assert.equal(s.respondToStimulus(s.index,target),null);t.advance(950);s.tick();
  assert.equal(s.metrics.hits,0);assert.equal(s.metrics.misses,0);assert.equal(s.metrics.falseAlarms,1);
  assert.equal(s.metrics.correctRejects,prior);assert.equal(s.result.meanReactionMs,null);
  const outcome=s.result.outcomes.at(-1);assert.equal(outcome.target,true);assert.equal(outcome.response,true);assert.equal(outcome.correct,false);assert.equal(outcome.selectedTarget,false);
});
test('all hunt levels complete with direct selection of the target among distractors',()=>{
  for(const level of Object.keys(LEVELS))for(const targetCount of [1,2]) {
    const t=clock(),s=FACTORIES.hunt({level,targetCount,now:t.now,random:seededRandom(1)});
    while(!s.done){if(s.gate)s.acknowledge();t.advance(50);if(s.current.target)assert.equal(s.respondToStimulus(s.index,s.current.choices.findIndex(c=>c.target)),true);t.advance(950);s.tick();}
    assert.equal(s.result.hits,30);assert.equal(s.result.omissions,0);assert.equal(s.result.falseSelections,0);assert.equal(s.result.outcomes.length,150);
  }
});
test('space always requires clearing obstacles to collect all required equipment',()=>{
  for(const level of Object.keys(LEVELS))for(let seed=0;seed<40;seed++) {
    const s=FACTORIES.space({level,random:seededRandom(seed)});
    assert.equal(s.items.filter(i=>i.blocked && i.required).length,LEVELS[level].obstacles);
    for(const item of s.items.filter(i=>i.required && !i.blocked))s.choose(item.id);
    assert.equal(s.ready,false);assert.equal(s.depart(),false);
    for(const item of s.items.filter(i=>i.blocked)){assert.equal(s.choose(item.id),'cleared');assert.equal(s.choose(item.id),true);}
    assert.ok(s.depart());assert.equal(s.result.obstaclesCleared,LEVELS[level].obstacles);assert.equal(s.result.departed,true);assert.equal(s.result.inventory.length,LEVELS[level].required);
  }
});
test('practice feedback explains why essential equipment is needed',()=>{
  for(const id of ['ark','space']) {
    const {session:s}=create(id);
    const item=s.items.find(i=>i.required);if(item.blocked)s.choose(item.id);s.choose(item.id);
    assert.ok(s.feedback.includes(item.name));assert.ok(s.feedback.length>item.name.length+25);
  }
});

test('dual search creates two distinct exact targets among distractors for each level and layout',()=>{
  for(const level of Object.keys(LEVELS))for(const material of ['shapes','letters'])for(const layout of ['grid','scattered'])for(let seed=0;seed<40;seed++) {
    const board=generateSearch(level,seededRandom(seed),layout,material,2);assert.equal(board.targets.length,2);assert.equal(board.choices.length,LEVELS[level].items);
    assert.equal(board.choices.filter(c=>c.target).length,2);
    assert.notDeepEqual(board.targets[0],board.targets[1]);
    for(const target of board.targets)assert.equal(board.choices.filter(c=>c.shape===target.shape&&c.color===target.color&&c.detail===target.detail).length,1);
    if(level==='hard')assert.ok(board.choices.every(c=>c.shape===board.target.shape&&c.color===board.target.color));
  }
});
test('dual search keeps the round active after one discovery, ignores duplicate choices and scores each target once',()=>{
  const t=clock(),s=FACTORIES.search({targetCount:2,now:t.now,random:seededRandom(12)});
  t.advance(2000);const targets=s.current.choices.flatMap((c,i)=>c.target?[i]:[]);
  t.advance(150);assert.equal(s.choose(targets[0]),true);assert.equal(s.index,0);assert.equal(s.found.size,1);assert.equal(s.choose(targets[0]),null);
  t.advance(250);assert.equal(s.choose(targets[1]),true);assert.equal(s.index,1);assert.equal(s.metrics.hits,2);assert.equal(s.result.meanReactionMs,275);assert.ok(s.preview);
});
test('dual search timeout records only remaining targets and pause preserves the timer and partial discoveries',()=>{
  const t=clock(),s=FACTORIES.search({targetCount:2,now:t.now,random:seededRandom(3)});
  t.advance(2100);s.choose(s.current.choices.findIndex(c=>c.target));s.pause();t.advance(50000);assert.equal(s.found.size,1);assert.equal(s.remainingMs,29900);
  s.resume();t.advance(29900);s.tick();assert.equal(s.index,1);assert.equal(s.metrics.hits,1);assert.equal(s.metrics.misses,1);
  t.advance(32000);s.tick();assert.equal(s.metrics.misses,3);
});
test('dual search finishes all ten rounds in every level, material and layout with separate variant records',()=>{
  for(const level of Object.keys(LEVELS))for(const material of ['shapes','letters'])for(const layout of ['grid','scattered']) {
    const t=clock(),s=FACTORIES.search({level,material,layout,targetCount:2,now:t.now,random:seededRandom(5)});
    while(!s.done){t.advance(2100);const indices=s.current.choices.flatMap((c,i)=>c.target?[i]:[]);for(const i of indices)s.choose(i);}
    assert.equal(s.result.score,20);assert.equal(s.result.maxScore,20);assert.equal(s.result.hits,20);assert.equal(s.result.outcomes.length,20);assert.equal(s.result.targetsPerRound,2);assert.ok(s.result.variant.endsWith('dual'));
  }
});
