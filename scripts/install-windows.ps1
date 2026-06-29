# =============================================================================
# install-windows.ps1 - One-time setup for running frontend + backend on Windows
#
# What it does:
#   1. Installs pnpm dependencies for backend and frontend (if not already)
#   2. Builds the backend (nest build -> dist/main.js)
#   3. Creates frontend/.env with NEXT_PUBLIC_API_URL
#   4. Validates that Docker Desktop is running (the infrastructure)
#
# Run from PowerShell (as Administrator the first time so it can install
# optional prerequisites, but no admin needed if Node + pnpm are already
# installed):
#   PS D:\work\ERP-AI> .\scripts\install-windows.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot | Split-Path -Parent

Write-Host ""
Write-Host "=== ERP-AI Windows install (one-time setup) ===" -ForegroundColor Cyan
Write-Host "    Repo root: $root"
Write-Host ""

# 0. Prerequisite checks --------------------------------------------------------

function Require-Command {
    param([string]$cmd, [string]$hint = "")
    $exists = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $exists) {
        Write-Host "  [FAIL] '$cmd' not found on PATH. $hint" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [ OK ] $cmd -> $($exists.Source)" -ForegroundColor DarkGray
}

Write-Host "0. Checking prerequisites..." -ForegroundColor Yellow
Require-Command 'node' 'Install Node.js 20+ LTS from https://nodejs.org/'
Require-Command 'pnpm' 'Install with: npm install -g pnpm@11'
Require-Command 'docker' 'Install Docker Desktop for Windows from https://www.docker.com/products/docker-desktop/'

# Check Docker Desktop is actually running
$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAIL] Docker Desktop is not running. Start it and re-run." -ForegroundColor Red
    Write-Host "        $dockerInfo" -ForegroundColor DarkGray
    exit 1
}
Write-Host "  [ OK ] Docker Desktop is running" -ForegroundColor DarkGray

# 1. Install backend dependencies ------------------------------------------------

Write-Host ""
Write-Host "1. Installing backend dependencies..." -ForegroundColor Yellow
$backendDir = Join-Path $root "backend\server"
Set-Location $backendDir
if (-not (Test-Path "node_modules")) {
    & pnpm install
    if ($LASTEXITCODE -ne 0) { Write-Host "  [FAIL] pnpm install failed in $backendDir" -ForegroundColor Red; exit 1 }
} else {
    Write-Host "  [SKIP] node_modules already exists" -ForegroundColor DarkGray
}

# 2. Build backend ------------------------------------------------------------

Write-Host ""
Write-Host "2. Building backend (nest build -> dist/main.js)..." -ForegroundColor Yellow
& pnpm build
if ($LASTEXITCODE -ne 0) { Write-Host "  [FAIL] pnpm build failed" -ForegroundColor Red; exit 1 }
if (-not (Test-Path "dist\main.js")) {
    Write-Host "  [FAIL] dist\main.js not found after build" -ForegroundColor Red
    exit 1
}
Write-Host "  [ OK ] dist\main.js built" -ForegroundColor DarkGray

# 3. Install frontend dependencies ----------------------------------------------

Write-Host ""
Write-Host "3. Installing frontend dependencies..." -ForegroundColor Yellow
$frontendDir = Join-Path $root "frontend"
Set-Location $frontendDir
if (-not (Test-Path "node_modules")) {
    & pnpm install
    if ($LASTEXITCODE -ne 0) { Write-Host "  [FAIL] pnpm install failed in $frontendDir" -ForegroundColor Red; exit 1 }
} else {
    Write-Host "  [SKIP] node_modules already exists" -ForegroundColor DarkGray
}

# 4. Create frontend/.env if missing -------------------------------------------

Write-Host ""
Write-Host "4. Creating frontend/.env..." -ForegroundColor Yellow
$envFile = Join-Path $frontendDir ".env"
if (-not (Test-Path $envFile)) {
    "NEXT_PUBLIC_API_URL=http://localhost:3000" | Out-File $envFile -Encoding utf8
    Write-Host "  [ OK ] wrote $envFile" -ForegroundColor DarkGray
} else {
    Write-Host "  [SKIP] $envFile already exists" -ForegroundColor DarkGray
}

# 5. Sanity-check backend .env -------------------------------------------------

Write-Host ""
Write-Host "5. Sanity-checking backend .env..." -ForegroundColor Yellow
$backendEnv = Join-Path $backendDir ".env"
if (-not (Test-Path $backendEnv)) {
    Write-Host "  [WARN] $backendEnv not found. Copy from .env.example or run pnpm start:dev once in WSL to scaffold it." -ForegroundColor Yellow
} else {
    Write-Host "  [ OK ] $backendEnv exists" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "=== Install complete ===" -ForegroundColor Cyan
Write-Host "Next step:  .\scripts\start-windows.ps1"
Write-Host ""
