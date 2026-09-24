# PulseChat Mobile Launcher for Windows PowerShell
$root = $PSScriptRoot
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting PulseChat Mobile Client (Expo SDK 57)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ensure the backend is running (run .\start.ps1 first)." -ForegroundColor Yellow
Write-Host "Starting Expo development server..." -ForegroundColor DarkGray
Write-Host ""

Set-Location "$root\mobile"
npx expo start
