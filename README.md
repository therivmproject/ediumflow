# Edium Flow

BTC/USD paper trading, in two parts. Everything runs on free tools (GitHub repository, GitHub Actions, GitHub Pages). No servers, no API keys, no paid plans.

| Part | What it is | Where it runs |
|---|---|---|
| **Lab** (`public/index.html`) | Live chart, settings, backtest with 70/30 validation, browser paper account | Your browser, only while the page is open |
| **Server bot** (`bot/`, workflow `bot.yml`) | The same strategy code, run every 5 minutes on GitHub's servers, also when your computer is off | GitHub Actions |
| **Track record** (`public/track.html`) | Read-only dashboard of the server bot: equity curve, trades, commentary, health | Your browser (reads the state file) |

The server bot is the authoritative trial. The Lab is for choosing settings.

## Copying the signals

The bot does everything except send orders. `track.html` shows ACTION NOW (open long or short with stop-loss, move stop, close now, or wait) with a position size helper, and ntfy sends the same signals to your phone. The signal is computed with the exact decision logic that the paper account applies when the candle closes; `npm test` verifies that. See `OPERATIONS.md` for the copy checklist and what to expect from real fills.

## Landing page overview

The overview bar on the landing page (`index.html`) has a POSITION cell: WAITING, LONG or SHORT, with entry, stop and result. When the server bot's state is reachable (public repository, GitHub Pages address, or `index.html?repo=OWNER/REPO`) the whole bar shows the server bot; otherwise it shows the paper bot running in your browser and says so.

## How the server bot works

- Every run it loads `state.json` from the `data` branch, downloads recent 15m and 1h candles (Coinbase Advanced, Coinbase Exchange, Bitstamp, Bitfinex, Kraken; first working source wins), evaluates every **newly closed** candle of the chosen timeframe in order, and saves the state again (one force-pushed commit, so no history bloat).
- Decisions use the last closed candle (15m entries with a 1h trend filter, or 1h entries with a 4h trend filter), entries fill at the next candle open, stops are checked against each candle's high and low (also on the entry candle), costs are fee per side plus 0.02% slippage. This is the same logic as the backtest. `bot/selftest.js` checks that results do not depend on how often or how late the bot runs.
- GitHub's scheduler is best effort: runs can be 5 to 30 minutes late or skipped. Because candles are processed in order, late runs change when trades are *recorded*, not the results. If the bot is down for more than about 7 days, missed candles cannot be recovered and a "DATA GAP" note is written.
- State is loaded safely: if GitHub cannot be reached the run stops instead of starting a new trial, and daily gzip backups (14 days) are kept on the `data` branch.
- Optional alerts: Healthchecks.io dead-man switch and ntfy push messages (see `OPERATIONS.md`).
- A keepalive step makes an empty commit if the repository has been quiet for 40 days, because GitHub disables scheduled workflows after 60 days without commits.

## Project structure

```
edium-flow/
├── public/
│   ├── index.html            # Lab
│   └── track.html            # Track record dashboard
├── bot/
│   ├── engine.js             # strategy + paper account (pure logic)
│   ├── run.js                # one bot run: fetch, process, save
│   ├── config.json           # fee, strategy, shorts, cost filter
│   ├── doctor.js             # preflight check (npm run doctor)
│   └── selftest.js           # offline tests (npm test)
├── .github/workflows/
│   ├── bot.yml               # runs the bot every 5 minutes
│   └── pages.yml             # publishes public/ on GitHub Pages
├── netlify.toml  vercel.json  render.yaml   # optional static hosting of public/
├── package.json  package-lock.json  .gitignore
├── OPERATIONS.md             # runbook: alerts, routine, incidents, backups
└── README.md
```

## Setup (about 20 minutes)

1. Use a **public** repository (free unlimited Actions minutes and free Pages). It only contains code and paper trades, no keys.
2. Settings > Pages > Source: **GitHub Actions**.
3. Settings > Actions > General > Workflow permissions: **Read and write permissions** (needed to save the state branch).
4. Upload the contents of this folder to the repository (including the hidden `.github` folder) and commit to the default branch. If the default branch is `master`, change `branches: [main]` in `pages.yml`.
5. `bot/config.json` is already set for Coinbase Advanced (see below). Check the fee tier of your own account and edit the file if it differs, before the first run.
6. Actions tab > **Edium bot** > Run workflow. The first run starts the account at $1,000 and records the start price.
7. Open `https://OWNER.github.io/REPO/track.html`.
8. Set up the two free alerts and read the routine in `OPERATIONS.md` before you leave the bot running.

## Settings (`bot/config.json`)

- `fee`: percent per side of the exchange you would really use. Default 0.40 = Coinbase Advanced taker fee at the 'Advanced 1' tier (30-day volume of about $10K to $50K, which an active bot on a $1,000 account reaches within days). Lower tiers cost more (roughly 0.60% to 1.20% under $10K), so check your own tier on Coinbase. Slippage of 0.02% is added.
- `costs`: `true` (default) charges the fee and 0.02% slippage on every trade. `false` ignores all costs: a pure signal test that judges the strategy on data, charts and indicators only, and the cost filter switches itself off. Results without costs cannot be achieved in real trading (the track record page shows a warning). Switching `costs` changes the character of the trial, so start a new trial (delete the `data` branch) instead of mixing both in one record.
- `tf`: `1h` (1-hour entries, 4-hour trend filter, default) or `15m` (15-minute entries, 1-hour trend filter). At Coinbase fees a 15-minute strategy rarely clears its costs, so `1h` is the default. Changing `tf` requires a new trial (the bot refuses to mix timeframes).
- `mode`: `auto` (regime based) or `trend`, `breakout`, `meanrev`, `squeeze`.
- `short`: `true` by default, because the signals are meant to be copied on a venue that can short (futures, perpetuals or margin). Set `false` if you can only trade spot. Funding and borrow costs of shorts are not modeled.
- `gate`: cost filter, expected move must be at least this many times the round-trip cost (2 strict, 1.5 balanced, 1 loose).

Verify them with the backtest in the Lab (Settings > Backtest timeframe), then leave them alone. Every change is logged on the track record page and only applies to new candles.

## Judging the trial

- Wait for at least 100 closed trades and several market phases (up, down, sideways). That normally takes weeks.
- Compare net return with buy and hold, and look at profit factor, average result per trade, max drawdown and fees.
- Do not change settings during the trial. If you do, start a new trial: delete the `data` branch (Code > branches) and run the workflow again.

## Limits

- Paper results on candle data. Real fills (order book, partial fills, outages, funding costs on shorts) will differ.
- Max drawdown is measured on candle closes.
- The bot cannot fix a market where costs are larger than the edge. At 0.60% per side, 15-minute trading is not viable.
- Not financial advice.

## Local commands

```bash
npm install
npm test                 # offline self-test
npm run doctor           # preflight: config, data sources, current bot view
STATE_FILE=/tmp/state.json npm run bot   # one real run against the exchanges
npm start                # serve public/ on http://localhost:3000
```

## Troubleshooting

- Track record says "Cannot load": the repository must be public and the bot must have run once (branch `data` must exist).
- "STOPPED?" or "DELAYED": look at the Actions tab. Scheduled runs disappear during GitHub load, and are disabled after 60 days of inactivity (re-enable under Actions > Edium bot).
- A failed run sends an email if GitHub notifications for Actions are on. The error is also shown on the track record page.
- If all sources fail: exchange outage or blocked region. The next run retries automatically.
