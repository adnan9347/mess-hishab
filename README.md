# মেস হিসাব · Mess Hishab

Meal and bazar accounting for student messes in Bangladesh. Members tap the meals they eat; the app works out the
meal rate, each person's share and a month-end settlement of who pays whom — replacing the manager's notebook.

- **Stack:** HTML, CSS, Bootstrap 5.3 (components), Tailwind CSS 3.4 (`tw-` utilities), vanilla JavaScript (ES modules, OOP)
- **Backend:** Firebase Authentication + Cloud Firestore on the free Spark plan (no Cloud Functions, no Storage)
- **Languages:** বাংলা (default) and English, with Bangla digits, dates and times
- **Look:** light theme only — white surfaces, a pure blue gradient, single-colour (blue/white) icons
- **Font:** [Anek Bangla](https://fonts.google.com/specimen/Anek+Bangla) everywhere — Bangla, English, both digit sets and ৳ (Google Fonts, SIL Open Font License)
- **PWA:** installable, offline app shell, Firestore offline cache for data
- **Retention:** every user's calculation data is kept for **at least 30 days** (configurable 30/60/90)

## Run it locally (demo mode)

Demo mode needs no Firebase project: accounts and data live in your browser's localStorage.

```bash
npm install
npm run dev
```

Open <http://localhost:5173> and tap **ডেমো মেস দেখে নিন / Try the demo mess**, or log in with
`demo@messhishab.app` / `demo1234`. The demo account manages "Green House Mess" with 8 members, this month's data up
to today, a closed previous month and 30 days of daily snapshots. **Settings → Reset demo mess** rebuilds it.

Other scripts:

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` (used by Vercel) |
| `npm run build:css` | Builds `css/tailwind.css` from the classes used in `index.html` and `js/` |
| `npm run watch:css` | Rebuilds Tailwind on change |
| `npm run serve` | Static server only (no CSS build) |
| `npm test` | Unit tests for the calculator, settlement, retention, cutoffs, dates and both translations |

## Connect Firebase

1. Create a project in the [Firebase console](https://console.firebase.google.com) (Spark plan is enough).
2. **Authentication → Sign-in method:** enable **Email/Password** and **Google**. Add your domain under *Authorized domains*.
3. **Firestore Database:** create a database (production mode).
4. **Project settings → Your apps → Web app:** copy the config into `FIREBASE_CONFIG` in [`js/config.js`](js/config.js).
   While `apiKey` is empty the app stays in demo mode; `?demo=1` forces demo mode even when configured.
5. Deploy rules and indexes (needs the [Firebase CLI](https://firebase.google.com/docs/cli)):

```bash
npx firebase-tools login
```

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
```

### Turn on automatic deletion (TTL) — keeps data ≥ 30 days, then cleans up

Every calculation document carries an `expireAt` timestamp that is always **≥ 30 days** in the future
(`snapshots`: created + 30 days; `results`, closed `months` and their `meals`/`bazar`/`fixedCosts`/`deposits`:
closed + the mess's retention setting). `firestore.indexes.json` declares a TTL policy on `expireAt` for all seven
collection groups, so deploying indexes switches it on. To do it by hand instead: **Firestore → Time-to-live → Create policy**,
collection group `snapshots`, field `expireAt` — repeat for `results`, `months`, `meals`, `bazar`, `fixedCosts`, `deposits`.

Firestore deletes expired documents some time after `expireAt` (usually within a day) — never before, so the 30-day
minimum always holds. If TTL is not enabled, the app falls back to deleting expired documents itself when the
manager opens it (`Repository.cleanupExpired`). Security rules refuse to delete anything whose `expireAt` hasn't passed
and refuse any retention below 30 days.

### Deploy the site

It's a static site. Either Firebase Hosting (free on Spark):

```bash
npx firebase-tools deploy --only hosting --project YOUR_PROJECT_ID
```

…or Vercel: `vercel.json` runs `npm run build`, which compiles Tailwind and copies the site into `dist/`.

### Free-tier limits that matter

Spark plan: 50k document reads, 20k writes and 20k deletes per day, 1 GiB stored. A 15-person mess uses a few hundred
writes a day. Reads are kept low by listening only to the current month and loading 30 snapshots on demand.

## How it works

```
js/
├── domain/            Pure business logic — no DOM, fully unit-tested
│   ├── Money.js              parse "৳১,২৫০" / "1250 tk", format with locale digits
│   ├── MealEntry.js          immutable day entry + MealCutoffPolicy
│   ├── HishabCalculator.js   meal rate, balances, fund, projection (+ MemberSummary)
│   ├── SettlementStrategy.js Strategy pattern: GreedySettlementStrategy, roundPreservingSum
│   └── RetentionPolicy.js    the ≥ 30-day rule
├── data/              Repository pattern
│   ├── Repository.js         abstract interface
│   ├── LocalRepository.js    demo mode (localStorage, multi-tab sync)
│   ├── FirestoreRepository.js Firebase mode (offline cache, batched month close)
│   └── DemoSeeder.js         realistic sample mess
├── auth/              AuthService → DemoAuthService / FirebaseAuthService, AuthError
├── core/              I18n, Router, DhakaDate, SafeStorage, util
├── ui/                View base class, components (AmountKeypad, ring…), StatementExporter, views/
├── i18n/              bn.js, en.js
└── App.js             services, state, route guards, shell, toasts, dialogs
```

**The maths** (`HishabCalculator`):

```
meal rate     = total bazar ÷ total meals          (breakfast can count as ½ — Settings)
member cost   = member meals × meal rate + fixed costs ÷ active members
paid          = confirmed deposits + bazar the member paid from their own pocket
balance       = paid − member cost                  (positive = gets money back)
settlement    = greedy matching, ≤ n−1 transfers, whole taka, totals exact
```

Deposits go to the manager, who holds the fund; at settlement the fund's cash is folded into the manager's balance so
every transfer is person-to-person.

**OOP where it earns its place:** the Repository and AuthService interfaces let every screen run unchanged against
localStorage or Firebase; the Strategy pattern isolates the settlement algorithm; value objects (`MealEntry`,
`MemberSummary`, `RetentionPolicy`) are immutable and validate themselves; every screen extends `View`
(render → bind → onDataChange → destroy). Plain functions are used where a class would add nothing (formatters, helpers).

## Not done yet / known limits

- Security rules are written but have not been run against the Firebase Emulator (it needs Java). Run
  `npx firebase-tools emulators:start` and exercise the app with `?demo` off before going live.
- Firebase mode has not been tested against a live project from here — demo mode was verified end-to-end in the browser.
- Meal cutoff times are enforced in the app; the rules enforce "own meals only, open month only".
- No real bKash/Nagad API: members record the TrxID and the manager confirms it.

See [docs/ux-laws.md](docs/ux-laws.md) for how each UX law shaped the UI and [docs/inspiration.md](docs/inspiration.md)
for design references.
