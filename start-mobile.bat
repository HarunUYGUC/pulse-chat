@echo off
echo ========================================================
echo Starting PulseChat Mobile Client (Expo SDK 57)
echo ========================================================
echo.
echo Make sure your backend is running (run start.bat first).
echo.
cd /d "%~dp0mobile"
npx expo start
