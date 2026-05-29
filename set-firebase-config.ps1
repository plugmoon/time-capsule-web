$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $root "firebase-config.js"
$clipboard = [System.Windows.Forms.Clipboard]::GetText()

if (-not $clipboard) {
  throw "Clipboard is empty. Copy the Firebase config object first."
}

function Read-ConfigValue {
  param(
    [string]$Text,
    [string]$Name
  )

  $pattern = "$Name\s*:\s*['""]([^'""]+)['""]"
  $match = [regex]::Match($Text, $pattern)
  if ($match.Success) {
    return $match.Groups[1].Value
  }

  return ""
}

$config = [ordered]@{
  apiKey            = Read-ConfigValue -Text $clipboard -Name "apiKey"
  authDomain        = Read-ConfigValue -Text $clipboard -Name "authDomain"
  projectId         = Read-ConfigValue -Text $clipboard -Name "projectId"
  storageBucket     = Read-ConfigValue -Text $clipboard -Name "storageBucket"
  messagingSenderId = Read-ConfigValue -Text $clipboard -Name "messagingSenderId"
  appId             = Read-ConfigValue -Text $clipboard -Name "appId"
  measurementId     = Read-ConfigValue -Text $clipboard -Name "measurementId"
}

$required = @("apiKey", "authDomain", "projectId", "appId")
foreach ($key in $required) {
  if (-not $config[$key]) {
    throw "Missing Firebase config field: $key"
  }
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("window.TIME_CAPSULE_FIREBASE_CONFIG = {")
foreach ($entry in $config.GetEnumerator()) {
  if ($entry.Value) {
    $safeValue = $entry.Value.Replace("\", "\\").Replace('"', '\"')
    $lines.Add("  $($entry.Key): ""$safeValue"",")
  }
}
$lines.Add("};")

[IO.File]::WriteAllText($target, ($lines -join [Environment]::NewLine), [Text.UTF8Encoding]::new($false))

Write-Host "Firebase config updated:"
Write-Host $target
