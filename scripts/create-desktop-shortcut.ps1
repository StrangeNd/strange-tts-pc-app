$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "Strange TTS PC App.lnk"
$OpenScript = Join-Path $AppDir "scripts\open-desktop-app.ps1"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$OpenScript`""
$shortcut.WorkingDirectory = $AppDir
$shortcut.WindowStyle = 7

$iconPng = Join-Path $AppDir "extension\assets\icons\icon128.png"
$iconDir = Join-Path $AppDir "assets"
$iconIco = Join-Path $iconDir "strange-tts.ico"
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null
if ((Test-Path $iconPng) -and (Test-Path $iconIco)) {
  Remove-Item -LiteralPath $iconIco -Force -ErrorAction SilentlyContinue
}
if (Test-Path $iconPng) {
  try {
    Add-Type -AssemblyName System.Drawing
    $src = [System.Drawing.Image]::FromFile($iconPng)
    $bmp = New-Object System.Drawing.Bitmap $src, 64, 64
    $handle = $bmp.GetHicon()
    $ico = [System.Drawing.Icon]::FromHandle($handle)
    $fs = [System.IO.File]::Open($iconIco, [System.IO.FileMode]::Create)
    $ico.Save($fs)
    $fs.Close()
    $src.Dispose()
    $bmp.Dispose()
  } catch {
    Write-Warning "Could not create .ico from PNG: $($_.Exception.Message)"
  }
}

if (Test-Path $iconIco) {
  $shortcut.IconLocation = $iconIco
} elseif (Test-Path $iconPng) {
  $shortcut.IconLocation = $iconPng
}

$shortcut.Description = "Open Strange TTS PC App desktop window"
$shortcut.Save()

Write-Host "[Strange TTS PC App] Desktop shortcut created: $ShortcutPath"
