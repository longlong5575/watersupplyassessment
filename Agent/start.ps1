$ErrorActionPreference = "Stop"

$agentRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$logPath = Join-Path $agentRoot "startup.log"
$backend = Join-Path $agentRoot "back"
$front = Join-Path $agentRoot "front"
$mobile = Join-Path $agentRoot "front-mobile"

function Add-CommonRuntimePaths {
  foreach ($path in @("$env:ProgramFiles\nodejs", "$env:LOCALAPPDATA\Programs\Python\Python312", "$env:LOCALAPPDATA\Programs\Python\Python312\Scripts")) {
    if ((Test-Path -LiteralPath $path) -and -not (($env:Path -split ';') -contains $path)) { $env:Path = "$path;$env:Path" }
  }
}

function Install-Node {
  if (Get-Command "node" -ErrorAction SilentlyContinue) { return }
  if (-not (Get-Command "winget" -ErrorAction SilentlyContinue)) { throw "Node.js is required and Windows App Installer is unavailable." }
  & winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
  Add-CommonRuntimePaths
}

function Install-Python312 {
  if ($env:PYTHON312_EXE -and (Test-Path -LiteralPath $env:PYTHON312_EXE)) { return }
  $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
  if (Test-Path -LiteralPath $candidate) { $env:PYTHON312_EXE = $candidate; return }
  try {
    $detected = (& py -3.12 -c "import sys; print(sys.executable)").Trim()
    if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $detected)) { $env:PYTHON312_EXE = $detected; return }
  } catch {}
  if (-not (Get-Command "winget" -ErrorAction SilentlyContinue)) { throw "Python 3.12 is required and Windows App Installer is unavailable." }
  & winget install --id Python.Python.3.12 --exact --silent --accept-package-agreements --accept-source-agreements
  $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
  if (-not (Test-Path -LiteralPath $candidate)) { throw "Python 3.12 installation did not produce the expected executable." }
  $env:PYTHON312_EXE = $candidate
}

function Start-Frontend([string]$directory) {
  $command = "Set-Location -LiteralPath '$directory'; if (Get-Command pnpm -ErrorAction SilentlyContinue) { pnpm run dev:local } else { npx --yes pnpm@10.12.1 run dev:local }"
  Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"$command`""
}

function Wait-ForUrl([string]$url) {
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null; return } catch { Start-Sleep -Seconds 1 }
  }
}

try {
  Start-Transcript -LiteralPath $logPath -Append | Out-Null
  Add-CommonRuntimePaths
  Install-Python312
  Install-Node
  & (Join-Path $agentRoot "init-recipient.ps1")
  & (Join-Path $backend ".venv\Scripts\pythonw.exe") (Join-Path $backend "start_backend_silent.py")
  Start-Frontend $front
  Start-Frontend $mobile
  Wait-ForUrl "http://127.0.0.1:5173"
  Wait-ForUrl "http://127.0.0.1:5174"
  Start-Process "http://127.0.0.1:5173"
  Start-Process "http://127.0.0.1:5174"
} catch {
  $_ | Out-File -LiteralPath $logPath -Append -Encoding utf8
} finally {
  try { Stop-Transcript | Out-Null } catch {}
}
