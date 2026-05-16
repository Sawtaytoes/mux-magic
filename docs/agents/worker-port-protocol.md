# Worker Port / PID Protocol

Workers running e2e in worktrees must not collide with each other or with the user's running dev servers. **Pick random unused ports per session and tear down only your own PIDs.**

## PowerShell (Windows)

```powershell
$env:PORT = Get-Random -Minimum 30000 -Maximum 65000
$env:WEB_PORT = Get-Random -Minimum 30000 -Maximum 65000
$servers = Start-Process -PassThru -NoNewWindow yarn -ArgumentList "prod:servers"
$serversPid = $servers.Id
# … run `yarn e2e` …
Stop-Process -Id $serversPid -Force
```

## Bash (Linux/Mac)

```bash
export PORT=$((30000 + RANDOM % 35000))
export WEB_PORT=$((30000 + RANDOM % 35000))
yarn prod:servers &
SERVERS_PID=$!
# … run `yarn e2e` …
kill -9 "$SERVERS_PID"
```

## Rules

- **Never `pkill` or `taskkill /F /IM node.exe`** — those kill other workers' and the user's servers too. Always target your captured PID.
- If `playwright.config.ts` `reuseExistingServer` is true, set `CI=true` for your session so Playwright spins up its own servers against your `PORT`/`WEB_PORT`.
