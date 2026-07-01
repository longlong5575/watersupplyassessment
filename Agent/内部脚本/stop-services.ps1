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
    $shell.Popup($Message, 5, "Watersupply Assessment", $Icon) | Out-Null
  } catch {}
}

try {
  if (Test-Path -LiteralPath $logDir) {
    foreach ($name in @("backend-server.pid", "backend-launcher.pid", "front-server.pid", "front-launcher.pid", "front-mobile-server.pid", "front-mobile-launcher.pid")) {
      Stop-FromPidFile (Join-Path $logDir $name)
    }
  }
  Show-Message "Services have been stopped."
} catch {
  Show-Message ("Stop failed: " + $_.Exception.Message) 16
  throw
}
