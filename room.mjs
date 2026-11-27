import E from './engine.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const error=(message,status=400)=>json({error:message},status);
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const makeCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>alphabet[n%26]).join('');
export class BattleRoom {
 constructor(ctx){this.ctx=ctx;this.r=null;}
 view(i){const r=this.r;return {code:r.code,phase:r.phase,me:i,players:r.players.map(p=>({name:p.name,team:p.team,ready:p.ready,online:Date.now()-p.seen<15000})),remaining:Math.max(0,Math.ceil((r.deadline-Date.now())/1000)),game:r.game,signals:r.players[i].signals.splice(0)};}
 player(name){name=String(name||'').trim().slice(0,24);if(!name)throw Error('نام را وارد کنید');return {name,token:crypto.randomUUID(),team:null,ready:false,input:{},signals:[],seen:Date.now()};}
 tick(now){const r=this.r;if(r.phase==='voice'&&now>=r.deadline)r.phase='teams';if(r.phase==='battle'){let elapsed=Math.min(0.5,Math.max(0,(now-r.last)/1000));while(elapsed>0){let dt=Math.min(.05,elapsed);E.step(r.game,r.players.map(p=>now-p.seen<1500?p.input:{}),dt);elapsed-=dt;}r.last=now;if(r.game.winner!==null)r.phase='finished';}}
 async fetch(req){try{const b=await req.json(),now=Date.now();if(this.r&&now-this.r.touched>1800000)this.r=null;
 if(b.action==='create'){if(this.r)return error('این کد قبلاً استفاده شده است',409);const p=this.player(b.name);this.r={code:b.code,phase:'waiting',players:[p],deadline:0,game:null,touched:now};return json({token:p.token,...this.view(0)});}
 const r=this.r;if(!r)return error('اتاق پیدا نشد یا بسته شده است',404);
 if(b.action==='join'){if(r.phase!=='waiting')return error('بازی شروع شده است');const p=this.player(b.name);r.players.push(p);r.touched=now;return json({token:p.token,...this.view(r.players.length-1)});}
 let i=r.players.findIndex(p=>p.token===b.token);if(i<0)return error('دسترسی نامعتبر',403);const p=r.players[i];p.seen=now;r.touched=now;this.tick(now);
 switch(b.action){
 case 'poll':if(r.phase==='battle'){const k=b.input||{};p.input={left:!!k.left,right:!!k.right,up:!!k.up,down:!!k.down,hit:!!k.hit};}break;
 case 'beginVoice':if(i!==0||r.phase!=='waiting')return error('فقط میزبان گفتگو را آغاز می‌کند');r.players=r.players.filter((p,j)=>j===0||now-p.seen<15000);if(r.players.length<2)return error('حداقل دو بازیکن حاضر لازم است');r.phase='voice';r.deadline=now+100000;break;
 case 'signal':if(r.phase==='voice'&&Number.isInteger(b.to)&&b.to!==i&&r.players[b.to]&&b.signal&&r.players[b.to].signals.length<256){const s=b.signal;r.players[b.to].signals.push({from:i,...(s.description?{description:s.description}:s.candidate?{candidate:s.candidate}:{})});}return json({ok:true});
 case 'endVoice':if(r.phase==='voice')r.phase='teams';break;
 case 'team':if(r.phase!=='teams')break;if(!['blue','yellow'].includes(b.team))return error('تیم نامعتبر');if(r.players.filter((q,j)=>j!==i&&q.team===b.team).length>=Math.ceil(r.players.length/2))return error('این تیم پر است');p.team=b.team;p.ready=false;break;
 case 'ready':if(r.phase==='teams'&&p.team)p.ready=true;break;
 case 'start':if(i!==0||r.phase!=='teams'||!r.players.every(p=>p.ready&&now-p.seen<15000)||!r.players.some(p=>p.team==='blue')||!r.players.some(p=>p.team==='yellow'))return error('هر دو تیم باید آماده باشند');r.game=E.makeGame(r.players);r.last=now;r.phase='battle';break;
 case 'leave':if(i===0){this.r=null;}else if(r.phase==='waiting'){r.players.splice(i,1);}else{p.seen=0;p.token=null;p.input={};if(r.phase==='battle'){r.game.players[i].hp=0;}else{r.phase='waiting';r.players=r.players.filter(q=>q.token);r.players.forEach(q=>{q.team=null;q.ready=false;q.signals=[];});}}return json({ok:true});
 default:return error('درخواست نامعتبر');
 }
 return json(this.view(i));
 }catch(e){return error(e.message||'خطا');}}
}
export async function routeApi(req,env){try{const raw=await req.text();if(raw.length>64000)return error('درخواست بزرگ است',413);const b=JSON.parse(raw);let c=String(b.code||'').trim().toUpperCase();if(c&&!/^[A-Z]{6}$/.test(c))return error('کد باید شش حرف انگلیسی باشد');const auto=b.action==='create'&&!c;if(!c&&!auto)return error('کد اتاق را وارد کنید');for(let j=0;j<(auto?8:1);j++){if(auto)c=makeCode();const stub=env.ROOMS.get(env.ROOMS.idFromName(c));const res=await stub.fetch(new Request('https://room.internal/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...b,code:c})}));if(!auto||res.status!==409)return res;}return error('کد آزاد پیدا نشد',503);}catch(e){return error('خطای درخواست',400);}}
