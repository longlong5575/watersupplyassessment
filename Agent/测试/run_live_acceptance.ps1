$ErrorActionPreference = "Stop"
$agentRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$workspaceRoot = if ((Split-Path -Leaf (Split-Path -Parent $agentRoot)) -eq "watersupplyassessment") { Split-Path -Parent (Split-Path -Parent $agentRoot) } else { Split-Path -Parent $agentRoot }
$runtimeRoot = Join-Path (Join-Path $workspaceRoot "运行脚本") "watersupply-agent-runtime"
$pythonExe = if ($env:PYTHON312_EXE) { $env:PYTHON312_EXE } else { Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe" }
$env:PYTHONPATH = ((Join-Path $runtimeRoot "backend\python-packages-current"), $env:PYTHONPATH | Where-Object { $_ }) -join ";"
& $pythonExe (Join-Path $PSScriptRoot "live_full_acceptance.py")
if ($LASTEXITCODE -ne 0) { throw "真实全流程验收失败，退出码：$LASTEXITCODE" }
$reportRoot = Join-Path $runtimeRoot "test-results\live-full-acceptance"
& $pythonExe (Join-Path $PSScriptRoot "check_report_quality.py") --report-root $reportRoot --all-reports
if ($LASTEXITCODE -ne 0) { throw "真实报告质量检查失败，退出码：$LASTEXITCODE" }