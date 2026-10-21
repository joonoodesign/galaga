@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo 🚀 전준우의 갤러그 (CAPTAIN JUNWOO GALAGA) GitHub 배포
echo ========================================================
git add .
git commit -m "Update Captain Junwoo Galaga with exit controls" 2>nul
git push -u origin main --force
git push -u origin db-store --force
echo.
echo ✅ 배포가 완료되었습니다!
echo 🌐 접속 주소: https://joonoodesign.github.io/galaga/
start "" "https://joonoodesign.github.io/galaga/"
pause
