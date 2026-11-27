import html from './index.html';
import {BattleRoom,routeApi} from './room.mjs';
export {BattleRoom};
export default {async fetch(req,env){const p=new URL(req.url).pathname;if(req.method==='GET'&&(p==='/'||p==='/index.html'))return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Permissions-Policy':'microphone=(self)'}});if(req.method==='POST'&&p==='/api')return routeApi(req,env);return new Response('Not found',{status:404});}};
