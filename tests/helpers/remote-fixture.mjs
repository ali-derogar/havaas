import { FACTORIES } from '../../src/games/index.js';
import { CLIENTS_KEY } from '../../src/core/clients.js';
import { seededRandom } from '../../src/core/random.js';
export function mockRemote(values){
  const user={id:'test-therapist',name:'درمانگر آزمون',email:'therapist@example.test',role:'therapist',active:true};
  const runs=new Map();let number=0;
  const read=()=>JSON.parse(values.get(CLIENTS_KEY)||'{"version":1,"activeId":null,"profiles":[],"records":[]}');
  const write=data=>values.set(CLIENTS_KEY,JSON.stringify(data));
  return async(url,options={})=>{
    const path=new URL(url,'http://localhost').pathname,query=new URL(url,'http://localhost').searchParams,method=options.method||'GET',body=options.body?JSON.parse(options.body):{};let result;
    const data=read();
    if(path==='/api/auth/session')result={user,csrfToken:'test-csrf'};
    else if(path==='/api/bootstrap'){const id=data.profiles.some(p=>p.id===query.get('childId'))?query.get('childId'):data.activeId||data.profiles[0]?.id||null;result={...data,user,activeId:id,records:data.records.filter(r=>r.profileId===id),difficulties:[]};}
    else if(path==='/api/users')result={users:[user]};
    else if(path==='/api/children'&&method==='POST'){const p={...body,id:`child-${data.profiles.length+1}`};data.profiles.push(p);data.activeId=p.id;write(data);result={profile:p};}
    else if(/^\/api\/children\/[^/]+$/.test(path)&&method==='PATCH'){const p=data.profiles.find(p=>p.id===path.split('/')[3]);Object.assign(p,body);write(data);result={profile:p};}
    else if(/^\/api\/children\/[^/]+$/.test(path)&&method==='DELETE'){const id=path.split('/')[3];data.profiles=data.profiles.filter(p=>p.id!==id);data.records=data.records.filter(r=>r.profileId!==id);if(data.activeId===id)data.activeId=data.profiles[0]?.id||null;write(data);result={ok:true};}
    else if(path.endsWith('/difficulty')&&method==='PATCH')result={setting:body};
    else if(path.endsWith('/sessions')&&method==='POST'){
      const engine=FACTORIES[body.gameId]({...body,practice:body.kind==='baseline',random:seededRandom(42),now:()=>0});
      result={id:`run-${++number}`,kind:body.kind,settings:{...body,reviewEnabled:body.kind==='baseline',seed:42,variant:engine.variant,protocolVersion:engine.protocolVersion}};runs.set(result.id,{...result,childId:path.split('/')[3]});
    }else if(path.endsWith('/complete')){
      const run=runs.get(path.split('/')[5]);if(!run)throw Error('Unknown mocked run');
      let record=data.records.find(r=>r.id===run.id);if(!record){record={id:run.id,profileId:run.childId,kind:run.kind,result:body.result};data.records.push(record);write(data);}result={record};
    }else throw Error(`Unhandled mock API ${method} ${path}`);
    return {ok:true,status:200,json:async()=>result};
  };
}
