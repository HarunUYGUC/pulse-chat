# PulseChat One-Click Launcher for Windows PowerShell
$root = $PSScriptRoot
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting PulseChat - Real-Time Chat & Collaboration" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Starting Backend (ASP.NET Core 9 on http://localhost:5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; dotnet run --urls http://localhost:5000"

Write-Host "Waiting for backend service to initialize..." -ForegroundColor DarkGray
Start-Sleep -Seconds 2

Write-Host "Starting Frontend (React + Vite on http://localhost:5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host ""
Write-Host "PulseChat launched successfully!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend:  http://localhost:5000" -ForegroundColor Cyan
