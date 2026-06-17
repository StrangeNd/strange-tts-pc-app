param(
  [switch]$Launch,
  [int]$Port = 48731
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
Set-Location $AppDir

$argsList = @("scripts/start-pc-app.mjs", "--production", "--port=$Port")
if ($Launch) {
  $argsList += "--launch"
}

node @argsList
