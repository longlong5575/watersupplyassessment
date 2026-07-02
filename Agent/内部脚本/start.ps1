$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentRoot = Split-Path -Parent $scriptRoot
$agentParent = Split-Path -Parent $agentRoot
$workspaceRoot = if ((Split-Path -Leaf $agentParent) -eq "watersupplyassessment") { Split-Path -Parent $agentParent } else { $agentParent }
$runScriptsName = -join ([char[]](0x8fd0, 0x884c, 0x811a, 0x672c))
$runtimeRoot = if ($env:WATERSUPPLY_RUNTIME_DIR) { $env:WATERSUPPLY_RUNTIME_DIR } else { Join-Path (Join-Path $workspaceRoot $runScriptsName) "watersupply-agent-runtime" }
$logDir = Join-Path $runtimeRoot "logs"
$logPath = Join-Path $logDir "startup.log"
$statusPath = Join-Path $logDir "startup-status.txt"
$statusJsonPath = Join-Path $logDir "startup-status.json"
$backend = Join-Path $agentRoot "backend"
$front = Join-Path (Join-Path $runtimeRoot "frontend") "front"
$mobile = Join-Path (Join-Path $runtimeRoot "frontend") "front-mobile"

function TextFromCodePoints([int[]]$Codes) {
  return -join ($Codes | ForEach-Object { [char]$_ })
}

$Text = @{
  Title = TextFromCodePoints @(0x6392,0x6c34,0x8003,0x6838,0x7cfb,0x7edf)
  Preparing = TextFromCodePoints @(0x51c6,0x5907,0x542f,0x52a8)
  PreparingMsg = TextFromCodePoints @(0x9996,0x6b21,0x542f,0x52a8,0x4f1a,0x81ea,0x52a8,0x5b89,0x88c5,0x4f9d,0x8d56,0xff0c,0x53ef,0x80fd,0x9700,0x8981,0x51e0,0x5206,0x949f,0x3002)
  Ports = TextFromCodePoints @(0x7aef,0x53e3,0x68c0,0x67e5)
  PortsMsg = TextFromCodePoints @(0x5df2,0x9009,0x62e9,0x53ef,0x7528,0x7aef,0x53e3,0x3002)
  Runtime = TextFromCodePoints @(0x73af,0x5883,0x68c0,0x67e5)
  RuntimeMsg = TextFromCodePoints @(0x6b63,0x5728,0x68c0,0x67e5,0x0020,0x0050,0x0079,0x0074,0x0068,0x006f,0x006e,0x0020,0x548c,0x0020,0x004e,0x006f,0x0064,0x0065,0x002e,0x006a,0x0073,0x3002)
  Dependencies = TextFromCodePoints @(0x521d,0x59cb,0x5316,0x4f9d,0x8d56)
  DependenciesMsg = TextFromCodePoints @(0x6b63,0x5728,0x51c6,0x5907,0x540e,0x7aef,0x548c,0x524d,0x7aef,0x8fd0,0x884c,0x526f,0x672c,0x3002)
  Backend = TextFromCodePoints @(0x542f,0x52a8,0x540e,0x7aef)
  BackendMsg = TextFromCodePoints @(0x6b63,0x5728,0x542f,0x52a8,0x540e,0x7aef,0x670d,0x52a1,0x3002)
  Frontend = TextFromCodePoints @(0x542f,0x52a8,0x524d,0x7aef)
  FrontendMsg = TextFromCodePoints @(0x6b63,0x5728,0x542f,0x52a8,0x5e73,0x53f0,0x7aef,0x548c,0x79fb,0x52a8,0x7aef,0x3002)
  Ready = TextFromCodePoints @(0x542f,0x52a8,0x5b8c,0x6210)
  ReadyMsg = TextFromCodePoints @(0x7cfb,0x7edf,0x5df2,0x53ef,0x4f7f,0x7528,0x3002)
  Failed = TextFromCodePoints @(0x542f,0x52a8,0x5931,0x8d25)
}

function Write-StartupStatus([string]$Stage, [string]$Message, [hashtable]$Extra = @{}) {
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $timestamp = (Get-Date).ToString("s")
  "[$timestamp] $Stage - $Message" | Out-File -LiteralPath $statusPath -Append -Encoding utf8
  $payload = [ordered]@{ generatedAt = $timestamp; stage = $Stage; message = $Message; runtimeRoot = $runtimeRoot; logPath = $logPath }
  foreach ($key in $Extra.Keys) { $payload[$key] = $Extra[$key] }
  $payload | ConvertTo-Json -Depth 8 | Out-File -LiteralPath $statusJsonPath -Encoding utf8
}

function Show-StartupFailure([string]$Message) {
  try {
    $shell = New-Object -ComObject WScript.Shell
    $shell.Popup("Startup failed: $Message`n`nPlease send this log file to support:`n$logPath", 0, "Watersupply Assessment", 16) | Out-Null
  } catch {}
}

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

function Start-Frontend([string]$directory, [int]$Port) {
  $command = "Set-Location -LiteralPath '$directory'; if (Get-Command pnpm -ErrorAction SilentlyContinue) { pnpm exec vite --host 127.0.0.1 --port $Port --strictPort } else { npx --yes pnpm@10.12.1 exec vite --host 127.0.0.1 --port $Port --strictPort }"
  $process = Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"$command`"" -PassThru
  return $process.Id
}

function Wait-ForUrl([string]$url) {
  $lastError = $null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null; return } catch { $lastError = $_.Exception.Message; Start-Sleep -Seconds 1 }
  }
  throw "Service startup timed out: $url ($lastError)"
}

function Test-UrlReady([string]$url) {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Test-PortAvailable([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if ($async.AsyncWaitHandle.WaitOne(200, $false)) {
      $client.EndConnect($async)
      return $false
    }
    return $true
  } catch {
    return $true
  } finally {
    $client.Close()
  }
}

function Get-FreePort([int]$Preferred, [int]$Start, [int]$End) {
  if (Test-PortAvailable $Preferred) { return $Preferred }
  for ($port = $Start; $port -le $End; $port++) {
    if (Test-PortAvailable $port) { return $port }
  }
  throw "No free port found between $Start and $End."
}

function Set-FrontendEnv([string]$directory, [int]$BackendPort) {
  "VITE_API_BASE_URL=http://127.0.0.1:$BackendPort/api" | Out-File -LiteralPath (Join-Path $directory ".env.local") -Encoding utf8
}

try {
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  Write-StartupStatus $Text.Preparing $Text.PreparingMsg
  Start-Transcript -LiteralPath $logPath -Append | Out-Null
  if ((Test-UrlReady "http://127.0.0.1:8000/health") -and (Test-UrlReady "http://127.0.0.1:5173") -and (Test-UrlReady "http://127.0.0.1:5174")) {
    Write-StartupStatus $Text.Ready $Text.ReadyMsg @{ backendUrl = "http://127.0.0.1:8000"; platformUrl = "http://127.0.0.1:5173"; mobileUrl = "http://127.0.0.1:5174" }
    Start-Process "http://127.0.0.1:5173"
    Start-Process "http://127.0.0.1:5174"
    return
  }
  $backendPort = Get-FreePort 8000 8100 8199
  $frontPort = Get-FreePort 5173 5200 5299
  $mobilePort = Get-FreePort 5174 5300 5399
  $env:BACKEND_PORT = [string]$backendPort
  $env:FRONT_PORT = [string]$frontPort
  $env:MOBILE_PORT = [string]$mobilePort
  Write-StartupStatus $Text.Ports $Text.PortsMsg @{ backendUrl = "http://127.0.0.1:$backendPort"; platformUrl = "http://127.0.0.1:$frontPort"; mobileUrl = "http://127.0.0.1:$mobilePort" }
  Add-CommonRuntimePaths
  Write-StartupStatus $Text.Runtime $Text.RuntimeMsg
  Install-Python312
  Install-Node
  Write-StartupStatus $Text.Dependencies $Text.DependenciesMsg
  & (Join-Path $scriptRoot "init-recipient.ps1")
  Set-FrontendEnv $front $backendPort
  Set-FrontendEnv $mobile $backendPort
  $backendPythonw = Join-Path (Join-Path (Join-Path $runtimeRoot "backend") ".venv") "Scripts\pythonw.exe"
  Write-StartupStatus $Text.Backend $Text.BackendMsg
  & $backendPythonw (Join-Path $backend "start_backend_silent.py")
  Write-StartupStatus $Text.Frontend $Text.FrontendMsg
  $frontPid = Start-Frontend $front $frontPort
  $mobilePid = Start-Frontend $mobile $mobilePort
  $frontPid | Out-File -LiteralPath (Join-Path $logDir "front-server.pid") -Encoding ascii
  $mobilePid | Out-File -LiteralPath (Join-Path $logDir "front-mobile-server.pid") -Encoding ascii
  Wait-ForUrl "http://127.0.0.1:$backendPort/health"
  Wait-ForUrl "http://127.0.0.1:$frontPort"
  Wait-ForUrl "http://127.0.0.1:$mobilePort"
  Write-StartupStatus $Text.Ready $Text.ReadyMsg @{ backendUrl = "http://127.0.0.1:$backendPort"; platformUrl = "http://127.0.0.1:$frontPort"; mobileUrl = "http://127.0.0.1:$mobilePort" }
  Start-Process "http://127.0.0.1:$frontPort"
  Start-Process "http://127.0.0.1:$mobilePort"
} catch {
  $message = $_.Exception.Message
  Write-StartupStatus $Text.Failed $message
  $_ | Out-File -LiteralPath $logPath -Append -Encoding utf8
  Show-StartupFailure $message
} finally {
  try { Stop-Transcript | Out-Null } catch {}
}
