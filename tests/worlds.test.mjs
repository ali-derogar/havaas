import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_ASSETS,worldFor,preloadWorld,worldBackground } from '../src/worlds.js';

test('visual worlds match the selected family and retain abstract backgrounds at hard difficulty',()=>{
 assert.equal(worldFor({gameId:'ark'}),WORLD_ASSETS.ark);assert.equal(worldFor({gameId:'space'}),WORLD_ASSETS.space);
 assert.equal(worldFor({gameId:'hunt',theme:'fish',level:'medium'}),WORLD_ASSETS.pond);
 for(const theme of ['star','bird','butterfly'])assert.equal(worldFor({gameId:'hunt',theme}),WORLD_ASSETS.meadow);
 assert.equal(worldFor({gameId:'hunt',theme:'fish',level:'hard'}),null);assert.equal(worldFor({gameId:'hunt',theme:'shape'}),null);
 assert.equal(worldBackground({gameId:'ark'},WORLD_ASSETS.space),'');assert.ok(worldBackground({gameId:'ark'},WORLD_ASSETS.ark).includes('world-backdrop'));
});
test('world loading shares one decode promise and resolves only when the image is decoded',async()=>{
 let release,created=0;
 class Image {constructor(){created++;}set src(value){this.url=value;queueMicrotask(()=>this.onload());}decode(){return new Promise(resolve=>{release=resolve;});}}
 const a=preloadWorld({gameId:'ark'},{ImageClass:Image}),b=preloadWorld({gameId:'ark'},{ImageClass:Image});assert.equal(a,b);assert.equal(created,1);
 let resolved=false;a.then(()=>resolved=true);await new Promise(resolve=>setImmediate(resolve));assert.equal(resolved,false);release();assert.equal(await a,WORLD_ASSETS.ark);assert.equal(await b,WORLD_ASSETS.ark);
});
test('a failed image or decode falls back and can be retried for a later game',async()=>{
 class Failing {set src(value){queueMicrotask(()=>this.onerror());}}
 class Good {set src(value){queueMicrotask(()=>this.onload());}decode(){return Promise.resolve();}}
 assert.equal(await preloadWorld({gameId:'space'},{ImageClass:Failing}),null);assert.equal(await preloadWorld({gameId:'space'},{ImageClass:Good}),WORLD_ASSETS.space);
 class Undecodable {set src(value){queueMicrotask(()=>this.onload());}decode(){return Promise.reject(Error('decode'));}}
 assert.equal(await preloadWorld({gameId:'hunt',theme:'bird'},{ImageClass:Undecodable}),null);assert.equal(await preloadWorld({gameId:'hunt',theme:'bird'},{ImageClass:Good}),WORLD_ASSETS.meadow);
});
test('an unavailable or stalled image does not block a game indefinitely',async()=>{
 assert.equal(await preloadWorld({gameId:'ark'},{ImageClass:null}),null);
 class NeverLoads {set src(value){}}
 assert.equal(await preloadWorld({gameId:'hunt',theme:'fish'},{ImageClass:NeverLoads,timeoutMs:1}),null);
});
