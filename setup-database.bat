@echo off
echo ==========================================
echo   Stallion - Database Setup
echo ==========================================
echo.

cd /d "%~dp0backend"

echo [1/3] Generating Prisma client...
call npm run db:generate
if errorlevel 1 (echo ERROR & pause & exit /b 1)

echo.
echo [2/3] Running database migrations...
call npm run db:migrate
if errorlevel 1 (echo ERROR & pause & exit /b 1)

echo.
echo [3/3] Seeding demo data...
call npm run db:seed
if errorlevel 1 (echo ERROR & pause & exit /b 1)

echo.
echo ==========================================
echo   Database ready!
echo ==========================================
echo.
echo Demo logins:
echo   CEO:    ceo@stallion.com  /  admin123
echo   Staff:  sara@stallion.com / member123
echo.
pause
