# =============================================================================
# stop-windows.ps1 - Kill anything on ports 3000 / 3001
#
# Also stops the WSL systemd services if WSL is installed.
#
# Run from PowerShell:
#   PS D:\work\ERP-AI> .\scripts\stop-windows.ps1
# =============================================================================

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot | Split-Path -Parent

Write-Host ""
Write-Host "=== ERP-AI stop ===" -ForegroundColor Cyan
Write-Host ""

# 1. Free Windows ports
Write-Host "1. Freeing ports 3000 / 3001..." -ForegroundColor Yellow
$busy = Get-NetTCPConnection -LocalPort 3000,3001 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    foreach ($c in $busy) {
        # NOTE: $pid is a reserved automatic var in PowerShell - use $procId instead
        $procId = $c.OwningProcess
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
            Write-Host "  [KILL] PID $procId on port $($c.LocalPort)" -ForegroundColor DarkGray
        } catch {
            Write-Host "  [WARN] could not kill PID $procId (port $($c.LocalPort)): $_" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  [ OK ] ports 3000 / 3001 are already free" -ForegroundColor DarkGray
}

# 2. Stop the WSL systemd services
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
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host ""
