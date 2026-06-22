 [CmdletBinding(PositionalBinding = $false)]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Command,
  [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

function Convert-UncWslPath {
  param([string]$Path)

  $withoutProvider = $Path -replace "^Microsoft\.PowerShell\.Core\\FileSystem::", ""
  $normalized = $withoutProvider -replace "/", "\"
  $patterns = @(
    '^\\\\wsl\.localhost\\([^\\]+)\\(.+)$',
    '^\\\\wsl\$\\([^\\]+)\\(.+)$'
  )

  foreach ($pattern in $patterns) {
    if ($normalized -match $pattern) {
      $script:distroFromPath = $Matches[1]
      $rest = $Matches[2] -replace "\\", "/"
      return "/$rest"
    }
  }

  throw "Repo path is not a WSL UNC path. Open this helper from \\wsl.localhost\<distro>\... or run commands directly in WSL."
}

function Quote-BashString {
  param([string]$Value)
  return "'" + ($Value -replace "'", "'\''") + "'"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoRootPath = if ($repoRoot.ProviderPath) { $repoRoot.ProviderPath } else { $repoRoot.Path }
$repoRootPath = [System.IO.Path]::GetFullPath($repoRootPath)
$distroFromPath = $null
$wslRepoPath = Convert-UncWslPath -Path $repoRootPath

if ($distroFromPath) {
  $Distro = $distroFromPath
}

$bashCommand = if ($Command.Count -gt 0) {
  $Command -join " "
} else {
  "bash scripts/agent-healthcheck.sh"
}

$quotedRepoPath = Quote-BashString -Value $wslRepoPath
$fullCommand = "cd $quotedRepoPath && $bashCommand"

Write-Host "Running in WSL distro '$Distro': $bashCommand"
Write-Host "Repo: $wslRepoPath"

& wsl.exe -d $Distro --exec /bin/bash -lc $fullCommand
exit $LASTEXITCODE
