$ErrorActionPreference = "Stop"

$agentRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$result = [ordered]@{
  generatedAt = (Get-Date).ToString("s")
  sourceClean = $false
  oldReferencesClean = $false
  fullChecksPassed = $false
}

function Assert-NoItems($Items, [string]$Message) {
  if ($Items -and @($Items).Count -gt 0) {
    $list = ($Items | Select-Object -First 10 | ForEach-Object { $_.FullName }) -join "`n"
    throw "$Message`n$list"
  }
}

function Assert-SourceClean {
  $generatedDirNames = @("node_modules", "dist", "logs", "storage", "__pycache__", ".venv", ".vite")
  $generatedDirs = Get-ChildItem -LiteralPath $agentRoot -Recurse -Force -Directory | Where-Object { $generatedDirNames -contains $_.Name }
  Assert-NoItems $generatedDirs "Generated runtime directories were found inside the source folder."
  $generatedFiles = Get-ChildItem -LiteralPath $agentRoot -Recurse -Force -File | Where-Object {
    $_.Name -eq ".env.local" -or $_.Extension -in @(".log", ".pid", ".db", ".sqlite", ".sqlite3")
  }
  Assert-NoItems $generatedFiles "Generated runtime files were found inside the source folder."
}

Get-ChildItem -LiteralPath $agentRoot -Recurse -Force -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
Assert-SourceClean
$result.sourceClean = $true

$legacyPatterns = @("Agent/tests", "run_extreme_checks", "run_report_task_check", "build_test_report", "start.vbs")
$textFiles = Get-ChildItem -LiteralPath $agentRoot -Recurse -Force -File | Where-Object {
  $_.FullName -notmatch "\\node_modules\\" -and
  $_.Name -ne "preflight_delivery_check.ps1" -and
  $_.Extension -in @(".ps1", ".vbs", ".py", ".ts", ".tsx", ".js", ".json", ".md", ".html", ".css")
}
foreach ($pattern in $legacyPatterns) {
  $matches = $textFiles | Select-String -Pattern $pattern -SimpleMatch
  if ($matches) { throw "Legacy reference found: $pattern`n$($matches | Select-Object -First 10 | Out-String)" }
}
$result.oldReferencesClean = $true

& (Join-Path $PSScriptRoot "run_agent_checks.ps1")
if ($LASTEXITCODE -ne 0) { throw "Full integration checks failed." }
$result.fullChecksPassed = $true

Get-ChildItem -LiteralPath $agentRoot -Recurse -Force -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
Assert-SourceClean

$runScriptsName = -join ([char[]](0x8fd0, 0x884c, 0x811a, 0x672c))
$workspaceRoot = if ((Split-Path -Leaf (Split-Path -Parent $agentRoot)) -eq "watersupplyassessment") { Split-Path -Parent (Split-Path -Parent $agentRoot) } else { Split-Path -Parent $agentRoot }
$runtimeRoot = if ($env:WATERSUPPLY_RUNTIME_DIR) { $env:WATERSUPPLY_RUNTIME_DIR } else { Join-Path (Join-Path $workspaceRoot $runScriptsName) "watersupply-agent-runtime" }
$resultPath = Join-Path (Join-Path $runtimeRoot "test-results") "preflight-delivery-summary.json"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $resultPath) | Out-Null
$result | ConvertTo-Json -Depth 8 | Out-File -LiteralPath $resultPath -Encoding utf8
$result
