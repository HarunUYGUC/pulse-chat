@echo off
echo ========================================================
echo Stopping PulseChat Servers...
echo ========================================================
echo.

taskkill /F /IM PulseChat.Api.exe >nul 2>&1
taskkill /F /IM dotnet.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo.
echo All PulseChat backend and frontend servers have been stopped!
echo.
pause
