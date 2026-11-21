# ============================================================
#  ResearchAI – One-time Setup Script
#  Run this ONCE from the project root:
#  .\setup.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ResearchAI – Setup Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Backend ──────────────────────────────────────────────
Write-Host "[1/5] Setting up Python virtual environment..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\backend"

if (-not (Test-Path "venv")) {
    python -m venv venv
    Write-Host "  ✅ Virtual environment created." -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Virtual environment already exists, skipping." -ForegroundColor DarkGray
}

# ── 2. Activate venv ────────────────────────────────────────
Write-Host "[2/5] Activating virtual environment..." -ForegroundColor Yellow
$ActivateScript = "$ProjectRoot\backend\venv\Scripts\Activate.ps1"
& $ActivateScript

# ── 3. Install Python packages ───────────────────────────────
Write-Host "[3/5] Installing Python dependencies..." -ForegroundColor Yellow
pip install --upgrade pip --quiet
pip install fastapi "uvicorn[standard]" python-multipart pymupdf sumy nltk
pip freeze | Out-File -Encoding utf8 requirements.txt
Write-Host "  ✅ Python packages installed. requirements.txt saved." -ForegroundColor Green

# ── 4. NLTK data ─────────────────────────────────────────────
Write-Host "[4/5] Downloading NLTK tokenizer data..." -ForegroundColor Yellow
python -c "import nltk; nltk.download('punkt'); nltk.download('punkt_tab')"
Write-Host "  ✅ NLTK data downloaded." -ForegroundColor Green

# ── 5. Frontend ───────────────────────────────────────────────
Write-Host "[5/5] Setting up React frontend..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\frontend"

if (-not (Test-Path "package.json")) {
    Write-Host "  Creating Vite React project..." -ForegroundColor DarkGray
    npm create vite@latest . -- --template react --yes
}

Write-Host "  Installing npm packages..." -ForegroundColor DarkGray
npm install
npm install axios
Write-Host "  ✅ Frontend ready." -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ✅ Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start the app, open TWO terminals:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Terminal 1 – Backend:" -ForegroundColor Yellow
Write-Host "    cd backend" -ForegroundColor White
Write-Host "    .\\venv\\Scripts\\Activate.ps1" -ForegroundColor White
Write-Host "    uvicorn app.main:app --reload" -ForegroundColor White
Write-Host ""
Write-Host "  Terminal 2 – Frontend:" -ForegroundColor Yellow
Write-Host "    cd frontend" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  🌐 App:    http://localhost:5173" -ForegroundColor Cyan
Write-Host "  📡 API:    http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  📚 Docs:   http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host ""

Set-Location $ProjectRoot
