$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " NeoCloud Avatar Engine - SadTalker Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$MODELS = Join-Path $ROOT "models"
$SADTALKER = Join-Path $MODELS "SadTalker"
$VENV = Join-Path $ROOT ".sadtalker-venv"

New-Item -ItemType Directory -Force -Path $MODELS | Out-Null

# ---------------------------------------------------------
# Check Git
# ---------------------------------------------------------

Write-Host "[1/7] Checking Git..." -ForegroundColor Yellow

try {
    git --version | Out-Null
}
catch {
    Write-Host "Git was not found. Installing Git..." -ForegroundColor Yellow
    winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
}

# ---------------------------------------------------------
# Check FFmpeg
# ---------------------------------------------------------

Write-Host "[2/7] Checking FFmpeg..." -ForegroundColor Yellow

$ffmpegExists = Get-Command ffmpeg -ErrorAction SilentlyContinue

if (-not $ffmpegExists) {
    Write-Host "FFmpeg not found. Installing FFmpeg..." -ForegroundColor Yellow

    try {
        winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
    }
    catch {
        Write-Host ""
        Write-Host "FFmpeg automatic installation failed." -ForegroundColor Red
        Write-Host "We can install it manually later." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------
# Clone official SadTalker
# ---------------------------------------------------------

Write-Host "[3/7] Preparing SadTalker source..." -ForegroundColor Yellow

if (-not (Test-Path $SADTALKER)) {

    Set-Location $MODELS

    git clone https://github.com/OpenTalker/SadTalker.git

}
else {

    Write-Host "SadTalker folder already exists. Skipping clone." -ForegroundColor Green
}

# ---------------------------------------------------------
# Create isolated Python 3.10 environment
# ---------------------------------------------------------

Write-Host "[4/7] Creating SadTalker Python environment..." -ForegroundColor Yellow

Set-Location $ROOT

if (-not (Test-Path $VENV)) {

    py -3.10 -m venv .sadtalker-venv
}

$PYTHON = Join-Path $VENV "Scripts\python.exe"

if (-not (Test-Path $PYTHON)) {
    throw "SadTalker virtual environment could not be created."
}

# ---------------------------------------------------------
# Upgrade pip
# ---------------------------------------------------------

Write-Host "[5/7] Preparing Python packages..." -ForegroundColor Yellow

& $PYTHON -m pip install --upgrade pip setuptools wheel

# CPU PyTorch build.
# This avoids NVIDIA/CUDA requirements on the current PC.

& $PYTHON -m pip install `
    torch==2.0.1 `
    torchvision==0.15.2 `
    torchaudio==2.0.2 `
    --index-url https://download.pytorch.org/whl/cpu

# ---------------------------------------------------------
# Install SadTalker dependencies
# ---------------------------------------------------------

Write-Host "[6/7] Installing SadTalker dependencies..." -ForegroundColor Yellow

$REQ = Join-Path $SADTALKER "requirements.txt"

if (-not (Test-Path $REQ)) {
    throw "SadTalker requirements.txt was not found."
}

& $PYTHON -m pip install -r $REQ

# ---------------------------------------------------------
# Download official checkpoints
# ---------------------------------------------------------

Write-Host "[7/7] Downloading SadTalker model checkpoints..." -ForegroundColor Yellow

$CHECKPOINTS = Join-Path $SADTALKER "checkpoints"

New-Item -ItemType Directory -Force -Path $CHECKPOINTS | Out-Null

function Download-IfMissing {
    param(
        [string]$Url,
        [string]$Destination
    )

    if (Test-Path $Destination) {
        Write-Host "Already exists: $Destination" -ForegroundColor Green
        return
    }

    Write-Host ""
    Write-Host "Downloading:" -ForegroundColor Cyan
    Write-Host $Url
    Write-Host ""

    Invoke-WebRequest `
        -Uri $Url `
        -OutFile $Destination `
        -UseBasicParsing
}

Download-IfMissing `
"https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/mapping_00109-model.pth.tar" `
(Join-Path $CHECKPOINTS "mapping_00109-model.pth.tar")

Download-IfMissing `
"https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/mapping_00229-model.pth.tar" `
(Join-Path $CHECKPOINTS "mapping_00229-model.pth.tar")

Download-IfMissing `
"https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/SadTalker_V0.0.2_256.safetensors" `
(Join-Path $CHECKPOINTS "SadTalker_V0.0.2_256.safetensors")

Download-IfMissing `
"https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/SadTalker_V0.0.2_512.safetensors" `
(Join-Path $CHECKPOINTS "SadTalker_V0.0.2_512.safetensors")


Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " NeoCloud SadTalker setup completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

Write-Host "SadTalker:" -ForegroundColor Cyan
Write-Host $SADTALKER

Write-Host ""
Write-Host "Python:" -ForegroundColor Cyan
Write-Host $PYTHON

Write-Host ""
Write-Host "Next step:" -ForegroundColor Yellow
Write-Host "Connect NeoCloud Avatar Engine to SadTalker inference."
Write-Host ""$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " NeoCloud Avatar Engine - SadTalker Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$MODELS = Join-Path $ROOT "models"
$SADTALKER = Join-Path $MODELS "SadTalker"
$VENV = Join-Path $ROOT ".sadtalker-venv"

New-Item -ItemType Directory -Force -Path $MODELS | Out-Null

# ---------------------------------------------------------
# Check Git
# ---------------------------------------------------------

Write-Host "[1/7] Checking Git..." -ForegroundColor Yellow

try {
    git --version | Out-Null
}
catch {
    Write-Host "Git was not found. Installing Git..." -ForegroundColor Yellow
    winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
}

# ---------------------------------------------------------
# Check FFmpeg
# ---------------------------------------------------------

Write-Host "[2/7] Checking FFmpeg..." -ForegroundColor Yellow

$ffmpegExists = Get-Command ffmpeg -ErrorAction SilentlyContinue

if (-not $ffmpegExists) {
    Write-Host "FFmpeg not found. Installing FFmpeg..." -ForegroundColor Yellow

    try {
        winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
    }
    catch {
        Write-Host ""
        Write-Host "FFmpeg automatic installation failed." -ForegroundColor Red
        Write-Host "We can install it manually later." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------
# Clone official SadTalker
# ---------------------------------------------------------

Write-Host "[3/7] Preparing SadTalker source..." -ForegroundColor Yellow

if (-not (Test-Path $SADTALKER)) {

    Set-Location $MODELS

    git clone https://github.com/OpenTalker/SadTalker.git

}
else {

    Write-Host "SadTalker folder already exists. Skipping clone." -ForegroundColor Green
}

# ---------------------------------------------------------
# Create isolated Python 3.10 environment
# ---------------------------------------------------------

Write-Host "[4/7] Creating SadTalker Python environment..." -ForegroundColor Yellow

Set-Location $ROOT

if (-not (Test-Path $VENV)) {

    py -3.10 -m venv .sadtalker-venv
}

$PYTHON = Join-Path $VENV "Scripts\python.exe"

if (-not (Test-Path $PYTHON)) {
    throw "SadTalker virtual environment could not be created."
}

# ---------------------------------------------------------
# Upgrade pip
# ---------------------------------------------------------

Write-Host "[5/7] Preparing Python packages..." -ForegroundColor Yellow

& $PYTHON -m pip install --upgrade pip setuptools wheel

# CPU PyTorch build.
# This avoids NVIDIA/CUDA requirements on the current PC.

& $PYTHON -m pip install `
    torch==2.0.1 `
    torchvision==0.15.2 `
    torchaudio==2.0.2 `
    --index-url https://download.pytorch.org/whl/cpu

# ---------------------------------------------------------
# Install SadTalker dependencies
# ---------------------------------------------------------

Write-Host "[6/7] Installing SadTalker dependencies..." -ForegroundColor Yellow

$REQ = Join-Path $SADTALKER "requirements.txt"

if (-not (Test-Path $REQ)) {
    throw "SadTalker requirements.txt was not found."
}

& $PYTHON -m pip install -r $REQ

# ---------------------------------------------------------
# Download official checkpoints
# ---------------------------------------------------------

Write-Host "[7/7] Downloading SadTalker model checkpoints..." -ForegroundColor Yellow

$CHECKPOINTS = Join-Path $SADTALKER "checkpoints"

New-Item -ItemType Directory -Force -Path $CHECKPOINTS | Out-Null

function Download-IfMissing {
    param(
        [string]$Url,
        [string]$Destination
    )

    if (Test-Path $Destination) {
        Write-Host "Already exists: $Destination" -ForegroundColor Green
        return
    }

    Write-Host ""
    Write-Host "Downloading:" -ForegroundColor Cyan
    Write-Host $Url
    Write-Host ""

    Invoke-WebRequest `
        -Uri $Url `
        -OutFile $Destination `
        -UseBasicParsing
}

Download-IfMissing `
"https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/mapping_00109-model.pth.tar" `
(Join-Path $CHECKPOINTS "mapping_00109-model.pth.tar")

Download-IfMissing `
"https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/mapping_00229-model.pth.tar" `
(Join-Path $CHECKPOINTS "mapping_00229-model.pth.tar")

Download-IfMissing `
"https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/SadTalker_V0.0.2_256.safetensors" `
(Join-Path $CHECKPOINTS "SadTalker_V0.0.2_256.safetensors")

Download-IfMissing `
"https://github.com/OpenTalker/SadTalker/releases/download/v0.0.2-rc/SadTalker_V0.0.2_512.safetensors" `
(Join-Path $CHECKPOINTS "SadTalker_V0.0.2_512.safetensors")


Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host " NeoCloud SadTalker setup completed!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

Write-Host "SadTalker:" -ForegroundColor Cyan
Write-Host $SADTALKER

Write-Host ""
Write-Host "Python:" -ForegroundColor Cyan
Write-Host $PYTHON

Write-Host ""
Write-Host "Next step:" -ForegroundColor Yellow
Write-Host "Connect NeoCloud Avatar Engine to SadTalker inference."
Write-Host ""