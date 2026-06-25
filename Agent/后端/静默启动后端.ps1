$backend = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonw = Join-Path $backend ".venv\Scripts\pythonw.exe"
$launcher = Join-Path $backend "start_backend_silent.py"

if (-not (Test-Path -LiteralPath $pythonw)) {
  throw "Backend virtual environment was not found."
}

& $pythonw $launcher
Write-Host "Backend started silently: http://127.0.0.1:8000/docs"
