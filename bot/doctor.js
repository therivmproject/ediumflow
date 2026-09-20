'use strict';
// Preflight check: `npm run doctor`. Validates bot/config.json, tests every data source from this machine and
// shows what the bot would say right now. Saves nothing and sends nothing.
const fs=require('fs'),path=require('path'),E=require('./engine'),R=require('./run');
(async()=>{let bad=0;const ok=t=>console.log('  OK   '+t),no=t=>{bad++;console.log('  FAIL '+t)};
console.log('1. Config (bot/config.json)');let cfg;
try{cfg={...E.DEF,...JSON.parse(fs.readFileSync(path.join(__dirname,'config.json'),'utf8'))}}catch(e){no('cannot read config: '+e.message);process.exit(1)}
const errs=R.validateCfg(cfg);errs.length?errs.forEach(no):ok(`${cfg.costs===false?'COSTS IGNORED (no fees, no slippage)':'fee '+cfg.fee+'% per side'}, timeframe ${cfg.tf}, mode ${cfg.mode}, shorts ${cfg.short?'on':'off'}, cost filter ${cfg.gate}x`);
if(cfg.costs!==false&&cfg.fee<.2)console.log('  note the fee is very low for Coinbase spot. Check your fee tier.');
console.log('2. Data sources (candles)');const h1=cfg.tf=='1h',now=Date.now();let up=0;
for(const s of R.SRC.filter(s=>s.cand)){const t0=Date.now();try{const a=await R.pageC(s,h1?'1h':'15m',(h1?3600:900)*720),last=a[a.length-1],age=Math.round((now-last.t)/6e4);
age>(h1?150:60)?no(`${s.n}: stale, last bar ${age} min old`):(up++,ok(`${s.n}: ${a.length} bars, ${Date.now()-t0} ms, last bar ${age} min old`))}catch(e){no(`${s.n}: ${e.message}`)}}
if(!up)console.log('  no source works from here. Check your internet, VPN or firewall.');else if(up<2)console.log('  only one source works, so there is no fallback if it goes down.');
console.log('3. What the bot sees right now');
try{const{A,H,src}=await R.fetchWindow(now,cfg);ok('data from '+src);console.log('  '+E.statusNote(E.newState(cfg,now),A,H,cfg,now))}catch(e){no(e.message)}
console.log('4. Optional alerts');console.log('  NTFY_TOPIC '+(process.env.NTFY_TOPIC?'set':'not set')+', HEALTHCHECK_URL '+(process.env.HEALTHCHECK_URL?'set':'not set')+' (these are GitHub secrets on the server)');
console.log(bad?'\nResult: '+bad+' problem(s) found.':'\nResult: all checks passed.');process.exit(bad?1:0)})();
