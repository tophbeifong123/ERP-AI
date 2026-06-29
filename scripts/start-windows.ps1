# =============================================================================
# start-windows.ps1 - Start backend + frontend natively on Windows
#
# What it does:
#   1. Kills anything already listening on 3000 / 3001
#   2. Stops the WSL systemd services (if WSL is installed) so they
#      don't hold the ports
#   3. Opens two new PowerShell windows:
#        - window 1: backend  (node dist/main.js on :3000)
#        - window 2: frontend (pnpm dev on :3001)
#   4. Waits 5 s and probes both endpoints; reports which one came up
#
# Run from PowerShell:
#   PS D:\work\ERP-AI> .\scripts\start-windows.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot | Split-Path -Parent

Write-Host ""
Write-Host "=== ERP-AI start (Windows native) ===" -ForegroundColor Cyan
Write-Host "    Repo root: $root"
Write-Host ""

# 1. Free up the ports -------------------------------------------------------

Write-Host "1. Freeing ports 3000 / 3001..." -ForegroundColor Yellow
$busy = Get-NetTCPConnection -LocalPort 3000,3001 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    foreach ($c in $busy) {
        $pid = $c.OwningProcess
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "  [KILL] PID $pid on port $($c.LocalPort)" -ForegroundColor DarkGray
        } catch {
            Write-Host "  [WARN] could not kill PID $pid (port $($c.LocalPort)): $_" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 1
} else {
    Write-Host "  [ OK ] ports 3000 / 3001 are free" -ForegroundColor DarkGray
}

# 2. Stop the WSL systemd services so they don't grab the ports back -------

if (Get-Command wsl.exe -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "2. Stopping WSL systemd services (best-effort)..." -ForegroundColor Yellow
    $wslCmd = 'systemctl --user stop erp-ai-backend2 erp-ai-frontend 2>/dev/null; true'
    try {
        wsl.exe -u $env:USERNAME -- bash -lc $wslCmd 2>&1 | Out-Null
        Write-Host "  [ OK ] WSL services stopped (or already stopped)" -ForegroundColor DarkGray
    } catch {
        Write-Host "  [WARN] could not stop WSL services: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "2. WSL not detected, skipping systemd cleanup" -ForegroundColor DarkGray
}

# 3. Verify Docker Desktop is running ----------------------------------------

Write-Host ""
Write-Host "3. Verifying Docker Desktop..." -ForegroundColor Yellow
$dockerOk = $true
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { $dockerOk = $false }
} catch { $dockerOk = $false }
if (-not $dockerOk) {
    Write-Host "  [FAIL] Docker Desktop is not running. Start it then re-run." -ForegroundColor Red
    exit 1
}
Write-Host "  [ OK ] Docker Desktop is up" -ForegroundColor DarkGray

# Verify the infra containers are running
$expected = @('erp-ai-postgres','erp-ai-redis','erp-ai-minio','erp-ai-services','n8n_local','erp-ai-mailhog')
$running = (docker ps --format '{{.Names}}' 2>&1) -split "`n"
$missing = $expected | Where-Object { $running -notcontains $_ }
if ($missing) {
    Write-Host "  [WARN] missing containers: $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host "         run 'docker compose up -d' from D:\work\ERP-AI" -ForegroundColor Yellow
} else {
    Write-Host "  [ OK ] all 6 infra containers are up" -ForegroundColor DarkGray
}

# 4. Start backend ------------------------------------------------------------

Write-Host ""
Write-Host "4. Starting backend in a new PowerShell window..." -ForegroundColor Yellow
$backendDir = Join-Path $root "backend\server"
if (-not (Test-Path (Join-Path $backendDir "dist\main.js"))) {
    Write-Host "  [FAIL] $backendDir\dist\main.js not found. Run install-windows.ps1 first." -ForegroundColor Red
    exit 1
}

$backendCmd = "Set-Location '$backendDir'; `$env:PORT=3000; node dist/main.js 2>&1 | Tee-Object -FilePath '$root\backend-server.log' -Append; Write-Host ''; Write-Host 'Backend exited. Press any key to close.'; `$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command", $backendCmd
) -WorkingDirectory $backendDir -WindowStyle Normal

Write-Host "  [ OK ] backend starting (check new window)" -ForegroundColor DarkGray

# 5. Start frontend -----------------------------------------------------------

Write-Host ""
Write-Host "5. Starting frontend in a new PowerShell window..." -ForegroundColor Yellow
$frontendDir = Join-Path $root "frontend"
$envFile = Join-Path $frontendDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "  [WARN] $envFile not found. Creating with default." -ForegroundColor Yellow
    "NEXT_PUBLIC_API_URL=http://localhost:3000" | Out-File $envFile -Encoding utf8
}

$frontendCmd = "Set-Location '$frontendDir'; `$env:PORT=3001; pnpm dev -- -p 3001 2>&1 | Tee-Object -FilePath '$root\frontend-dev.log' -Append; Write-Host ''; Write-Host 'Frontend exited. Press any key to close.'; `$null = `$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')"
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command", $frontendCmd
) -WorkingDirectory $frontendDir -WindowStyle Normal

Write-Host "  [ OK ] frontend starting (check new window)" -ForegroundColor DarkGray

# 6. Wait + probe ------------------------------------------------------------

Write-Host ""
Write-Host "6. Probing ports (waiting up to 20 s)..." -ForegroundColor Yellow
$backendUp = $false
$frontendUp = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    $b = Test-NetTCP -ComputerName 127.0.0.1 -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue
    $f = Test-NetTCP -ComputerName 127.0.0.1 -Port 3001 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($b -and -not $backendUp) { Write-Host "  [ OK ] backend listening on :3000  (after $($i+1)s)" -ForegroundColor Green; $backendUp = $true }
    if ($f -and -not $frontendUp) { Write-Host "  [ OK ] frontend listening on :3001 (after $($i+1)s)" -ForegroundColor Green; $frontendUp = $true }
    if ($backendUp -and $frontendUp) { break }
}
if (-not $backendUp) { Write-Host "  [WARN] backend not listening on :3000 after 20 s — check the window for errors" -ForegroundColor Yellow }
if (-not $frontendUp) { Write-Host "  [WARN] frontend not listening on :3001 after 20 s — check the window for errors" -ForegroundColor Yellow }

Write-Host ""
Write-Host "=== Open in your browser ===" -ForegroundColor Cyan
Write-Host "    http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "Demo credentials (already seeded in dev DB):" -ForegroundColor DarkGray
Write-Host "    Email:    demo@erp-ai.test" -ForegroundColor DarkGray
Write-Host "    Password: Test1234!" -ForegroundColor DarkGray
Write-Host ""
Write-Host "To stop: .\scripts\stop-windows.ps1" -ForegroundColor DarkGray
Write-Host ""
