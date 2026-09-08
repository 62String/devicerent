param(
  [string]$ApiBaseUrl = "http://localhost:4000",
  [string]$ExcelPath = "seed-data\DeviceRent_release_devices_2026-09-08.xlsx",
  [Parameter(Mandatory = $true)]
  [string]$AdminId,
  [Parameter(Mandatory = $true)]
  [string]$Password,
  [switch]$ForceInit
)

$ErrorActionPreference = "Stop"

$resolvedExcelPath = Resolve-Path -LiteralPath $ExcelPath
$normalizedApiBaseUrl = $ApiBaseUrl.TrimEnd("/")

Write-Host "DeviceRent device import"
Write-Host "API: $normalizedApiBaseUrl"
Write-Host "Excel: $resolvedExcelPath"
Write-Host "Force init: $($ForceInit.IsPresent)"

$loginBody = @{
  id = $AdminId
  password = $Password
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod `
  -Method Post `
  -Uri "$normalizedApiBaseUrl/api/auth/login" `
  -ContentType "application/json" `
  -Body $loginBody

if (-not $loginResponse.token) {
  throw "Login succeeded but token was not returned."
}

$headers = @{
  Authorization = "Bearer $($loginResponse.token)"
}

$forceValue = if ($ForceInit.IsPresent) { "true" } else { "false" }
$uploadResponse = & curl.exe `
  -sS `
  -X POST `
  "$normalizedApiBaseUrl/api/admin/upload-devices" `
  -H "Authorization: $($headers.Authorization)" `
  -F "force=$forceValue" `
  -F "excelFile=@$resolvedExcelPath;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

if ($LASTEXITCODE -ne 0) {
  throw "Excel upload failed. curl exit code: $LASTEXITCODE"
}

Write-Host "Import completed."
$uploadResponse
