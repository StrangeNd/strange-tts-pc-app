$ErrorActionPreference = "Stop"

$Port = 48731
$connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

if (-not $connections) {
  Write-Host "[Strange TTS PC App] Not running on 127.0.0.1:$Port"
  exit 0
}

$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pidValue in $pids) {
  try {
    $proc = Get-Process -Id $pidValue -ErrorAction Stop
    Stop-Process -Id $pidValue -Force
    Write-Host "[Strange TTS PC App] Stopped PID $pidValue ($($proc.ProcessName))"
  } catch {
    Write-Host "[Strange TTS PC App] PID $pidValue was already stopped"
  }
}
