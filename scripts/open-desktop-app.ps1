$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Port = 48731
$Url = "http://127.0.0.1:$Port"
$LogDir = Join-Path $AppDir "data\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Test-AppHealth {
  try {
    $health = Invoke-RestMethod -Uri "$Url/api/health" -Method Get -TimeoutSec 2
    return ($health.ok -eq $true -and $health.app -eq "Strange TTS PC App")
  } catch {
    return $false
  }
}

if (-not (Test-AppHealth)) {
  Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("start") `
    -WorkingDirectory $AppDir `
    -RedirectStandardOutput (Join-Path $LogDir "desktop-start.out.log") `
    -RedirectStandardError (Join-Path $LogDir "desktop-start.err.log") `
    -WindowStyle Hidden | Out-Null

  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-AppHealth) {
      $ready = $true
      break
    }
  }
  if (-not $ready) {
    throw "Strange TTS PC App did not start on $Url. Check data\logs\desktop-start.err.log"
  }
}

$payload = @{ profileName = "default" } | ConvertTo-Json -Compress
$lastError = $null
for ($attempt = 1; $attempt -le 2; $attempt++) {
  try {
    $launch = Invoke-RestMethod `
      -Uri "$Url/api/app/open-dashboard-app" `
      -Method Post `
      -ContentType "application/json" `
      -Body $payload `
      -TimeoutSec 45

    $launchLogPath = Join-Path $LogDir "desktop-app-dashboard.json"
    $launch | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $launchLogPath -Encoding UTF8

    if (($launch.ok -ne $true) -or (-not $launch.result.appUrl)) {
      throw "PC dashboard app window was not returned by local API."
    }

    Write-Host "[Strange TTS PC App] PC dashboard app window opened: $($launch.result.appUrl)"
    exit 0
  } catch {
    $lastError = $_
    if ($attempt -lt 2) {
      Start-Sleep -Seconds 2
    }
  }
}

throw "Cannot open Strange TTS PC dashboard app window. Local API is $Url. $($lastError.Exception.Message)"
