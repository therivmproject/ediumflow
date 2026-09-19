'use strict';
// Offline self-test: `npm test`. No network needed (fetch is mocked).
const assert=require('assert'),E=require('./engine');
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
// data source failover with mocked fetch: everything fails except Bitstamp
const run=require('./run');
global.fetch=async u=>{u=String(u);if(!u.includes('bitstamp'))throw new TypeError('blocked');
const q=new URL(u).searchParams,st=+q.get('start'),en=+q.get('end'),map=+q.get('step')==900?D.A15:D.H1;
return{ok:true,json:async()=>({data:{ohlc:map.filter(c=>c.t/1e3>=st&&c.t/1e3<=en).map(c=>({timestamp:String(c.t/1e3),open:c.o,high:c.h,low:c.l,close:c.c,volume:c.v}))}})}};
(async()=>{const now=D.A15[D.A15.length-1].t+3e5,rn=Date.now;Date.now=()=>now;
for(const tf of['15m','1h']){const w=await run.fetchWindow(now,{tf});assert.strictEqual(w.src,'Bitstamp');assert(w.A.length>=300&&w.H.length>=60);console.log('ok  failover ('+tf+') to',w.src,':',w.A.length,'entry bars,',w.H.length,'trend bars')}
Date.now=rn;console.log('all self-tests passed')})().catch(e=>{console.error('FAILED',e.message);process.exit(1)});
