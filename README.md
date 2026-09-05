# Match Notebook

A focused W3Booster example by **W3Pad**. Keep a snapshot of the current match, write private practice notes, and copy a match summary. This is intentionally **application-only**: a notebook requires typing and review, not space over the game.

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

1. Start a demo match, then select **Keep match snapshot**.
2. Write an opening plan, turning point, or next practice goal.
3. Reload: the note survives. Updating the same snapshot preserves its notes.
4. Select **Copy match summary + notes** to share only what you choose. A selectable-text fallback is available when browser clipboard access is blocked.

The notebook keeps up to 20 manually captured snapshots in browser-local storage, with separate demo/live stores. It is not cloud-synced, account-isolated, automatic match history, replay analysis, or an operating-system file API. Anyone using this browser profile can access its notes. Clearing browser data removes them; copy important notes first. Unreadable storage is never silently overwritten. Deletion requires confirmation.

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
