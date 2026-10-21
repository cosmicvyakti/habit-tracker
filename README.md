# habit-tracker

A habit tracker with three views: Today, Stats, and Habits.

Every check-in goes into an append-only event log in SQLite, and every view and figure is computed from that log. Built with TanStack Start, Router, Query, and Form, plus plain HTML and SVG for charts. It has no streak resets and no random rewards.

The UI uses the [Lime design system](https://design.how/systems/lime) from design.how, with the layer Spendly puts over it (Spendly's `frontend/DESIGN.md`): Figtree for every word and number, a warm-grey page with white cards, an ink sidebar, and one breakpoint, below which the sidebar becomes a top bar and a full-screen navigation page, and dialogs become sheets from the foot. Lime's components live in `src/components/lime/`, the app's layer is `src/app.css`, and `npm run lint` checks every screen against Lime's rules. The `.claude/skills/lime` skill holds the rules for UI changes. The app follows the system light or dark setting until you choose a theme in the account menu, at the foot of the sidebar.

## Features

- **Today**: the week, Monday first, with a ring on each day for how much of its daily plan was done. Step to the week before or after, or pick a day. Below it, that day's habits: tap a habit's check to check it off. The check draws in, then the habit moves down to Completed. Tap it again to clear it, with Undo. A check on a past day is a backfill, marked approximate.
- **Stats** for a week, month, quarter, or year, kept in the URL: the completion rate and its change from the range before, a chart by day, week, or month, a calendar heat map of daily habits, each habit's rate, status, and longest run, and which weekdays and times of day work best.
- **Habits**: every habit, with its last seven periods. A habit is a name and how often: daily, weekly, monthly, or yearly. Edit or archive it from the same form.
- **Works offline.** Install it from the browser as an app. Check-ins and edits save on the device first and sync when the server answers.
- **One account**, with an email and password. The sidebar shows who is signed in.

Habits made before the redesign keep their cue, place, and consequence, and every past SRBAI check-in, effort, and payoff entry stays in the log. The app no longer asks for them or shows them.

## How the figures are counted

| Figure | How |
| --- | --- |
| Completion rate | Periods done out of periods planned. A period counts once it has ended, or earlier if it is done. A habit counts from its first period, and an archived one stops counting the day it was archived. |
| Which habits a range counts | A habit counts in a range or a bar only if its period fits inside it: a week counts daily and weekly habits, a month and a quarter add monthly habits, and a year counts all four. |
| Perfect day | A day when every daily habit planned was done. |
| Status: on track, missed once, missed twice | Consecutive missed periods before now. One missed opportunity did not materially affect habit formation (Lally et al. 2010); the "never miss twice" wording is from Clear 2018. |
| Usual time, which orders Today | The circular mean of the habit's recorded times over the last 60 days, so 23:30 and 00:30 average to midnight. |
| Time of day | Recorded check-ins by hour: morning 5-12, afternoon 12-17, evening 17-21, night 21-5. Backfills are left out, because their times were reconstructed. |

### References

- Clear, J. (2018). *Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones.* Avery.
- Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W., & Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. *European Journal of Social Psychology, 40*(6), 998-1009.

## Data

The server stores data in SQLite at `data/habits.db`. To use a different file, set `HABITS_DB`. Database triggers reject any update or delete on the `events`, `retractions`, and `check_ins` tables. Only a habit's plan can change.

### Offline and sync

Every change is made in the browser first, with its own ID and the time it happened. It goes into a queue saved on the device, shows at once, and is sent to the server in order (`src/data.ts`). The browser also keeps the last log it got from the server, so the app opens without a connection. A service worker caches the app's files (`public/sw.js`). On a device that has never loaded the log, the app says it couldn't load your habits, and loads them as soon as the connection comes back.

Sending a change twice adds nothing, so the queue can always retry. Check-ins and retractions are only ever added, so two devices never conflict over them. When two devices edit the same habit, the edit made last wins. Archiving keeps the first time.

When the server refuses a change, for example one that fails validation, the app drops it and says so. Signing out deletes everything saved on the device, including changes that haven't synced; the app asks first.

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
npm test           # Vitest: consistency, stats, Today's order, dates, sync
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
