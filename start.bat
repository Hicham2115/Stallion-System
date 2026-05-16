@echo off
echo ==========================================
echo   Stallion Advertising - Starting...
echo ==========================================
echo.
echo Backend: http://localhost:5000
echo Frontend: http://localhost:5173
echo.

start "Stallion Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 3 /nobreak > nul
start "Stallion Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Servers starting in separate windows...
echo.
timeout /t 5 /nobreak > nul
start "" "http://localhost:5173"
