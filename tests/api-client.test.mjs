import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiClient,ApiError} from '../src/api.js';

test('API client preserves HTTP authorization status when an intermediary returns HTML',async()=>{
 const client=new ApiClient(async()=>new Response('<h1>Unauthorized</h1>',{status:401,headers:{'Content-Type':'text/html'}}));
 await assert.rejects(client.request('/bootstrap'),error=>error instanceof ApiError&&error.status===401&&error.code==='INVALID_RESPONSE');
});

test('API client rejects malformed successful payloads without replacing the current CSRF token',async()=>{
 for(const body of ['null','[]','"unexpected"','true','{"csrfToken":123}','{"csrfToken":{}}','{"csrfToken":null}','{"csrfToken":""}']){
  const client=new ApiClient(async()=>new Response(body,{status:200}));client.csrfToken='previous-token';
  await assert.rejects(client.request('/auth/session'),error=>error instanceof ApiError&&error.status===200&&error.code==='INVALID_RESPONSE');
  assert.equal(client.csrfToken,'previous-token');
 }
});

test('API client reports a readable network error and preserves its original cause',async()=>{
 const cause=new TypeError('Failed to fetch'),client=new ApiClient(async()=>{throw cause;});
 await assert.rejects(client.request('/bootstrap'),error=>error instanceof ApiError&&error.status===0&&error.code==='NETWORK_ERROR'&&error.cause===cause);
});

test('API client keeps structured API failures and does not replace CSRF state on failed requests',async()=>{
 const client=new ApiClient(async()=>new Response(JSON.stringify({error:'ابتدا وارد حساب شوید.',code:'AUTH_REQUIRED',csrfToken:'unaccepted-token'}),{status:401}));client.csrfToken='previous-token';
 await assert.rejects(client.request('/bootstrap'),error=>error instanceof ApiError&&error.status===401&&error.code==='AUTH_REQUIRED'&&error.message==='ابتدا وارد حساب شوید.');
 assert.equal(client.csrfToken,'previous-token');
});

test('API client accepts session tokens and sends credentials and the current token on mutations',async()=>{
 const calls=[],client=new ApiClient(async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(calls.length===1?{csrfToken:'session-token'}:{ok:true}));});
 await client.request('/auth/session');await client.request('/auth/logout',{method:'POST',body:{}});
 assert.equal(calls[1].options.credentials,'same-origin');assert.equal(calls[1].options.headers['X-CSRF-Token'],'session-token');assert.equal(calls[1].options.body,'{}');
});

test('API client uses text fallbacks when an error response has invalid message or code types',async()=>{
 const client=new ApiClient(async()=>new Response(JSON.stringify({error:{details:'unexpected'},code:123}),{status:502}));
 await assert.rejects(client.request('/bootstrap'),error=>error instanceof ApiError&&error.status===502&&typeof error.message==='string'&&!error.message.includes('[object Object]')&&error.code==='API_ERROR');
});
