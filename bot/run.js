'use strict';
// One execution of the Edium bot: load state, fetch candles (with fallbacks), process newly closed 15m bars, save state.
// Data source code below is copied from public/index.html (server-side there is no CORS limit).
const fs=require('fs'),path=require('path'),E=require('./engine');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),iso=s=>new Date(s*1e3).toISOString().slice(0,19)+'Z';
async function J(u){const r=await fetch(u,{headers:{'User-Agent':'edium-flow-bot/1.0'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json();if(j&&j.error&&j.error.length)throw new Error(String(j.error[0]));return j}
const mk=(t,o,h,l,c,v)=>({t:t*1e3,o:+o,h:+h,l:+l,c:+c,v:+v}),S5={'1m':60,'5m':300,'15m':900,'1h':3600,'1d':86400};
const SRC=[
{n:'Coinbase Advanced',per:340,gap:150,deep:1,sec:S5,G:{'1m':'ONE_MINUTE','5m':'FIVE_MINUTE','15m':'FIFTEEN_MINUTE','1h':'ONE_HOUR','1d':'ONE_DAY'},B:'https://api.coinbase.com/api/v3/brokerage/market/products/BTC-USD',
 async cand(k,a,b){return(await J(`${this.B}/candles?granularity=${this.G[k]}&start=${a}&end=${b}`)).candles.map(x=>mk(x.start,x.open,x.high,x.low,x.close,x.volume))},
 async tick(){return+(await J(this.B)).price}},
{n:'Coinbase Exchange',per:290,gap:150,deep:1,sec:S5,
 async cand(k,a,b){return(await J(`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=${this.sec[k]}&start=${iso(a)}&end=${iso(b)}`)).map(x=>mk(x[0],x[3],x[2],x[1],x[4],x[5]))},
 async tick(){return+(await J('https://api.exchange.coinbase.com/products/BTC-USD/ticker')).price}},
{n:'Bitstamp',per:1000,gap:200,deep:1,sec:S5,
 async cand(k,a,b){return(await J(`https://www.bitstamp.net/api/v2/ohlc/btcusd/?step=${this.sec[k]}&limit=1000&start=${a}&end=${b}`)).data.ohlc.map(x=>mk(x.timestamp,x.open,x.high,x.low,x.close,x.volume))},
 async tick(){return+(await J('https://www.bitstamp.net/api/v2/ticker/btcusd/')).last}},
{n:'Bitfinex',per:5000,gap:800,deep:1,sec:S5,T:{'1m':'1m','5m':'5m','15m':'15m','1h':'1h','1d':'1D'},
 async cand(k,a,b){return(await J(`https://api-pub.bitfinex.com/v2/candles/trade:${this.T[k]}:tBTCUSD/hist?start=${a*1e3}&end=${b*1e3}&limit=5000&sort=1`)).map(x=>mk(x[0]/1e3,x[1],x[3],x[4],x[2],x[5]))},
 async tick(){return+(await J('https://api-pub.bitfinex.com/v2/ticker/tBTCUSD'))[6]}},
{n:'Kraken',per:720,gap:400,deep:0,sec:S5,
 async cand(k,a){const r=(await J(`https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=${this.sec[k]/60}&since=${a}`)).result;return r[Object.keys(r).find(q=>q!='last')].map(x=>mk(x[0],x[1],x[2],x[3],x[4],x[6]))},
 async tick(){const r=(await J('https://api.kraken.com/0/public/Ticker?pair=XBTUSD')).result;return+r[Object.keys(r)[0]].c[0]}},
{n:'Coinbase spot',async tick(){return+(await J('https://api.coinbase.com/v2/prices/BTC-USD/spot')).data.amount}},
{n:'Gemini',async tick(){return+(await J('https://api.gemini.com/v1/pubticker/btcusd')).last}}];
async function T(s,f){const t0=performance.now();try{const r=await f();s.h={ok:1,ms:Math.round(performance.now()-t0)};return r}catch(e){s.h={ok:0,err:e.name=='TypeError'?'blocked (CORS/network/ad blocker)':e.name=='TimeoutError'?'timeout':e.message};s.bad=Date.now()+3e4;throw e}}
const RT=async(s,f,n=3)=>{for(let i=1;;i++){try{return await T(s,f)}catch(e){if(i>=n||e.name=='TypeError')throw e;await sleep(700*i)}}};
async function pageC(s,k,span,onp){const sc=s.sec[k],now=Math.floor(Date.now()/1e3),st=now-span,m=new Map();let end=now;
while(end>st){const a=s.deep?Math.max(st,end-sc*s.per):st;(await RT(s,()=>s.cand(k,a,end))).forEach(c=>c.o>0&&c.h>=c.l&&m.set(c.t,c));if(!s.deep)break;end=a;onp&&onp();if(end>st)await sleep(s.gap)}
const r=[...m.values()].sort((a,b)=>a.t-b.t);if(r.length<30)throw new Error('too few candles');return r}

const agg4=H=>{const q=[],b=144e5;H.forEach(c=>{const t=Math.floor(c.t/b)*b,l=q[q.length-1];if(l&&l.t==t){l.h=Math.max(l.h,c.h);l.l=Math.min(l.l,c.l);l.c=c.c;l.v+=c.v}else q.push({...c,t})});q.shift();return q};
async function fetchWindow(now,cfg={}){const h1=cfg.tf=='1h',bar=h1?36e5:9e5,errs=[];
for(const s of SRC.filter(s=>s.cand)){try{const a=await pageC(s,h1?'1h':'15m',(h1?3600:900)*720),h=h1?agg4(a):await pageC(s,'1h',3600*320),last=a[a.length-1];
if(now-last.t>Math.max(36e5,2*bar))throw new Error('stale data (last bar '+new Date(last.t).toISOString()+')');if(a.length<300||h.length<(h1?60:80))throw new Error('too few candles');
return{A:a,H:h,src:s.n}}catch(e){errs.push(s.n+': '+e.message)}}
throw new Error('all data sources failed: '+errs.join(' | '))}
const note=(S,t,x)=>{S.notes.unshift({t,x});if(S.notes.length>60)S.notes.pop()};
function validateCfg(c){const e=[];if(!(c.fee>=0&&c.fee<=5))e.push('fee must be a number between 0 and 5 (percent per side)');
if(!['15m','1h'].includes(c.tf))e.push('tf must be "15m" or "1h"');if(!['auto','trend','breakout','meanrev','squeeze'].includes(c.mode))e.push('mode must be auto, trend, breakout, meanrev or squeeze');
if(typeof c.short!=='boolean')e.push('short must be true or false');if(typeof c.costs!=='boolean')e.push('costs must be true or false');if(!(c.gate>=.5&&c.gate<=5))e.push('gate must be a number between 0.5 and 5');return e}
async function post(url,opt){try{const r=await fetch(url,{...opt,signal:AbortSignal.timeout(10000)});return r.ok}catch(e){return false}}
const ntfy=m=>process.env.NTFY_TOPIC&&m?post('https://ntfy.sh/'+encodeURIComponent(process.env.NTFY_TOPIC),{method:'POST',body:m,headers:{Title:'Edium Flow'}}):0;
const heartbeat=fail=>process.env.HEALTHCHECK_URL?post(process.env.HEALTHCHECK_URL.replace(/\/+$/,'')+(fail?'/fail':'')):0;
function events(S,before){const m=[],px=n=>'$'+Math.round(n).toLocaleString('en-US');
S.trades.slice(before.n).forEach(t=>m.push(`RESULT paper trade closed, ${t.dir} (${t.style}): ${t.pl>=0?'+':''}${t.pl.toFixed(2)}% after fees. ${t.why}. Entry ${px(t.entry)}, exit ${px(t.exit)}.`));
return m}
async function main(){const now=Date.now(),fail=async m=>{console.error(m);process.exitCode=1;await heartbeat(true)};let cfg;
try{cfg={...E.DEF,...JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'),'utf8'))}}catch(e){return fail('Cannot read bot/config.json: '+e.message)}
const errs=validateCfg(cfg);if(errs.length)return fail('Invalid bot/config.json:\n - '+errs.join('\n - '));
const file=process.env.STATE_FILE||path.join(process.cwd(),'data','state.json'),save=S=>{fs.writeFileSync(file+'.tmp',JSON.stringify(S));fs.renameSync(file+'.tmp',file)};
fs.mkdirSync(path.dirname(file),{recursive:true});let S=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):E.newState(cfg,now);
const tf0=S.cfg.tf||'15m';
if(tf0!==(cfg.tf||'15m')){const m='Timeframe changed from '+tf0+' to '+(cfg.tf||'15m')+'. Delete the data branch to start a new trial.';S.run={...S.run,lastRun:now,lastError:m};note(S,now,'ERROR: '+m);save(S);return fail(m)}
if(JSON.stringify(S.cfg)!==JSON.stringify(cfg)){S.cfgLog.push({t:now,from:S.cfg,to:cfg});S.cfg=cfg;note(S,now,'SETTINGS CHANGED: '+JSON.stringify(cfg)+' (applies to new bars only)')}
const before={n:S.trades.length,posT:S.pos&&S.pos.t},prevFails=S.run.failStreak||0;let ok=true,msgs=[];
try{const{A,H,src}=await fetchWindow(now,cfg),r=E.processBars(S,A,H,now,cfg,src),px=A[A.length-1].c;
if(r.init)note(S,now,'STARTED: paper account $1,000, start price $'+S.P0.toFixed(2)+', data from '+src+(cfg.costs===false?'. COSTS ARE IGNORED (no fees, no slippage)':''));
if(r.gap)note(S,now,'DATA GAP: '+r.gap+' bars could not be evaluated (bot was not running or the source had a hole)');
note(S,now,E.statusNote(S,A,H,cfg,now));const prevPlan=S.plan||null;S.plan=E.plan(S,A,H,now,cfg);msgs=[...E.signals(prevPlan,S.plan),...events(S,before)];if(r.init)msgs.push('STARTED: paper account $1,000 at BTC $'+Math.round(S.P0).toLocaleString('en-US')+'.'+(cfg.costs===false?' Costs are ignored.':''));if(prevFails>=3)msgs.push('RECOVERED: market data is reachable again.');
S.run={...S.run,lastRun:now,lastOkRun:now,src,runs:(S.run.runs||0)+1,lastError:null,failStreak:0,lastPrice:px,lastBarT:S.lastT,newBars:r.bars};S.metrics=E.metrics(S,px,cfg);
console.log('ok',src,'new bars',r.bars,'trades',S.trades.length,'equity',S.metrics.equity)}
catch(e){ok=false;S.run={...S.run,lastRun:now,lastError:String(e.message).slice(0,500),failStreak:prevFails+1};note(S,now,'ERROR: '+e.message);console.error(e.message);process.exitCode=S.run.failStreak===3?1:0;if(S.run.failStreak===3)msgs.push('ERROR: no market data for 3 runs in a row. '+String(e.message).slice(0,180))}
save(S);await ntfy(msgs.join('\n'));await heartbeat(!ok)}
module.exports={fetchWindow,main,validateCfg,events,SRC,pageC,agg4};
if(require.main===module)main();
