'use strict';
// Offline self-test: `npm test`. No network needed (fetch is mocked).
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),E=require('./engine');
let seed=5;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647-.5};
const agg=(A,n)=>{const R=[];for(let i=0;i+n<=A.length;i+=n){const w=A.slice(i,i+n);R.push({t:w[0].t,o:w[0].o,h:Math.max(...w.map(x=>x.h)),l:Math.min(...w.map(x=>x.l)),c:w[n-1].c,v:1})}return R};
function gen(days){let p=80000;const A=[],t0=Math.floor((Date.now()-days*864e5)/144e5)*144e5;
for(let i=0;i<days*96;i++){const reg=Math.floor(i/1200)%3,dr=[.0006,0,-.0006][reg],o=p;let h=o,l=o;for(let q=0;q<5;q++){p*=1+dr/5+.006*rnd();h=Math.max(h,p);l=Math.min(l,p)}A.push({t:t0+i*9e5,o,h,l,c:p,v:1})}
return{A15:A,H1:agg(A,4),H4:agg(A,16)}}
const D=gen(120);
function live(cfg,next){const h1=cfg.tf=='1h',A=h1?D.H1:D.A15,H=h1?D.H4:D.H1,bar=h1?36e5:9e5,S=E.newState(cfg,0);let m=800;
const win=()=>[A.slice(Math.max(0,m-700),m+1),H.filter(h=>h.t<=A[m].t),A[m].t+bar/3];
E.processBars(S,...win().slice(0,2),win()[2],cfg,'test');
while(m<A.length-1){m=Math.min(A.length-1,m+next());Object.assign(S,JSON.parse(JSON.stringify(S)));E.processBars(S,win()[0],win()[1],win()[2],cfg,'test')}return S}
for(const tf of['15m','1h']){const cfg={...E.DEF,tf,fee:.10,short:true},a=live(cfg,()=>1),b=live(cfg,()=>1+Math.floor(Math.random()*40));
assert.strictEqual(JSON.stringify(a.trades),JSON.stringify(b.trades),tf+': trades must not depend on how often the bot runs');
assert(a.trades.length>5,tf+': expected trades on volatile test data');assert(a.eq>0);
console.log('ok  '+tf+' chunk-invariant and restart-safe:',a.trades.length,'trades,',a.curve.length,'equity points')}
// the signal shown at the start of a bar must equal what the paper account does when that bar closes
for(const [tf,costs] of[['15m',true],['1h',true],['15m',false],['1h',false]]){const cfg={...E.DEF,tf,costs,fee:.10,short:true},A=tf=='1h'?D.H1:D.A15,H=tf=='1h'?D.H4:D.H1;E.setCfg(cfg);const P=E.pre(A,H),S=E.newState(cfg,0),s0=tf=='1h'?400:800;let n=0,acts={};
for(let k=100;k<s0;k++)E.stepBar(S,A,P,k,cfg,'t');
for(let k=s0;k<s0+250;k++){const pl=E.plan(S,A.slice(0,k+1),H.filter(h=>h.t<=A[k].t),A[k].t+1,cfg),nb=S.trades.length,pos0=S.pos&&{...S.pos};E.stepBar(S,A,P,k,cfg,'t');n++;acts[pl.action]=1;
const cn=S.trades.length>nb?S.trades[S.trades.length-1]:null;
if(pl.action=='ENTER'){const e=S.pos?S.pos.e:cn&&cn.tOpen===A[k].t?cn.entry:NaN;assert(Math.abs(e-pl.ref)<1e-6,tf+' ENTER signal must equal the paper entry')}
else if(pl.action=='EXIT'){assert(cn&&cn.tClose===A[k].t&&Math.abs(cn.exit-pl.ref)<1e-6,tf+' EXIT signal must equal the paper exit')}
else if(pl.action=='HOLD')assert(Math.abs(pos0.stop-pl.stop)<1e-6,tf+' HOLD stop must equal the paper stop');
else assert(!(S.pos&&S.pos.t===A[k].t),tf+' WAIT must not open a position')}
if(!costs)assert(S.trades.every(t=>t.fee===0)&&S.trades.length>0,'no fees may be charged when costs are ignored');console.log('ok  '+tf+(costs?'':' (costs ignored)')+' signals equal paper execution over',n,'bars')}
// data source failover with mocked fetch: everything fails except Bitstamp
const run=require('./run');
assert.deepStrictEqual(run.validateCfg({fee:.4,costs:true,tf:'1h',mode:'auto',short:false,gate:1.5}),[]);
assert.strictEqual(run.validateCfg({fee:-1,tf:'5m',mode:'x',short:'no',gate:0,costs:'yes'}).length,6);
assert.deepStrictEqual(run.validateCfg({...E.DEF,...JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'),'utf8'))}),[],'bot/config.json must be valid');
const fake={trades:[{dir:'long',style:'Trend Following',pl:1.234,why:'Trailing stop (profit locked in)',entry:80000,exit:81000}],pos:{t:5,d:-1,k:'meanrev',e:82000,stop:83000}};
const ev=run.events(fake,{n:0,posT:null});assert(ev.length===1&&ev[0].startsWith('RESULT paper trade closed, long'));assert.strictEqual(run.events(fake,{n:1,posT:5}).length,0);
const sg=E.signals,base={barT:1,ref:80000,px:80100,stop:79000,style:'Trend Following',dir:1,dev:.12,ok:true,approx:false};
assert(sg(null,{...base,action:'ENTER'})[0].startsWith('SIGNAL OPEN LONG'));assert.strictEqual(sg({...base,action:'ENTER'},{...base,action:'ENTER'}).length,0,'no duplicate signal within a bar');
assert(sg({...base,action:'HOLD',stop:79000,barT:1},{...base,action:'HOLD',stop:79500,barT:2})[0].startsWith('SIGNAL MOVE STOP'));
assert(sg(null,{...base,action:'EXIT',why:'Trend reversed'})[0].startsWith('SIGNAL CLOSE LONG'));assert(sg(null,{...base,action:'HOLD',stopHit:true})[0].includes('touched'));
console.log('ok  config validation and alert messages');
global.fetch=async u=>{u=String(u);if(!u.includes('bitstamp'))throw new TypeError('blocked');
const q=new URL(u).searchParams,st=+q.get('start'),en=+q.get('end'),map=+q.get('step')==900?D.A15:D.H1;
return{ok:true,json:async()=>({data:{ohlc:map.filter(c=>c.t/1e3>=st&&c.t/1e3<=en).map(c=>({timestamp:String(c.t/1e3),open:c.o,high:c.h,low:c.l,close:c.c,volume:c.v}))}})}};
(async()=>{const now=D.A15[D.A15.length-1].t+3e5,rn=Date.now;Date.now=()=>now;
for(const tf of['15m','1h']){const w=await run.fetchWindow(now,{tf});assert.strictEqual(w.src,'Bitstamp');assert(w.A.length>=300&&w.H.length>=60);console.log('ok  failover ('+tf+') to',w.src,':',w.A.length,'entry bars,',w.H.length,'trend bars')}
// full run() with alerts: success pings the heartbeat and sends a start message, failure pings /fail and keeps the state
const calls=[],base=global.fetch;global.fetch=async(u,o)=>{u=String(u);calls.push(u);return u.includes('hc.test')||u.includes('ntfy.sh')?{ok:true}:base(u,o)};
process.env.STATE_FILE=path.join(os.tmpdir(),'edium-selftest-'+process.pid+'.json');process.env.HEALTHCHECK_URL='https://hc.test/abc';process.env.NTFY_TOPIC='selftest-topic';
await run.main();const S1=JSON.parse(fs.readFileSync(process.env.STATE_FILE,'utf8'));
assert(S1.run.lastError===null&&S1.metrics&&S1.P0>0,'first run initialises the account');assert(calls.includes('https://hc.test/abc')&&!calls.some(u=>u.endsWith('/fail')));assert(calls.some(u=>u.includes('ntfy.sh/selftest-topic')));
calls.length=0;global.fetch=async u=>{u=String(u);calls.push(u);if(u.includes('hc.test')||u.includes('ntfy.sh'))return{ok:true};throw new TypeError('blocked')};
process.exitCode=0;await run.main();const S2=JSON.parse(fs.readFileSync(process.env.STATE_FILE,'utf8'));
assert.strictEqual(S2.run.failStreak,1);assert(calls.includes('https://hc.test/abc/fail'));assert.strictEqual(process.exitCode,0);assert.strictEqual(S2.eq,S1.eq,'a failed run must not change the account');
fs.unlinkSync(process.env.STATE_FILE);global.fetch=base;console.log('ok  run(): heartbeat, alerts and failure handling');
Date.now=rn;console.log('all self-tests passed')})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
