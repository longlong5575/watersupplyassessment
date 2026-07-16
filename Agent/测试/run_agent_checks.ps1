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

$dependencyRoot = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"
$bundledNode = Join-Path $dependencyRoot "node\bin\node.exe"
$bundledPnpm = Join-Path $dependencyRoot "node\node_modules\pnpm\bin\pnpm.cjs"
$pnpm = if (Get-Command "pnpm" -ErrorAction SilentlyContinue) { (Get-Command "pnpm").Source } else { "pnpm" }
$pythonExe = $env:PYTHON312_EXE
if (-not $pythonExe -or -not (Test-Path -LiteralPath $pythonExe)) {
  $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
  if (Test-Path -LiteralPath $candidate) { $pythonExe = $candidate }
}
$pythonPackages = Join-Path (Join-Path $runtimeRoot "backend") "python-packages-current"
if (-not (Test-Path -LiteralPath $pythonPackages) -or -not (Test-Path -LiteralPath (Join-Path $pythonPackages "jwt"))) {
  & (Join-Path (Join-Path $agentRoot "内部脚本") "init-recipient.ps1")
}
if (-not $pythonExe -or -not (Test-Path -LiteralPath $pythonExe)) {
  throw "Python 3.12 is missing after initialization."
}
$env:PYTHONPATH = (($pythonPackages, $env:PYTHONPATH) | Where-Object { $_ }) -join ";"

function Invoke-Checked {
  param([scriptblock]$Command)
  & $Command
  if ($LASTEXITCODE -ne 0) { throw ("Command failed with exit code " + $LASTEXITCODE) }
}

function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  if ((Test-Path -LiteralPath $bundledNode) -and (Test-Path -LiteralPath $bundledPnpm)) {
    & $bundledNode $bundledPnpm @Arguments
    return
  }
  & $pnpm @Arguments
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
      Invoke-Checked { Invoke-Pnpm install --config.confirm-modules-purge=false }
      Invoke-Checked { Invoke-Pnpm typecheck }
      & $MarkTypecheck
      Invoke-Checked { Invoke-Pnpm build }
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

$powerShellScripts = @(
  Get-ChildItem -LiteralPath $agentRoot -File -Filter "*.ps1"
  Get-ChildItem -LiteralPath (Join-Path $agentRoot "内部脚本") -File -Filter "*.ps1"
  Get-Item -LiteralPath $PSCommandPath
)
foreach ($scriptFile in $powerShellScripts) {
  $tokens = $null
  $parseErrors = $null
  [void][System.Management.Automation.Language.Parser]::ParseFile($scriptFile.FullName, [ref]$tokens, [ref]$parseErrors)
  if ($parseErrors.Count -gt 0) {
    throw ("PowerShell脚本语法错误：" + $scriptFile.FullName + " - " + ($parseErrors.Message -join "；"))
  }
}
Write-Output "PASS: Windows启动与停止脚本语法检查"

Push-Location $backend
try {
  Invoke-Checked { & $pythonExe -m compileall -q app }
  $summary.backendCompile = $true
}
finally { Pop-Location }

Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_project_pipeline.py") }
$summary.projectPipeline = $true

Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_calculation_rules.py") }
Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_word_field_materialization.py") }
Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_standard_option_generation.py") }
Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_standard_integrity.py") }
Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_standard_save_validation.py") }
Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_auth_security.py") }
Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_account_data_isolation.py") }
Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_api_access_control.py") }
Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_upload_safety.py") }
Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_fresh_database_migration.py") }
Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "test_no_taishan_residue.py") }

Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "check_report_quality.py") }
$summary.reportQuality = $true

Invoke-Checked { & $pythonExe (Join-Path $PSScriptRoot "check_ui_copy.py") }

Invoke-FrontendChecks -Source $front -Name "front" -MarkTypecheck { $summary.desktopTypecheck = $true } -MarkBuild { $summary.desktopBuild = $true }
Invoke-FrontendChecks -Source $mobile -Name "front-mobile" -MarkTypecheck { $summary.mobileTypecheck = $true } -MarkBuild { $summary.mobileBuild = $true }

$summary | ConvertTo-Json -Depth 8 | Out-File -LiteralPath (Join-Path $resultDir "agent-check-summary.json") -Encoding utf8
$summary
