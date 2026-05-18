# Worker Port / PID Protocol

Workers running e2e in worktrees must not collide with each other or with the user's running dev servers. **Pick a random unused port per session and tear down only your own PID.**

Worker 29 collapsed the SPA + API + Storybook onto a single port (default 3000), so workers only need to pick one port now — the historical `WEB_PORT` is gone.

## PowerShell (Windows)

```powershell
$env:PORT = Get-Random -Minimum 30000 -Maximum 65000
$server = Start-Process -PassThru -NoNewWindow yarn -ArgumentList "prod:server"
$serverPid = $server.Id
# … run `yarn e2e` …
Stop-Process -Id $serverPid -Force
```

## Bash (Linux/Mac)

```bash
export PORT=$((30000 + RANDOM % 35000))
yarn prod:server &
SERVER_PID=$!
# … run `yarn e2e` …
kill -9 "$SERVER_PID"
```

## Rules

- **Never `pkill` or `taskkill /F /IM node.exe`** — those kill other workers' and the user's servers too. Always target your captured PID.
- If `playwright.config.ts` `reuseExistingServer` is true, set `CI=true` for your session so Playwright spins up its own server against your `PORT`.
- `yarn prod:server` requires `yarn build:prod` to have run first (it executes the esbuild bundle at `packages/server/dist/index.js`). Use `yarn dev` if you want hot-reload.
