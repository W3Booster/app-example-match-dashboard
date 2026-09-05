# Match Notebook

A focused W3Booster example: reusable 1v1 preparation by **your race → opponent race → map**. Keep a game plan, scouting cues, responses and lessons together. This is intentionally **application-only**: writing and reviewing plans belongs in a proper window, not over the game.

[Try the demo](https://w3booster.github.io/app-example-match-dashboard/) · [Developer docs](https://website.w3booster.com/developer/) · [All examples](https://website.w3booster.com/developer/examples/)

The repository URL remains `app-example-match-dashboard` so existing links and installations survive the workflow redesign.

## Run in one minute

Node.js 22.22.3 or newer. Demo mode needs no account, Warcraft III, desktop client, or database.

```sh
git clone https://github.com/W3Booster/app-example-match-dashboard.git
cd app-example-match-dashboard
npm ci
npm run dev
```

Open **http://localhost:5173/**. Expect **DEMO DATA** and **Connected · synchronized**. Edit **[src/notebook.ts](src/notebook.ts)** and watch the UI reload. Startup and teardown are in **[src/main.ts](src/main.ts)**; appearance is in **[src/notebook.css](src/notebook.css)**.

## Try the actual workflow

1. Choose **New matchup plan**, even without a running match. Set your race and the opponent's race; leave the map blank for **Any map** advice.
2. Write a **Game plan**, **Scouting cues**, **Responses**, **Mistakes to avoid**, and optional **Free-form notes**. Changes save as you type.
3. Start the demo match: relevant plans appear above the library, map-specific first and general advice next. **New plan for this matchup** prefills the races and map but never creates notes automatically.
4. **Attach current match** to a matching plan. Add a takeaway after the game. A repeated capture updates the same snapshot without replacing the plan; a plan can support many matches.
5. Search races, maps and note text. **Copy plan** shares a readable summary (with a manual clipboard fallback). **Export notebook** downloads a private JSON backup; **Import notebook** merges it without overwriting existing plans. Reimporting identical content does not duplicate it; conflicting versions remain separate.

The notebook keeps up to 100 plans, each with 20 supporting snapshots and 8,000 characters per writing field. It uses browser-local storage with separate demo/live stores. It is not cloud-synced, account-isolated, automatic match history, or replay analysis. Anyone using this browser profile can access its notes. Clearing browser data removes them; export important notes first. Backups contain notes and captured player names—keep them private. File import/export uses ordinary user-initiated browser uploads/downloads, not arbitrary filesystem access.

### Matching, safety and migration

- Suggestions require synchronized **1v1** data, two players, known races and a selected perspective. Team games and unresolved/random races do not receive misleading recommendations. A known non-observer broadcaster is selected initially; observers explicitly choose a player. You can switch sides at any time.
- Map matching ignores case and surrounding whitespace, but does not guess aliases or conflate map versions. Blank means **Any map**. Notes for Human vs Orc never silently become advice for Orc vs Human.
- No-match, disconnected and stale sessions still allow manual preparation; they cannot attach a stale match. Finished matches remain explicitly labeled. Live clock updates never remount a text editor.
- Retired snapshot notes migrate once into unclassified plans, preserving all notes and supporting snapshots. Assign their races yourself; the app cannot infer whose perspective an old note represents. The original storage key remains untouched, and the new store uses `:v2`.
- Malformed storage is never silently overwritten. Storage failures show a persistent warning and leave session edits available to export. Import validates the whole file (version, fields, limits and identities) before changing anything; files larger than 2 MB are rejected. Deletion and merging require confirmation.
- If another window changes the same notebook, saving pauses instead of overwriting it. Export your edits, reload the other version, then import to merge. The 2 MB notebook limit is checked before accepting edits so exported notebooks remain importable.

The pure data model is in [src/notebook-model.ts](src/notebook-model.ts), with migration, validation and merge tests in [scripts/notebook-model.test.mjs](scripts/notebook-model.test.mjs). The UI and SDK integration live in [src/notebook.ts](src/notebook.ts).

## Surfaces and minimum permissions

Register only **Application** at `http://localhost:5173/?demo=0`. No overlay URLs or unused settings are needed.

Data scopes: `match:read`, `players:read`. There are no unrelated data permissions. The app-definition file is the registration guide; `example.json` and the tested build manifest declare the same surfaces.

The host's overlay switches are deliberately absent for this app.

## Fork and use live data

The checked-in binding identifies the official example. Cloning source does **not** grant ownership or live access.

1. Enable Developer Mode in W3Booster and create your own application.
2. Use [app-definition.json](app-definition.json) for the exact surfaces, scopes, and settings schema. Supply your own name and hosted URLs.
3. Replace the official binding safely:

   ```sh
   npm run app:fork -- YOUR_NEW_CLIENT_ID
   npm run check
   ```

4. Use **Test locally** with the configured surface URLs above, then launch through W3Booster. Commit the new binding and package configuration.

Direct visits default to offline demo data. Registered live URLs must include `demo=0`. Failed authorization never silently falls back to synthetic data. The application runs with browser APIs and the SDK; it has no arbitrary shell or filesystem access.

## Verify and publish

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:browser
npm run screenshots
```

Tests exercise the real workflow, minimal scopes, configured surfaces, mobile layout, demo/live isolation, and authorization failures. Screenshots capture the real UI, not a mockup.

![Match Notebook: actual runnable interface](docs/screenshot.png)

The included GitHub Actions workflow checks the project and deploys `dist/` to Pages. Enable **Settings → Pages → GitHub Actions** in your fork and replace the official URLs. The build uses the checked-in SDK lockfile and does not fetch private data. Its `example-bindings.json` records the binding actually compiled and the tested supported surfaces.

After editing your registered contract, run `npm run w3booster:sync`; `npm run w3booster:check` verifies the current public definition. Never put credentials or real user captures into the repository or Pages secrets.

For a complete Angular starting point, [build from Match Vision](https://website.w3booster.com/developer/match-vision/). All examples remain together in the [example library](https://website.w3booster.com/developer/examples/).

MIT licensed; retain [LICENSE](LICENSE) when reusing source. No Warcraft artwork is bundled.

## Shared game context

This example uses SDK 1.1.0. Shared HUD scale, chat-input visibility, and team-color mode are available through `gameContext(state)` from `@w3booster/sdk/selectors`, without an additional scope. Request only the match/player data this app consumes. App-specific values belong in `state.application.data`; Match Vision’s score is not shared game context.
