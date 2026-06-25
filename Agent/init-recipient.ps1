$ErrorActionPreference = "Stop"

$agentRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $agentRoot "backend"
$front = Join-Path (Join-Path $agentRoot "frontend") "front"
$mobile = Join-Path (Join-Path $agentRoot "frontend") "front-mobile"

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

Require-Command "node"

$python312 = $env:PYTHON312_EXE
if (-not $python312 -or -not (Test-Path -LiteralPath $python312)) {
  $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
  if (Test-Path -LiteralPath $candidate) { $python312 = $candidate }
  else { $python312 = (& py -3.12 -c "import sys; print(sys.executable)").Trim() }
}

Push-Location $backend
try {
  $venvConfig = Join-Path $backend ".venv\pyvenv.cfg"
  if ((Test-Path -LiteralPath $venvConfig) -and -not (Select-String -LiteralPath $venvConfig -Pattern "version = 3\.12" -Quiet)) {
    Remove-Item -LiteralPath (Join-Path $backend ".venv") -Recurse -Force
  }
  & $python312 -m venv .venv
  & ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
}
finally { Pop-Location }

Initialize-Frontend $front
Initialize-Frontend $mobile
