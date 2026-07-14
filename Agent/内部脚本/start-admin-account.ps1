param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentRoot = Split-Path -Parent $scriptRoot
$runtimeRoot = if ($env:WATERSUPPLY_RUNTIME_DIR) { $env:WATERSUPPLY_RUNTIME_DIR } else { Join-Path (Join-Path (Split-Path -Parent (Split-Path -Parent $agentRoot)) "运行脚本") "watersupply-agent-runtime" }
$logDir = Join-Path $runtimeRoot "logs"
$adminRoot = Join-Path $agentRoot "管理员账号管理"

function Test-PortAvailable([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if ($async.AsyncWaitHandle.WaitOne(200, $false)) { $client.EndConnect($async); return $false }
    return $true
  } catch { return $true } finally { $client.Close() }
}
function Get-FreePort {
  foreach ($port in 5180..5199) { if (Test-PortAvailable $port) { return $port } }
  throw "未找到可用的管理员入口端口。"
}
function Wait-ForUrl([string]$Url) {
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try { Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null; return } catch { Start-Sleep -Seconds 1 }
  }
  throw "管理员入口启动超时：$Url"
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$pidPath = Join-Path $logDir "admin-account-server.pid"
if (Test-Path -LiteralPath $pidPath) {
  $oldPid = Get-Content -LiteralPath $pidPath -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
}
& (Join-Path $scriptRoot "start.ps1") -NoBrowser
$port = Get-FreePort
$python = if ($env:PYTHON312_EXE) { $env:PYTHON312_EXE } else { Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe" }
if (-not (Test-Path -LiteralPath $python)) { throw "未找到 Python 3.12。" }
$stdout = Join-Path $logDir "admin-account-server.out.log"
$stderr = Join-Path $logDir "admin-account-server.err.log"
$launcher = Join-Path (Join-Path $agentRoot "backend") "start_hidden_process.py"
$processId = & $python $launcher --working-directory $adminRoot --stdout $stdout --stderr $stderr -- $python -m http.server $port --bind 127.0.0.1 --directory $adminRoot
if ($LASTEXITCODE -ne 0 -or -not $processId) { throw "管理员入口静默启动失败。" }
[int]($processId | Select-Object -Last 1) | Out-File -LiteralPath $pidPath -Encoding ascii
$url = "http://127.0.0.1:$port"
Wait-ForUrl $url
if (-not $NoBrowser) { Start-Process $url }
