$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentRoot = Split-Path -Parent $scriptRoot
$agentParent = Split-Path -Parent $agentRoot
$workspaceRoot = if ((Split-Path -Leaf $agentParent) -eq "watersupplyassessment") { Split-Path -Parent $agentParent } else { $agentParent }
$runScriptsName = -join ([char[]](0x8fd0, 0x884c, 0x811a, 0x672c))
$runtimeRoot = if ($env:WATERSUPPLY_RUNTIME_DIR) { $env:WATERSUPPLY_RUNTIME_DIR } else { Join-Path (Join-Path $workspaceRoot $runScriptsName) "watersupply-agent-runtime" }

function Show-Message([string]$Message, [int]$Icon = 64) {
  try {
    $shell = New-Object -ComObject WScript.Shell
    $shell.Popup($Message, 0, "Watersupply Assessment", $Icon) | Out-Null
  } catch {}
}

try {
  if (Test-Path -LiteralPath $runtimeRoot) {
    $resolved = (Resolve-Path -LiteralPath $runtimeRoot).Path
    $workspaceResolved = (Resolve-Path -LiteralPath $workspaceRoot).Path
    if (-not $resolved.StartsWith($workspaceResolved, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Runtime folder is outside this workspace. Cleanup refused." }
    if ((Split-Path -Leaf $resolved) -ne "watersupply-agent-runtime") { throw "Unexpected runtime folder name. Cleanup refused." }
    Remove-Item -LiteralPath $resolved -Recurse -Force
  }
  Show-Message "Runtime data has been cleaned. The next startup will initialize the environment and database again."
} catch {
  Show-Message ("Cleanup failed: " + $_.Exception.Message) 16
  throw
}
