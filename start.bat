@echo off
echo ========================================================
echo Starting PulseChat - Real-Time Chat & Collaboration
echo ========================================================
echo.

echo Starting ASP.NET Core Web API (Backend) on http://0.0.0.0:5000 ...
start "PulseChat Backend" cmd /k "cd /d ""%~dp0backend"" && dotnet run --urls http://0.0.0.0:5000"

echo Waiting for backend service to initialize...
timeout /t 2 /nobreak >nul

echo Starting React + Vite (Frontend) on http://localhost:5173 ...
start "PulseChat Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo PulseChat is booting up!
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo.
pause
