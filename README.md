# habit-tracker

A habit tracker built on the habit research rather than on streaks.

Each habit is a plan in Wood's context, cue, behavior, and consequence form, written as an implementation intention: "After [cue], I will [behavior] at [place]." Every log entry goes into an append-only event log in SQLite. All views and scores are computed from that log.

Built with TanStack Start, Router, Query, Form, and Table, plus plain SVG for charts. It has no streak resets and no random rewards.

The UI uses the [Lime design system](https://design.how/systems/lime) from design.how. Its components live in `src/components/lime/`, and `npm run lint` checks every screen against Lime's rules. The `.claude/skills/lime` skill holds the rules for UI changes. The app follows the system light or dark setting until you choose a theme with the button in the header.

## Features

- **Define a habit** as an implementation intention. Choose daily, weekly, monthly, or yearly.
- **Log in one tap.** Place and cue come from the plan. You can edit them, and add effort (1-5) and whether you noticed the payoff, before you tap.
- **Undo** a mis-tap or retract any entry after confirming. A retraction is a new event, so nothing in the log is ever edited or deleted.
- **Backfill** a past day, week, month, or year from the period row. Backfilled entries are marked approximate.
- **SRBAI check-in** every 14 days per daily or weekly habit. Monthly and yearly habits are measured by consistency only.
- **Insights** for a habit and a date range, both kept in the URL: the automaticity curve, the plateau estimate, consistency, effort and payoff, and context stability.
- **Log** of every raw event, in a sortable table.
- **Works offline.** Install it from the browser as an app. Logs, check-ins, and plan edits save on the device first and sync when the server answers.
- **One account**, with an email and password.

## Where each metric comes from

| Metric or field | Source |
| --- | --- |
| Context (place) of the plan and of each event | Wood & Neal 2007 |
| Cue, and the "After [cue], I will [behavior] at [place]" plan | Gollwitzer 1999 |
| `precededBy`: the cue that came before each event | Wood & Neal 2007 |
| Consequence (expected payoff, optional in the plan) and `payoffNoticed` | Skinner 1938 |
| Event timestamps and the habit's start date (day 0) | Lally et al. 2010 |
| Effort, 1-5, as a proxy for automaticity between check-ins; Insights compares the first 4 weeks of the range with the last 4 | Lally et al. 2010 (a proxy, not a measure from the paper) |
| SRBAI score: the mean of 4 items on a 1-7 scale | Gardner et al. 2012 |
| Curve `A(t) = a - b·e^(-ct)` and the plateau, the day the curve reaches 95% of `a` | Lally et al. 2010 |
| Consistency rate and "never miss twice", which replace the reset-to-zero streak | Lally et al. 2010: one missed opportunity did not materially affect habit formation. The "never miss twice" wording is from Clear 2018 |
| Time-of-day spread (circular standard deviation, in hours) and the share of events after the planned cue | Wood & Neal 2007; Lally et al. 2010 |

The curve and the plateau show once there are at least 5 check-ins over 42 days and the curve explains at least 70% of their variance. Lally et al. reported no plateau for curves that fitted poorly; these thresholds are the app's own. Until then, Insights says it's too early to tell. A plateau after the last check-in is a projection: the curve is dashed there, and Insights gives the month rather than a day. When the scores show no bend yet, the app shows no plateau date instead of a guess. Time-of-day spread and cue share leave out approximate events, because their times and cues were reconstructed rather than recorded.

### References

- Clear, J. (2018). *Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones.* Avery.
- Gardner, B., Abraham, C., Lally, P., & de Bruijn, G.-J. (2012). Towards parsimony in habit measurement: Testing the convergent and predictive validity of an automaticity subscale of the Self-Report Habit Index. *International Journal of Behavioral Nutrition and Physical Activity, 9*, 102.
- Gollwitzer, P. M. (1999). Implementation intentions: Strong effects of simple plans. *American Psychologist, 54*(7), 493-503.
- Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W., & Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. *European Journal of Social Psychology, 40*(6), 998-1009.
- Skinner, B. F. (1938). *The Behavior of Organisms: An Experimental Analysis.* Appleton-Century.
- Wood, W., & Neal, D. T. (2007). A new look at habits and the habit-goal interface. *Psychological Review, 114*(4), 843-863.

## Data

The server stores data in SQLite at `data/habits.db`. To use a different file, set `HABITS_DB`. Database triggers reject any update or delete on the `events`, `retractions`, and `check_ins` tables. Only a habit's plan can change.

### Offline and sync

Every change is made in the browser first, with its own ID and the time it happened. It goes into a queue saved on the device, shows at once, and is sent to the server in order (`src/data.ts`). The browser also keeps the last log it got from the server, so the app opens without a connection. A service worker caches the app's files (`public/sw.js`). On a device that has never loaded the log, the app says it couldn't load your habits, and loads them as soon as the connection comes back.

Sending a change twice adds nothing, so the queue can always retry. Logs, retractions, and check-ins are only ever added, so two devices never conflict over them. When two devices edit the same plan, the edit made last wins. Archiving keeps the first time.

When the server refuses a change, for example one that fails validation, the app drops it and says so. Signing out deletes everything saved on the device, including changes that haven't synced; the app asks first.

### Moving data from the previous version

The previous version kept data in the browser under the `habit-tracker:v1` localStorage key. On first load, the app imports that data automatically when it runs on the same origin, such as the old dev server at `localhost:5173`. The app keeps a copy under `habit-tracker:v1:migrated`. Data from another origin, such as the old GitHub Pages site, doesn't import.

Each done period becomes one event at local noon on the period's first day, marked approximate. Importing the same data twice adds nothing.

## Run it

```bash
npm install
npm run dev        # dev server at http://localhost:5173, without sign-in
npm run build      # build to dist/
npm start          # serve the build at http://localhost:3000
```

`npm run dev` sets `HABITS_AUTH=off`, so there's no sign-in page. Everywhere else, the server needs the account's email and password hash, and refuses every request without them:

```bash
npm run hash-password    # prints the hash for the password you type
HABITS_EMAIL=you@example.com HABITS_PASSWORD_HASH=scrypt:16384:... npm start
```

`npm start` listens on `localhost` only. The service worker runs in production builds only.

## Test

```bash
npm test           # Vitest: SRBAI, curve fit, consistency, stability, migration, sync
npm run typecheck
npm run lint       # Lime design system rules
npm run e2e        # Playwright and axe, against a fresh seeded database, signed in
```

On every push to `main`, CI runs all four.

## Deploying (quicksilver)

The app runs at https://habit.axismundi.dev on [quicksilver](https://github.com/cosmicvyakti/quicksilver), the same way as Thoughts and Spendly: the `Dockerfile` checks and builds the app and runs it on port 8000, `docker-compose.yml` runs it on the server, and `quicksilver.app.toml` is the manifest. The site is public, so the app's own sign-in is what keeps it private.

The database lives on the `habit_data` Docker volume, so it survives every deploy. The app needs no Postgres (`database = false`).

### First deploy

1. Register the app. `qs new` only scaffolds an empty folder, so for this existing repository, do what it does by hand. Use the server from `host` in `~/.config/quicksilver/config.toml` in place of `<host>`:

   ```sh
   ssh <host> 'git init --bare -q /opt/quicksilver/repos/habit.git'
   ssh <host> 'cat > /opt/quicksilver/repos/habit.git/hooks/post-receive && chmod +x /opt/quicksilver/repos/habit.git/hooks/post-receive' \
     < ~/Projects/quicksilver/quicksilver/assets/server/post-receive
   git remote add quicksilver ssh://<host>/opt/quicksilver/repos/habit.git
   ```

   Then add the app to `~/.config/quicksilver/config.toml`, so `qs` commands know it:

   ```toml
   [apps.habit]
   path = "/Users/mananshah/Projects/habit-tracker"
   remote = "ssh://<host>/opt/quicksilver/repos/habit.git"
   subdomain = "habit"
   created = "2026-10-19"
   ```

2. Deploy. The first deploy creates the app's server-side `.env`; until the account is set, every request fails.

   ```sh
   qs deploy habit
   ```

3. Set the account. `qs env set` restarts the app:

   ```sh
   npm run hash-password
   qs env set habit HABITS_EMAIL=you@example.com HABITS_PASSWORD_HASH=scrypt:16384:...
   ```

4. Check that `https://habit.axismundi.dev/api/health` answers `{"ok":true}`, then sign in. `qs logs habit -f` shows the server's log.

Never roll back (`qs rollback`) to a commit from before sign-in existed: that version would serve your habits to anyone. Schema changes add columns and tables only, so the previous version can still read the database.

### Backups

quicksilver backs up Postgres, not this volume. Copy the database off the server on a schedule. The backup is safe while the app runs:

```sh
# On the server, in /opt/quicksilver/apps/habit:
docker compose exec backend node scripts/backup.ts /data/backups/habits-$(date +%F).db
docker compose cp backend:/data/backups/habits-$(date +%F).db ~/habit-backups/
```

### Deploying on green

`.github/workflows/deploy.yml` deploys `main` once CI passes on it: it makes the same push `qs deploy` makes, to the server's `quicksilver` remote, then waits for `/api/health` to answer. It stays off until these are set up:

1. Make a key for GitHub alone: `ssh-keygen -t ed25519 -N '' -C habit-deploy -f habit-deploy`.
2. On the server, add `habit-deploy.pub` to `/root/.ssh/authorized_keys`, limited to pushing this one repository:

   ```text
   restrict,command="if [ \"$SSH_ORIGINAL_COMMAND\" = \"git-receive-pack '/opt/quicksilver/repos/habit.git'\" ]; then exec git-receive-pack /opt/quicksilver/repos/habit.git; else echo refused >&2; exit 1; fi" ssh-ed25519 AAAA... habit-deploy
   ```

3. In the repository's settings, under **Secrets and variables > Actions**, add three secrets:
   - `QUICKSILVER_SSH_KEY`: the private key file, `habit-deploy`.
   - `QUICKSILVER_REMOTE`: the remote's URL, from `git remote get-url quicksilver`.
   - `QUICKSILVER_KNOWN_HOSTS`: the server's line from your own `~/.ssh/known_hosts` (`ssh-keygen -F <host>`), not a fresh `ssh-keyscan`.
4. Run `qs deploy` once from a `main` equal to `origin/main`. The workflow only fast-forwards the server's `main`, so the server must hold GitHub's history. After that, deploy only commits already on GitHub.
5. Add the variable `DEPLOY_ENABLED` with the value `true`. Unset it to pause deploys.
