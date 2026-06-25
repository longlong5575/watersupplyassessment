$ErrorActionPreference = "Stop"

$agentRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendName = [string]::Concat([char]0x540E, [char]0x7AEF)
$frontendName = [string]::Concat([char]0x524D, [char]0x7AEF)
$backend = Join-Path $agentRoot $backendName
$front = Join-Path (Join-Path $agentRoot $frontendName) "front"
$mobile = Join-Path (Join-Path $agentRoot $frontendName) "front-mobile"
$resultName = [string]::Concat([char]0x7ED3, [char]0x679C)
$resultDir = Join-Path $PSScriptRoot $resultName
New-Item -ItemType Directory -Force -Path $resultDir | Out-Null

$pnpm = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd"
if (-not (Test-Path -LiteralPath $pnpm)) { $pnpm = "pnpm" }
$nodeBin = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
if ((Test-Path -LiteralPath $nodeBin) -and -not (($env:Path -split ";") -contains $nodeBin)) {
  $env:Path = "$nodeBin;$env:Path"
}

function Invoke-Checked {
  param([scriptblock]$Command)
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE" }
}

function Copy-FrontendForCheck {
  param(
    [string]$Source,
    [string]$Name,
    [string]$CheckRoot
  )
  $target = Join-Path $CheckRoot $Name
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  & robocopy $Source $target /E /XD node_modules dist .git /XF .env.local | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "Frontend copy failed with robocopy code $LASTEXITCODE" }
  return $target
}

function Invoke-FrontendChecks {
  param(
    [string]$Source,
    [string]$Name,
    [scriptblock]$MarkTypecheck,
    [scriptblock]$MarkBuild
  )
  $baseTemp = Join-Path $env:PUBLIC "CodexAgentChecks"
  try {
    New-Item -ItemType Directory -Force -Path $baseTemp | Out-Null
  }
  catch {
    $baseTemp = Join-Path $env:SystemDrive "CodexAgentChecks"
    try {
      New-Item -ItemType Directory -Force -Path $baseTemp | Out-Null
    }
    catch {
      $baseTemp = $env:TEMP
    }
  }
  $checkRoot = Join-Path $baseTemp ("agent-frontend-checks-" + [guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $checkRoot | Out-Null
  try {
    $target = Copy-FrontendForCheck -Source $Source -Name $Name -CheckRoot $checkRoot
    Push-Location $target
    try {
      Invoke-Checked { & $pnpm install --config.confirm-modules-purge=false }
      Invoke-Checked { & $pnpm typecheck }
      & $MarkTypecheck
      Invoke-Checked { & $pnpm build }
      & $MarkBuild
    }
    finally { Pop-Location }
  }
  finally {
    $resolved = Resolve-Path -LiteralPath $checkRoot -ErrorAction SilentlyContinue
    if ($resolved -and $resolved.Path.StartsWith([System.IO.Path]::GetFullPath($baseTemp), [System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolved.Path -Recurse -Force
    }
  }
}

$summary = [ordered]@{
  generatedAt = (Get-Date).ToString("s")
  backendVenvReady = $false
  backendCompile = $false
  backendApiFlow = $null
  desktopTypecheck = $false
  mobileTypecheck = $false
  desktopBuild = $false
  mobileBuild = $false
}

Push-Location $backend
try {
  New-Item -ItemType Directory -Force -Path (Join-Path $backend "storage") | Out-Null
  $pythonExe = Join-Path $backend ".venv\Scripts\python.exe"
  if (-not (Test-Path -LiteralPath $pythonExe)) {
    $python312 = $env:PYTHON312_EXE
    if (-not $python312 -or -not (Test-Path -LiteralPath $python312)) {
      $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
      if (Test-Path -LiteralPath $candidate) { $python312 = $candidate }
      else { $python312 = (& py -3.12 -c "import sys; print(sys.executable)").Trim() }
    }
    Invoke-Checked { & $python312 -m venv .venv }
    Invoke-Checked { & $pythonExe -m pip install -r requirements.txt }
  }
  $summary.backendVenvReady = $true
  Invoke-Checked { & $pythonExe -m compileall -q app }
  $summary.backendCompile = $true
  $apiJson = & $pythonExe -c "from app.core.database import Base, engine, SessionLocal; from app.services.seed import seed_database; Base.metadata.drop_all(engine); Base.metadata.create_all(engine); s=SessionLocal(); seed_database(s); s.close(); from fastapi.testclient import TestClient; from app.main import app; c=TestClient(app); towns=c.get('/api/mobile/towns').json()['items']; cycles=c.get('/api/mobile/assessment-cycles').json()['items']; standards=c.get('/api/mobile/indicator-standards').json()['items']; rec=c.post('/api/mobile/assessment-records',json={'town':towns[0]['name'],'period':'2023\u5e74\u4e0b\u534a\u5e74\u5ea6','entries':[{'deduction':1,'reason':'\u81ea\u52a8\u5316\u6d4b\u8bd5\u6263\u5206'}]}).json(); submitted=c.post('/api/mobile/assessment-records/'+rec['id']+'/submit').json(); overview=c.get('/api/dashboard/overview').json(); reviewed=c.post('/api/records/'+rec['id']+'/review').json(); locked=c.post('/api/records/'+rec['id']+'/lock').json(); import json; print(json.dumps({'health':c.get('/health').json()['status'],'towns':len(towns),'cycles':len(cycles),'standards':len(standards),'submitted':submitted['status'],'dashboardSubmitted':overview['submittedRecords'],'reviewed':reviewed['status'],'locked':locked['status']}, ensure_ascii=False))"
  $summary.backendApiFlow = $apiJson | ConvertFrom-Json
}
finally { Pop-Location }

Invoke-FrontendChecks -Source $front -Name "front" -MarkTypecheck { $summary.desktopTypecheck = $true } -MarkBuild { $summary.desktopBuild = $true }
Invoke-FrontendChecks -Source $mobile -Name "front-mobile" -MarkTypecheck { $summary.mobileTypecheck = $true } -MarkBuild { $summary.mobileBuild = $true }

$summary | ConvertTo-Json -Depth 8 | Out-File -LiteralPath (Join-Path $resultDir "agent-check-summary.json") -Encoding utf8
$summary
