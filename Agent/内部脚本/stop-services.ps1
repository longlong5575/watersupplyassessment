param([switch]$Silent)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentRoot = Split-Path -Parent $scriptRoot
$agentParent = Split-Path -Parent $agentRoot
$workspaceRoot = if ((Split-Path -Leaf $agentParent) -eq "watersupplyassessment") { Split-Path -Parent $agentParent } else { $agentParent }
$runScriptsName = -join ([char[]](0x8fd0, 0x884c, 0x811a, 0x672c))
$runtimeRoot = if ($env:WATERSUPPLY_RUNTIME_DIR) { $env:WATERSUPPLY_RUNTIME_DIR } else { Join-Path (Join-Path $workspaceRoot $runScriptsName) "watersupply-agent-runtime" }
$logDir = Join-Path $runtimeRoot "logs"

function Stop-ProcessTree([int]$ProcessId) {
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree ([int]$child.ProcessId)
  }
  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Stop-FromPidFile([string]$PidFile) {
  if (-not (Test-Path -LiteralPath $PidFile)) { return }
  $raw = (Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  $pidValue = 0
  if ([int]::TryParse($raw, [ref]$pidValue)) {
    Stop-ProcessTree $pidValue
  }
  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

function Show-Message([string]$Message, [int]$Icon = 64) {
  try {
    $shell = New-Object -ComObject WScript.Shell
    $title = -join ([char[]](0x0050, 0x0050, 0x0050, 0x519c, 0x6751, 0x6c61, 0x6c34, 0x8003, 0x6838, 0x7cfb, 0x7edf))
    $shell.Popup($Message, 5, $title, $Icon) | Out-Null
  } catch {}
}

try {
  if (Test-Path -LiteralPath $logDir) {
    foreach ($name in @("backend-server.pid", "backend-launcher.pid", "front-server.pid", "front-launcher.pid", "front-mobile-server.pid", "front-mobile-launcher.pid", "admin-account-server.pid")) {
      Stop-FromPidFile (Join-Path $logDir $name)
    }
  }
  $runtimeProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.ProcessId -ne $PID -and
      $_.CommandLine -and
      $_.CommandLine.IndexOf($runtimeRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
    }
  foreach ($runtimeProcess in $runtimeProcesses) {
    Stop-ProcessTree ([int]$runtimeProcess.ProcessId)
  }
  $stoppedMessage = -join ([char[]](0x670d, 0x52a1, 0x5df2, 0x505c, 0x6b62, 0x3002))
  if (-not $Silent) { Show-Message $stoppedMessage }
} catch {
  $failedPrefix = -join ([char[]](0x505c, 0x6b62, 0x670d, 0x52a1, 0x5931, 0x8d25, 0xff1a))
  if (-not $Silent) { Show-Message ($failedPrefix + $_.Exception.Message) 16 }
  throw
}
