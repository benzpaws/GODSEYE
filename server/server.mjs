import http from 'node:http';
import WebSocket from 'ws';
import {normalizeAIS,validBoxes} from './providers.mjs';
const env=process.env,port=Number(env.PORT)||8080;
const allowed=new Set((env.ALLOWED_ORIGINS||'https://benzpaws.github.io').split(',').map(x=>x.trim()));
const vessels=new Map(),cache=new Map(),pending=new Map(),limits=new Map();
let token=null,tokenExpires=0,tokenPending=null,socket=null,reconnectTimer,heartbeat,retry=0,connected=false,stopping=false;
const queries={world:'(election OR summit OR crisis OR earthquake OR conflict) sourcelang:english',security:'(conflict OR defense OR diplomacy OR ceasefire) sourcelang:english',weather:'(earthquake OR wildfire OR hurricane OR flooding) sourcelang:english'};
class FeedError extends Error{constructor(message,status=502){super(message);this.status=status;}}
async function jsonFetch(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(14000)});if(!r.ok)throw new FeedError('Provider unavailable (HTTP '+r.status+')',r.status===429?429:502);return r.json();}
async function cached(key,ttl,load){const old=cache.get(key);if(old&&Date.now()-old.at<ttl)return old.data;if(pending.has(key))return pending.get(key);const p=load().then(data=>{cache.set(key,{at:Date.now(),data});return data;}).finally(()=>pending.delete(key));pending.set(key,p);return p;}
async function authToken(){
  if(!env.OPENSKY_CLIENT_ID||!env.OPENSKY_CLIENT_SECRET)throw new FeedError('OpenSky credentials are not configured on the server',503);
  if(token&&Date.now()<tokenExpires)return token;if(tokenPending)return tokenPending;
  tokenPending=jsonFetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:env.OPENSKY_CLIENT_ID,client_secret:env.OPENSKY_CLIENT_SECRET})}).then(d=>{if(!d.access_token)throw new FeedError('OpenSky authentication failed');token=d.access_token;tokenExpires=Date.now()+(Number(d.expires_in)||1800)*1000-30000;return token;}).finally(()=>tokenPending=null);return tokenPending;
}
async function aircraft(){return cached('aircraft',90000,async()=>{
  for(let attempt=0;attempt<2;attempt++){
    const auth=await authToken();const r=await fetch('https://opensky-network.org/api/states/all',{headers:{Authorization:'Bearer '+auth},signal:AbortSignal.timeout(14000)});
    if(r.status===401&&attempt===0){token=null;continue;}
    if(!r.ok)throw new FeedError('Flight provider unavailable (HTTP '+r.status+')',r.status===429?429:502);
    const d=await r.json();if(d.states===null)d.states=[];if(!Array.isArray(d.states))throw new FeedError('Invalid flight response');return d;
  }
});}
function connectAIS(){
  if(stopping||!env.AISSTREAM_API_KEY)return;
  let boxes;try{boxes=validBoxes(env.AIS_BOUNDING_BOXES||'[[[40,27],[47,42]]]');}catch{console.error('AIS_BOUNDING_BOXES is invalid; AIS connection disabled.');return;}
  socket=new WebSocket('wss://stream.aisstream.io/v0/stream',{perMessageDeflate:true,maxPayload:1024*1024,handshakeTimeout:15000});
  socket.on('open',()=>{socket.send(JSON.stringify({APIKey:env.AISSTREAM_API_KEY,BoundingBoxes:boxes,FilterMessageTypes:['PositionReport','StandardClassBPositionReport','ExtendedClassBPositionReport']}));let alive=true;socket.on('pong',()=>alive=true);heartbeat=setInterval(()=>{if(!alive){socket.terminate();return;}alive=false;socket.ping();},30000);});
  socket.on('message',raw=>{try{const data=JSON.parse(raw.toString());if(data.MessageType==='SubscriptionConfirmation'){connected=true;retry=0;return;}const v=normalizeAIS(data);if(v){connected=true;retry=0;const old=vessels.get(v.mmsi);if(!old||old.observedAt<=v.observedAt)vessels.set(v.mmsi,v);if(vessels.size>10000)vessels.delete(vessels.keys().next().value);}}catch{}});
  socket.on('error',()=>{connected=false;});
  socket.on('close',()=>{connected=false;clearInterval(heartbeat);if(!stopping){const delay=Math.min(60000,1000*2**Math.min(retry++,6))+Math.random()*1000;reconnectTimer=setTimeout(connectAIS,delay);}});
}
const clean=setInterval(()=>{const now=Date.now()/1000;for(const [id,v] of vessels)if(now-v.observedAt>600)vessels.delete(id);for(const [ip,v] of limits)if(Date.now()-v.at>60000)limits.delete(ip);},30000);clean.unref();
const tleGroups=new Set(['stations','starlink','weather','gps-ops','galileo','glonass-operational','science','iridium-NEXT','active','cosmos-1408-debris']);
const server=http.createServer(async(req,res)=>{
  const origin=req.headers.origin;if(origin&&!allowed.has(origin)){res.writeHead(403);res.end('Origin not allowed');return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');res.writeHead(204);res.end();return;}
  if(req.method!=='GET'){res.writeHead(405);res.end(JSON.stringify({error:'GET only'}));return;}
  const ip=req.socket.remoteAddress||'unknown',lim=limits.get(ip)||{at:Date.now(),count:0};if(Date.now()-lim.at>60000){lim.at=Date.now();lim.count=0;}lim.count++;limits.set(ip,lim);
  if(lim.count>180){res.writeHead(429);res.end(JSON.stringify({error:'Request limit reached'}));return;}
  try{
    const url=new URL(req.url,'http://localhost');let data;
    if(url.pathname==='/health')data={status:'ok',aircraftConfigured:!!(env.OPENSKY_CLIENT_ID&&env.OPENSKY_CLIENT_SECRET),aisConfigured:!!env.AISSTREAM_API_KEY,aisConnected:connected};
    else if(url.pathname==='/api/aircraft')data=await aircraft();
    else if(url.pathname==='/api/vessels'){
      if(!env.AISSTREAM_API_KEY||!connected)throw new FeedError('AIS feed not connected',503);
      data={source:'AISStream',timestampSource:'provider receipt',vessels:[...vessels.values()].filter(v=>Date.now()/1000-v.observedAt<=600).slice(0,5000)};
    }else if(url.pathname==='/api/news'){
      const topic=url.searchParams.get('topic')||'world';if(!queries[topic])throw new FeedError('Unknown news topic',400);
      data=await cached('news:'+topic,300000,()=>jsonFetch('https://api.gdeltproject.org/api/v2/doc/doc?'+new URLSearchParams({query:queries[topic],mode:'artlist',format:'json',maxrecords:'30',timespan:'24h',sort:'datedesc'})));
    }else if(url.pathname==='/api/satellites'){
      const group=url.searchParams.get('group');if(!tleGroups.has(group))throw new FeedError('Unknown orbital group',400);
      const raw=await cached('tle:'+group,3600000,async()=>{const r=await fetch('https://celestrak.org/NORAD/elements/gp.php?'+new URLSearchParams({GROUP:group,FORMAT:'tle'}),{signal:AbortSignal.timeout(14000)});if(!r.ok)throw new FeedError('Orbital provider unavailable');return r.text();});res.setHeader('Content-Type','text/plain; charset=utf-8');res.end(raw);return;
    }else throw new FeedError('Not found',404);
    res.end(JSON.stringify(data));
  }catch(e){res.writeHead(e.status||502);res.end(JSON.stringify({error:e instanceof FeedError?e.message:'Upstream feed unavailable'}));}
});
server.listen(port,'0.0.0.0',()=>console.log('GODSEYE feed server listening on port '+port));connectAIS();
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopping=true;clearTimeout(reconnectTimer);clearInterval(heartbeat);clearInterval(clean);socket?.terminate();server.close(()=>process.exit(0));});
