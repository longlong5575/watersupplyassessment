$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$agentRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backend = Join-Path $agentRoot "backend"
$front = Join-Path (Join-Path $agentRoot "frontend") "front"
$mobile = Join-Path (Join-Path $agentRoot "frontend") "front-mobile"
$resultDir = Join-Path $PSScriptRoot "results"
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

function Install-PythonRequirements {
  param([string]$PythonExe)
  & $PythonExe -m pip install --disable-pip-version-check -r requirements.txt
  if ($LASTEXITCODE -eq 0) { return }

  Write-Host "默认 Python 源安装失败，切换到清华镜像重试..."
  & $PythonExe -m pip install --disable-pip-version-check --timeout 30 --retries 2 -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
  if ($LASTEXITCODE -ne 0) { throw "Python dependencies install failed with exit code $LASTEXITCODE" }
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
  $baseCandidates = @(
    $env:AGENT_CHECK_ROOT,
    (Join-Path $env:SystemDrive "CodexAgentChecks"),
    (Join-Path $env:PUBLIC "CodexAgentChecks"),
    $env:TEMP
  ) | Where-Object { $_ }
  $baseTemp = $null
  foreach ($candidate in $baseCandidates) {
    try {
      New-Item -ItemType Directory -Force -Path $candidate -ErrorAction Stop | Out-Null
      $probe = Join-Path $candidate ("probe-" + [guid]::NewGuid().ToString("N"))
      New-Item -ItemType Directory -Force -Path $probe -ErrorAction Stop | Out-Null
      Remove-Item -LiteralPath $probe -Recurse -Force
      $baseTemp = $candidate
      break
    }
    catch {}
  }
  if (-not $baseTemp) { throw "No writable frontend check directory is available." }
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
  extremeApiFlow = $null
  reportQuality = $null
  docxOutput = $null
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
    $pythonCandidates = @(
      $env:PYTHON312_EXE,
      (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"),
      (Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe")
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
    $python312 = $null
    foreach ($candidate in $pythonCandidates) {
      try {
        & $candidate -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" | Out-Null
        if ($LASTEXITCODE -eq 0) { $python312 = $candidate; break }
      }
      catch {}
    }
    if (-not $python312) {
      $python312 = (& py -3.12 -c "import sys; print(sys.executable)").Trim()
    }
    Invoke-Checked { & $python312 -m venv .venv }
    Install-PythonRequirements -PythonExe $pythonExe
  }
  $summary.backendVenvReady = $true
  Invoke-Checked { & $pythonExe -m compileall -q app }
  $summary.backendCompile = $true
  $env:PYTHONPATH = $backend
  Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "run_report_task_check.py") }
  $reportSummary = Get-Content -Encoding UTF8 -LiteralPath (Join-Path $resultDir "report-task-summary.json") | ConvertFrom-Json
  $summary.backendApiFlow = $reportSummary.reportTask
  Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "run_extreme_checks.py") }
  $extremeSummary = Get-Content -Encoding UTF8 -LiteralPath (Join-Path $resultDir "extreme-check-summary.json") | ConvertFrom-Json
  $summary.extremeApiFlow = @{
    passed = $extremeSummary.passed
    caseCount = $extremeSummary.caseCount
    reports = $extremeSummary.reportTask.reports
    reportNames = $extremeSummary.reportTask.reportNames
  }
  Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "check_report_quality.py") }
  $qualitySummary = Get-Content -Encoding UTF8 -LiteralPath (Join-Path $resultDir "report-quality-summary.json") | ConvertFrom-Json
  $summary.reportQuality = @{
    passed = $qualitySummary.passed
    paymentTables = @($qualitySummary.paymentTables).Count
    badTokens = @($qualitySummary.badTokens).Count
    replacementChars = $qualitySummary.replacementChars
  }
  Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "build_test_report.py") }
  Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "check_docx_outputs.py") }
  Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "build_test_report.py") }
  Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "check_docx_outputs.py") }
  $docxSummary = Get-Content -Encoding UTF8 -LiteralPath (Join-Path $resultDir "docx-output-summary.json") | ConvertFrom-Json
  $summary.docxOutput = @{
    passed = $docxSummary.passed
    checkedFiles = $docxSummary.checkedFiles
    selectedTowns = $docxSummary.selectedTowns
  }
}
finally { Pop-Location }

Invoke-FrontendChecks -Source $front -Name "front" -MarkTypecheck { $summary.desktopTypecheck = $true } -MarkBuild { $summary.desktopBuild = $true }
Invoke-FrontendChecks -Source $mobile -Name "front-mobile" -MarkTypecheck { $summary.mobileTypecheck = $true } -MarkBuild { $summary.mobileBuild = $true }

$summary | ConvertTo-Json -Depth 8 | Out-File -LiteralPath (Join-Path $resultDir "agent-check-summary.json") -Encoding utf8
$summary
