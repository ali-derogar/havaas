import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileSettings,validateProfileSettings,profileEntry,profileFamilies} from '../src/training-profiles.js';
import {FACTORIES} from '../src/games/index.js';
import {timingKey} from '../src/game-timing.js';

test('a complete profile covers every game mode and isolates the two hunt timing families',()=>{
 const settings=createProfileSettings('hard');assert.deepEqual(validateProfileSettings(settings),settings);
 for(const gameId of ['hunt','ark','space','traffic','search','nback','stroop']){
  const entry=profileEntry(settings,gameId);assert.ok(entry);for(const family of profileFamilies(gameId)){const engine=FACTORIES[gameId]({level:entry.level,theme:family==='moving'?'fish':'star',timing:entry.timings[family]});assert.equal(timingKey(engine.timing),timingKey(entry.timings[family]));}
 }
 const hunt=profileEntry(settings,'hunt');assert.notDeepEqual(hunt.timings.static,hunt.timings.moving);hunt.timings.static.visibleMs=800;assert.equal(profileEntry(createProfileSettings('hard'),'hunt').timings.static.visibleMs,300);
});
test('profile validation rejects missing and duplicate entries, stale protocols, invalid levels and timing families',()=>{
 for(const modify of [settings=>settings.pop(),settings=>settings[1]=structuredClone(settings[0]),settings=>settings[0].protocolVersion=999,settings=>settings[0].level='six-years',settings=>delete settings[0].timings.moving,settings=>settings[0].timings.static.intervalMs=0]){
  const settings=createProfileSettings();modify(settings);assert.throws(()=>validateProfileSettings(settings));
 }
});
