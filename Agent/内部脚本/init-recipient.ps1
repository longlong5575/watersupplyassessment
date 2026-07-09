$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentRoot = Split-Path -Parent $scriptRoot
$agentParent = Split-Path -Parent $agentRoot
$workspaceRoot = if ((Split-Path -Leaf $agentParent) -eq "watersupplyassessment") { Split-Path -Parent $agentParent } else { $agentParent }
$runScriptsName = -join ([char[]](0x8fd0, 0x884c, 0x811a, 0x672c))
$runtimeRoot = if ($env:WATERSUPPLY_RUNTIME_DIR) { $env:WATERSUPPLY_RUNTIME_DIR } else { Join-Path (Join-Path $workspaceRoot $runScriptsName) "watersupply-agent-runtime" }
$backend = Join-Path $agentRoot "backend"
$front = Join-Path (Join-Path $agentRoot "frontend") "front"
$mobile = Join-Path (Join-Path $agentRoot "frontend") "front-mobile"
$runtimeBackend = Join-Path $runtimeRoot "backend"
$runtimeFront = Join-Path (Join-Path $runtimeRoot "frontend") "front"
$runtimeMobile = Join-Path (Join-Path $runtimeRoot "frontend") "front-mobile"

function Require-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { throw "缺少必要命令：$name" }
}

function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  if (Get-Command "pnpm" -ErrorAction SilentlyContinue) { & pnpm @Arguments; return }
  if (Get-Command "npx" -ErrorAction SilentlyContinue) { & npx --yes pnpm@10.12.1 @Arguments; return }
  throw "Node.js with npm/npx is required to initialize the frontends."
}

function Initialize-Frontend([string]$directory) {
  $example = Join-Path $directory ".env.example"
  $local = Join-Path $directory ".env.local"
  if ((Test-Path -LiteralPath $example) -and -not (Test-Path -LiteralPath $local)) { Copy-Item -LiteralPath $example -Destination $local }
  $nodeModules = Join-Path $directory "node_modules"
  $marker = Join-Path $nodeModules ".watersupply-deps.sha256"
  $dependencyFiles = @("package.json", "pnpm-lock.yaml") | ForEach-Object { Join-Path $directory $_ } | Where-Object { Test-Path -LiteralPath $_ }
  $dependencyHash = ($dependencyFiles | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash }) -join ":"
  if ((Test-Path -LiteralPath $nodeModules) -and (Test-Path -LiteralPath $marker)) {
    $cachedHash = (Get-Content -LiteralPath $marker -Raw).Trim()
    if ($cachedHash -eq $dependencyHash) { return }
  }
  Push-Location $directory
  try {
    Invoke-Pnpm install --frozen-lockfile
    New-Item -ItemType Directory -Force -Path $nodeModules | Out-Null
    Set-Content -LiteralPath $marker -Value $dependencyHash -Encoding ASCII
  }
  finally { Pop-Location }
}

function Sync-RuntimeFrontend([string]$source, [string]$target) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  robocopy $source $target /MIR /XD node_modules dist .vite /XF .env.local *.log *.pid /R:2 /W:1 | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "准备前端运行副本失败：$source" }
}

function Install-PythonRequirements {
  param([string]$PythonExe, [string]$TargetDir)
  New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
  $requirements = Join-Path (Get-Location) "requirements.txt"
  $marker = Join-Path $TargetDir ".requirements.sha256"
  $requirementsHash = (Get-FileHash -LiteralPath $requirements -Algorithm SHA256).Hash
  if (Test-Path -LiteralPath (Join-Path $TargetDir "fastapi")) {
    $cachedHash = if (Test-Path -LiteralPath $marker) { (Get-Content -LiteralPath $marker -Raw).Trim() } else { "" }
    if ($cachedHash -eq $requirementsHash) { return }
    $previousPythonPath = $env:PYTHONPATH
    $env:PYTHONPATH = (($TargetDir, $previousPythonPath) | Where-Object { $_ }) -join ";"
    try {
      & $PythonExe -c "import fastapi, uvicorn, multipart, docx, fitz, sqlalchemy, alembic, psycopg, celery, pydantic_settings, httpx"
    }
    finally {
      $env:PYTHONPATH = $previousPythonPath
    }
    if ($LASTEXITCODE -eq 0) {
      Set-Content -LiteralPath $marker -Value $requirementsHash -Encoding ASCII
      return
    }
  }
  & $PythonExe -m pip --version | Out-Null
  if ($LASTEXITCODE -ne 0) {
    & $PythonExe -m ensurepip --upgrade
    if ($LASTEXITCODE -ne 0) { throw "Python pip initialization failed." }
  }
  & $PythonExe -m pip install --disable-pip-version-check --upgrade --target $TargetDir -r requirements.txt
  if ($LASTEXITCODE -ne 0) {
    & $PythonExe -m pip install --disable-pip-version-check --upgrade --target $TargetDir --timeout 30 --retries 2 -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed." }
  }
  Set-Content -LiteralPath $marker -Value $requirementsHash -Encoding ASCII
}

Require-Command "node"

$python312 = $env:PYTHON312_EXE
if (-not $python312 -or -not (Test-Path -LiteralPath $python312)) {
  $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"
  if (Test-Path -LiteralPath $candidate) { $python312 = $candidate }
  else { $python312 = (& py -3.12 -c "import sys; print(sys.executable)").Trim() }
}

Push-Location $backend
try {
  New-Item -ItemType Directory -Force -Path $runtimeBackend | Out-Null
  $pythonPackages = Join-Path $runtimeBackend "python-packages"
  Install-PythonRequirements $python312 $pythonPackages
}
finally { Pop-Location }

Sync-RuntimeFrontend $front $runtimeFront
Sync-RuntimeFrontend $mobile $runtimeMobile
Initialize-Frontend $runtimeFront
Initialize-Frontend $runtimeMobile
