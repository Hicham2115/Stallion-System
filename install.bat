@echo off
echo ==========================================
echo   Stallion Advertising - First Time Setup
echo ==========================================
echo.

echo [1/4] Installing backend dependencies...
cd /d "%~dp0backend"
call npm install
if errorlevel 1 (echo ERROR: Backend install failed & pause & exit /b 1)

echo.
echo [2/4] Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 (echo ERROR: Frontend install failed & pause & exit /b 1)

echo.
echo [3/4] Setting up environment file...
cd /d "%~dp0backend"
if not exist ".env" (
  copy ".env.example" ".env"
  echo .env file created. Please edit backend\.env with your database credentials.
) else (
  echo .env already exists, skipping.
)

echo.
echo ==========================================
echo   Installation complete!
echo ==========================================
echo.
echo NEXT STEPS:
echo   1. Edit backend\.env with your PostgreSQL credentials
echo   2. Run: setup-database.bat
echo   3. Run: start.bat
echo.
pause
