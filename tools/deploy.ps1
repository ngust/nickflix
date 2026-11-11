# Package (sign) and install NickFlix on a Samsung TV with the Tizen CLI.
# Prereqs: Tizen Studio CLI, a Samsung certificate profile (Certificate Manager), TV in Developer Mode,
#          and `sdb connect <tv-ip>` done once (sdb devices should list the TV).
param(
  [string]$Zip       = "$PSScriptRoot\..\dist\nickflix.zip",
  [string]$BuildDir  = "$env:TEMP\nickflix-build",
  [string]$Profile   = $env:NF_CERT_PROFILE,      # your Tizen security profile name
  [string]$Target    = $env:NF_TV_TARGET,         # TV name as shown by `sdb devices` / `tizen` target
  [string]$AppId     = "NgustIbTv1.ibtv",
  [string]$Tizen     = "C:\Tizen\sdk\tools\ide\bin\tizen.bat"
)
if (-not $Profile -or -not $Target) { throw "Set -Profile and -Target (or NF_CERT_PROFILE / NF_TV_TARGET)." }
New-Item -ItemType Directory -Force $BuildDir | Out-Null
Set-Location $BuildDir
Remove-Item * -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Force $Zip -DestinationPath $BuildDir
& $Tizen package -t wgt -s $Profile 2>&1 | Select-String 'Package File'
& $Tizen install -n NickFlix.wgt -t $Target 2>&1 | Select-String 'successfully|error|fail'
& $Tizen run -p $AppId -t $Target 2>&1 | Select-String 'success|error|fail'
