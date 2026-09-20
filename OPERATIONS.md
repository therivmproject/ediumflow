# Operations guide

For running the Edium server bot for weeks. Everything here is free.

## What "24/7" means here

GitHub Actions starts the bot every 5 minutes. GitHub's scheduler is best effort: expect delays of 5 to 30 minutes and now and then a skipped run. The bot processes every closed candle in order, so this changes when a trade is recorded, not the result. It is not real-time execution: it is a paper trial on candle data.

## One-time setup

1. Follow the setup steps in README.md (public repository, Pages source = GitHub Actions, workflow permissions = read and write, upload, first run).
2. Run `npm run doctor` on your computer before the first run. It checks the config, tests each data source and shows what the bot would say now. (It cannot test GitHub's servers themselves; the first run in the Actions tab does that.)
3. Optional but recommended: set up the two alerts below.

## Alert 1: dead-man switch (Healthchecks.io, free)

Detects the silent failures: schedule skipped for hours, workflow disabled, GitHub outage.

1. Create a free account on healthchecks.io and add a check named "Edium bot". Period: 10 minutes. Grace time: 1 hour (GitHub delays runs). Add your email (or another integration) as notification.
2. Copy the ping URL of the check.
3. In your repository: Settings > Secrets and variables > Actions > New repository secret. Name: `HEALTHCHECK_URL`. Value: the ping URL.

The bot pings after every run and pings `/fail` when it could not get market data. Treat the ping URL as a secret.

## Alert 2: trade and error notifications (ntfy, free)

1. Install the ntfy app (or open ntfy.sh in a browser) and subscribe to a topic with a long random name, for example `edium-7f3k9x2q8m4v`. Anyone who knows the topic name can read it, so do not use a guessable name.
2. Add a repository secret `NTFY_TOPIC` with that topic name.

You get SIGNAL messages (open long or short with stop-loss, move stop, close now), RESULT messages when a paper trade closes, and messages when the account starts, after 3 failed runs in a row, and when data is back. Signals are sent at the start of a candle, so with the default 1-hour timeframe you have most of an hour to act, minus the delay of GitHub's scheduler (5 to 30 minutes).

## Copying the signals manually

The bot never sends orders. It tells you what it would do, and you copy it on your own exchange.

1. Open `track.html`, section ACTION NOW, or read the ntfy messages. Enter your account size and risk per trade to get a position size (capped at 100% of your account, no leverage).
2. **SIGNAL OPEN LONG/SHORT**: open the position at market (or a limit close to the price) and immediately place the stop-loss at the stated level. If the message says the price already ran away, skip this trade.
3. **SIGNAL MOVE STOP**: move your stop-loss to the new level. The bot trails its stop after each candle.
4. **SIGNAL CLOSE**: close the position at market.
5. **SIGNAL STOP LEVEL touched**: check whether your stop order filled. The bot confirms with a RESULT message.
6. Shorts need a venue that supports them (futures, perpetuals or margin). On spot you can only copy longs; then set `"short": false` in `bot/config.json` before you start.

What to expect: your fills differ from the paper fills (delay, spread, slippage, stop-limit orders that do not fill in fast markets). The paper account uses 100% of equity per trade and models a 0.02% slippage plus your fee; funding and borrow costs of shorts are not modeled. Keep a note of your real fills for the first weeks and compare them with the paper results.

## Pure signal mode (no costs)

Set `"costs": false` in `bot/config.json` to ignore fees and slippage. The bot then trades every valid signal and the cost filter is inactive. Use it to see how good the signals are on their own. Do not use its results to expect real profit: on synthetic test data the same strategy turned a large gain into a large loss once realistic costs were applied. Start a new trial when you switch (delete the `data` branch) so the two regimes do not mix in one record.

## Routine

- Daily, 1 minute: open `track.html`. The top line should say RUNNING with a last run of less than 30 minutes ago.
- Weekly: download the CSV from the track record page.
- Monthly: open Actions > Edium bot and check that runs are still appearing. The workflow makes an empty keepalive commit if the repository is quiet for 40 days, because GitHub disables schedules after 60 days without commits.

## Something is wrong

If ACTION NOW shows a plan older than about 1.5 hours, do not act on it: check the bot status first.


| What you see | What to do |
|---|---|
| DELAYED or STOPPED? on the track record | Actions tab > Edium bot. If runs are missing, click Run workflow. If the workflow says "disabled", click Enable |
| Red run "Cannot reach GitHub" | Transient. The bot stops without touching the state and tries again in 5 minutes |
| Red run "Invalid bot/config.json" | Fix the value named in the log and commit |
| Red run "Timeframe changed" | You changed `tf`. Change it back, or delete the `data` branch to start a new trial |
| "no market data for 3 runs" | Exchange outage or blocked region. The next runs retry automatically |
| DATA GAP note | The bot was not running for a while. Candles older than about 7 days (15m) or 30 days (1h) cannot be recovered |
| State looks wrong | Restore a backup, see below |

## Restore a backup

The `data` branch contains `backups/state-YYYY-MM-DD.json.gz` (last 14 days). Download the file, unzip it to `state.json`, then on GitHub open the `data` branch, Add file > Upload files, and upload it as `state.json`. The next run continues from it (candles since that day are processed again in order).

## Change settings during the trial

Edit `bot/config.json` and commit. Changes are logged on the track record page and apply to new candles only. A change of `tf` requires a new trial. For a clean comparison, avoid changes.

## Start over / stop

- New trial: Code > branches > delete `data`, then run the workflow.
- Stop: Actions > Edium bot > Disable workflow.

## Limits to keep in mind

- Public repository, so the paper trades are visible to anyone with the link. No keys or personal data are stored.
- Paper results on candle data: real fills, outages and funding costs on shorts will differ.
- Not financial advice.
