$ErrorActionPreference = "Stop"

$agentRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$workspaceRoot = if ((Split-Path -Leaf (Split-Path -Parent $agentRoot)) -eq "watersupplyassessment") { Split-Path -Parent (Split-Path -Parent $agentRoot) } else { Split-Path -Parent $agentRoot }
$runScriptsName = -join ([char[]](0x8fd0, 0x884c, 0x811a, 0x672c))
$runtimeRoot = if ($env:WATERSUPPLY_RUNTIME_DIR) { $env:WATERSUPPLY_RUNTIME_DIR } else { Join-Path (Join-Path $workspaceRoot $runScriptsName) "watersupply-agent-runtime" }
$backend = Join-Path $agentRoot "backend"
$front = Join-Path (Join-Path $agentRoot "frontend") "front"
$mobile = Join-Path (Join-Path $agentRoot "frontend") "front-mobile"
$resultDir = Join-Path $runtimeRoot "test-results"
New-Item -ItemType Directory -Force -Path $resultDir | Out-Null

$pnpm = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd"
if (-not (Test-Path -LiteralPath $pnpm)) { $pnpm = "pnpm" }
$pythonExe = Join-Path (Join-Path (Join-Path $runtimeRoot "backend") ".venv") "Scripts\python.exe"
if (-not (Test-Path -LiteralPath $pythonExe)) {
  & (Join-Path (Join-Path $agentRoot "内部脚本") "init-recipient.ps1")
}
if (-not (Test-Path -LiteralPath $pythonExe)) {
  throw "Backend Python environment is missing after initialization."
}

function Invoke-Checked {
  param([scriptblock]$Command)
  & $Command
  if ($LASTEXITCODE -ne 0) { throw ("Command failed with exit code " + $LASTEXITCODE) }
}

function Copy-FrontendForCheck {
  param([string]$Source, [string]$Name, [string]$CheckRoot)
  $target = Join-Path $CheckRoot $Name
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  & robocopy $Source $target /E /XD node_modules dist .git /XF .env.local | Out-Null
  if ($LASTEXITCODE -gt 7) { throw ("Frontend copy failed with robocopy code " + $LASTEXITCODE) }
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
  New-Item -ItemType Directory -Force -Path $baseTemp | Out-Null
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
    if (Test-Path -LiteralPath $checkRoot) {
      Remove-Item -LiteralPath $checkRoot -Recurse -Force
    }
  }
}

$summary = [ordered]@{
  generatedAt = (Get-Date).ToString("s")
  backendCompile = $false
  projectPipeline = $false
  reportQuality = $false
  desktopTypecheck = $false
  desktopBuild = $false
  mobileTypecheck = $false
  mobileBuild = $false
}

Push-Location $backend
try {
  Invoke-Checked { & $pythonExe -m compileall -q app }
  $summary.backendCompile = $true
}
finally { Pop-Location }

Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_project_pipeline.py") }
$summary.projectPipeline = $true

Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "check_report_quality.py") }
$summary.reportQuality = $true

Invoke-FrontendChecks -Source $front -Name "front" -MarkTypecheck { $summary.desktopTypecheck = $true } -MarkBuild { $summary.desktopBuild = $true }
Invoke-FrontendChecks -Source $mobile -Name "front-mobile" -MarkTypecheck { $summary.mobileTypecheck = $true } -MarkBuild { $summary.mobileBuild = $true }

$summary | ConvertTo-Json -Depth 8 | Out-File -LiteralPath (Join-Path $resultDir "agent-check-summary.json") -Encoding utf8
$summary
