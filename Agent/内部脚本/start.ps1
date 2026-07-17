param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentRoot = Split-Path -Parent $scriptRoot
$agentParent = Split-Path -Parent $agentRoot
$env:APP_ENV = "delivery"
$env:LOCAL_AUTO_LOGIN = "false"
$localModePath = Join-Path $agentRoot ".env.local"
if (Test-Path -LiteralPath $localModePath) {
  foreach ($rawLine in Get-Content -LiteralPath $localModePath -Encoding utf8) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { continue }
    $parts = $line.Split("=", 2)
    $key = $parts[0].Trim().ToUpperInvariant()
    $value = $parts[1].Trim()
    if ($key -eq "APP_ENV") { $env:APP_ENV = $value }
    if ($key -eq "LOCAL_AUTO_LOGIN") { $env:LOCAL_AUTO_LOGIN = $value }
  }
}
$workspaceRoot = if ((Split-Path -Leaf $agentParent) -eq "watersupplyassessment") { Split-Path -Parent $agentParent } else { $agentParent }
$runScriptsName = -join ([char[]](0x8fd0, 0x884c, 0x811a, 0x672c))
$runtimeRoot = if ($env:WATERSUPPLY_RUNTIME_DIR) { $env:WATERSUPPLY_RUNTIME_DIR } else { Join-Path (Join-Path $workspaceRoot $runScriptsName) "watersupply-agent-runtime" }
$env:WATERSUPPLY_RUNTIME_DIR = $runtimeRoot
$logDir = Join-Path $runtimeRoot "logs"
$logPath = Join-Path $logDir "startup.log"
$statusPath = Join-Path $logDir "startup-status.txt"
$statusJsonPath = Join-Path $logDir "startup-status.json"
$launchMutex = New-Object System.Threading.Mutex($false, "Local\PPP-Rural-Sewage-Assessment-Startup")
$launchLockAcquired = $false
$backend = Join-Path $agentRoot "backend"
$front = Join-Path (Join-Path $runtimeRoot "frontend") "front"
$mobile = Join-Path (Join-Path $runtimeRoot "frontend") "front-mobile"

function TextFromCodePoints([int[]]$Codes) {
  return -join ($Codes | ForEach-Object { [char]$_ })
}

$Text = @{
  Title = TextFromCodePoints @(0x0050,0x0050,0x0050,0x519c,0x6751,0x6c61,0x6c34,0x8003,0x6838,0x7cfb,0x7edf)
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
  FailurePrefix = TextFromCodePoints @(0x542f,0x52a8,0x5931,0x8d25,0xff1a)
  FailureLogHint = TextFromCodePoints @(0x8bf7,0x5c06,0x6b64,0x65e5,0x5fd7,0x6587,0x4ef6,0x53d1,0x9001,0x7ed9,0x6280,0x672f,0x652f,0x6301,0xff1a)
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
    $shell.Popup(($Text.FailurePrefix + $Message + "`n`n" + $Text.FailureLogHint + "`n" + $logPath), 0, $Text.Title, 16) | Out-Null
  } catch {}
}

function Add-CommonRuntimePaths {
  foreach ($path in @("$env:ProgramFiles\nodejs", "$env:LOCALAPPDATA\Programs\Python\Python312", "$env:LOCALAPPDATA\Programs\Python\Python312\Scripts")) {
    if ((Test-Path -LiteralPath $path) -and -not (($env:Path -split ';') -contains $path)) { $env:Path = "$path;$env:Path" }
  }
}

function Install-Node {
  if (Get-Command "node" -ErrorAction SilentlyContinue) { return }
  if (-not (Get-Command "winget" -ErrorAction SilentlyContinue)) { throw "缺少 Node.js，且当前系统无法使用 Windows 应用安装器自动安装。" }
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
  if (-not (Get-Command "winget" -ErrorAction SilentlyContinue)) { throw "缺少 Python 3.12，且当前系统无法使用 Windows 应用安装器自动安装。" }
  & winget install --id Python.Python.3.12 --exact --silent --accept-package-agreements --accept-source-agreements
  $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
  if (-not (Test-Path -LiteralPath $candidate)) { throw "Python 3.12 安装完成后仍未找到可执行文件。" }
  $env:PYTHON312_EXE = $candidate
}

function Start-Frontend([string]$directory, [int]$Port, [string]$Name, [string]$PythonExe) {
  $nodeCommand = Get-Command "node" -ErrorAction SilentlyContinue
  $viteEntry = Join-Path $directory "node_modules\vite\bin\vite.js"
  if (-not $nodeCommand) { throw "未找到 Node.js，无法启动前端服务。" }
  $nodeExecutable = $nodeCommand.Source
  if ([IO.Path]::GetExtension($nodeExecutable) -in @(".cmd", ".bat")) {
    try {
      $resolvedNode = (& $nodeExecutable -p "process.execPath" 2>$null | Select-Object -Last 1).Trim()
      if ($resolvedNode -and (Test-Path -LiteralPath $resolvedNode)) { $nodeExecutable = $resolvedNode }
    } catch {}
  }
  if ([IO.Path]::GetExtension($nodeExecutable) -ne ".exe" -or -not (Test-Path -LiteralPath $nodeExecutable)) {
    throw "未能找到真实的 Node.js 可执行文件，请重新安装 Node.js 后重试。"
  }
  if (-not (Test-Path -LiteralPath $viteEntry)) { throw "前端依赖不完整，请重新启动系统以自动修复。" }
  $stdoutPath = Join-Path $logDir "$Name.out.log"
  $stderrPath = Join-Path $logDir "$Name.err.log"
  $arguments = @($viteEntry, "--host", "127.0.0.1", "--port", [string]$Port, "--strictPort")
  $launcher = Join-Path $backend "start_hidden_process.py"
  $processId = & $PythonExe $launcher --working-directory $directory --stdout $stdoutPath --stderr $stderrPath -- $nodeExecutable @arguments
  if ($LASTEXITCODE -ne 0 -or -not $processId) { throw "前端服务静默启动失败：$Name" }
  return [int]($processId | Select-Object -Last 1)
}

function Wait-ForUrl([string]$url) {
  $lastError = $null
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try { Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null; return } catch { $lastError = $_.Exception.Message; Start-Sleep -Seconds 1 }
  }
  throw "服务启动超时：$url（$lastError）"
}

function Test-UrlReady([string]$url) {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Get-AppBuildId {
  $sourceRoots = @(
    (Join-Path $agentRoot "backend\app"),
    (Join-Path $agentRoot "frontend\front\src"),
    (Join-Path $agentRoot "frontend\front-mobile\src")
  )
  $sourceFiles = foreach ($sourceRoot in $sourceRoots) {
    if (Test-Path -LiteralPath $sourceRoot) {
      Get-ChildItem -LiteralPath $sourceRoot -Recurse -File -ErrorAction SilentlyContinue
    }
  }
  $configFiles = @(
    (Join-Path $agentRoot "backend\requirements.txt"),
    (Join-Path $agentRoot "backend\pyproject.toml"),
    (Join-Path $agentRoot "frontend\front\package.json"),
    (Join-Path $agentRoot "frontend\front\pnpm-lock.yaml"),
    (Join-Path $agentRoot "frontend\front\index.html"),
    (Join-Path $agentRoot "frontend\front-mobile\package.json"),
    (Join-Path $agentRoot "frontend\front-mobile\pnpm-lock.yaml"),
    (Join-Path $agentRoot "frontend\front-mobile\index.html")
  ) | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Get-Item -LiteralPath $_ }
  $latest = @($sourceFiles) + @($configFiles) |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
  if (-not $latest) { throw "未找到应用程序源文件，请确认 Agent 文件夹完整。" }
  return $latest.LastWriteTimeUtc.Ticks.ToString()
}

function Test-BackendBuild([string]$url, [string]$ExpectedBuildId) {
  try {
    $health = Invoke-RestMethod -Uri "$url/health" -TimeoutSec 2
    return ($health.status -eq "ok" -and $health.buildId -eq $ExpectedBuildId)
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
  throw "在 $Start 至 $End 范围内没有可用端口。"
}

function Set-FrontendEnv([string]$directory, [int]$BackendPort) {
  "VITE_API_BASE_URL=http://127.0.0.1:$BackendPort/api" | Out-File -LiteralPath (Join-Path $directory ".env.local") -Encoding utf8
}

function Get-LastServiceUrls {
  $urls = [ordered]@{
    backend = "http://127.0.0.1:8000"
    platform = "http://127.0.0.1:5173"
    mobile = "http://127.0.0.1:5174"
  }
  if (Test-Path -LiteralPath $statusJsonPath) {
    try {
      $status = Get-Content -LiteralPath $statusJsonPath -Raw -Encoding utf8 | ConvertFrom-Json
      if ($status.backendUrl) { $urls.backend = [string]$status.backendUrl }
      if ($status.platformUrl) { $urls.platform = [string]$status.platformUrl }
      if ($status.mobileUrl) { $urls.mobile = [string]$status.mobileUrl }
    } catch {}
  }
  return $urls
}

function Close-OldAppBrowserWindows {
  $titlePatterns = @(
    "*PPP农村污水考核系统*",
    "*农村污水考核录入工具*"
  )
  $browserNames = @("chrome", "msedge", "firefox", "iexplore", "brave", "opera")
  foreach ($process in Get-Process -ErrorAction SilentlyContinue | Where-Object { $browserNames -contains $_.ProcessName -and $_.MainWindowTitle }) {
    foreach ($pattern in $titlePatterns) {
      if ($process.MainWindowTitle -like $pattern) {
        try { $process.CloseMainWindow() | Out-Null } catch {}
        break
      }
    }
  }
  Start-Sleep -Milliseconds 500
}

try {
  $launchLockAcquired = $launchMutex.WaitOne(0)
  if (-not $launchLockAcquired) { return }
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  Write-StartupStatus $Text.Preparing $Text.PreparingMsg
  $appBuildId = Get-AppBuildId
  $env:WATERSUPPLY_BUILD_ID = $appBuildId
  $lastUrls = Get-LastServiceUrls
  $lastBackendPort = ([uri]$lastUrls.backend).Port
  $lastPlatformPort = ([uri]$lastUrls.platform).Port
  $lastMobilePort = ([uri]$lastUrls.mobile).Port
  $lastPortsBusy = (-not (Test-PortAvailable $lastBackendPort)) -and (-not (Test-PortAvailable $lastPlatformPort)) -and (-not (Test-PortAvailable $lastMobilePort))
  if ($lastPortsBusy -and (Test-BackendBuild $lastUrls.backend $appBuildId) -and (Test-UrlReady $lastUrls.platform) -and (Test-UrlReady $lastUrls.mobile)) {
    Write-StartupStatus $Text.Ready $Text.ReadyMsg @{ backendUrl = $lastUrls.backend; platformUrl = $lastUrls.platform; mobileUrl = $lastUrls.mobile }
    if (-not $NoBrowser) {
      Close-OldAppBrowserWindows
      Start-Process $lastUrls.platform
      Start-Process $lastUrls.mobile
    }
    return
  }
  $managedPidFiles = @("backend-server.pid", "front-server.pid", "front-mobile-server.pid") | ForEach-Object { Join-Path $logDir $_ }
  if ($managedPidFiles | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1) {
    & (Join-Path $scriptRoot "stop-services.ps1") -Silent
    Start-Sleep -Seconds 1
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
  $backendLauncherPython = $env:PYTHON312_EXE
  if (-not $backendLauncherPython) { throw "未找到 Python 运行环境，请重新启动系统以自动修复。" }
  Write-StartupStatus $Text.Backend $Text.BackendMsg
  $backendStarterScript = Join-Path $backend "start_backend_silent.py"
  $backendStarter = Start-Process -FilePath $backendLauncherPython -ArgumentList "`"$backendStarterScript`"" -WorkingDirectory $backend -WindowStyle Hidden -PassThru
  Write-StartupStatus $Text.Frontend $Text.FrontendMsg
  $frontPid = Start-Frontend $front $frontPort "front-server" $backendLauncherPython
  $mobilePid = Start-Frontend $mobile $mobilePort "front-mobile-server" $backendLauncherPython
  $frontPid | Out-File -LiteralPath (Join-Path $logDir "front-server.pid") -Encoding ascii
  $mobilePid | Out-File -LiteralPath (Join-Path $logDir "front-mobile-server.pid") -Encoding ascii
  Wait-ForUrl "http://127.0.0.1:$backendPort/health"
  Wait-ForUrl "http://127.0.0.1:$frontPort"
  Wait-ForUrl "http://127.0.0.1:$mobilePort"
  if ($backendStarter.HasExited -and $backendStarter.ExitCode -ne 0) { throw "后端启动程序异常退出，请查看启动日志。" }
  Write-StartupStatus $Text.Ready $Text.ReadyMsg @{ backendUrl = "http://127.0.0.1:$backendPort"; platformUrl = "http://127.0.0.1:$frontPort"; mobileUrl = "http://127.0.0.1:$mobilePort" }
  if (-not $NoBrowser) {
    Close-OldAppBrowserWindows
    Start-Process "http://127.0.0.1:$frontPort"
    Start-Process "http://127.0.0.1:$mobilePort"
  }
} catch {
  $message = $_.Exception.Message
  Write-StartupStatus $Text.Failed $message
  $_ | Out-File -LiteralPath $logPath -Append -Encoding utf8
  if ($NoBrowser) { throw }
  Show-StartupFailure $message
} finally {
  if ($launchLockAcquired) {
    try { $launchMutex.ReleaseMutex() } catch {}
  }
  $launchMutex.Dispose()
}
