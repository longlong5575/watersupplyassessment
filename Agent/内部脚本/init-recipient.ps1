$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentRoot = Split-Path -Parent $scriptRoot
$agentParent = Split-Path -Parent $agentRoot
$workspaceRoot = if ((Split-Path -Leaf $agentParent) -eq "watersupplyassessment") { Split-Path -Parent $agentParent } else { $agentParent }
$runScriptsName = -join ([char[]](0x8fd0, 0x884c, 0x811a, 0x672c))
$runtimeRoot = if ($env:WATERSUPPLY_RUNTIME_DIR) { $env:WATERSUPPLY_RUNTIME_DIR } else { Join-Path (Join-Path $workspaceRoot $runScriptsName) "watersupply-agent-runtime" }
$backend = Join-Path $agentRoot "backend"
$front = Join-Path (Join-Path $agentRoot "frontend") "front"
$mobile = Join-Path (Join-Path $agentRoot "frontend") "front-mobile"
$runtimeBackend = Join-Path $runtimeRoot "backend"
$runtimeFront = Join-Path (Join-Path $runtimeRoot "frontend") "front"
$runtimeMobile = Join-Path (Join-Path $runtimeRoot "frontend") "front-mobile"

function Require-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { throw "Missing required command: $name" }
}

function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  if (Get-Command "pnpm" -ErrorAction SilentlyContinue) { & pnpm @Arguments; return }
  if (Get-Command "npx" -ErrorAction SilentlyContinue) { & npx --yes pnpm@10.12.1 @Arguments; return }
  throw "Node.js with npm/npx is required to initialize the frontends."
}

function Initialize-Frontend([string]$directory) {
  $example = Join-Path $directory ".env.example"
  $local = Join-Path $directory ".env.local"
  if ((Test-Path -LiteralPath $example) -and -not (Test-Path -LiteralPath $local)) { Copy-Item -LiteralPath $example -Destination $local }
  Push-Location $directory
  try { Invoke-Pnpm install --frozen-lockfile }
  finally { Pop-Location }
}

function Sync-RuntimeFrontend([string]$source, [string]$target) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  robocopy $source $target /MIR /XD node_modules dist .vite /XF .env.local *.log *.pid /R:2 /W:1 | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "Failed to prepare frontend runtime copy: $source" }
}

function Install-PythonRequirements {
  param([string]$PythonExe)
  & $PythonExe -m pip install --disable-pip-version-check -r requirements.txt
  if ($LASTEXITCODE -eq 0) { return }
  & $PythonExe -m pip install --disable-pip-version-check --timeout 30 --retries 2 -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
  if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed." }
}

Require-Command "node"

$python312 = $env:PYTHON312_EXE
if (-not $python312 -or -not (Test-Path -LiteralPath $python312)) {
  $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
  if (Test-Path -LiteralPath $candidate) { $python312 = $candidate }
  else { $python312 = (& py -3.12 -c "import sys; print(sys.executable)").Trim() }
}

Push-Location $backend
try {
  New-Item -ItemType Directory -Force -Path $runtimeBackend | Out-Null
  $venvPath = Join-Path $runtimeBackend ".venv"
  $venvConfig = Join-Path $venvPath "pyvenv.cfg"
  if ((Test-Path -LiteralPath $venvConfig) -and -not (Select-String -LiteralPath $venvConfig -Pattern "version = 3\.12" -Quiet)) {
    Remove-Item -LiteralPath $venvPath -Recurse -Force
  }
  & $python312 -m venv $venvPath
  Install-PythonRequirements (Join-Path $venvPath "Scripts\python.exe")
}
finally { Pop-Location }

Sync-RuntimeFrontend $front $runtimeFront
Sync-RuntimeFrontend $mobile $runtimeMobile
Initialize-Frontend $runtimeFront
Initialize-Frontend $runtimeMobile
