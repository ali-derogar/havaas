import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAppOrigin,appOrigin} from '../server/origin.js';

test('configured application origins use browser URL normalization for slash, case, ports and IPv6',()=>{
  for(const [configured,expected] of [
    ['http://85.133.250.181:4173/','http://85.133.250.181:4173'],
    ['http://EXAMPLE.test:80/','http://example.test'],
    ['https://EXAMPLE.test:443/','https://example.test'],
    ['http://[::1]:4173/','http://[::1]:4173'],
    ['', ''],[undefined,'']
  ])assert.equal(normalizeAppOrigin(configured),expected);
  for(const value of ['example.test','ftp://example.test','https://example.test/path','https://example.test/?query=1','https://example.test/#token','https://name:password@example.test'])assert.throws(()=>normalizeAppOrigin(value),/APP_ORIGIN/);
});

test('shared links and CSRF checks use the same normalized origin and retain the host fallback',()=>{
  const previous=process.env.APP_ORIGIN;
  try{
    process.env.APP_ORIGIN='http://EXAMPLE.test:80/';
    const req={protocol:'https',get:name=>name==='host'?'internal.example.test:443':undefined};
    assert.equal(appOrigin(req),'http://example.test');
    delete process.env.APP_ORIGIN;
    assert.equal(appOrigin(req),'https://internal.example.test');
  }finally{if(previous===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=previous;}
});
