'use strict';
// Verbatim copy of the indicator and strategy code in public/index.html. Keep both in sync.
const ema=(a,n)=>{const k=2/(n+1);let p=a[0];return a.map((v,i)=>p=i?v*k+p*(1-k):v)};
const bb=a=>a.map((_,i)=>{if(i<19)return null;const w=a.slice(i-19,i+1),m=w.reduce((s,v)=>s+v)/20,d=Math.sqrt(w.reduce((s,v)=>s+(v-m)**2,0)/20);return[m-2*d,m,m+2*d]});
const rsi=(a,n=14)=>{let g=0,l=0;return a.map((v,i)=>{if(!i)return 50;const d=v-a[i-1];if(i<=n){g+=Math.max(d,0)/n;l+=Math.max(-d,0)/n}else{g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n}return l?100-100/(1+g/l):100})};
const atr=A=>ema(A.map((c,i)=>i?Math.max(c.h-c.l,Math.abs(c.h-A[i-1].c),Math.abs(c.l-A[i-1].c)):c.h-c.l),14);
function pre(a,h){const cl=a.map(x=>x.c),e12=ema(cl,12),e26=ema(cl,26),md=e12.map((v,k)=>v-e26[k]),sg=ema(md,9),hc=h.map(x=>x.c);const B=bb(cl),bw=B.map(b=>b?(b[2]-b[0])/b[1]:1),bwp=bw.map((v,q)=>{if(q<40)return .5;let n=0,m=0;for(let z=Math.max(0,q-100);z<q;z++){m++;if(bw[z]<v)n++}return n/m});return{lo20:a.map((_,q)=>q<20?0:Math.min(...a.slice(q-20,q).map(x=>x.l))),bl:B.map(b=>b?b[0]:0),bm:B.map(b=>b?b[1]:1e9),bu:B.map(b=>b?b[2]:1e9),bwp,ad:adx(a),hi20:a.map((_,q)=>q<20?1e9:Math.max(...a.slice(q-20,q).map(x=>x.h))),cl,e9:ema(cl,9),e21:ema(cl,21),r:rsi(cl),at:atr(a),hg:md.map((v,k)=>v-sg[k]),h20:ema(hc,20),h50:ema(hc,50),ht:h.map(x=>x.t)}}
const adx=(A,n=14)=>{const o=A.map(()=>0);let tr=0,pd=0,md=0,dx=[],ax=0;
for(let i=1;i<A.length;i++){const u=A[i].h-A[i-1].h,d=A[i-1].l-A[i].l,t=Math.max(A[i].h-A[i].l,Math.abs(A[i].h-A[i-1].c),Math.abs(A[i].l-A[i-1].c)),p=u>d&&u>0?u:0,m=d>u&&d>0?d:0;
if(i<=n){tr+=t;pd+=p;md+=m}else{tr+=t-tr/n;pd+=p-pd/n;md+=m-md/n}
if(i<n)continue;const pi=tr?100*pd/tr:0,mi=tr?100*md/tr:0,x=pi+mi?100*Math.abs(pi-mi)/(pi+mi):0;dx.push(x);ax=dx.length<=n?dx.reduce((s,v)=>s+v)/dx.length:(ax*(n-1)+x)/n;o[i]=dx.length>=n?ax:0}return o};
let SHORT=true,GATE=1.5;
const cg=(P,i,px,rt)=>P.at[i]/px*300>=GATE*rt,sq=(P,i)=>{for(let q=i;q>i-8&&q>=0;q--)if(P.bwp[q]<.2)return 1;return 0},al=(P,j,d)=>P.h20[j]*d>P.h50[j]*d,
fav=(p,h,l)=>p.d>0?Math.max(p.hi,h):Math.min(p.hi,l),val=(p,x)=>Math.max(0,p.d>0?x/p.e:2-x/p.e),hit=(p,h,l)=>p.d>0?l<=p.stop:h>=p.stop,
trail=(p,rt)=>{const d=p.d;p.stop=d>0?Math.max(p.stop,p.hi-p.tm*p.at):Math.min(p.stop,p.hi+p.tm*p.at);if((p.hi-p.e)*d>=1.5*p.at)p.stop=d>0?Math.max(p.stop,p.e*(1+rt/100)):Math.min(p.stop,p.e*(1-rt/100))};
const SG={
trend:{nm:'Trend Following',sm:1.5,tm:2,ent:(P,i,j,px,rt,d)=>al(P,j,d)&&P.e9[i]*d>P.e21[i]*d&&P.cl[i]*d>P.e21[i]*d&&px*d>P.e21[i]*d&&(d>0?P.r[i]>50&&P.r[i]<70:P.r[i]<50&&P.r[i]>30)&&P.hg[i]*d>0&&cg(P,i,px,rt),
 ex:(P,i,d)=>P.e9[i]*d<P.e21[i]*d&&P.cl[i]*d<P.e21[i]*d?'Trend reversed (EMA 9 crossed EMA 21)':(d>0?P.r[i]>82:P.r[i]<18)?'RSI extreme':null},
breakout:{nm:'Momentum Breakout',sm:1.5,tm:2.5,ent:(P,i,j,px,rt,d)=>(d>0?P.cl[i]>P.hi20[i]&&P.r[i]<75:P.cl[i]<P.lo20[i]&&P.r[i]>25)&&P.hg[i]*d>0&&al(P,j,d)&&cg(P,i,px,rt),
 ex:(P,i,d)=>P.cl[i]*d<P.e21[i]*d?'Momentum lost (EMA 21)':(d>0?P.r[i]>85:P.r[i]<15)?'RSI extreme':null},
meanrev:{nm:'Mean Reversion (range)',sm:1.2,tm:99,ent:(P,i,j,px,rt,d)=>d>0?P.cl[i]<P.bl[i]&&P.r[i]<32&&(P.bm[i]-px)/px*100>=GATE*rt:P.cl[i]>P.bu[i]&&P.r[i]>68&&(px-P.bm[i])/px*100>=GATE*rt,
 ex:(P,i,d)=>P.cl[i]*d>=P.bm[i]*d?'Target reached (Bollinger midline)':(d>0?P.r[i]>60:P.r[i]<40)?'RSI recovered':null},
squeeze:{nm:'Volatility Squeeze',sm:1.5,tm:2,ent:(P,i,j,px,rt,d)=>(d>0?P.cl[i]>P.bu[i]:P.cl[i]<P.bl[i])&&P.hg[i]*d>0&&cg(P,i,px,rt),
 ex:(P,i,d)=>P.cl[i]*d<P.bm[i]*d?'Back through Bollinger midline':null}};
function pick(P,i,j){const ad=P.ad[i];if(ad>=25)return'trend';if(sq(P,i))return'squeeze';if(ad>=18)return'breakout';if(ad<20)return'meanrev';return null}
const dirs=(K,P,j)=>{const r=K=='meanrev'||K=='squeeze'?[1,-1]:[P.h20[j]>P.h50[j]?1:-1];return SHORT?r:r.filter(d=>d>0)},
tryEnt=(K,P,i,j,px,rt)=>{if(!K)return 0;for(const d of dirs(K,P,j))if(SG[K].ent(P,i,j,px,rt,d))return d;return 0};

// ===================== engine (server-side, deterministic, closed-candle based) =====================
// Mirrors run() in public/index.html: decisions use the last closed bar (15m with 1h trend, or 1h with 4h trend, see cfg.tf), entries fill at the next bar open,
// stops are checked against each bar's high/low (also on the entry bar). Costs: fee per side + 0.02% slippage.
let BAR=9e5,CTX=36e5;const DEF={fee:.25,tf:'15m',mode:'auto',short:true,gate:1.5};
function setCfg(c){SHORT=!!c.short;GATE=+c.gate;BAR=c.tf=='1h'?36e5:9e5;CTX=c.tf=='1h'?144e5:36e5;if(c.trend){SG.trend.sm=c.trend.sm;SG.trend.tm=c.trend.tm}}
const jFor=(P,t)=>{let j=0;while(j<P.ht.length-1&&P.ht[j+1]+CTX<=t)j++;return j};
const newState=(cfg,now)=>({v:1,startedAt:now,P0:null,eq:1e3,pos:null,cdT:0,lastT:null,trades:[],curve:[],notes:[],cfg,cfgLog:[],run:{}});
function closeTrade(S,x,why,t,c){const p=S.pos,v=S.eq*val(p,x),f=v*c,pl=(v-f)/p.eq0-1;S.eq=v-f;
S.trades.push({n:S.trades.length+1,dir:p.d>0?'long':'short',style:SG[p.k].nm,tOpen:p.t,tClose:t,entry:p.e,exit:x,pl:pl*100,fee:p.fee+f,why,src:p.src});
S.pos=null;S.cdT=t+(pl<0?2:1)*BAR;return pl}
function stepBar(S,A,P,k,cfg,src){const c=(cfg.fee+.02)/100,rt=2*(cfg.fee+.02),i=k-1,o=A[k].o,t=A[k].t,j=jFor(P,t);
if(S.pos){const p=S.pos,w=SG[p.k].ex(P,i,p.d);let x=null,why=w;
if(w)x=o;else if(hit(p,A[k].h,A[k].l)){x=p.d>0?Math.min(o,p.stop):Math.max(o,p.stop);why=(p.stop-p.e)*p.d>=0?'Trailing stop (profit locked in)':'Stop-loss hit'}
if(x!=null)closeTrade(S,x,why,t,c);else{p.hi=fav(p,A[k].h,A[k].l);trail(p,rt)}}
else if(t>=S.cdT){const K=cfg.mode=='auto'?pick(P,i,j):cfg.mode,d=tryEnt(K,P,i,j,o,rt);
if(d){const q=SG[K],f=S.eq*c;S.pos={e:o,eq0:S.eq,hi:o,at:P.at[i],stop:o-d*q.sm*P.at[i],k:K,tm:q.tm,d,t,fee:f,src};S.eq-=f;
if(hit(S.pos,A[k].h,A[k].l))closeTrade(S,S.pos.d>0?Math.min(o,S.pos.stop):Math.max(o,S.pos.stop),'Stop-loss hit',t,c)}}
const m=S.pos?S.eq*val(S.pos,A[k].c)*(1-c):S.eq;S.curve.push([t+BAR,+m.toFixed(2)]);if(S.curve.length>2e4)S.curve.shift()}
// Process all newly closed 15m bars. A = 15m candles (may include the forming one), H = 1h candles.
function processBars(S,A,H,now,cfg,src){setCfg(cfg);const cl=A.filter(x=>x.t+BAR<=now);if(cl.length<120)throw new Error('too few candles: '+cl.length);
const L=cl[cl.length-1];if(S.lastT==null){S.lastT=L.t;S.P0=L.c;S.startedAt=now;S.curve.push([L.t+BAR,S.eq]);return{bars:0,init:true,gap:0}}
let first=cl.findIndex(x=>x.t>S.lastT);if(first<0)return{bars:0,gap:0};
let gap=Math.max(0,Math.round((cl[first].t-S.lastT)/BAR)-1);if(first<80){gap+=80-first;first=80}
const P=pre(cl,H);let n=0;for(let k=first;k<cl.length;k++){stepBar(S,cl,P,k,cfg,src);n++}S.lastT=L.t;return{bars:n,gap}}
const equityNow=(S,px,cfg)=>S.pos?S.eq*val(S.pos,px)*(1-(cfg.fee+.02)/100):S.eq;
function metrics(S,px,cfg){const T=S.trades,w=T.filter(x=>x.pl>0),gw=w.reduce((a,x)=>a+x.pl,0),gl=-T.filter(x=>x.pl<=0).reduce((a,x)=>a+x.pl,0);
let pk=0,dd=0;S.curve.forEach(([,v])=>{pk=Math.max(pk,v);dd=Math.max(dd,(pk-v)/pk*100)});const e=equityNow(S,px,cfg);
return{equity:+e.toFixed(2),ret:(e/1e3-1)*100,bh:S.P0?(px/S.P0-1)*100:0,n:T.length,win:T.length?w.length/T.length*100:0,pf:gl?gw/gl:(gw?99:0),avg:T.length?T.reduce((a,x)=>a+x.pl,0)/T.length:0,dd,fees:T.reduce((a,x)=>a+x.fee,0)+(S.pos?S.pos.fee:0),days:(Date.now()-S.startedAt)/864e5}}
const XT={trend:'the trend reverses or RSI becomes extreme',breakout:'price moves back through EMA 21 or RSI becomes extreme',meanrev:'the Bollinger midline is reached or RSI recovers',squeeze:'price moves back through the Bollinger midline'};
function statusNote(S,A,H,cfg,now){setCfg(cfg);const cl=A.filter(x=>x.t+BAR<=now),P=pre(cl,H),i=cl.length-1,j=jFor(P,now),px=A[A.length-1].c,up=P.h20[j]>P.h50[j],K=cfg.mode=='auto'?pick(P,i,j):cfg.mode,rt=2*(cfg.fee+.02),
head=`BTC $${px.toFixed(0)} | 1h trend ${up?'up':'down'} | ADX ${P.ad[i].toFixed(0)} | RSI ${P.r[i].toFixed(0)} | ATR ${(P.at[i]/px*100).toFixed(2)}%`;
if(S.pos){const p=S.pos,pl=(equityNow(S,px,cfg)/S.eq*1-1)*100;return`HOLDING ${p.d>0?'LONG':'SHORT'} (${SG[p.k].nm}) since ${new Date(p.t).toISOString().slice(0,16)}Z, entry $${p.e.toFixed(0)}, stop $${p.stop.toFixed(0)}. Exits when ${XT[p.k]}. | ${head}`}
let why=!K?'no clear market regime':now<S.cdT?'cooldown after the last trade':`active style ${SG[K].nm}, waiting for its setup`+(K!='meanrev'&&!cg(P,i,px,rt)?` (expected move too small versus ${rt.toFixed(2)}% round-trip cost)`:'');
return`WAITING: ${why}. | ${head}`}
module.exports={DEF,newState,processBars,metrics,statusNote,equityNow,setCfg,closeTrade,pre,SG,pick,tryEnt,stepBar};
