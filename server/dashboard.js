import {requireValue as check} from './security.js';
import {GAMES,GAME_PROTOCOLS} from '../src/config.js';

export function registerDashboard(app,pool,role){
 app.get('/api/admin/dashboard',async(req,res)=>{
  role(req,['admin']);const days=Number(req.query.days||30);check([7,30,90].includes(days),'بازهٔ زمانی معتبر انتخاب کنید.');
  const result=await pool.query(`WITH bounds AS (SELECT (now() AT TIME ZONE 'Asia/Tehran')::date AS today),
   recent AS (SELECT s.*,c.owner_user_id FROM game_sessions s JOIN children c ON c.id=s.child_id WHERE s.result IS NOT NULL AND s.finished_at>=((SELECT today FROM bounds)-($1::int-1))::timestamp AT TIME ZONE 'Asia/Tehran' AND s.finished_at<((SELECT today FROM bounds)+1)::timestamp AT TIME ZONE 'Asia/Tehran' AND c.owner_user_id IS NOT NULL),
   assessments AS (SELECT c.owner_user_id,count(DISTINCT s.result->>'gameId') FILTER (WHERE s.kind='baseline' AND s.result->>'level'='easy' AND COALESCE(s.result->>'variant','standard')='standard' AND (s.result->>'protocolVersion')::int=($2::jsonb->>(s.result->>'gameId'))::int) AS done FROM children c LEFT JOIN game_sessions s ON s.child_id=c.id AND s.result IS NOT NULL GROUP BY c.owner_user_id)
   SELECT json_build_object(
    'days',$1::int,'today',(SELECT today FROM bounds),
    'totals',json_build_object('users',(SELECT count(*) FROM users WHERE role='user'),'activeUsers',(SELECT count(DISTINCT owner_user_id) FROM recent),'sessions',(SELECT count(*) FROM recent),'incompleteAssessments',(SELECT count(*) FROM users u LEFT JOIN assessments a ON a.owner_user_id=u.id WHERE u.role='user' AND u.active AND NOT u.pending AND COALESCE(a.done,0)<7),'openInvitations',(SELECT count(*) FROM registration_links l JOIN users u ON u.id=l.created_by WHERE l.used_at IS NULL AND l.revoked_at IS NULL AND l.expires_at>now() AND u.active)+(SELECT count(*) FROM invitations i JOIN users u ON u.id=i.created_by WHERE i.purpose='invite' AND i.used_at IS NULL AND i.expires_at>now() AND u.active)),
    'daily',(SELECT json_agg(d ORDER BY d.day) FROM (SELECT to_char(day,'YYYY-MM-DD') AS day,count(r.id) FILTER (WHERE r.kind='baseline') AS baseline,count(r.id) FILTER (WHERE r.kind='training') AS training FROM generate_series((SELECT today FROM bounds)-($1::int-1),(SELECT today FROM bounds),interval '1 day') AS day LEFT JOIN recent r ON (r.finished_at AT TIME ZONE 'Asia/Tehran')::date=day::date GROUP BY day) d),
    'games',(SELECT COALESCE(json_agg(g),'[]') FROM (SELECT result->>'gameId' AS id,count(*) AS count FROM recent GROUP BY result->>'gameId') g),
    'recent',(SELECT COALESCE(json_agg(a),'[]') FROM (SELECT s.id,u.id AS "userId",u.name,s.kind,s.result->>'gameId' AS "gameId",s.result->>'level' AS level,(s.result->>'durationMs')::numeric AS "durationMs",s.finished_at AS "finishedAt" FROM recent s JOIN users u ON u.id=s.owner_user_id ORDER BY s.finished_at DESC,s.id DESC LIMIT 10) a)
   ) AS data`,[days,JSON.stringify(GAME_PROTOCOLS)]);
  const data=result.rows[0].data;data.games=GAMES.map(game=>({id:game.id,count:Number(data.games.find(g=>g.id===game.id)?.count||0)}));res.json(data);
 });
}
