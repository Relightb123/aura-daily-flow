@echo off
cd /d "%~dp0"

echo Initializing Git...
git config user.email "user@example.com"
git config user.name "Aura User"
git init
git add .
git commit -m "Aura: Daily Flow - Production build"

echo.
echo ========================================
echo Repository created!
echo.
echo Next steps:
echo 1. Go to https://github.com/new
echo 2. Create a new repository called "aura-daily-flow"
echo 3. Run these commands:
echo.
echo   git branch -M main
echo   git remote add origin https://github.com/YOUR_USERNAME/aura-daily-flow.git
echo   git push -u origin main
echo.
echo 4. Then go to https://vercel.com and import the repo
echo ========================================
pause